import { describe, expect, it } from 'vitest';
import { ARENAS, arenaForTrophies, getArena } from './arenas.js';

describe('ARENAS', () => {
  it('matches the PRD "Rules per arena" table', () => {
    const summary = ARENAS.map((a) => ({
      id: a.id,
      trophies: [a.minTrophies, a.maxTrophies],
      terms: [a.terms.min, a.terms.max],
      operators: a.operators.join(''),
      additive: [a.additive.min, a.additive.lowMax, a.additive.highMax],
      factor: a.factor && [a.factor.min, a.factor.lowMax, a.factor.highMax],
      answer: [a.answer.min, a.answer.max],
    }));
    expect(summary).toEqual([
      {
        id: 1,
        trophies: [0, 299],
        terms: [2, 2],
        operators: '+-',
        additive: [1, 10, 20],
        factor: null,
        answer: [0, 40],
      },
      {
        id: 2,
        trophies: [300, 699],
        terms: [3, 4],
        operators: '+-',
        additive: [1, 15, 30],
        factor: null,
        answer: [0, 100],
      },
      {
        id: 3,
        trophies: [700, 1199],
        terms: [2, 3],
        operators: '+-*/',
        additive: [1, 50, 50],
        factor: [2, 9, 12],
        answer: [0, 200],
      },
      {
        id: 4,
        trophies: [1200, 1799],
        terms: [3, 4],
        operators: '+-*/',
        additive: [1, 100, 100],
        factor: [2, 12, 15],
        answer: [0, 999],
      },
      {
        id: 5,
        trophies: [1800, 2399],
        terms: [3, 4],
        operators: '+-*/',
        additive: [-100, 100, 100],
        factor: [2, 15, 20],
        answer: [-999, 9999],
      },
    ]);
  });

  it('turns on the special rules only where the PRD allows them', () => {
    expect(ARENAS.map((a) => a.requiresMulDiv)).toEqual([false, false, true, false, false]);
    expect(ARENAS.map((a) => a.brackets)).toEqual([false, false, false, true, true]);
    expect(ARENAS.map((a) => a.powersAndRoots)).toEqual([false, false, false, false, true]);
    expect(ARENAS.map((a) => a.negatives)).toEqual([false, false, false, false, true]);
  });

  it('has arenas that follow on from each other with no gaps', () => {
    ARENAS.slice(1).forEach((arena, i) => {
      expect(arena.minTrophies).toBe((ARENAS[i]?.maxTrophies ?? 0) + 1);
    });
  });
});

describe('arenaForTrophies', () => {
  it.each([
    [0, 1],
    [299, 1],
    [300, 2],
    [699, 2],
    [700, 3],
    [1199, 3],
    [1200, 4],
    [1799, 4],
    [1800, 5],
    [2399, 5],
    [10_000, 5],
  ])('%i trophies → arena %i', (trophies, id) => {
    expect(arenaForTrophies(trophies).id).toBe(id);
  });

  it('rejects negative or fractional trophy counts', () => {
    expect(() => arenaForTrophies(-1)).toThrow(RangeError);
    expect(() => arenaForTrophies(1.5)).toThrow(RangeError);
  });
});

describe('getArena', () => {
  it('returns the arena by id', () => {
    expect(getArena(3).name).toBe('Times Tower');
  });
});
