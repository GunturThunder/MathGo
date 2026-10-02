import { randomBytes } from 'node:crypto';
import type { AccessClaims, SigningKey } from '@mathgo/auth';
import { Room, ServerError, type AuthContext, type Client, type Delayed } from '@colyseus/core';
import { questionLevelForMatch, type QuestionLevel, type Seat } from '@mathgo/game-core';
import { parseClientMessage } from '@mathgo/protocol';
import { BattleSession, type Outgoing } from './battle-session.js';
import { authorizeJoin, JoinRefused } from './join.js';
import type { InviteStore } from './invites.js';
import type { MatchRecorder, RecordedMatch } from './match-recorder.js';
import type { MatchQueueStore } from './matchmaking/queue-store.js';
import type { TrophyLookup } from './queue-room.js';
import { RateLimiter } from './rate-limit.js';

/** Answers per second per player before the rest are dropped (S4-06 adds speed flags). */
export const ANSWER_RATE_LIMIT = { max: 5, windowMs: 1_000 } as const;

/**
 * Where a battle's questions come from when nothing else says (tests' server-opened rooms). The
 * queue passes the match's level; invite rooms work it out from both players (S5-04). It always
 * comes from the server, never from a client's join options.
 */
const DEFAULT_LEVEL: QuestionLevel = { arena: 1, trophies: 0 };

/** A level from the queue's create options, checked even though only the server sets it. */
function isLevel(value: unknown): value is QuestionLevel {
  const level = value as Partial<QuestionLevel> | null;
  return (
    typeof level === 'object' &&
    level !== null &&
    Number.isInteger(level.arena) &&
    (level.arena ?? 0) >= 1 &&
    (level.arena ?? 0) <= 5 &&
    Number.isSafeInteger(level.trophies) &&
    (level.trophies ?? -1) >= 0
  );
}

/** A dropped player keeps their seat this long while the battle runs on (FR-07). */
export const RECONNECT_SECONDS = 15;
/** The 3-2-1 before each battle (S4-10); the clock starts after it. */
export const COUNTDOWN_MS = 3_000;

export interface BattleRoomOptions {
  readonly key: SigningKey;
  readonly invites: InviteStore;
  readonly recorder: MatchRecorder;
  /** Marks who is in a running battle, so they cannot queue for another (S5-02). */
  readonly matchQueue: MatchQueueStore;
  /** Players' trophies, to set an invite battle's level (S5-04). */
  readonly trophies: TrophyLookup;
  readonly now?: () => Date;
  readonly reconnectSeconds?: number;
  /** Tests set 0: the battle starts the moment both players are in. */
  readonly countdownMs?: number;
}

interface PlayerData {
  readonly userId: string;
  readonly seat: Seat;
}

const otherSeat = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

const newSession = (level: QuestionLevel) =>
  new BattleSession(randomBytes(4).readUInt32BE(0), level);
const newLimiter = () => new RateLimiter<Seat>(ANSWER_RATE_LIMIT.max, ANSWER_RATE_LIMIT.windowMs);

/**
 * A 1v1 battle. The seed is drawn here and never leaves the server; players get question text
 * only. The battle clock starts when the second seat is taken.
 */
export class BattleRoom extends Room {
  private static key: SigningKey | undefined;
  private static now: () => Date = () => new Date();
  private static invites: InviteStore | undefined;
  private static reconnectSeconds = RECONNECT_SECONDS;
  private static countdownMs = COUNTDOWN_MS;
  private static recorder: MatchRecorder | undefined;
  private static activity: MatchQueueStore | undefined;
  private static trophies: TrophyLookup | undefined;

  /** Called once at startup: the key that checks access tokens (JWT_SECRET) and the invite store. */
  static configure(options: BattleRoomOptions): void {
    BattleRoom.key = options.key;
    BattleRoom.invites = options.invites;
    BattleRoom.recorder = options.recorder;
    BattleRoom.activity = options.matchQueue;
    BattleRoom.trophies = options.trophies;
    BattleRoom.now = options.now ?? (() => new Date());
    BattleRoom.reconnectSeconds = options.reconnectSeconds ?? RECONNECT_SECONDS;
    BattleRoom.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
  }

  override maxClients = 2;

  /** The current battle; a rematch replaces it with a new one (new secret seed). */
  /** The level every battle in this room plays at (S5-04); a rematch keeps it. */
  private level: QuestionLevel = DEFAULT_LEVEL;
  private session = newSession(DEFAULT_LEVEL);
  private limiter = newLimiter();
  private endTimer: Delayed | null = null;
  /** Set during the 3-2-1 before a battle (S4-10). */
  private countdownTimer: Delayed | null = null;
  /** Seats that said "play again" after the last battle (S4-05). */
  private readonly rematch = new Set<Seat>();
  /** Ranked rooms come from matchmaking (S5-01); invite rooms from POST /invites (S4-02). */
  private mode: 'ranked' | 'invite' = 'ranked';
  private startedAt: number | null = null;
  /** User id per seat, kept after a player leaves (a forfeit still names them). */
  private readonly users: [string, string] = ['', ''];
  /** The stored match id, once the finished battle is saved (S4-03). */
  recorded: Promise<RecordedMatch> | null = null;
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

  /**
   * Only the server creates invite rooms (matchMaker.createRoom in POST /invites): clients' join
   * options never pass the protocol schema with a `mode`, so they cannot ask for one.
   */
  override async onCreate(options?: {
    mode?: 'invite' | 'ranked';
    matched?: boolean;
    level?: unknown;
  }) {
    // Only the server opens battles: the queue (ranked, with reserved seats) or POST /invites.
    // A client's joinOrCreate/create would skip matchmaking, and with it the trophy window.
    if (options?.mode === undefined) {
      throw new ServerError(403, 'room-not-found');
    }
    if (options?.mode === 'invite') {
      this.mode = 'invite';
      // Random matchmaking must never fill an invite room; friends join it by id.
      await this.setPrivate(true);
    }
    if (options?.matched === true) {
      // Made by the queue (S5-01) with a seat reserved for each player: nobody else gets in.
      await this.setPrivate(true);
    }
    if (options?.level !== undefined) {
      if (!isLevel(options.level)) throw new ServerError(400, 'invalid-message');
      // The queue's pick: the lower of the two players' trophies (S5-04).
      this.level = options.level;
      this.session = newSession(this.level);
    }
    this.onMessage('*', (client: Client, type: string | number, payload: unknown) => {
      this.receive(client, String(type), payload);
    });
  }

  override onJoin(client: Client, _options: unknown, auth: AccessClaims) {
    const taken = new Set(this.clients.map((c) => (c.userData as PlayerData | undefined)?.seat));
    const seat: Seat = taken.has(0) ? 1 : 0;
    client.userData = { userId: auth.userId, seat } satisfies PlayerData;
    this.users[seat] = auth.userId;
    this.touchInvite();
    // An invite room learns its level only when both friends are in, so `joined` (which names
    // the arena) waits until then; other rooms know it from the start.
    if (this.mode !== 'invite') this.dispatch(this.session.welcome(seat));

    if (this.clients.length === this.maxClients && this.startedAt === null) {
      if (this.mode === 'invite') void this.beginInviteBattle();
      else this.beginBattle();
    }
  }

  /**
   * Friends can be in different arenas: like random battles, questions come from the lower
   * trophy count (PRD; S5-04). Looked up when both are in, then the battle starts.
   */
  private async beginInviteBattle() {
    const lookup = BattleRoom.trophies;
    const [a, b] =
      lookup === undefined ? [null, null] : await Promise.all(this.users.map((u) => lookup(u)));
    if (this.clients.length < this.maxClients || this.startedAt !== null) return; // someone left
    this.level = a == null || b == null ? DEFAULT_LEVEL : questionLevelForMatch(a, b);
    this.session = newSession(this.level);
    this.dispatch([...this.session.welcome(0), ...this.session.welcome(1)]);
    this.beginBattle();
  }

  /**
   * Both players are in: count down 3-2-1 (S4-10), then start. The countdown is the server's, so
   * it never eats into the 90 s and both players start together.
   */
  private beginBattle() {
    const ms = BattleRoom.countdownMs;
    if (ms <= 0) {
      this.startClock();
      return;
    }
    this.broadcast('countdown', { startsInMs: ms });
    this.countdownTimer?.clear();
    this.countdownTimer = this.clock.setTimeout(() => {
      this.countdownTimer = null;
      this.startClock();
    }, ms);
  }

  /** Starts the clock of the current session and sends both players their first questions. */
  private startClock() {
    void BattleRoom.activity?.setActive([...this.users], this.roomId).catch(() => undefined);
    this.startedAt = BattleRoom.now().getTime();
    this.lastAt = 0;
    this.recorded = null;
    this.dispatch(this.session.start());
    // End on time even if nobody answers; a previous battle's timer must not end this one.
    this.endTimer?.clear();
    const session = this.session;
    this.endTimer = this.clock.setTimeout(() => {
      this.dispatch(session.tick(session.battle.rules.durationMs));
    }, session.battle.rules.durationMs);
  }

  /**
   * "Play again?" after a battle in an invite room (S4-05). Both players see each answer; when
   * both accept, a new battle starts in the same room, so the same code keeps working.
   */
  private handleRematch(client: Client, player: PlayerData, type: string, payload: unknown) {
    const parsed = parseClientMessage(type, payload);
    const error = (detail: string) => client.send('error', { code: 'invalid-message', detail });
    if (!parsed.ok || parsed.message.type !== 'rematch')
      return error(parsed.ok ? 'not a rematch' : parsed.error);
    if (this.mode !== 'invite') return error('rematches are for invite rooms');
    if (this.running || this.startedAt === null) return error('the battle has not ended');

    if (parsed.message.payload.accept) this.rematch.add(player.seat);
    else this.rematch.delete(player.seat);
    this.broadcast('rematch', { seat: player.seat, accepted: parsed.message.payload.accept });
    this.touchInvite();

    if (this.rematch.size === this.maxClients && this.clients.length === this.maxClients) {
      this.rematch.clear();
      this.session = newSession(this.level);
      this.limiter = newLimiter();
      this.dispatch([...this.session.welcome(0), ...this.session.welcome(1)]);
      this.beginBattle();
    }
  }

  /**
   * Dropped without leaving (network, app in the background): hold the seat while the battle
   * keeps running (no freeze, decided), and tell the opponent until when.
   */
  override onDrop(client: Client) {
    const player = client.userData as PlayerData | undefined;
    if (player === undefined || !this.running) return;
    const reconnectBy = this.battleTime() + BattleRoom.reconnectSeconds * 1000;
    this.dispatch([
      {
        to: otherSeat(player.seat),
        message: {
          type: 'presence',
          payload: { seat: player.seat, connected: false, reconnectBy },
        },
      },
    ]);
    // Rejected when the time is up; onLeave then forfeits.
    this.allowReconnection(client, BattleRoom.reconnectSeconds).catch(() => undefined);
  }

  /** Back in time: tell the opponent, and bring this player up to date. */
  override onReconnect(client: Client) {
    const player = client.userData as PlayerData | undefined;
    if (player === undefined) return;
    this.dispatch([
      {
        to: otherSeat(player.seat),
        message: { type: 'presence', payload: { seat: player.seat, connected: true } },
      },
      ...this.session.resync(player.seat),
    ]);
  }

  /** Gone for good: quit, or not back within the reconnect window. Mid-battle that is a forfeit. */
  override onLeave(client: Client) {
    const player = client.userData as PlayerData | undefined;
    // Left during the countdown: start now, so leaving counts as a forfeit like mid-battle.
    if (player !== undefined && this.countdownTimer !== null) {
      this.countdownTimer.clear();
      this.countdownTimer = null;
      this.startClock();
    }
    if (player !== undefined && this.running) {
      this.dispatch(this.session.forfeit(player.seat, this.battleTime()));
    }
    // Gone after the battle in a friend's room: the other player isn't left waiting for an
    // answer to "play again?" (S4-13). Leaving counts as no.
    if (
      player !== undefined &&
      this.mode === 'invite' &&
      this.startedAt !== null &&
      !this.running
    ) {
      this.rematch.delete(player.seat);
      this.broadcast('rematch', { seat: player.seat, accepted: false }, { except: client });
    }
    if (player !== undefined)
      void BattleRoom.activity?.clearActive([player.userId]).catch(() => undefined);
    this.touchInvite();
  }

  /** Both players have been in and the battle has not ended. */
  private get running(): boolean {
    return this.startedAt !== null && this.session.battle.result === null;
  }

  override async onDispose() {
    await BattleRoom.activity
      ?.clearActive(this.users.filter((u) => u !== ''))
      .catch(() => undefined);
    if (this.mode === 'invite') await BattleRoom.invites?.removeRoom(this.roomId);
  }

  /** Activity keeps an invite code alive (10-minute idle expiry). */
  private touchInvite() {
    if (this.mode === 'invite') void BattleRoom.invites?.touchRoom(this.roomId);
  }

  private receive(client: Client, type: string, payload: unknown) {
    const player = client.userData as PlayerData | undefined;
    if (player === undefined || this.startedAt === null) {
      return; // Nothing to answer before both players are in.
    }
    if (type === 'rematch') {
      this.handleRematch(client, player, type, payload);
      return;
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

  /** Saves the finished battle once; a failed write is logged, never fatal for the room. */
  private recordMatch(): Promise<RecordedMatch> | null {
    if (this.recorded !== null || this.startedAt === null) return this.recorded;
    const recorder = BattleRoom.recorder;
    if (recorder === undefined) return null;
    const battle = this.session.battle;
    this.recorded = recorder
      .record({
        mode: this.mode,
        battle,
        users: [...this.users],
        startedAt: new Date(this.startedAt),
        endedAt: new Date(this.startedAt + battle.now),
        answers: [...this.session.answers],
      })
      .catch((error: unknown) => {
        console.error(`[battle ${this.roomId}] could not record the match`, error);
        throw error;
      });
    this.recorded.catch(() => undefined);
    return this.recorded;
  }

  /**
   * The battle's `end`, once it is stored: for ranked battles it carries both players' trophy
   * changes (S5-03). If storing failed the battle still ends, without trophy changes.
   */
  private async sendEnd(end: Outgoing) {
    // The battle is over: both may queue again (or rematch, which marks them again).
    void BattleRoom.activity?.clearActive([...this.users]).catch(() => undefined);
    let message = end.message;
    const recorded = await this.recordMatch()?.catch(() => null);
    if (message.type === 'end' && recorded?.trophies != null) {
      const [a, b] = recorded.trophies.map(({ delta, trophies, arenaBefore, arenaAfter }) => ({
        delta,
        trophies,
        arenaBefore,
        arenaAfter,
      }));
      if (a !== undefined && b !== undefined) {
        message = { ...message, payload: { ...message.payload, trophies: [a, b] } };
      }
    }
    this.dispatch([{ to: end.to, message }], true);
  }

  /** Sends each message to its seat or to both. An `end` waits for the match to be stored. */
  private dispatch(out: readonly Outgoing[], stored = false) {
    for (const outgoing of out) {
      if (outgoing.message.type === 'end' && !stored) {
        void this.sendEnd(outgoing);
        continue;
      }
      const { to, message } = outgoing;
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
