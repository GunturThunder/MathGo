import { pairPlayers, type QueueEntry } from './pairing.js';
import type { MatchQueueStore } from './queue-store.js';

/** The queue plus the 1 s tick that pairs it (FR-02). */
export class Matchmaker {
  constructor(private readonly store: MatchQueueStore) {}

  join(entry: QueueEntry): Promise<void> {
    return this.store.add(entry);
  }

  leave(userId: string): Promise<void> {
    return this.store.remove([userId]);
  }

  /** Pairs whoever fits now and takes them out of the queue. */
  async tick(now: number): Promise<[QueueEntry, QueueEntry][]> {
    const pairs = pairPlayers(await this.store.all(), now);
    await this.store.remove(pairs.flat().map((e) => e.userId));
    return pairs;
  }
}
