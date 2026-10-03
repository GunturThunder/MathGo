import { requireOnlinePlay, signingKey, verifyAccessToken } from '@mathgo/auth';
import { eq, parentalConsents, refreshTokens, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { newRefreshToken, REFRESH_TOKEN_TTL_MS } from './tokens.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
const key = signingKey(config.JWT_SECRET);
const database = await createTestDatabase();
const { db } = database;
const now = new Date('2026-11-02T08:00:00Z');
const app = buildApp(config, { db, now: () => now });

afterAll(async () => {
  await app.close();
  await database.close();
});

const codeOf = (res: { json: () => unknown }) =>
  (res.json() as { error: { code: string } }).error.code;

/** A minor's account as the consent flow (S5-05) will create it: user, consent, refresh token. */
async function consentedMinor() {
  const [user] = await db
    .insert(users)
    .values({ nickname: 'Kancil Pintar', birthYear: 2014 })
    .returning();
  if (user === undefined) throw new Error('no user');
  await db
    .insert(parentalConsents)
    .values({ userId: user.id, contactHash: 'hash', channel: 'email' });
  const refresh = newRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
  });
  return { user, refreshToken: refresh.token };
}

const refresh = async (refreshToken: string) => {
  const res = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });
  return res.json<{ accessToken: string; refreshToken: string; user: { online: boolean } }>();
};

describe('under-18 players (S3-04)', () => {
  it('get no account and leave no data without parent consent', async () => {
    const before = await db.$count(users);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { birthYear: 2014 },
    });
    expect(res.statusCode).toBe(403);
    expect(codeOf(res)).toBe('consent-required');
    expect(await db.$count(users)).toBe(before);
  });

  it('treat a player as a minor until the year they turn 19', async () => {
    const turning18 = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { birthYear: 2008 },
    });
    expect(codeOf(turning18)).toBe('consent-required');
    const surely18 = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { birthYear: 2007 },
    });
    expect(surely18.statusCode).toBe(201);
  });

  it('Done when: an under-18 token cannot join matchmaking or rooms', async () => {
    const { user, refreshToken } = await consentedMinor();
    const consented = await refresh(refreshToken);
    expect(consented.user.online).toBe(true);
    const allowed = await verifyAccessToken(consented.accessToken, key, now);
    expect(() => requireOnlinePlay(allowed)).not.toThrow();

    // The parent withdraws consent: the next token no longer allows online play.
    await db
      .update(parentalConsents)
      .set({ revokedAt: now })
      .where(eq(parentalConsents.userId, user.id));
    const revoked = await refresh(consented.refreshToken);
    expect(revoked.user.online).toBe(false);
    const claims = await verifyAccessToken(revoked.accessToken, key, now);
    expect(() => requireOnlinePlay(claims)).toThrow(
      expect.objectContaining({ code: 'consent-required' }),
    );

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${revoked.accessToken}` },
    });
    expect(me.json()).toMatchObject({ birthYear: 2014, online: false });
  });

  it('adults always get online play', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { birthYear: 1990 },
    });
    const { accessToken } = res.json<{ accessToken: string }>();
    expect(() => requireOnlinePlay({ userId: 'x', online: true })).not.toThrow();
    expect((await verifyAccessToken(accessToken, key, now)).online).toBe(true);
  });
});
