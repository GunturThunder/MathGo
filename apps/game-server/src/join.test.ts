import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { PROTOCOL_VERSION } from '@mathgo/protocol';
import { describe, expect, it } from 'vitest';
import { authorizeJoin, JoinRefused } from './join.js';

const key = signingKey(DEV_JWT_SECRET);
const now = new Date('2026-11-09T10:00:00Z');

const refusal = async (options: unknown) => {
  try {
    await authorizeJoin(options, key, now);
    return 'ok';
  } catch (error) {
    return error instanceof JoinRefused ? `${error.status} ${error.code}` : 'other';
  }
};

describe('authorizeJoin', () => {
  it('returns the claims of a valid adult token from a current app', async () => {
    const { token } = await signAccessToken({ userId: 'u1', online: true }, key, now);
    expect(await authorizeJoin({ protocolVersion: PROTOCOL_VERSION, token }, key, now)).toEqual({
      userId: 'u1',
      online: true,
    });
  });

  it('refuses an older app before checking anything else, whatever its options look like', async () => {
    expect(await refusal({ protocolVersion: 0 })).toBe('426 update-required');
    expect(await refusal({ protocolVersion: 0, token: 'x', somethingOld: true })).toBe(
      '426 update-required',
    );
  });

  it('refuses options that are not a join request', async () => {
    for (const options of [null, undefined, 'x', {}, { protocolVersion: PROTOCOL_VERSION }]) {
      expect(await refusal(options)).toBe('400 invalid-message');
    }
  });
});
