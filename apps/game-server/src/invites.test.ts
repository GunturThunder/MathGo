import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { createInvite, joinBattle, joinByCode, JoinError } from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import {
  INVITE_ALPHABET,
  INVITE_IDLE_TTL_MS,
  MemoryInviteStore,
  newInviteCode,
  normalizeInviteCode,
  RedisInviteStore,
  type InviteStore,
} from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';

describe('invite codes', () => {
  it('are 6 characters without look-alikes (0, O, 1, I, L)', () => {
    expect(INVITE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 1_000; i++)
      expect(newInviteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  });

  it('are read case-insensitively; anything else is not a code', () => {
    expect(normalizeInviteCode(' abc234 ')).toBe('ABC234');
    expect(normalizeInviteCode('ABC23')).toBeNull();
    expect(normalizeInviteCode('ABC2O4')).toBeNull(); // O is not in the alphabet
  });
});

/** The store contract, for the in-memory store and (with REDIS_URL) the Redis one. */
function storeContract(
  name: string,
  make: () => { store: InviteStore; wait: (ms: number) => Promise<void>; ttl: number },
) {
  describe(name, () => {
    it('finds the room, keeps the code alive while used, then expires it', async () => {
      const { store, wait, ttl } = make();
      const { code } = await store.create('room-1');
      expect(await store.resolve(code)).toEqual({ status: 'ok', roomId: 'room-1' });
      await wait(ttl * 0.6);
      await store.touchRoom('room-1'); // a join or leave
      await wait(ttl * 0.6);
      expect(await store.resolve(code)).toEqual({ status: 'ok', roomId: 'room-1' });
      await wait(ttl + 50);
      expect(await store.resolve(code)).toEqual({ status: 'expired' });
    });

    it("a closed room's code stops working; an unknown code is not found", async () => {
      const { store } = make();
      const { code } = await store.create('room-2');
      await store.removeRoom('room-2');
      expect((await store.resolve(code)).status).not.toBe('ok');
      expect(await store.resolve('ZZZZZZ')).toEqual({ status: 'not-found' });
    });
  });
}

let memoryNow = 0;
storeContract('MemoryInviteStore', () => ({
  store: new MemoryInviteStore(() => memoryNow, 1_000),
  wait: async (ms) => {
    memoryNow += ms;
  },
  ttl: 1_000,
}));

const redisUrl = process.env['REDIS_URL'];
describe.runIf(redisUrl !== undefined)('with Redis', () => {
  const redis = new Redis(redisUrl ?? '');
  afterAll(() => redis.quit());
  storeContract('RedisInviteStore', () => ({
    store: new RedisInviteStore(redis, 400),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ttl: 400,
  }));
});

describe('invite rooms through game-server (S4-02)', () => {
  let storeNow = Date.parse('2026-11-16T10:00:00Z');
  const store = new MemoryInviteStore(() => storeNow);
  let colyseus: ColyseusTestServer;
  const endpoint = 'ws://localhost:2568';
  const key = signingKey(DEV_JWT_SECRET);

  beforeAll(async () => {
    colyseus = await boot(
      createServer(loadConfig({}), { invites: store, recorder: noMatchRecorder }),
    );
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });

  const as = (userId: string, online = true) => ({
    endpoint,
    getToken: async () => (await signAccessToken({ userId, online }, key, new Date())).token,
  });
  const inbox = () => {
    const messages: ServerMessage[] = [];
    return { messages, handlers: { onMessage: (m: ServerMessage) => messages.push(m) } };
  };
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(check()).toBe(true);
  };

  it('Done when: a friend joins by code', async () => {
    const invite = await createInvite(as('host'));
    expect(invite.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);

    const host = inbox();
    const hostRoom = await joinBattle(as('host'), host.handlers, invite.roomId);
    // Random matchmaking never lands in an invite room.
    const stranger = await joinBattle(as('stranger'), inbox().handlers);
    expect(stranger.roomId).not.toBe(invite.roomId);

    const friend = inbox();
    const friendRoom = await joinByCode(as('friend'), friend.handlers, invite.code.toLowerCase());
    expect(friendRoom.roomId).toBe(invite.roomId);
    await until(() => [host, friend].every((p) => p.messages.some((m) => m.type === 'questions')));

    await Promise.all([hostRoom, friendRoom, stranger].map((c) => c.leave()));
  });

  it('Done when: an expired code gives a clear error', async () => {
    const invite = await createInvite(as('host2'));
    const hostRoom = await joinBattle(as('host2'), inbox().handlers, invite.roomId);
    storeNow += INVITE_IDLE_TTL_MS + 1;
    const error = await joinByCode(as('late-friend'), inbox().handlers, invite.code).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(JoinError);
    expect(error).toMatchObject({ code: 'room-expired', status: 410 });
    await hostRoom.leave();
  });

  it('an unknown code is room-not-found', async () => {
    const error = await joinByCode(as('typo'), inbox().handlers, 'QQQQQQ').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'room-not-found', status: 404 });
  });

  it('creating an invite needs a valid token with online play', async () => {
    const bad = await createInvite({ endpoint, getToken: async () => 'garbage' }).catch(
      (e: unknown) => e,
    );
    expect(bad).toMatchObject({ code: 'invalid-token', status: 401 });
    const minor = await createInvite(as('minor', false)).catch((e: unknown) => e);
    expect(minor).toMatchObject({ code: 'consent-required', status: 403 });
  });
});
