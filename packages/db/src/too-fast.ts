import { eq, gte, sql } from 'drizzle-orm';
import type { Database } from './database.js';
import { matchAnswers, matches, users } from './schema.js';

/** Defaults for the weekly review (S6-04): flagged again and again, not once by luck. */
export const TOO_FAST_REVIEW = { days: 7, minTooFast: 10, minMatches: 2 } as const;

export interface TooFastOptions {
  /** Look at matches started at or after this time. */
  readonly since: Date;
  /** At least this many answers under 300 ms (S4-06's too_fast flag)… */
  readonly minTooFast?: number;
  /** …spread over at least this many matches. */
  readonly minMatches?: number;
}

export interface TooFastAccount {
  readonly userId: string;
  readonly nickname: string;
  readonly trophies: number;
  readonly answers: number;
  readonly tooFast: number;
  /** tooFast / answers, 0 to 1. */
  readonly share: number;
  readonly matchesWithTooFast: number;
  readonly fastestMs: number;
  readonly lastMatchAt: Date;
}

/**
 * Accounts that answered under 300 ms repeatedly in the window, worst first, for a person to
 * review (and, if it is cheating, reverse their trophies in the ledger). Only matches started at
 * or after `since` count; answers of deleted accounts (user_id null) are left out.
 */
export async function tooFastAccounts(
  db: Database,
  options: TooFastOptions,
): Promise<TooFastAccount[]> {
  const minTooFast = options.minTooFast ?? TOO_FAST_REVIEW.minTooFast;
  const minMatches = options.minMatches ?? TOO_FAST_REVIEW.minMatches;
  const tooFast = sql<number>`count(*) filter (where ${matchAnswers.tooFast})::int`;
  const matchesWithTooFast = sql<number>`count(distinct ${matchAnswers.matchId}) filter (where ${matchAnswers.tooFast})::int`;

  const rows = await db
    .select({
      userId: users.id,
      nickname: users.nickname,
      trophies: users.trophies,
      answers: sql<number>`count(*)::int`,
      tooFast,
      matchesWithTooFast,
      fastestMs: sql<number>`coalesce(min(${matchAnswers.latencyMs}) filter (where ${matchAnswers.tooFast}), 0)::int`,
      lastMatchAt: sql<Date>`max(${matches.startedAt})`,
    })
    .from(matchAnswers)
    .innerJoin(matches, eq(matches.id, matchAnswers.matchId))
    .innerJoin(users, eq(users.id, matchAnswers.userId))
    .where(gte(matches.startedAt, options.since))
    .groupBy(users.id)
    .having(sql`${tooFast} >= ${minTooFast} and ${matchesWithTooFast} >= ${minMatches}`)
    .orderBy(sql`${tooFast} desc`, users.id);

  return rows.map((r) => ({
    ...r,
    share: r.answers === 0 ? 0 : r.tooFast / r.answers,
    lastMatchAt: new Date(r.lastMatchAt),
  }));
}
