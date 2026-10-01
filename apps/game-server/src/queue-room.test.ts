import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { findMatch, JoinError, type BattleClientOptions } from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { MemoryMatchQueue } from './matchmaking/queue-store.js';
import { createServer } from './server.js';
import { testDeps } from './test-deps.js';

let fakeNow = Date.parse('2026-12-01T09:00:00Z');
const trophies = new Map<string, number>();
const queue = new MemoryMatchQueue();
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        matchQueue: queue,
        trophies: async (userId) => trophies.get(userId) ?? null,
        now: () => new Date(fakeNow),
        queueTickMs: 50, // pair often; waiting time comes from the fake clock
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const as = (userId: string, cups?: number): BattleClientOptions => {
  if (cups !== undefined) trophies.set(userId, cups);
  return {
    endpoint: 'ws://localhost:2568',
    getToken: async () =>
      (
        await signAccessToken(
          { userId, online: true },
          signingKey(DEV_JWT_SECRET),
          new Date(fakeNow),
        )
      ).token,
  };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await sleep(10);
  expect(check()).toBe(true);
}

describe('random matchmaking (S5-01)', () => {
  it('pairs two close players into one private battle with reserved seats', async () => {
    const inboxes: ServerMessage[][] = [[], []];
    const queued: number[] = [];
    const a = await findMatch(as('ana', 500), { onMessage: (m) => inboxes[0]?.push(m) }, (t) =>
      queued.push(t),
    );
    const b = await findMatch(as('budi', 550), { onMessage: (m) => inboxes[1]?.push(m) }, (t) =>
      queued.push(t),
    );
    const [ca, cb] = await Promise.all([a.match, b.match]);

    expect(ca.roomId).toBe(cb.roomId);
    expect(queued.sort()).toEqual([500, 550]); // trophies from the server's lookup
    await until(() => inboxes.every((box) => box.some((m) => m.type === 'questions')));
    expect(await queue.all()).toEqual([]);
    await Promise.all([ca.leave(), cb.leave()]);
  });

  it('players far apart wait until their window has widened enough', async () => {
    let paired = false;
    const low = await findMatch(as('low', 100), { onMessage: () => undefined });
    const high = await findMatch(as('high', 900), { onMessage: () => undefined });
    void Promise.all([low.match, high.match]).then(() => (paired = true));

    await sleep(300); // several ticks: gap 800 > 100
    expect(paired).toBe(false);
    fakeNow += 65_000; // 13 steps: 100 + 13 × 50 = 750 < 800
    await sleep(300);
    expect(paired).toBe(false);
    fakeNow += 5_000; // 14 steps: 800 fits
    await until(() => paired);

    const [cl, ch] = await Promise.all([low.match, high.match]);
    expect(cl.roomId).toBe(ch.roomId);
    await Promise.all([cl.leave(), ch.leave()]);
  });

  it('cancelling leaves the queue, and the search ends as cancelled', async () => {
    const search = await findMatch(as('quitter', 1_200), { onMessage: () => undefined });
    await until(() => trophies.has('quitter'));
    await sleep(100);
    expect((await queue.all()).map((e) => e.userId)).toContain('quitter');
    await search.cancel();
    await expect(search.match).rejects.toMatchObject({ code: 'cancelled' });
    await sleep(100);
    expect((await queue.all()).map((e) => e.userId)).not.toContain('quitter');
  });

  it('refuses an account the server does not know', async () => {
    const error = await findMatch(as('ghost'), { onMessage: () => undefined }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(JoinError);
    expect(error).toMatchObject({ code: 'invalid-token' });
  });
});
