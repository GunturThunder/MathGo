import { arenaForTrophies, type ArenaId } from './arenas.js';
import type { BattleResult, Seat } from './battle.js';

/** Starting values from the PRD's "Trophies and arenas"; tuned after beta. */
export interface TrophyRules {
  readonly win: number;
  /** Negative: trophies lost. */
  readonly loss: number;
  /** Largest adjustment for a trophy gap, either way. */
  readonly maxGapAdjustment: number;
  /** Trophy gap per point of adjustment; smaller gaps change nothing. */
  readonly gapPerPoint: number;
}

export const DEFAULT_TROPHY_RULES: TrophyRules = {
  win: 30,
  loss: -20,
  maxGapAdjustment: 10,
  gapPerPoint: 20,
};

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface TrophyInput {
  readonly trophies: number;
  readonly opponentTrophies: number;
  readonly outcome: MatchOutcome;
  readonly rules?: TrophyRules;
}

export interface TrophyChange {
  /** Trophies actually gained or lost, after the arena floor. Goes in the trophy ledger. */
  readonly delta: number;
  readonly trophies: number;
  readonly arenaBefore: ArenaId;
  readonly arenaAfter: ArenaId;
  /** The loss was cut short by the arena floor. */
  readonly floored: boolean;
}

function assertTrophies(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Adjustment for the trophy gap: positive when the opponent has more trophies. One point per
 * full `gapPerPoint`, capped at ±`maxGapAdjustment`, so beating a stronger player earns more and
 * losing to one costs less.
 */
export function gapAdjustment(
  trophies: number,
  opponentTrophies: number,
  rules: TrophyRules = DEFAULT_TROPHY_RULES,
): number {
  const points = Math.trunc((opponentTrophies - trophies) / rules.gapPerPoint);
  const capped = Math.max(-rules.maxGapAdjustment, Math.min(rules.maxGapAdjustment, points));
  // `+ 0` turns -0 into 0.
  return capped + 0;
}

/**
 * One player's trophy change after a ranked battle. Players never drop below the start of the
 * arena they are in; since that floor always holds, it is also the highest arena they reached.
 */
export function trophyChange({
  trophies,
  opponentTrophies,
  outcome,
  rules = DEFAULT_TROPHY_RULES,
}: TrophyInput): TrophyChange {
  assertTrophies('trophies', trophies);
  assertTrophies('opponentTrophies', opponentTrophies);

  const arenaBefore = arenaForTrophies(trophies);
  const adjustment = gapAdjustment(trophies, opponentTrophies, rules);
  const wanted = outcome === 'draw' ? 0 : (outcome === 'win' ? rules.win : rules.loss) + adjustment;
  const next = Math.max(arenaBefore.minTrophies, trophies + wanted);

  return {
    delta: next - trophies,
    trophies: next,
    arenaBefore: arenaBefore.id,
    arenaAfter: arenaForTrophies(next).id,
    floored: next > trophies + wanted,
  };
}

/** Both players' changes for a finished ranked battle, by seat. */
export function settleTrophies(
  result: BattleResult,
  trophies: readonly [number, number],
  rules: TrophyRules = DEFAULT_TROPHY_RULES,
): readonly [TrophyChange, TrophyChange] {
  const outcomeFor = (seat: Seat): MatchOutcome => {
    if (result.outcome === 'draw') return 'draw';
    return result.winner === seat ? 'win' : 'loss';
  };
  const [a, b] = trophies;
  return [
    trophyChange({ trophies: a, opponentTrophies: b, outcome: outcomeFor(0), rules }),
    trophyChange({ trophies: b, opponentTrophies: a, outcome: outcomeFor(1), rules }),
  ];
}
