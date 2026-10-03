import type { ApiErrorBody, ConsentStarted, Profile, Session } from './types';
import type { TokenStore } from './token-store';

/** An api error with its stable code, e.g. `consent-required` or `nickname-not-allowed`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Extra facts some errors carry (S5-05): wrong codes left, when to try again. */
    readonly details: { readonly attemptsLeft?: number; readonly retryAt?: string } = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The refresh token was refused: the player needs a new session (S3-08's first launch). */
export class SessionEndedError extends ApiError {
  constructor() {
    super(401, 'session-ended', 'Sign in again.');
    this.name = 'SessionEndedError';
  }
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly store: TokenStore;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

/** Refresh this long before the access token's expiry, to cover clock skew and latency. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Talks to apps/api. Adds the access token to every call and refreshes it without the player
 * noticing: before it expires, and once more on a 401. Concurrent calls share one refresh, so a
 * one-time refresh token is never spent twice.
 */
export class ApiClient {
  private refreshing: Promise<Session> | null = null;
  private readonly now: () => Date;

  constructor(private readonly options: ApiClientOptions) {
    this.now = options.now ?? (() => new Date());
  }

  /** Looked up on each call, not kept: the global can be replaced later (tests, polyfills). */
  private get fetch(): typeof fetch {
    return this.options.fetch ?? globalThis.fetch;
  }

  get session(): Session | null {
    return this.options.store.get();
  }

  /** Forgets the session on this device. */
  signOut(): void {
    this.options.store.clear();
  }

  async signUpGuest(birthYear: number): Promise<Session> {
    const session = await this.call<Session>('POST', '/auth/guest', { birthYear });
    this.options.store.set(session);
    return session;
  }

  /** A parent asks for a code by email, for a child born in `birthYear` (S5-05, S5-09). */
  startConsent(email: string, birthYear: number): Promise<ConsentStarted> {
    return this.call<ConsentStarted>('POST', '/consent/start', { email, birthYear });
  }

  /** The parent's code: right, and the child's account exists with online play unlocked. */
  async verifyConsent(consentId: string, code: string): Promise<Session> {
    const session = await this.call<Session>('POST', '/consent/verify', { consentId, code });
    this.options.store.set(session);
    return session;
  }

  me(): Promise<Profile> {
    return this.authed<Profile>('GET', '/me');
  }

  nicknames(lang: 'id' | 'en'): Promise<{ nicknames: string[] }> {
    return this.call('GET', `/nicknames?lang=${lang}`);
  }

  setNickname(nickname: string): Promise<Profile> {
    return this.authed<Profile>('PATCH', '/me/nickname', { nickname });
  }

  /**
   * The current access token, refreshed first if it has (nearly) expired, or always when
   * `forceRefresh` (the server said `token-expired`).
   */
  async accessToken(forceRefresh = false): Promise<string> {
    const session = this.session;
    if (session === null) throw new SessionEndedError();
    const expiresAt = Date.parse(session.accessTokenExpiresAt);
    if (forceRefresh || expiresAt - EXPIRY_MARGIN_MS <= this.now().getTime()) {
      return (await this.refresh()).accessToken;
    }
    return session.accessToken;
  }

  private async authed<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.accessToken();
    try {
      return await this.call<T>(method, path, body, token);
    } catch (error) {
      // The server says no (e.g. its clock is ahead): refresh once and try again.
      if (
        error instanceof ApiError &&
        (error.code === 'token-expired' || error.code === 'invalid-token')
      ) {
        const fresh = await this.refresh();
        return this.call<T>(method, path, body, fresh.accessToken);
      }
      throw error;
    }
  }

  private refresh(): Promise<Session> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<Session> {
    const current = this.session;
    if (current === null) throw new SessionEndedError();
    try {
      const next = await this.call<Session>('POST', '/auth/refresh', {
        refreshToken: current.refreshToken,
      });
      this.options.store.set(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.options.store.clear();
        throw new SessionEndedError();
      }
      throw error;
    }
  }

  private async call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token !== undefined) headers['authorization'] = `Bearer ${token}`;
    const res = await this.fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      const { error } = json as ApiErrorBody;
      throw new ApiError(res.status, error.code, error.message, {
        ...(error.attemptsLeft === undefined ? {} : { attemptsLeft: error.attemptsLeft }),
        ...(error.retryAt === undefined ? {} : { retryAt: error.retryAt }),
      });
    }
    return json as T;
  }
}
