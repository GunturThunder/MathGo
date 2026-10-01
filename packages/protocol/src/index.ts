import { z } from 'zod';

/**
 * Bump on any breaking change to these messages. The app sends it on join; the server refuses
 * older clients with `update-required`, because store builds lag behind server deploys.
 */
export const PROTOCOL_VERSION = 1;

/** The Colyseus room the app joins for a battle. */
export const BATTLE_ROOM = 'battle';

/** The Colyseus room the app joins to wait for a random opponent (FR-02). */
export const QUEUE_ROOM = 'queue';

// Shared pieces.

const seat = z.union([z.literal(0), z.literal(1)]);
const arenaId = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const nat = z.number().int().nonnegative();
/** Milliseconds from the battle start, on the server clock. */
const battleMs = nat;

// Client → server.

/** Join options: sent when the app joins a BattleRoom. */
export const joinRequest = z.strictObject({
  protocolVersion: z.number().int().positive(),
  /** The access token from `POST /auth/guest`. */
  token: z.string().min(1).max(4096),
});

/** A typed answer. Only whole numbers fit the keypad; the bound keeps junk out of the server. */
export const answerRequest = z.strictObject({
  questionIndex: nat,
  value: z.number().int().min(-99_999).max(99_999),
});

/** After a battle in an invite room: play again (accept) or not (S4-05). */
export const rematchRequest = z.strictObject({ accept: z.boolean() });

// Server → client.

/** Reply to a join: which seat is yours and what the battle plays. */
export const joined = z.strictObject({
  seat,
  arena: arenaId,
  durationMs: z.number().int().positive(),
});

/** The next questions to show. Text only: answers never leave the server. */
export const questionBatch = z.strictObject({
  questions: z
    .array(z.strictObject({ index: nat, text: z.string().min(1).max(100) }))
    .min(1)
    .max(10),
});

const playerView = z.strictObject({
  hp: nat,
  /** Correct answers in a row towards the next combo. */
  streak: nat,
  comboReady: z.boolean(),
  /** Answers are refused before this time (wrong-answer lock). */
  lockedUntil: battleMs,
  /** The question this player is on. */
  questionIndex: nat,
});

const battleEvent = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('hit'),
    seat,
    questionIndex: nat,
    damage: nat,
    speedBonus: z.boolean(),
    combo: z.boolean(),
    targetHp: nat,
  }),
  z.strictObject({ type: z.literal('combo-ready'), seat }),
  z.strictObject({ type: z.literal('miss'), seat, questionIndex: nat, lockedUntil: battleMs }),
  z.strictObject({
    type: z.literal('rejected'),
    seat,
    reason: z.enum(['finished', 'locked', 'stale-question']),
  }),
]);

/** Sent to both players after every change: what happened and where things stand. */
export const stateUpdate = z.strictObject({
  now: battleMs,
  players: z.tuple([playerView, playerView]),
  events: z.array(battleEvent).max(10),
});

/**
 * A player dropped or came back (FR-07). While `connected` is false the seat is held until
 * `reconnectBy`; the app shows "opponent reconnecting" (S4-10).
 */
export const presence = z.strictObject({
  seat,
  connected: z.boolean(),
  reconnectBy: battleMs.optional(),
});

/**
 * A player's answer to "play again?", sent to both players (S4-13). When both have accepted, a
 * new battle starts in the same room: `joined` again, then its first questions.
 */
export const rematchUpdate = z.strictObject({ seat, accepted: z.boolean() });

/** In the random queue; trophies as the server knows them (FR-02). */
export const queued = z.strictObject({ trophies: nat });

/**
 * An opponent was found: a seat in a new battle room is reserved for this player. The app hands
 * `reservation` to the Colyseus client (`consumeSeatReservation`) to enter the battle.
 */
export const matched = z.strictObject({
  reservation: z.looseObject({ name: z.string(), roomId: z.string(), sessionId: z.string() }),
});

const battleResult = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('win'),
    winner: seat,
    /** `forfeit`: the other player quit or stayed away more than 15 s (FR-07). */
    reason: z.enum(['ko', 'time', 'forfeit']),
  }),
  z.strictObject({ outcome: z.literal('draw'), reason: z.literal('time') }),
]);

const playerStats = z.strictObject({ correct: nat, wrong: nat, bestStreak: nat });

const trophyChange = z.strictObject({
  delta: z.number().int(),
  trophies: nat,
  arenaBefore: arenaId,
  arenaAfter: arenaId,
});

/** The end of a battle. `trophies` is null for invite battles, which never change trophies. */
export const battleEnd = z.strictObject({
  result: battleResult,
  stats: z.tuple([playerStats, playerStats]),
  trophies: z.tuple([trophyChange, trophyChange]).nullable(),
});

/** Codes, not text: the app shows each one in the player's language. */
export const ERROR_CODES = [
  /** `protocolVersion` is older than the server's: show "please update" (S4-12). */
  'update-required',
  'invalid-token',
  /** The access token expired: refresh it and join again. */
  'token-expired',
  /** Under-18 account without parent consent (FR-20). */
  'consent-required',
  'room-not-found',
  'room-full',
  /** Invite code past its 10-minute idle TTL. */
  'room-expired',
  'rate-limited',
  /** Already waiting in the random queue (e.g. from another device). */
  'already-queued',
  /** Seated in a battle that is still running: reconnect to it instead. */
  'already-in-match',
  /** A message that fails its schema. */
  'invalid-message',
] as const;

export const errorMessage = z.strictObject({
  code: z.enum(ERROR_CODES),
  /** For logs only; never shown to players. */
  detail: z.string().max(500).optional(),
});

/** Message names for `room.send(type, …)` and `room.onMessage(type, …)`. */
export const clientMessages = {
  answer: answerRequest,
  rematch: rematchRequest,
} as const;

export const serverMessages = {
  joined,
  questions: questionBatch,
  state: stateUpdate,
  end: battleEnd,
  presence,
  rematch: rematchUpdate,
  queued,
  matched,
  error: errorMessage,
} as const;

export type JoinRequest = z.infer<typeof joinRequest>;
export type AnswerRequest = z.infer<typeof answerRequest>;
export type Joined = z.infer<typeof joined>;
export type QuestionBatch = z.infer<typeof questionBatch>;
export type StateUpdate = z.infer<typeof stateUpdate>;
export type BattleEnd = z.infer<typeof battleEnd>;
export type Presence = z.infer<typeof presence>;
export type RematchUpdate = z.infer<typeof rematchUpdate>;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorMessage = z.infer<typeof errorMessage>;

export type ClientMessageType = keyof typeof clientMessages;
export type ServerMessageType = keyof typeof serverMessages;
export type ClientMessage = {
  [K in ClientMessageType]: { type: K; payload: z.infer<(typeof clientMessages)[K]> };
}[ClientMessageType];
export type ServerMessage = {
  [K in ServerMessageType]: { type: K; payload: z.infer<(typeof serverMessages)[K]> };
}[ServerMessageType];

export type Parsed<T> = { ok: true; message: T } | { ok: false; error: string };

function parseWith<T>(
  schemas: Record<string, z.ZodType>,
  type: string,
  payload: unknown,
): Parsed<T> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type] : undefined;
  if (schema === undefined) {
    return { ok: false, error: `Unknown message type "${type}"` };
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: z.prettifyError(parsed.error) };
  }
  return { ok: true, message: { type, payload: parsed.data } as T };
}

/** Validates a message from a client (server side). */
export function parseClientMessage(type: string, payload: unknown): Parsed<ClientMessage> {
  return parseWith<ClientMessage>(clientMessages, type, payload);
}

/** Validates a message from the server (app side). */
export function parseServerMessage(type: string, payload: unknown): Parsed<ServerMessage> {
  return parseWith<ServerMessage>(serverMessages, type, payload);
}

// Analytics (FR-09, S6-02): app → api, POST /events. Numbers and fixed values only: no free text,
// so no personal data can ride along. Only signed-in players send them (no data from minors
// before parent consent).

const battleMode = z.enum(['ranked', 'invite']);

export const analyticsEvent = z.discriminatedUnion('name', [
  z.strictObject({
    name: z.literal('battle_start'),
    props: z.strictObject({ mode: battleMode, arena: arenaId }),
  }),
  z.strictObject({
    name: z.literal('battle_end'),
    props: z.strictObject({
      mode: battleMode,
      arena: arenaId,
      outcome: z.enum(['win', 'loss', 'draw']),
      reason: z.enum(['ko', 'time', 'forfeit']),
      durationMs: nat.max(10 * 60_000),
      correct: nat.max(1_000),
      wrong: nat.max(1_000),
    }),
  }),
  z.strictObject({
    name: z.literal('queue_wait'),
    props: z.strictObject({
      waitedMs: nat.max(60 * 60_000),
      outcome: z.enum(['matched', 'cancelled']),
    }),
  }),
  z.strictObject({ name: z.literal('invite_create'), props: z.strictObject({}) }),
  z.strictObject({
    name: z.literal('invite_join'),
    props: z.strictObject({ result: z.enum(['joined', 'expired', 'not-found', 'full']) }),
  }),
  z.strictObject({
    name: z.literal('consent_step'),
    props: z.strictObject({ step: z.enum(['started', 'code-sent', 'verified', 'failed']) }),
  }),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEvent>;
export type AnalyticsEventName = AnalyticsEvent['name'];
export const ANALYTICS_EVENT_NAMES = analyticsEvent.options.map(
  (o) => o.shape.name.value,
) as readonly AnalyticsEventName[];

/** One POST /events body: up to 50 events, each checked on its own. */
export const MAX_EVENTS_PER_BATCH = 50;
export const eventBatch = z.strictObject({
  events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_BATCH),
});
