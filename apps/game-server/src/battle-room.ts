import { randomBytes } from 'node:crypto';
import type { AccessClaims, SigningKey } from '@mathgo/auth';
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import type { QuestionLevel, Seat } from '@mathgo/game-core';
import { BattleSession, type Outgoing } from './battle-session.js';
import { authorizeJoin, JoinRefused } from './join.js';
import { RateLimiter } from './rate-limit.js';

/** Answers per second per player before the rest are dropped (S4-06 adds speed flags). */
export const ANSWER_RATE_LIMIT = { max: 5, windowMs: 1_000 } as const;

/**
 * Questions come from Counting Camp until matchmaking and invites set the level (S4-02, S5-04).
 * The level must come from the server, never from a client's join options.
 */
const DEFAULT_LEVEL: QuestionLevel = { arena: 1, trophies: 0 };

interface PlayerData {
  readonly userId: string;
  readonly seat: Seat;
}

/**
 * A 1v1 battle. The seed is drawn here and never leaves the server; players get question text
 * only. The battle clock starts when the second seat is taken.
 */
export class BattleRoom extends Room {
  private static key: SigningKey | undefined;
  private static now: () => Date = () => new Date();

  /** Called once at startup with the key that checks access tokens (JWT_SECRET). */
  static configure(key: SigningKey, now: () => Date = () => new Date()): void {
    BattleRoom.key = key;
    BattleRoom.now = now;
  }

  override maxClients = 2;

  private readonly session = new BattleSession(randomBytes(4).readUInt32BE(0), DEFAULT_LEVEL);
  private readonly limiter = new RateLimiter<Seat>(
    ANSWER_RATE_LIMIT.max,
    ANSWER_RATE_LIMIT.windowMs,
  );
  private startedAt: number | null = null;
  /** Last battle time used; the engine needs time never to go backwards. */
  private lastAt = 0;

  static override async onAuth(_token: string, options: unknown, _context: AuthContext) {
    if (BattleRoom.key === undefined) {
      throw new Error('BattleRoom.configure() was not called');
    }
    try {
      return await authorizeJoin(options, BattleRoom.key, BattleRoom.now());
    } catch (error) {
      if (error instanceof JoinRefused) {
        // The client's join promise rejects with this status and the protocol error code.
        throw new ServerError(error.status, error.code);
      }
      throw error;
    }
  }

  override onCreate() {
    this.onMessage('*', (client: Client, type: string | number, payload: unknown) => {
      this.receive(client, String(type), payload);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: AccessClaims) {
    const taken = new Set(this.clients.map((c) => (c.userData as PlayerData | undefined)?.seat));
    const seat: Seat = taken.has(0) ? 1 : 0;
    client.userData = { userId: auth.userId, seat } satisfies PlayerData;
    this.dispatch(this.session.welcome(seat));

    if (this.clients.length === this.maxClients && this.startedAt === null) {
      this.startedAt = BattleRoom.now().getTime();
      this.dispatch(this.session.start());
      // End on time even if nobody answers.
      this.clock.setTimeout(() => {
        this.dispatch(this.session.tick(this.session.battle.rules.durationMs));
      }, this.session.battle.rules.durationMs);
    }
  }

  private receive(client: Client, type: string, payload: unknown) {
    const player = client.userData as PlayerData | undefined;
    if (player === undefined || this.startedAt === null) {
      return; // Nothing to answer before both players are in.
    }
    const at = this.battleTime();
    if (!this.limiter.allow(player.seat, at)) {
      client.send('error', { code: 'rate-limited' });
      return;
    }
    this.dispatch(this.session.receive(player.seat, type, payload, at));
  }

  /** Milliseconds since the start on the server clock, never going backwards. */
  private battleTime(): number {
    const elapsed = BattleRoom.now().getTime() - (this.startedAt ?? 0);
    // The end timer can fire a hair before the wall clock reaches 90 s; never go below the engine.
    this.lastAt = Math.max(this.lastAt, this.session.battle.now, Math.round(elapsed));
    return this.lastAt;
  }

  private dispatch(out: readonly Outgoing[]) {
    for (const { to, message } of out) {
      if (to === 'all') {
        this.broadcast(message.type, message.payload);
      } else {
        const client = this.clients.find(
          (c) => (c.userData as PlayerData | undefined)?.seat === to,
        );
        client?.send(message.type, message.payload);
      }
    }
  }
}
