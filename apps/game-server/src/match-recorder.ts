import { matchAnswers, matches, type Database } from '@mathgo/db';
import type { BattleState, Seat } from '@mathgo/game-core';
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

export interface MatchRecorder {
  /** Stores the match and its answers; resolves to the match id. */
  record(match: FinishedMatch): Promise<string>;
}

/** Postgres: one `matches` row and one `match_answers` row per counted answer, together. */
export class DbMatchRecorder implements MatchRecorder {
  constructor(private readonly db: Database) {}

  async record({
    mode,
    battle,
    users,
    startedAt,
    endedAt,
    answers,
  }: FinishedMatch): Promise<string> {
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
      return row.id;
    });
  }
}

/** Records nothing; for tests that are not about storage. */
export const noMatchRecorder: MatchRecorder = { record: async () => 'not-recorded' };
