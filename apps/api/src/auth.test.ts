import { createTestDatabase } from '@mathgo/db/testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
  signingKey,
} from './tokens.js';

interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: { id: string; nickname: string; birthYear: number; trophies: number };
}

const config = loadConfig({ LOG_LEVEL: 'silent' });
const database = await createTestDatabase();
let clock = new Date('2026-11-02T08:00:00Z');
const app = buildApp(config, { db: database.db, now: () => clock });

afterAll(async () => {
  await app.close();
  await database.close();
});

beforeEach(() => {
  clock = new Date('2026-11-02T08:00:00Z');
});

const advance = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};

const newGuest = async (birthYear = 2010) => {
  const res = await app.inject({ method: 'POST', url: '/auth/guest', payload: { birthYear } });
  return { res, session: res.json<Session>() };
};

const me = (token: string) =>
  app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });

const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });

const codeOf = (res: { json: () => unknown }) =>
  (res.json() as { error: { code: string } }).error.code;

describe('Done when: a new install gets a token; refresh works after expiry', () => {
  it('guest → token works → token expires → refresh → new token works', async () => {
    const { res, session } = await newGuest();
    expect(res.statusCode).toBe(201);
    expect(session.user).toMatchObject({ birthYear: 2010, trophies: 0 });
    expect((await me(session.accessToken)).json()).toEqual(session.user);

    advance(ACCESS_TOKEN_TTL_SECONDS * 1000 + 1);
    const expired = await me(session.accessToken);
    expect(expired.statusCode).toBe(401);
    expect(codeOf(expired)).toBe('token-expired');

    const renewed = await refresh(session.refreshToken);
    expect(renewed.statusCode).toBe(200);
    const next = renewed.json<Session>();
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect((await me(next.accessToken)).json()).toEqual(session.user);
  });
});

describe('POST /auth/guest', () => {
  it('returns tokens with their expiry times and a placeholder nickname', async () => {
    const { session } = await newGuest();
    expect(session.accessTokenExpiresAt).toBe('2026-11-02T08:15:00.000Z');
    expect(session.refreshTokenExpiresAt).toBe(
      new Date(clock.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    );
    expect(session.user.nickname).toMatch(/^Pemain \d{4}$/);
  });

  it('creates a different account for each install', async () => {
    const [a, b] = [await newGuest(), await newGuest()];
    expect(a.session.user.id).not.toBe(b.session.user.id);
  });

  it('rejects a missing, non-integer or impossible birth year', async () => {
    for (const payload of [
      {},
      { birthYear: 2010.5 },
      { birthYear: 'soon' },
      { birthYear: 2010, extra: 1 },
    ]) {
      const res = await app.inject({ method: 'POST', url: '/auth/guest', payload });
      expect(res.statusCode).toBe(400);
      expect(codeOf(res)).toBe('invalid-request');
    }
    for (const birthYear of [1800, 2027]) {
      const res = await app.inject({ method: 'POST', url: '/auth/guest', payload: { birthYear } });
      expect(codeOf(res)).toBe('invalid-birth-year');
    }
  });
});

describe('POST /auth/refresh', () => {
  it('each refresh token works once; reusing it ends every session of that user', async () => {
    const { session } = await newGuest();
    const first = (await refresh(session.refreshToken)).json<Session>();

    const replay = await refresh(session.refreshToken);
    expect(replay.statusCode).toBe(401);
    expect(codeOf(replay)).toBe('invalid-refresh-token');
    // The newer token was revoked with it, so a thief and the owner both have to sign in again.
    expect(codeOf(await refresh(first.refreshToken))).toBe('invalid-refresh-token');
  });

  it('an expired or unknown refresh token is refused', async () => {
    const { session } = await newGuest();
    advance(REFRESH_TOKEN_TTL_MS + 1);
    expect(codeOf(await refresh(session.refreshToken))).toBe('invalid-refresh-token');
    expect(codeOf(await refresh('not-a-token'))).toBe('invalid-refresh-token');
  });
});

describe('GET /me', () => {
  it('needs a valid bearer access token', async () => {
    expect(codeOf(await app.inject({ method: 'GET', url: '/me' }))).toBe('invalid-token');
    expect(codeOf(await me('garbage'))).toBe('invalid-token');
    const { session } = await newGuest();
    // A refresh token is not an access token.
    expect(codeOf(await me(session.refreshToken))).toBe('invalid-token');
  });

  it('refuses a token signed with another key', async () => {
    const { session } = await newGuest();
    const forged = await signAccessToken(
      session.user.id,
      signingKey('another-secret-that-is-long-enough-000'),
      clock,
    );
    expect(codeOf(await me(forged.token))).toBe('invalid-token');
  });
});
