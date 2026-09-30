import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Personal data stays minimal (PRD: UU PDP, PP Tunas). Deleting a user removes their personal
// rows and anonymises their matches, so an erasure request is one DELETE.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const consentChannel = pgEnum('consent_channel', ['whatsapp', 'sms']);
export const matchMode = pgEnum('match_mode', ['ranked', 'invite']);
export const matchOutcome = pgEnum('match_outcome', ['win', 'draw']);
export const matchEndReason = pgEnum('match_end_reason', ['ko', 'time', 'forfeit']);
export const trophyReason = pgEnum('trophy_reason', ['match', 'reversal']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Chosen from generated names (adjective + animal); never typed. */
    nickname: text('nickname').notNull(),
    /** The only age data kept (FR-20). */
    birthYear: smallint('birth_year').notNull(),
    trophies: integer('trophies').notNull().default(0),
    /** Subject IDs from Google and Apple sign-in (S6-01); null for guests. */
    googleSub: text('google_sub').unique(),
    appleSub: text('apple_sub').unique(),
    createdAt: createdAt(),
  },
  (t) => [
    check('users_trophies_non_negative', sql`${t.trophies} >= 0`),
    check('users_birth_year_range', sql`${t.birthYear} between 1900 and 2100`),
  ],
);

export const parentalConsents = pgTable('parental_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Keyed hash of the parent's phone number; the number itself is not stored. */
  phoneHash: text('phone_hash').notNull(),
  channel: consentChannel('channel').notNull(),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mode: matchMode('mode').notNull(),
    /** Questions came from this arena at this trophy level (the lower player's). */
    arena: smallint('arena').notNull(),
    levelTrophies: integer('level_trophies').notNull(),
    /** Secret match seed (uint32), kept to replay and audit a battle. Never sent to the app. */
    seed: bigint('seed', { mode: 'number' }).notNull(),
    /** Null once the player's account is deleted. */
    seat0UserId: uuid('seat0_user_id').references(() => users.id, { onDelete: 'set null' }),
    seat1UserId: uuid('seat1_user_id').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    outcome: matchOutcome('outcome').notNull(),
    /** Null for a draw. */
    winnerSeat: smallint('winner_seat'),
    endReason: matchEndReason('end_reason').notNull(),
    seat0Hp: smallint('seat0_hp').notNull(),
    seat1Hp: smallint('seat1_hp').notNull(),
  },
  (t) => [
    check('matches_arena_range', sql`${t.arena} between 1 and 5`),
    check('matches_seed_uint32', sql`${t.seed} between 0 and 4294967295`),
    check(
      'matches_winner_matches_outcome',
      sql`(${t.outcome} = 'draw' and ${t.winnerSeat} is null) or (${t.outcome} = 'win' and ${t.winnerSeat} in (0, 1))`,
    ),
    check('matches_draw_only_at_time', sql`${t.outcome} = 'win' or ${t.endReason} = 'time'`),
    index('matches_seat0_user_id_idx').on(t.seat0UserId),
    index('matches_seat1_user_id_idx').on(t.seat1UserId),
  ],
);

export const matchAnswers = pgTable(
  'match_answers',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    seat: smallint('seat').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    questionIndex: integer('question_index').notNull(),
    value: integer('value').notNull(),
    correct: boolean('correct').notNull(),
    /** Server clock: question sent → answer received. */
    latencyMs: integer('latency_ms').notNull(),
    /** When the answer arrived, in ms from the battle start. */
    atMs: integer('at_ms').notNull(),
    /** Answered under 300 ms: reviewed for cheating (S4-06, S6-04). */
    tooFast: boolean('too_fast').notNull().default(false),
  },
  (t) => [
    check('match_answers_seat', sql`${t.seat} in (0, 1)`),
    check('match_answers_latency_non_negative', sql`${t.latencyMs} >= 0`),
    uniqueIndex('match_answers_match_seat_question_idx').on(t.matchId, t.seat, t.questionIndex),
    index('match_answers_user_too_fast_idx').on(t.userId, t.tooFast),
  ],
);

export const trophyLedger = pgTable(
  'trophy_ledger',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Null only for a reversal not tied to one match. */
    matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
    delta: integer('delta').notNull(),
    trophiesAfter: integer('trophies_after').notNull(),
    reason: trophyReason('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('trophy_ledger_trophies_after_non_negative', sql`${t.trophiesAfter} >= 0`),
    // A match settles each player's trophies once (S5-03).
    uniqueIndex('trophy_ledger_one_settlement_idx')
      .on(t.userId, t.matchId)
      .where(sql`${t.reason} = 'match'`),
    index('trophy_ledger_user_id_idx').on(t.userId),
  ],
);

/** Analytics (FR-09): event names and properties only, no personal data. */
export const events = pgTable(
  'events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    /** Pseudonymous, for retention (S6-15); null for anonymous events and deleted users. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    props: jsonb('props').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('events_name_created_at_idx').on(t.name, t.createdAt)],
);

/**
 * Refresh tokens (S3-02). Only a SHA-256 hash is stored. Each token works once: using it marks
 * `used_at` and issues a new one, and presenting a used token again revokes the user's tokens.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_id_idx').on(t.userId)],
);
