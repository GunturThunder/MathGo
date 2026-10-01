import type { Redis } from 'ioredis';
import type { QueueEntry } from './pairing.js';

/** A queue entry plus when its player was last seen connected (stale after a crash). */
export interface StoredEntry extends QueueEntry {
  readonly seenAt: number;
}

/**
 * Matchmaking state shared by every game-server instance (Redis in services, memory in tests):
 * who is waiting for a random battle (FR-02), and who is in a running battle (S5-02).
 */
export interface MatchQueueStore {
  /** Adds the player unless already queued; false means "already queued". */
  tryAdd(entry: QueueEntry, now: number): Promise<boolean>;
  remove(userIds: readonly string[]): Promise<void>;
  all(): Promise<StoredEntry[]>;
  /** These players are still connected and waiting. */
  touch(userIds: readonly string[], now: number): Promise<void>;
  /** Marks players as seated in a running battle; the mark expires on its own as a safety net. */
  setActive(userIds: readonly string[], roomId: string): Promise<void>;
  clearActive(userIds: readonly string[]): Promise<void>;
  /** The battle room a player is in, or null. */
  activeRoom(userId: string): Promise<string | null>;
}

/** Longer than a battle (90 s) plus the reconnect window (15 s), so a crash cannot pin a player. */
export const ACTIVE_TTL_MS = 5 * 60_000;

const QUEUE = 'mm:queue'; // sorted set: userId scored by trophies
const JOINED = 'mm:joined'; // hash: userId → joinedAt (ms)
const SEEN = 'mm:seen'; // hash: userId → last seen (ms)
const active = (userId: string) => `mm:active:${userId}`;

export class RedisMatchQueue implements MatchQueueStore {
  constructor(private readonly redis: Redis) {}

  async tryAdd({ userId, trophies, joinedAt }: QueueEntry, now: number) {
    // ZADD NX: atomic, so two simultaneous joins cannot both get in.
    const added = await this.redis.zadd(QUEUE, 'NX', trophies, userId);
    if (added !== 1) return false;
    await this.redis.multi().hset(JOINED, userId, joinedAt).hset(SEEN, userId, now).exec();
    return true;
  }

  async remove(userIds: readonly string[]) {
    if (userIds.length === 0) return;
    await this.redis
      .multi()
      .zrem(QUEUE, ...userIds)
      .hdel(JOINED, ...userIds)
      .hdel(SEEN, ...userIds)
      .exec();
  }

  async all(): Promise<StoredEntry[]> {
    const [scored, joined, seen] = await Promise.all([
      this.redis.zrange(QUEUE, '0', '-1', 'WITHSCORES'),
      this.redis.hgetall(JOINED),
      this.redis.hgetall(SEEN),
    ]);
    const entries: StoredEntry[] = [];
    for (let i = 0; i + 1 < scored.length; i += 2) {
      const userId = scored[i] as string;
      entries.push({
        userId,
        trophies: Number(scored[i + 1]),
        joinedAt: Number(joined[userId] ?? 0),
        seenAt: Number(seen[userId] ?? 0),
      });
    }
    return entries;
  }

  async touch(userIds: readonly string[], now: number) {
    if (userIds.length === 0) return;
    await this.redis.hset(SEEN, Object.fromEntries(userIds.map((id) => [id, now])));
  }

  async setActive(userIds: readonly string[], roomId: string) {
    const tx = this.redis.multi();
    for (const id of userIds) tx.set(active(id), roomId, 'PX', ACTIVE_TTL_MS);
    await tx.exec();
  }

  async clearActive(userIds: readonly string[]) {
    if (userIds.length > 0) await this.redis.del(...userIds.map(active));
  }

  activeRoom(userId: string) {
    return this.redis.get(active(userId));
  }
}

export class MemoryMatchQueue implements MatchQueueStore {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly active = new Map<string, string>();

  async tryAdd(entry: QueueEntry, now: number) {
    if (this.entries.has(entry.userId)) return false;
    this.entries.set(entry.userId, { ...entry, seenAt: now });
    return true;
  }

  async remove(userIds: readonly string[]) {
    for (const id of userIds) this.entries.delete(id);
  }

  async all() {
    return [...this.entries.values()];
  }

  async touch(userIds: readonly string[], now: number) {
    for (const id of userIds) {
      const entry = this.entries.get(id);
      if (entry !== undefined) this.entries.set(id, { ...entry, seenAt: now });
    }
  }

  async setActive(userIds: readonly string[], roomId: string) {
    for (const id of userIds) this.active.set(id, roomId);
  }

  async clearActive(userIds: readonly string[]) {
    for (const id of userIds) this.active.delete(id);
  }

  async activeRoom(userId: string) {
    return this.active.get(userId) ?? null;
  }
}
