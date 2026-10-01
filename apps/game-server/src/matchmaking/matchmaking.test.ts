import { createRng } from '@mathgo/game-core';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { Matchmaker } from './matchmaker.js';
import { canPair, MATCH_WINDOW, pairPlayers, windowFor, type QueueEntry } from './pairing.js';
import { MemoryMatchQueue, RedisMatchQueue, type MatchQueueStore } from './queue-store.js';

const entry = (userId: string, trophies: number, joinedAt = 0): QueueEntry => ({
  userId,
  trophies,
  joinedAt,
});

describe('pairing rule (FR-02)', () => {
  it('starts at ±100 and widens by 50 every 5 s', () => {
    expect(MATCH_WINDOW).toEqual({ base: 100, step: 50, everyMs: 5_000 });
    const p = entry('p', 500);
    expect([0, 4_999, 5_000, 12_000, 30_000].map((t) => windowFor(p, t))).toEqual([
      100, 100, 150, 200, 400,
    ]);
  });

  it('pairs within the wider of the two windows', () => {
    expect(canPair(entry('a', 500), entry('b', 600), 0)).toBe(true);
    expect(canPair(entry('a', 500), entry('b', 601), 0)).toBe(false);
    // b has waited 10 s: window 200 covers the gap.
    expect(canPair(entry('a', 500, 10_000), entry('b', 690), 10_000)).toBe(true);
  });

  it('serves the longest wait first, with the closest opponent, nobody twice', () => {
    const pairs = pairPlayers(
      [
        entry('new', 520, 9_000),
        entry('old', 500, 0),
        entry('near', 505, 8_000),
        entry('far', 700, 0),
      ],
      10_000,
    );
    expect(pairs.map(([a, b]) => [a.userId, b.userId])).toEqual([
      ['old', 'near'],
      ['far', 'new'], // far waited 10 s: window 200 ≥ the 180 gap
    ]);
  });
});

/** 50 players join over 20 s with spread-out trophies; the matchmaker ticks every second. */
async function simulate(store: MatchQueueStore) {
  const rng = createRng(2026, 11);
  const players = Array.from({ length: 50 }, (_, i) =>
    entry(`player-${i}`, rng.int(0, 2_500), rng.int(0, 20) * 1_000),
  );
  const matchmaker = new Matchmaker(store);
  const pairs: { a: QueueEntry; b: QueueEntry; at: number }[] = [];

  const waiting = new Set<string>();
  for (let now = 0; now <= 300_000 && pairs.length < 25; now += 1_000) {
    for (const p of players.filter((x) => x.joinedAt === now)) {
      await matchmaker.join(p, now);
      waiting.add(p.userId);
    }
    // Like the queue room: everyone still connected is seen every tick (S5-02 stale pruning).
    await store.touch([...waiting], now);
    for (const [a, b] of await matchmaker.tick(now)) {
      pairs.push({ a, b, at: now });
      waiting.delete(a.userId);
      waiting.delete(b.userId);
    }
  }
  return { players, pairs, left: (await store.all()).map((e) => e.userId) };
}

function checkSimulation({ players, pairs, left }: Awaited<ReturnType<typeof simulate>>) {
  // Everyone paired, exactly once.
  expect(left).toEqual([]);
  const ids = pairs.flatMap(({ a, b }) => [a.userId, b.userId]).sort();
  expect(ids).toEqual(players.map((p) => p.userId).sort());
  // Every pair fit the widening rule when it was made.
  for (const { a, b, at } of pairs) {
    const gap = Math.abs(a.trophies - b.trophies);
    expect({ gap, allowed: Math.max(windowFor(a, at), windowFor(b, at)) }).toSatisfy(
      ({ gap: g, allowed }: { gap: number; allowed: number }) => g <= allowed,
    );
  }
  return pairs;
}

describe('Done when: 50 simulated players are all paired within the widening rules', () => {
  it('in memory', async () => {
    const pairs = checkSimulation(await simulate(new MemoryMatchQueue()));
    expect(pairs).toHaveLength(25);
  });

  const redisUrl = process.env['REDIS_URL'];
  describe.runIf(redisUrl !== undefined)('with Redis', () => {
    const redis = new Redis(redisUrl ?? '');
    afterAll(() => redis.quit());
    it('the same in a Redis sorted set', async () => {
      await redis.del('mm:queue', 'mm:joined', 'mm:seen');
      checkSimulation(await simulate(new RedisMatchQueue(redis)));
    });
  });
});
