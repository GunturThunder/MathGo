import { describe, expect, it } from 'vitest';
import { ExpressionError, evaluate, format, parse, type Expression } from './expression.js';

const valueOf = (text: string): number => evaluate(parse(text)).value;

describe('evaluate', () => {
  // The worked examples from the PRD's "Rules per arena" table.
  it.each([
    ['10 + 10', 20],
    ['10 + 12 + 2 − 10', 14],
    ['7 × 8 − 12', 44],
    ['(24 + 16) ÷ 8 × 3', 15],
    ['12² − 45 ÷ 5 × 3', 117],
  ])('%s = %i', (text, expected) => {
    expect(valueOf(text)).toBe(expected);
  });

  it('applies × and ÷ before + and −, left to right', () => {
    expect(valueOf('2 + 3 × 4')).toBe(14);
    expect(valueOf('20 − 12 ÷ 4 × 2')).toBe(14);
    expect(valueOf('48 ÷ 6 ÷ 2')).toBe(4);
    expect(valueOf('10 − 4 − 3')).toBe(3);
  });

  it('handles square roots of perfect squares and negative numbers', () => {
    expect(valueOf('√144')).toBe(12);
    expect(valueOf('5 − (−3)')).toBe(8);
    expect(valueOf('−25 − 75')).toBe(-100);
    expect(valueOf('(−5 + 2) × 3')).toBe(-9);
  });

  it('reports the lowest running total, including inside brackets', () => {
    expect(evaluate(parse('10 − 12 + 5')).lowestRunningTotal).toBe(-2);
    expect(evaluate(parse('3 + 4')).lowestRunningTotal).toBe(3);
    expect(evaluate(parse('(3 − 5) × 2 + 10')).lowestRunningTotal).toBe(-4);
  });

  it('refuses a division that is not whole, or by zero', () => {
    expect(() => valueOf('7 ÷ 2')).toThrow(ExpressionError);
    expect(() => valueOf('6 × 5 ÷ 4')).toThrow(ExpressionError);
    expect(() => valueOf('8 ÷ 0')).toThrow(ExpressionError);
  });

  it('refuses the square root of a non-perfect square', () => {
    expect(() => valueOf('√50')).toThrow(ExpressionError);
  });

  it('refuses a malformed expression', () => {
    const broken: Expression = { terms: [{ kind: 'number', value: 1 }], operators: ['+'] };
    expect(() => evaluate(broken)).toThrow(ExpressionError);
  });
});

describe('format', () => {
  it('uses the display symbols + − × ÷ ² √', () => {
    const expression: Expression = {
      terms: [
        { kind: 'square', base: 12 },
        { kind: 'number', value: 45 },
        { kind: 'number', value: 5 },
        { kind: 'sqrt', radicand: 9 },
      ],
      operators: ['-', '/', '*'],
    };
    expect(format(expression)).toBe('12² − 45 ÷ 5 × √9');
  });

  it('brackets a negative number unless it comes first', () => {
    const expression: Expression = {
      terms: [
        { kind: 'number', value: -7 },
        { kind: 'number', value: -3 },
      ],
      operators: ['-'],
    };
    expect(format(expression)).toBe('−7 − (−3)');
  });
});

describe('parse', () => {
  it.each(['10 + 10', '(24 + 16) ÷ 8 × 3', '12² − 45 ÷ 5 × 3', '−7 − (−3) + √144', '3 × (−5 + 2)'])(
    'round-trips %s',
    (text) => {
      expect(format(parse(text))).toBe(text);
    },
  );

  it('accepts ASCII operators too', () => {
    expect(valueOf('7 * 8 - 12')).toBe(44);
    expect(valueOf('48 / 6')).toBe(8);
  });

  it('rejects text it cannot read', () => {
    expect(() => parse('7 × ')).toThrow(ExpressionError);
    expect(() => parse('7 % 2')).toThrow(ExpressionError);
    expect(() => parse('(1 + 2')).toThrow(ExpressionError);
    expect(() => parse('1 2')).toThrow(ExpressionError);
  });
});
