import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { PROTOCOL_VERSION } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { openBattle, testDeps } from './test-deps.js';

const now = new Date('2026-11-09T10:00:00Z');
const key = signingKey(DEV_JWT_SECRET);
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        invites: new MemoryInviteStore(),
        recorder: noMatchRecorder,
        now: () => now,
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const token = async (online = true, at = now, secret = key) =>
  (await signAccessToken({ userId: `user-${String(online)}`, online }, secret, at)).token;

/** What the app sees when a join is refused: the status and the protocol error code. */
async function refusal(options: unknown) {
  try {
    const room = await colyseus.sdk.joinById(await openBattle(colyseus), options as object);
    await room.leave();
    return 'joined';
  } catch (error) {
    const { code, message } = error as { code: number; message: string };
    return `${code} ${message}`;
  }
}

describe('GET /health', () => {
  it('returns 200 { status: ok }', async () => {
    const res = await colyseus.http.get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ status: 'ok' });
  });
});

describe('joining a battle room (S3-05)', () => {
  it('a current app with a valid adult token joins', async () => {
    const room = await colyseus.sdk.joinById(await openBattle(colyseus), {
      protocolVersion: PROTOCOL_VERSION,
      token: await token(),
    });
    expect(room.roomId).toBeTruthy();
    await room.leave();
  });

  it('Done when: a bad token is refused with a clear error code', async () => {
    const v = PROTOCOL_VERSION;
    expect(await refusal({ protocolVersion: v, token: 'garbage' })).toBe('401 invalid-token');
    const otherKey = signingKey('another-secret-that-is-long-enough-000000');
    expect(await refusal({ protocolVersion: v, token: await token(true, now, otherKey) })).toBe(
      '401 invalid-token',
    );
    const old = await token(true, new Date(now.getTime() - 16 * 60 * 1000));
    expect(await refusal({ protocolVersion: v, token: old })).toBe('401 token-expired');
  });

  it('Done when: an old app version is refused with update-required', async () => {
    expect(await refusal({ protocolVersion: PROTOCOL_VERSION - 1, token: await token() })).toBe(
      '426 update-required',
    );
  });

  it('refuses players under 18 without parent consent (S3-04)', async () => {
    expect(await refusal({ protocolVersion: PROTOCOL_VERSION, token: await token(false) })).toBe(
      '403 consent-required',
    );
  });

  it('refuses malformed join options', async () => {
    expect(await refusal({})).toBe('400 invalid-message');
    expect(await refusal({ protocolVersion: '1', token: 'x' })).toBe('400 invalid-message');
  });
});
