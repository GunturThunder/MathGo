import { createMMKV } from 'react-native-mmkv';
import {
  ApiClient,
  ApiError,
  REQUEST_TIMEOUT_MS,
  RequestTimeoutError,
  SessionEndedError,
} from './client';
import { createTokenStore } from './token-store';
import type { Profile, Session } from './types';

const ACCESS_TTL_MS = 15 * 60_000;

/** Just enough of apps/api: 15-minute access tokens, one-time refresh tokens, its own clock. */
class FakeApi {
  serverNow = new Date('2026-11-02T08:00:00Z').getTime();
  refreshCalls = 0;
  private counter = 0;
  private readonly access = new Map<string, number>(); // token → expiry
  private readonly refresh = new Set<string>();
  private readonly user: Profile = {
    id: 'u1',
    nickname: 'Harimau Cepat',
    birthYear: 2000,
    trophies: 0,
    online: true,
  };

  private issue(): Session {
    const n = ++this.counter;
    const expiresAt = this.serverNow + ACCESS_TTL_MS;
    this.access.set(`access-${n}`, expiresAt);
    this.refresh.add(`refresh-${n}`);
    return {
      accessToken: `access-${n}`,
      accessTokenExpiresAt: new Date(expiresAt).toISOString(),
      refreshToken: `refresh-${n}`,
      refreshTokenExpiresAt: new Date(this.serverNow + 30 * 86_400_000).toISOString(),
      user: this.user,
    };
  }

  fetch = (async (url: string, init?: RequestInit) => {
    const path = url.replace('http://api.test', '');
    const body = init?.body === undefined ? {} : JSON.parse(String(init.body));
    const reply = (status: number, json: unknown) =>
      ({ ok: status < 400, status, json: async () => json }) as Response;
    const error = (status: number, code: string) =>
      reply(status, { error: { code, message: code, requestId: 'r' } });

    if (path === '/auth/guest') return reply(201, this.issue());
    if (path === '/auth/refresh') {
      this.refreshCalls++;
      if (!this.refresh.delete(body.refreshToken)) return error(401, 'invalid-refresh-token');
      return reply(200, this.issue());
    }
    if (path === '/me') {
      const token = String((init?.headers as Record<string, string>)['authorization']).replace(
        'Bearer ',
        '',
      );
      const expiry = this.access.get(token);
      if (expiry === undefined) return error(401, 'invalid-token');
      if (expiry <= this.serverNow) return error(401, 'token-expired');
      return reply(200, this.user);
    }
    return error(404, 'not-found');
  }) as typeof fetch;
}

const setup = () => {
  const api = new FakeApi();
  const store = createTokenStore(createMMKV({ id: `test-${Math.random()}` }));
  let appNow = api.serverNow;
  const client = () =>
    new ApiClient({
      baseUrl: 'http://api.test',
      store,
      fetch: api.fetch,
      now: () => new Date(appNow),
    });
  const advance = (ms: number) => {
    appNow += ms;
    api.serverNow += ms;
  };
  return { api, store, client, advance, skewServer: (ms: number) => (api.serverNow += ms) };
};

describe('ApiClient (S3-10)', () => {
  it('Done when: the token survives an app restart', async () => {
    const { store, client } = setup();
    await client().signUpGuest(2000);
    expect(store.get()?.user.nickname).toBe('Harimau Cepat');

    // A new client on the same storage: what the app sees after a restart.
    const afterRestart = client();
    expect(afterRestart.session?.accessToken).toBe('access-1');
    await expect(afterRestart.me()).resolves.toMatchObject({ id: 'u1' });
  });

  it('Done when: refresh is invisible — an expired token is renewed before the call', async () => {
    const { api, store, client, advance } = setup();
    const app = client();
    await app.signUpGuest(2000);
    advance(ACCESS_TTL_MS + 1_000);
    await expect(app.me()).resolves.toMatchObject({ nickname: 'Harimau Cepat' });
    expect(api.refreshCalls).toBe(1);
    expect(store.get()?.accessToken).toBe('access-2');
  });

  it('retries once after a 401 when the server clock is ahead of the phone', async () => {
    const { api, client, skewServer } = setup();
    const app = client();
    await app.signUpGuest(2000);
    skewServer(ACCESS_TTL_MS + 1_000); // the phone still thinks its token is fine
    await expect(app.me()).resolves.toMatchObject({ id: 'u1' });
    expect(api.refreshCalls).toBe(1);
  });

  it('shares one refresh between concurrent calls (refresh tokens work once)', async () => {
    const { api, client, advance } = setup();
    const app = client();
    await app.signUpGuest(2000);
    advance(ACCESS_TTL_MS + 1_000);
    const results = await Promise.all([app.me(), app.me(), app.me()]);
    expect(results).toHaveLength(3);
    expect(api.refreshCalls).toBe(1);
  });

  it('ends the session when the refresh token is refused', async () => {
    const { store, client, advance } = setup();
    const app = client();
    await app.signUpGuest(2000);
    store.set({ ...store.get()!, refreshToken: 'stolen-and-used' });
    advance(ACCESS_TTL_MS + 1_000);
    await expect(app.me()).rejects.toBeInstanceOf(SessionEndedError);
    expect(store.get()).toBeNull();
  });

  it('passes other api errors through with their code', async () => {
    const { client } = setup();
    const app = client();
    await app.signUpGuest(2000);
    const error = await app.setNickname('KingSlayer99').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('not-found'); // the fake api has no such route
  });

  it('gives up after 10 seconds when the server never answers (e.g. wrong Wi-Fi)', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    // A fetch that hangs until it is aborted, as an unreachable server does.
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const app = new ApiClient({
      baseUrl: 'http://api.test',
      store: createTokenStore(createMMKV({ id: 'test-timeout' })),
      fetch: hanging,
    });
    const result = app.nicknames('id').catch((e: unknown) => e);
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(await result).toBeInstanceOf(RequestTimeoutError);
    jest.useRealTimers();
  });

  it('a quick answer clears its timer', async () => {
    jest.useFakeTimers();
    const { client } = setup();
    await client().signUpGuest(2000);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('without a session, authed calls end the session instead of calling the api', async () => {
    const { api, client } = setup();
    await expect(client().me()).rejects.toBeInstanceOf(SessionEndedError);
    expect(api.refreshCalls).toBe(0);
  });
});

describe('createTokenStore', () => {
  it('keeps, reads and clears the session; drops unreadable data', () => {
    const storage = createMMKV({ id: 'store-test' });
    const store = createTokenStore(storage);
    expect(store.get()).toBeNull();
    const session = { accessToken: 'a' } as Session;
    store.set(session);
    expect(store.get()).toEqual(session);
    store.clear();
    expect(store.get()).toBeNull();
    storage.set('session', '{not json');
    expect(store.get()).toBeNull();
  });
});
