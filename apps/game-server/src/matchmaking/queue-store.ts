import type { Redis } from 'ioredis';
import type { QueueEntry } from './pairing.js';

/** Who is waiting for a random battle (FR-02). Redis in services, memory in tests. */
export interface MatchQueueStore {
  add(entry: QueueEntry): Promise<void>;
  remove(userIds: readonly string[]): Promise<void>;
  all(): Promise<QueueEntry[]>;
}

const QUEUE = 'mm:queue'; // sorted set: userId scored by trophies
const JOINED = 'mm:joined'; // hash: userId → joinedAt (ms)

export class RedisMatchQueue implements MatchQueueStore {
  constructor(private readonly redis: Redis) {}

  async add({ userId, trophies, joinedAt }: QueueEntry) {
    await this.redis.multi().zadd(QUEUE, trophies, userId).hset(JOINED, userId, joinedAt).exec();
  }

  async remove(userIds: readonly string[]) {
    if (userIds.length === 0) return;
    await this.redis
      .multi()
      .zrem(QUEUE, ...userIds)
      .hdel(JOINED, ...userIds)
      .exec();
  }

  async all(): Promise<QueueEntry[]> {
    const [scored, joined] = await Promise.all([
      this.redis.zrange(QUEUE, '0', '-1', 'WITHSCORES'),
      this.redis.hgetall(JOINED),
    ]);
    const entries: QueueEntry[] = [];
    for (let i = 0; i + 1 < scored.length; i += 2) {
      const userId = scored[i] as string;
      entries.push({
        userId,
        trophies: Number(scored[i + 1]),
        joinedAt: Number(joined[userId] ?? 0),
      });
    }
    return entries;
  }
}

export class MemoryMatchQueue implements MatchQueueStore {
  private readonly entries = new Map<string, QueueEntry>();

  async add(entry: QueueEntry) {
    this.entries.set(entry.userId, entry);
  }

  async remove(userIds: readonly string[]) {
    for (const id of userIds) this.entries.delete(id);
  }

  async all() {
    return [...this.entries.values()];
  }
}
