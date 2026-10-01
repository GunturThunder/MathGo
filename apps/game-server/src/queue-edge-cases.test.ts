import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { findMatch, joinBattle, JoinError, type BattleClientOptions } from '@mathgo/battle-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { STALE_MS } from './matchmaking/matchmaker.js';
import { MemoryMatchQueue } from './matchmaking/queue-store.js';
import { createServer } from './server.js';
import { openBattle, testDeps } from './test-deps.js';

const fakeNow = Date.parse('2026-12-03T09:00:00Z');
const queue = new MemoryMatchQueue();
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        matchQueue: queue,
        trophies: async () => 500,
        now: () => new Date(fakeNow),
        queueTickMs: 50,
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const as = (userId: string): BattleClientOptions => ({
  endpoint: 'ws://localhost:2568',
  getToken: async () =>
    (await signAccessToken({ userId, online: true }, signingKey(DEV_JWT_SECRET), new Date(fakeNow)))
      .token,
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const queued = async () => (await queue.all()).map((e) => e.userId).sort();

describe('queue edge cases through the queue room (S5-02)', () => {
  it('joining twice (e.g. a second device) is refused with already-queued', async () => {
    const first = await findMatch(as('twice'), { onMessage: () => undefined });
    const second = await findMatch(as('twice'), { onMessage: () => undefined }).catch(
      (e: unknown) => e,
    );
    expect(second).toBeInstanceOf(JoinError);
    expect(second).toMatchObject({ code: 'already-queued' });
    await first.cancel();
    await sleep(100);
    expect(await queued()).not.toContain('twice');
  });

  it('a player in a running battle cannot queue (already-in-match) until it ends', async () => {
    const roomId = await openBattle(colyseus);
    const busy = await joinBattle(as('busy'), { onMessage: () => undefined }, roomId);
    const other = await joinBattle(as('other'), { onMessage: () => undefined }, roomId);
    await sleep(100);
    const refused = await findMatch(as('busy'), { onMessage: () => undefined }).catch(
      (e: unknown) => e,
    );
    expect(refused).toMatchObject({ code: 'already-in-match' });

    await other.leave(); // forfeit: the battle ends, busy wins
    await sleep(150);
    const allowed = await findMatch(as('busy'), { onMessage: () => undefined });
    await allowed.cancel();
    await busy.leave();
  });

  it('a queued player with no connection here is never paired; the one waiting meets the next', async () => {
    // "gone" is in the queue but not connected (left, or still between onAuth and onJoin).
    await queue.tryAdd({ userId: 'gone', trophies: 500, joinedAt: fakeNow }, fakeNow);
    const stays = await findMatch(as('stays'), { onMessage: () => undefined });
    await sleep(200); // several ticks: stays is not paired with gone
    expect(await queued()).toEqual(['gone', 'stays']);

    const next = await findMatch(as('next'), { onMessage: () => undefined });
    const [a, b] = await Promise.all([stays.match, next.match]);
    expect(a.roomId).toBe(b.roomId);
    await Promise.all([a.leave(), b.leave()]);
    await queue.remove(['gone']);
  });

  it('stale entries left by a crash are pruned, never matched', async () => {
    await queue.tryAdd(
      { userId: 'crashed', trophies: 500, joinedAt: fakeNow },
      fakeNow - STALE_MS - 1_000,
    );
    const live = await findMatch(as('live'), { onMessage: () => undefined });
    await sleep(200);
    expect(await queued()).toEqual(['live']);
    await live.cancel();
  });
});
