import { pairPlayers, type QueueEntry } from './pairing.js';
import type { MatchQueueStore } from './queue-store.js';

/** A queued player not seen for this long is gone (e.g. their server crashed): pruned. */
export const STALE_MS = 10_000;

/** The queue plus the 1 s tick that pairs it (FR-02, S5-02). */
export class Matchmaker {
  constructor(readonly store: MatchQueueStore) {}

  /** Queues the player; false when they are already queued (joining twice). */
  join(entry: QueueEntry, now: number): Promise<boolean> {
    return this.store.tryAdd(entry, now);
  }

  leave(userId: string): Promise<void> {
    return this.store.remove([userId]);
  }

  /**
   * Prunes stale entries, pairs whoever fits now and takes them out of the queue. Only players
   * `canServe` accepts are paired: a queue room pairs the players connected to it, so a player
   * still between onAuth and onJoin (or on another instance) waits for a later tick.
   */
  async tick(
    now: number,
    canServe: (userId: string) => boolean = () => true,
  ): Promise<[QueueEntry, QueueEntry][]> {
    const entries = await this.store.all();
    const stale = entries.filter((e) => e.seenAt < now - STALE_MS).map((e) => e.userId);
    await this.store.remove(stale);
    const live = entries.filter((e) => e.seenAt >= now - STALE_MS && canServe(e.userId));
    const pairs = pairPlayers(live, now);
    await this.store.remove(pairs.flat().map((e) => e.userId));
    return pairs;
  }
}
