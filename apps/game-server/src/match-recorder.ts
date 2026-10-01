import {
  eq,
  inArray,
  matchAnswers,
  matches,
  trophyLedger,
  users as usersTable,
  type Database,
} from '@mathgo/db';
import { settleTrophies, type BattleState, type Seat, type TrophyChange } from '@mathgo/game-core';
import type { AnswerRecord } from './battle-session.js';

/** A finished battle, ready to store (S4-03). */
export interface FinishedMatch {
  readonly mode: 'ranked' | 'invite';
  readonly battle: BattleState;
  /** The user id in each seat. */
  readonly users: readonly [string, string];
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly answers: readonly AnswerRecord[];
}

export interface RecordedMatch {
  readonly matchId: string;
  /** Each seat's trophy change; null for invite battles, which never change trophies (S5-03). */
  readonly trophies: readonly [TrophyChange, TrophyChange] | null;
}

export interface MatchRecorder {
  /** Stores the match and its answers and, for ranked battles, settles the trophies. */
  record(match: FinishedMatch): Promise<RecordedMatch>;
}

/**
 * Postgres, in one transaction: one `matches` row, one `match_answers` row per counted answer,
 * and for ranked battles the trophy settlement (FR-08): both players' rows locked, the change
 * from game-core's settleTrophies on their current trophies, `users.trophies` updated and one
 * `trophy_ledger` row each. Every trophy change goes through the ledger, so it always adds up.
 */
export class DbMatchRecorder implements MatchRecorder {
  constructor(private readonly db: Database) {}

  async record({
    mode,
    battle,
    users,
    startedAt,
    endedAt,
    answers,
  }: FinishedMatch): Promise<RecordedMatch> {
    const result = battle.result;
    if (result === null) throw new Error('Only finished battles are recorded');
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(matches)
        .values({
          mode,
          arena: battle.level.arena,
          levelTrophies: battle.level.trophies,
          seed: battle.seed,
          seat0UserId: users[0],
          seat1UserId: users[1],
          startedAt,
          endedAt,
          outcome: result.outcome,
          winnerSeat: result.outcome === 'win' ? result.winner : null,
          endReason: result.reason,
          seat0Hp: battle.players[0].hp,
          seat1Hp: battle.players[1].hp,
        })
        .returning({ id: matches.id });
      if (row === undefined) throw new Error('match insert returned nothing');
      if (answers.length > 0) {
        await tx.insert(matchAnswers).values(
          answers.map((a) => ({
            matchId: row.id,
            seat: a.seat,
            userId: users[a.seat as Seat],
            questionIndex: a.questionIndex,
            value: a.value,
            correct: a.correct,
            latencyMs: a.latencyMs,
            atMs: a.atMs,
            tooFast: a.tooFast,
          })),
        );
      }
      if (mode !== 'ranked') return { matchId: row.id, trophies: null };

      // Lock both players so concurrent settlements for the same player queue up.
      const locked = await tx
        .select({ id: usersTable.id, trophies: usersTable.trophies })
        .from(usersTable)
        .where(inArray(usersTable.id, [...users]))
        .for('update');
      const current = (seat: Seat) => {
        const player = locked.find((u) => u.id === users[seat]);
        if (player === undefined) throw new Error(`No user ${users[seat]} to settle`);
        return player.trophies;
      };
      const changes = settleTrophies(result, [current(0), current(1)]);
      for (const seat of [0, 1] as const) {
        const change = changes[seat];
        await tx
          .update(usersTable)
          .set({ trophies: change.trophies })
          .where(eq(usersTable.id, users[seat]));
        await tx.insert(trophyLedger).values({
          userId: users[seat],
          matchId: row.id,
          delta: change.delta,
          trophiesAfter: change.trophies,
          reason: 'match',
        });
      }
      return { matchId: row.id, trophies: changes };
    });
  }
}

/** Records nothing; for tests that are not about storage. */
export const noMatchRecorder: MatchRecorder = {
  record: async () => ({ matchId: 'not-recorded', trophies: null }),
};
