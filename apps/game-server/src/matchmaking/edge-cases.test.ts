import { createRng } from '@mathgo/game-core';
import { describe, expect, it } from 'vitest';
import { Matchmaker, STALE_MS } from './matchmaker.js';
import type { QueueEntry } from './pairing.js';
import { MemoryMatchQueue } from './queue-store.js';

const entry = (userId: string, trophies = 500, joinedAt = 0): QueueEntry => ({
  userId,
  trophies,
  joinedAt,
});

describe('queue edge cases (S5-02)', () => {
  it('joining twice: the second add is refused and changes nothing', async () => {
    const store = new MemoryMatchQueue();
    const mm = new Matchmaker(store);
    expect(await mm.join(entry('ana', 500, 0), 0)).toBe(true);
    expect(await mm.join(entry('ana', 900, 3_000), 3_000)).toBe(false);
    expect(await store.all()).toEqual([{ userId: 'ana', trophies: 500, joinedAt: 0, seenAt: 0 }]);
  });

  it('cancel: a player who left is not paired', async () => {
    const mm = new Matchmaker(new MemoryMatchQueue());
    await mm.join(entry('ana'), 0);
    await mm.join(entry('budi'), 0);
    await mm.leave('budi');
    expect(await mm.tick(1_000)).toEqual([]);
  });

  it("stale entries (a crashed server's players) are pruned before pairing", async () => {
    const store = new MemoryMatchQueue();
    const mm = new Matchmaker(store);
    await mm.join(entry('ghost'), 0); // nobody touches it again
    await mm.join(entry('live'), 0);
    for (let now = 1_000; now <= STALE_MS + 1_000; now += 1_000) await store.touch(['live'], now);
    // The ghost was last seen more than 10 s ago: gone, and not paired with the live player.
    expect(await mm.tick(STALE_MS + 1_000)).toEqual([]);
    expect((await store.all()).map((e) => e.userId)).toEqual(['live']);
  });

  it('Done when: no player is paired twice, whatever the joins, repeats, cancels and crashes', async () => {
    for (let run = 0; run < 20; run++) {
      const rng = createRng(run, 99);
      const store = new MemoryMatchQueue();
      const mm = new Matchmaker(store);
      const connected = new Set<string>();
      const paired = new Map<string, number>();
      /** When each player was last seen connected. */
      const lastSeen = new Map<string, number>();

      for (let now = 0; now <= 120_000; now += 1_000) {
        for (let k = 0; k < 3; k++) {
          const id = `p${rng.int(0, 39)}`;
          const roll = rng.next();
          if (roll < 0.5 && !paired.has(id)) {
            // A join, or a repeat join from another device.
            if (await mm.join(entry(id, rng.int(0, 1_500), now), now)) {
              connected.add(id);
              lastSeen.set(id, now); // joining is being seen
            }
          } else if (roll < 0.65 && connected.has(id)) {
            await mm.leave(id); // cancel
            connected.delete(id);
          } else if (roll < 0.75 && connected.has(id)) {
            connected.delete(id); // the server lost them without a leave: their entry goes stale
          }
        }
        await store.touch([...connected], now);
        for (const id of connected) lastSeen.set(id, now);
        for (const pair of await mm.tick(now)) {
          for (const p of pair) {
            expect(paired.has(p.userId)).toBe(false); // nobody twice
            // No ghosts: nobody unseen for longer than STALE_MS is ever paired. (A player lost less
            // than that ago can be; the queue room then puts their partner back in the queue.)
            expect(now - (lastSeen.get(p.userId) ?? -Infinity)).toBeLessThanOrEqual(STALE_MS);
            paired.set(p.userId, now);
            connected.delete(p.userId);
          }
        }
      }
    }
  });
});

describe('only players the room can serve are paired (S5-02)', () => {
  it('a player between onAuth and onJoin waits for a later tick instead of being lost', async () => {
    const store = new MemoryMatchQueue();
    const mm = new Matchmaker(store);
    await mm.join(entry('arriving'), 0);
    await mm.join(entry('here'), 0);
    // "arriving" is queued but not connected yet: no pair, nobody removed.
    expect(await mm.tick(1_000, (id) => id === 'here')).toEqual([]);
    expect((await store.all()).map((e) => e.userId).sort()).toEqual(['arriving', 'here']);
    // Once connected, they meet.
    const pairs = await mm.tick(2_000, () => true);
    expect(pairs.map((p) => p.map((e) => e.userId).sort())).toEqual([['arriving', 'here']]);
  });
});
