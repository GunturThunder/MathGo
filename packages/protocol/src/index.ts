import { z } from 'zod';

/**
 * Bump on any breaking change to these messages. The app sends it on join; the server refuses
 * older clients with `update-required`, because store builds lag behind server deploys.
 */
export const PROTOCOL_VERSION = 1;

/** The Colyseus room the app joins for a battle. */
export const BATTLE_ROOM = 'battle';

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
} as const;

export const serverMessages = {
  joined,
  questions: questionBatch,
  state: stateUpdate,
  end: battleEnd,
  error: errorMessage,
} as const;

export type JoinRequest = z.infer<typeof joinRequest>;
export type AnswerRequest = z.infer<typeof answerRequest>;
export type Joined = z.infer<typeof joined>;
export type QuestionBatch = z.infer<typeof questionBatch>;
export type StateUpdate = z.infer<typeof stateUpdate>;
export type BattleEnd = z.infer<typeof battleEnd>;
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
