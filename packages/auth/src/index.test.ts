import { describe, expect, it } from 'vitest';
import {
  AuthError,
  isAdult,
  requireOnlinePlay,
  signAccessToken,
  signingKey,
  verifyAccessToken,
} from './index.js';

const key = signingKey('test-secret-that-is-long-enough-0123456789');
const now = new Date('2026-11-02T08:00:00Z');

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof AuthError ? error.code : 'other';
  }
};

describe('access tokens', () => {
  it('round-trip the user id and the online claim', async () => {
    for (const online of [true, false]) {
      const { token } = await signAccessToken({ userId: 'u1', online }, key, now);
      expect(await verifyAccessToken(token, key, now)).toEqual({ userId: 'u1', online });
    }
  });

  it('expire after 15 minutes', async () => {
    const { token, expiresAt } = await signAccessToken({ userId: 'u1', online: true }, key, now);
    expect(expiresAt.toISOString()).toBe('2026-11-02T08:15:00.000Z');
    expect(await codeOf(verifyAccessToken(token, key, expiresAt))).toBe('token-expired');
  });

  it('reject another key and garbage', async () => {
    const { token } = await signAccessToken({ userId: 'u1', online: true }, key, now);
    const other = signingKey('another-secret-that-is-long-enough-000000');
    expect(await codeOf(verifyAccessToken(token, other, now))).toBe('invalid-token');
    expect(await codeOf(verifyAccessToken('garbage', key, now))).toBe('invalid-token');
  });
});

describe('Done when: an under-18 token cannot join matchmaking or rooms', () => {
  it('requireOnlinePlay refuses a token without online play with consent-required', async () => {
    const { token } = await signAccessToken({ userId: 'minor', online: false }, key, now);
    const claims = await verifyAccessToken(token, key, now);
    expect(() => requireOnlinePlay(claims)).toThrow(
      expect.objectContaining({ code: 'consent-required' }),
    );
  });

  it('lets adults and consented minors in', async () => {
    const { token } = await signAccessToken({ userId: 'adult', online: true }, key, now);
    expect(() => requireOnlinePlay({ userId: 'adult', online: true })).not.toThrow();
    expect((await verifyAccessToken(token, key, now)).online).toBe(true);
  });
});

describe('isAdult', () => {
  it('counts from the year a player turns 19, the first year they are surely 18', () => {
    expect(isAdult(2007, now)).toBe(true); // 19 in 2026: 18 or 19 today
    expect(isAdult(2008, now)).toBe(false); // 17 or 18 today: treated as a minor
    expect(isAdult(2015, now)).toBe(false);
    expect(isAdult(1980, now)).toBe(true);
  });
});
