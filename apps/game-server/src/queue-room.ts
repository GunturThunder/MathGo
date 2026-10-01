import type { AccessClaims, SigningKey } from '@mathgo/auth';
import {
  matchMaker,
  Room,
  ServerError,
  type AuthContext,
  type Client,
  type Delayed,
} from '@colyseus/core';
import { eq, users, type Database } from '@mathgo/db';
import { BATTLE_ROOM } from '@mathgo/protocol';
import { authorizeJoin, JoinRefused } from './join.js';
import type { Matchmaker } from './matchmaking/matchmaker.js';

/** A player's trophies, or null when the account does not exist. */
export type TrophyLookup = (userId: string) => Promise<number | null>;

export function dbTrophyLookup(db: Database): TrophyLookup {
  return async (userId) => {
    try {
      const [row] = await db
        .select({ trophies: users.trophies })
        .from(users)
        .where(eq(users.id, userId));
      return row?.trophies ?? null;
    } catch {
      return null; // e.g. not a valid user id
    }
  };
}

export interface QueueRoomOptions {
  readonly key: SigningKey;
  readonly matchmaker: Matchmaker;
  readonly trophies: TrophyLookup;
  readonly now?: () => Date;
  /** How often the queue is paired (FR-02: every second). */
  readonly tickMs?: number;
}

type QueuedAuth = AccessClaims & { readonly trophies: number };

/**
 * Random matchmaking (FR-02, S5-01). Players wait here; every tick pairs them by trophies
 * (pairing.ts), creates a ranked battle room and reserves a seat in it for each of the two.
 * Trophies come from the database, never from the app.
 */
export class QueueRoom extends Room {
  private static options: QueueRoomOptions | undefined;

  static configure(options: QueueRoomOptions): void {
    QueueRoom.options = options;
  }

  override maxClients = 5_000;

  private readonly waiting = new Map<string, { client: Client; auth: QueuedAuth }>();
  private ticker: Delayed | null = null;
  private ticking = false;

  static override async onAuth(
    _token: string,
    options: unknown,
    _context: AuthContext,
  ): Promise<QueuedAuth> {
    const config = QueueRoom.options;
    if (config === undefined) throw new Error('QueueRoom.configure() was not called');
    try {
      const claims = await authorizeJoin(options, config.key, (config.now ?? (() => new Date()))());
      const trophies = await config.trophies(claims.userId);
      if (trophies === null) throw new JoinRefused('invalid-token');
      return { ...claims, trophies };
    } catch (error) {
      if (error instanceof JoinRefused) throw new ServerError(error.status, error.code);
      throw error;
    }
  }

  override onCreate() {
    this.ticker = this.clock.setInterval(
      () => void this.tick(),
      QueueRoom.options?.tickMs ?? 1_000,
    );
  }

  override async onJoin(client: Client, _options: unknown, auth: QueuedAuth) {
    const config = QueueRoom.options;
    if (config === undefined) return;
    this.waiting.set(auth.userId, { client, auth });
    client.userData = { userId: auth.userId };
    await config.matchmaker.join({
      userId: auth.userId,
      trophies: auth.trophies,
      joinedAt: (config.now ?? (() => new Date()))().getTime(),
    });
    client.send('queued', { trophies: auth.trophies });
  }

  /** Leaving the queue room is cancelling the search. */
  override async onLeave(client: Client) {
    const userId = (client.userData as { userId?: string } | undefined)?.userId;
    if (userId === undefined || !this.waiting.has(userId)) return;
    this.waiting.delete(userId);
    await QueueRoom.options?.matchmaker.leave(userId);
  }

  override onDispose() {
    this.ticker?.clear();
  }

  private async tick() {
    const config = QueueRoom.options;
    if (config === undefined || this.ticking) return;
    this.ticking = true;
    try {
      const pairs = await config.matchmaker.tick((config.now ?? (() => new Date()))().getTime());
      for (const pair of pairs) {
        const players = pair.map((e) => this.waiting.get(e.userId));
        const [a, b] = players;
        if (a === undefined || b === undefined) continue; // left meanwhile (S5-02 hardens this)
        // A private ranked room: only the two reserved players can enter it.
        const room = await matchMaker.createRoom(BATTLE_ROOM, { mode: 'ranked', matched: true });
        for (const player of [a, b]) {
          const reservation = await matchMaker.reserveSeatFor(room, {}, {
            userId: player.auth.userId,
            online: player.auth.online,
          } satisfies AccessClaims);
          this.waiting.delete(player.auth.userId);
          player.client.send('matched', { reservation });
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}
