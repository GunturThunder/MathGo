import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ARENAS } from './arenas.js';
import { difficultyProgress, rangeMax } from './difficulty.js';
import { evaluate, parse, type Expression } from './expression.js';
import { generateQuestion } from './generator.js';

/** 10,000 generated questions per arena (S1-14). */
const RUNS = 10_000;

const flatNumbers = (expression: Expression): number[] =>
  expression.terms.flatMap((term) => {
    switch (term.kind) {
      case 'number':
        return [term.value];
      case 'group':
        return flatNumbers(term.expression);
      default:
        return [];
    }
  });

describe.each(ARENAS)('arena $id · $name', (arena) => {
  const input = fc.record({
    seed: fc.nat({ max: 0xffff_ffff }),
    index: fc.nat({ max: 200 }),
    // Past the top of Power Peak too, where difficulty stops growing.
    trophies: fc.integer({
      min: arena.minTrophies,
      max: arena.maxTrophies + (arena.id === 5 ? 3000 : 0),
    }),
  });

  it('always finds a question that follows every rule', () => {
    fc.assert(
      fc.property(input, ({ seed, index, trophies }) => {
        const question = generateQuestion(seed, index, { arena: arena.id, trophies });
        const { value, lowestRunningTotal } = evaluate(question.expression);

        // Whole-number answer that matches the stored one.
        expect(Number.isInteger(question.answer)).toBe(true);
        expect(value).toBe(question.answer);

        // Within the arena's answer limit.
        expect(question.answer).toBeGreaterThanOrEqual(arena.answer.min);
        expect(question.answer).toBeLessThanOrEqual(arena.answer.max);

        // No negative running totals before Power Peak.
        if (!arena.negatives) {
          expect(lowestRunningTotal).toBeGreaterThanOrEqual(0);
        }

        // Term count and operators allowed in this arena.
        const { terms, operators } = question.expression;
        expect(terms.length).toBeGreaterThanOrEqual(arena.terms.min);
        expect(terms.length).toBeLessThanOrEqual(arena.terms.max);
        for (const op of operators) {
          expect(arena.operators).toContain(op);
        }

        // The text players see means the same thing as the expression.
        expect(evaluate(parse(question.text)).value).toBe(question.answer);
      }),
      { numRuns: RUNS },
    );
  });

  it('is deterministic for a given seed, index and trophy count', () => {
    fc.assert(
      fc.property(input, ({ seed, index, trophies }) => {
        const level = { arena: arena.id, trophies };
        expect(generateQuestion(seed, index, level)).toEqual(generateQuestion(seed, index, level));
      }),
      { numRuns: 1_000 },
    );
  });

  if (arena.factor === null) {
    it('keeps every number within 1 to N_max', () => {
      fc.assert(
        fc.property(input, ({ seed, index, trophies }) => {
          const question = generateQuestion(seed, index, { arena: arena.id, trophies });
          const max = rangeMax(arena.additive, difficultyProgress(arena, trophies));
          for (const n of flatNumbers(question.expression)) {
            expect(n).toBeGreaterThanOrEqual(1);
            expect(n).toBeLessThanOrEqual(max);
          }
        }),
        { numRuns: RUNS },
      );
    });
  }
});
