import { arenaForTrophies, type ArenaId, type ArenaRules, type NumberRange } from './arenas.js';

/**
 * How far a trophy count is through its arena: p in the PRD's formula,
 * p = (T − T_start) / (T_end − T_start), clamped to [0, 1].
 */
export function difficultyProgress(arena: ArenaRules, trophies: number): number {
  const span = arena.maxTrophies - arena.minTrophies;
  const p = (trophies - arena.minTrophies) / span;
  return Math.min(1, Math.max(0, p));
}

/** N_max = round(N_low + p × (N_high − N_low)). */
export function rangeMax(range: NumberRange, progress: number): number {
  return Math.round(range.lowMax + progress * (range.highMax - range.lowMax));
}

/** The arena and trophy count that set a match's questions. */
export interface QuestionLevel {
  readonly arena: ArenaId;
  readonly trophies: number;
}

/**
 * When two players meet, the lower trophy count sets both the arena and T, so neither player
 * gets questions above their level.
 */
export function questionLevelForMatch(trophiesA: number, trophiesB: number): QuestionLevel {
  const trophies = Math.min(trophiesA, trophiesB);
  return { arena: arenaForTrophies(trophies).id, trophies };
}
