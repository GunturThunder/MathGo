import type { BattleResult, BattleState, Seat } from '@mathgo/game-core';
import { outcomeFor, type Outcome } from './effects';
import type { Fighters } from './battle-view';

// What the result screen shows (S2-11), from a finished battle, seen from one seat.

export interface FighterResult {
  readonly name: string;
  /** Damage this fighter dealt: the HP the other side lost. */
  readonly damage: number;
}

export interface BattleSummary {
  readonly outcome: Outcome;
  readonly reason: BattleResult['reason'];
  /** Whole seconds left on the clock when it ended (0 at time-out). */
  readonly secondsLeft: number;
  readonly correct: number;
  /** Answers given, right or wrong. */
  readonly answered: number;
  readonly bestCombo: number;
  readonly me: FighterResult;
  readonly rival: FighterResult;
}

export function battleSummary(
  state: BattleState,
  seat: Seat,
  fighters: Fighters,
): BattleSummary | null {
  if (state.result === null) return null;
  const me = state.players[seat];
  const rival = state.players[seat === 0 ? 1 : 0];
  const { hp, durationMs } = state.rules;
  return {
    outcome: outcomeFor(state.result, seat),
    reason: state.result.reason,
    secondsLeft: Math.max(0, Math.floor((durationMs - state.now) / 1000)),
    correct: me.correct,
    answered: me.correct + me.wrong,
    bestCombo: me.bestStreak,
    me: { name: fighters.me.name, damage: hp - rival.hp },
    rival: { name: fighters.rival.name, damage: hp - me.hp },
  };
}
