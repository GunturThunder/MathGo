/**
 * Arena table from the PRD ("Trophies and arenas" and "Rules per arena").
 * Names and ranges are placeholders to tune after beta.
 */

export type ArenaId = 1 | 2 | 3 | 4 | 5;

/** Operators as stored; `format()` shows them as + − × ÷. */
export type Operator = '+' | '-' | '*' | '/';

/**
 * The numbers one operator family may use. The lower bound is fixed; the upper bound grows
 * from `lowMax` at the arena's start to `highMax` at its end (PRD "Difficulty inside an arena").
 */
export interface NumberRange {
  readonly min: number;
  readonly lowMax: number;
  readonly highMax: number;
}

export interface ArenaRules {
  readonly id: ArenaId;
  readonly name: string;
  readonly minTrophies: number;
  /** Inclusive top of the arena, used as T_end in the difficulty formula. */
  readonly maxTrophies: number;
  readonly terms: { readonly min: number; readonly max: number };
  readonly operators: readonly Operator[];
  /** Every question has at least one × or ÷. */
  readonly requiresMulDiv: boolean;
  readonly brackets: boolean;
  readonly powersAndRoots: boolean;
  /** Negative numbers and negative running totals are allowed. */
  readonly negatives: boolean;
  /** Operands of + and −. */
  readonly additive: NumberRange;
  /** Operands of × and ÷, or null when the arena has none. */
  readonly factor: NumberRange | null;
  readonly answer: { readonly min: number; readonly max: number };
}

/**
 * Power Peak has no upper trophy bound in the PRD. Its numbers stop growing here (an assumption:
 * the same 600-trophy width as Mixed Mountain). Revisit with beta data.
 */
export const POWER_PEAK_DIFFICULTY_CAP = 2399;

export const ARENAS: readonly ArenaRules[] = [
  {
    id: 1,
    name: 'Counting Camp',
    minTrophies: 0,
    maxTrophies: 299,
    terms: { min: 2, max: 2 },
    operators: ['+', '-'],
    requiresMulDiv: false,
    brackets: false,
    powersAndRoots: false,
    negatives: false,
    additive: { min: 1, lowMax: 10, highMax: 20 },
    factor: null,
    answer: { min: 0, max: 40 },
  },
  {
    id: 2,
    name: 'Plus Plains',
    minTrophies: 300,
    maxTrophies: 699,
    terms: { min: 3, max: 4 },
    operators: ['+', '-'],
    requiresMulDiv: false,
    brackets: false,
    powersAndRoots: false,
    negatives: false,
    additive: { min: 1, lowMax: 15, highMax: 30 },
    factor: null,
    answer: { min: 0, max: 100 },
  },
  {
    id: 3,
    name: 'Times Tower',
    minTrophies: 700,
    maxTrophies: 1199,
    terms: { min: 2, max: 3 },
    operators: ['+', '-', '*', '/'],
    requiresMulDiv: true,
    brackets: false,
    powersAndRoots: false,
    negatives: false,
    additive: { min: 1, lowMax: 50, highMax: 50 },
    factor: { min: 2, lowMax: 9, highMax: 12 },
    answer: { min: 0, max: 200 },
  },
  {
    id: 4,
    name: 'Mixed Mountain',
    minTrophies: 1200,
    maxTrophies: 1799,
    terms: { min: 3, max: 4 },
    operators: ['+', '-', '*', '/'],
    requiresMulDiv: false,
    brackets: true,
    powersAndRoots: false,
    negatives: false,
    additive: { min: 1, lowMax: 100, highMax: 100 },
    factor: { min: 2, lowMax: 12, highMax: 15 },
    answer: { min: 0, max: 999 },
  },
  {
    id: 5,
    name: 'Power Peak',
    minTrophies: 1800,
    maxTrophies: POWER_PEAK_DIFFICULTY_CAP,
    terms: { min: 3, max: 4 },
    operators: ['+', '-', '*', '/'],
    requiresMulDiv: false,
    brackets: true,
    powersAndRoots: true,
    negatives: true,
    additive: { min: -100, lowMax: 100, highMax: 100 },
    factor: { min: 2, lowMax: 15, highMax: 20 },
    answer: { min: -999, max: 9999 },
  },
];

export function getArena(id: ArenaId): ArenaRules {
  const arena = ARENAS[id - 1];
  if (arena === undefined) {
    throw new RangeError(`Unknown arena ${id}`);
  }
  return arena;
}

/** The arena a trophy count belongs to. Counts above Power Peak's cap stay in Power Peak. */
export function arenaForTrophies(trophies: number): ArenaRules {
  if (!Number.isInteger(trophies) || trophies < 0) {
    throw new RangeError(`Trophies must be a non-negative integer, got ${trophies}`);
  }
  for (let i = ARENAS.length - 1; i >= 0; i--) {
    const arena = ARENAS[i] as ArenaRules;
    if (trophies >= arena.minTrophies) {
      return arena;
    }
  }
  throw new RangeError(`No arena for ${trophies} trophies`);
}
