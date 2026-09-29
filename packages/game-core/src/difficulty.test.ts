import { describe, expect, it } from 'vitest';
import { ARENAS, getArena } from './arenas.js';
import { difficultyProgress, questionLevelForMatch, rangeMax } from './difficulty.js';

describe('difficultyProgress', () => {
  it('runs from 0 at the arena start to 1 at its end', () => {
    for (const arena of ARENAS) {
      expect(difficultyProgress(arena, arena.minTrophies)).toBe(0);
      expect(difficultyProgress(arena, arena.maxTrophies)).toBe(1);
    }
    expect(difficultyProgress(getArena(2), 500)).toBeCloseTo(200 / 399);
  });

  it('clamps outside the arena, e.g. Power Peak above its cap', () => {
    expect(difficultyProgress(getArena(5), 5000)).toBe(1);
    expect(difficultyProgress(getArena(2), 100)).toBe(0);
  });
});

describe('rangeMax (N_max)', () => {
  // N_max at p = 0, 0.5 and 1 for every arena (S1-10).
  it.each([
    [1, 'additive', [10, 15, 20]],
    [2, 'additive', [15, 23, 30]],
    [3, 'additive', [50, 50, 50]],
    [3, 'factor', [9, 11, 12]],
    [4, 'additive', [100, 100, 100]],
    [4, 'factor', [12, 14, 15]],
    [5, 'additive', [100, 100, 100]],
    [5, 'factor', [15, 18, 20]],
  ] as const)('arena %i %s range', (id, family, expected) => {
    const range = getArena(id)[family];
    if (range === null) throw new Error('missing range');
    expect([0, 0.5, 1].map((p) => rangeMax(range, p))).toEqual(expected);
  });
});

describe('questionLevelForMatch', () => {
  it('uses the lower trophy count for both arena and T', () => {
    expect(questionLevelForMatch(250, 800)).toEqual({ arena: 1, trophies: 250 });
    expect(questionLevelForMatch(1900, 1250)).toEqual({ arena: 4, trophies: 1250 });
    expect(questionLevelForMatch(400, 400)).toEqual({ arena: 2, trophies: 400 });
  });
});
