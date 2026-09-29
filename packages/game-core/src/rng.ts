/**
 * Deterministic random numbers for game-core.
 *
 * The same (seed, stream) pair yields the same sequence in Node and in Hermes: only 32-bit integer
 * maths (`Math.imul`, `>>>`) is used. Never use `Math.random` in game-core.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability (0 to 1). */
  chance(probability: number): boolean;
}

const UINT32_MAX = 0xffff_ffff;

/** MurmurHash3 finalizer: spreads the bits of a 32-bit integer. */
function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85eb_ca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2_ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function assertUint32(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${name} must be an integer from 0 to ${UINT32_MAX}, got ${value}`);
  }
}

/**
 * Creates a generator for one stream of a seed. Questions use the match seed as `seed` and the
 * question number as `stream`, so each question can be rebuilt on its own.
 */
export function createRng(seed: number, stream = 0): Rng {
  assertUint32('seed', seed);
  assertUint32('stream', stream);

  // Mulberry32 state, derived from both inputs so neighbouring streams are unrelated.
  let state = mix32(seed ^ mix32(Math.imul(stream + 1, 0x9e37_79b9)));

  const next = (): number => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new RangeError(`int(${min}, ${max}): bounds must be integers with min <= max`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new RangeError('pick() needs at least one item');
    }
    return items[int(0, items.length - 1)] as T;
  };

  const chance = (probability: number): boolean => next() < probability;

  return { next, int, pick, chance };
}
