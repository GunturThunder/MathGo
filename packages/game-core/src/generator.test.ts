import { describe, expect, it } from 'vitest';
import type { ArenaId } from './arenas.js';
import { getArena } from './arenas.js';
import { hasMulDiv, type Expression, type Term } from './expression.js';
import { generateQuestion, generateQuestions } from './generator.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => (i * 2_654_435_761) >>> 0);

const sample = (arena: ArenaId, trophies = getArena(arena).minTrophies) =>
  SEEDS.flatMap((seed) => generateQuestions(seed, 0, 5, { arena, trophies }));

const allTerms = (expression: Expression): Term[] =>
  expression.terms.flatMap((term) =>
    term.kind === 'group' ? [term, ...allTerms(term.expression)] : [term],
  );

describe('generateQuestion', () => {
  it('is a function of seed, index and level only', () => {
    const level = { arena: 4, trophies: 1500 } as const;
    expect(generateQuestion(987_654, 3, level)).toEqual(generateQuestion(987_654, 3, level));
    expect(generateQuestions(987_654, 2, 3, level)[1]).toEqual(generateQuestion(987_654, 3, level));
  });

  it('varies between questions and between seeds', () => {
    const level = { arena: 2, trophies: 500 } as const;
    const texts = new Set(generateQuestions(1, 0, 20, level).map((q) => q.text));
    expect(texts.size).toBeGreaterThan(15);
    expect(generateQuestion(1, 0, level).text).not.toBe(generateQuestion(2, 0, level).text);
  });

  it('Counting Camp: two numbers joined by + or −', () => {
    for (const q of sample(1)) {
      expect(q.expression.terms).toHaveLength(2);
      expect(['+', '-']).toContain(q.expression.operators[0]);
    }
  });

  it('Plus Plains: 3–4 numbers with + and − only', () => {
    for (const q of sample(2)) {
      expect(q.expression.terms.length).toBeGreaterThanOrEqual(3);
      expect(q.expression.terms.length).toBeLessThanOrEqual(4);
      expect(hasMulDiv(q.expression)).toBe(false);
    }
  });

  it('Times Tower: always a × or ÷, times-table sized factors', () => {
    for (const q of sample(3, 1199)) {
      expect(hasMulDiv(q.expression)).toBe(true);
    }
  });

  it('Mixed Mountain: sometimes brackets, never powers or negatives', () => {
    const questions = sample(4);
    expect(questions.some((q) => q.expression.terms.some((t) => t.kind === 'group'))).toBe(true);
    for (const q of questions) {
      for (const term of allTerms(q.expression)) {
        expect(['number', 'group']).toContain(term.kind);
        if (term.kind === 'number') expect(term.value).toBeGreaterThan(0);
      }
    }
  });

  it('Power Peak: uses squares, square roots and negative numbers', () => {
    const terms = sample(5).flatMap((q) => allTerms(q.expression));
    expect(terms.some((t) => t.kind === 'square')).toBe(true);
    expect(terms.some((t) => t.kind === 'sqrt')).toBe(true);
    expect(terms.some((t) => t.kind === 'number' && t.value < 0)).toBe(true);
  });

  it('grows the numbers as a player climbs through an arena', () => {
    const largest = (trophies: number) =>
      Math.max(
        ...sample(1, trophies).flatMap((q) =>
          allTerms(q.expression).map((t) => (t.kind === 'number' ? t.value : 0)),
        ),
      );
    expect(largest(0)).toBe(10);
    expect(largest(299)).toBe(20);
  });
});
