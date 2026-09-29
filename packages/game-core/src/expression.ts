import type { Operator } from './arenas.js';

/** One operand of an expression. */
export type Term =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'square'; readonly base: number }
  | { readonly kind: 'sqrt'; readonly radicand: number }
  | { readonly kind: 'group'; readonly expression: Expression };

/** A flat list of terms joined by operators; `operators.length === terms.length - 1`. */
export interface Expression {
  readonly terms: readonly Term[];
  readonly operators: readonly Operator[];
}

/** Thrown when an expression breaks a rule: inexact division, a non-perfect-square root, bad shape. */
export class ExpressionError extends Error {
  override name = 'ExpressionError';
}

export interface Evaluation {
  readonly value: number;
  /**
   * The lowest running total met while evaluating, including inside brackets. Running totals are
   * the sums after each + or − step, once × and ÷ have been applied.
   */
  readonly lowestRunningTotal: number;
}

const isMulDiv = (op: Operator): boolean => op === '*' || op === '/';

function assertShape(expression: Expression): void {
  if (
    expression.terms.length === 0 ||
    expression.operators.length !== expression.terms.length - 1
  ) {
    throw new ExpressionError('An expression needs n terms and n − 1 operators');
  }
}

function evaluateTerm(term: Term): Evaluation {
  switch (term.kind) {
    case 'number':
      return { value: term.value, lowestRunningTotal: term.value };
    case 'square': {
      const value = term.base * term.base;
      return { value, lowestRunningTotal: value };
    }
    case 'sqrt': {
      const root = Math.round(Math.sqrt(term.radicand));
      if (term.radicand < 0 || root * root !== term.radicand) {
        throw new ExpressionError(`√${term.radicand} is not a whole number`);
      }
      return { value: root, lowestRunningTotal: root };
    }
    case 'group':
      return evaluate(term.expression);
  }
}

/**
 * Evaluates with normal order of operations: × and ÷ left to right first, then + and − left to
 * right. Every ÷ step must divide exactly, so every result is a whole number.
 */
export function evaluate(expression: Expression): Evaluation {
  assertShape(expression);

  let lowest = Number.POSITIVE_INFINITY;
  const firstTerm = evaluateTerm(expression.terms[0] as Term);
  lowest = Math.min(lowest, firstTerm.lowestRunningTotal);

  let sum = 0;
  let sign = 1;
  let product = firstTerm.value;

  expression.operators.forEach((op, i) => {
    const next = evaluateTerm(expression.terms[i + 1] as Term);
    lowest = Math.min(lowest, next.lowestRunningTotal);

    if (op === '*') {
      product *= next.value;
    } else if (op === '/') {
      if (next.value === 0 || product % next.value !== 0) {
        throw new ExpressionError(`${product} ÷ ${next.value} is not a whole number`);
      }
      product /= next.value;
    } else {
      sum += sign * product;
      lowest = Math.min(lowest, sum);
      sign = op === '+' ? 1 : -1;
      product = next.value;
    }
  });

  sum += sign * product;
  lowest = Math.min(lowest, sum);

  if (!Number.isSafeInteger(sum)) {
    throw new ExpressionError(`Result ${sum} is not a safe integer`);
  }
  return { value: sum, lowestRunningTotal: lowest };
}

// ---------------------------------------------------------------------------------------------
// Display text
// ---------------------------------------------------------------------------------------------

const MINUS = '−';
const SYMBOLS: Record<Operator, string> = { '+': '+', '-': MINUS, '*': '×', '/': '÷' };

const formatInteger = (value: number): string =>
  value < 0 ? `${MINUS}${Math.abs(value)}` : String(value);

function formatTerm(term: Term, isFirst: boolean): string {
  switch (term.kind) {
    case 'number':
      // A negative number after an operator is bracketed: 5 − (−3).
      return term.value < 0 && !isFirst
        ? `(${formatInteger(term.value)})`
        : formatInteger(term.value);
    case 'square':
      return `${term.base}²`;
    case 'sqrt':
      return `√${term.radicand}`;
    case 'group':
      return `(${format(term.expression)})`;
  }
}

/** Question text as players see it, e.g. `(24 + 16) ÷ 8 × 3`. */
export function format(expression: Expression): string {
  assertShape(expression);
  let text = formatTerm(expression.terms[0] as Term, true);
  expression.operators.forEach((op, i) => {
    text += ` ${SYMBOLS[op]} ${formatTerm(expression.terms[i + 1] as Term, false)}`;
  });
  return text;
}

// ---------------------------------------------------------------------------------------------
// Parsing (the inverse of format; used by tests and tooling)
// ---------------------------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; op: Operator }
  | { type: 'minus' }
  | { type: '(' }
  | { type: ')' }
  | { type: '²' }
  | { type: '√' };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === ' ') {
      i++;
    } else if (ch >= '0' && ch <= '9') {
      let end = i;
      while (end < text.length && (text[end] as string) >= '0' && (text[end] as string) <= '9') {
        end++;
      }
      tokens.push({ type: 'number', value: Number(text.slice(i, end)) });
      i = end;
    } else if (ch === MINUS || ch === '-') {
      tokens.push({ type: 'minus' });
      i++;
    } else if (ch === '+') {
      tokens.push({ type: 'op', op: '+' });
      i++;
    } else if (ch === '×' || ch === '*') {
      tokens.push({ type: 'op', op: '*' });
      i++;
    } else if (ch === '÷' || ch === '/') {
      tokens.push({ type: 'op', op: '/' });
      i++;
    } else if (ch === '(' || ch === ')' || ch === '²' || ch === '√') {
      tokens.push({ type: ch });
      i++;
    } else {
      throw new ExpressionError(`Unexpected character "${ch}" in "${text}"`);
    }
  }
  return tokens;
}

/** Parses question text in the format produced by `format()`. */
export function parse(text: string): Expression {
  const tokens = tokenize(text);
  let pos = 0;

  const peek = (offset = 0): Token | undefined => tokens[pos + offset];
  const expectNumber = (): number => {
    const token = tokens[pos++];
    if (token?.type !== 'number') {
      throw new ExpressionError(`Expected a number in "${text}"`);
    }
    return token.value;
  };
  const expect = (type: '(' | ')'): void => {
    if (tokens[pos++]?.type !== type) {
      throw new ExpressionError(`Expected "${type}" in "${text}"`);
    }
  };

  const parseTerm = (isFirst: boolean): Term => {
    const token = peek();
    if (token?.type === 'minus' && isFirst) {
      pos++;
      return { kind: 'number', value: -expectNumber() };
    }
    if (token?.type === '√') {
      pos++;
      return { kind: 'sqrt', radicand: expectNumber() };
    }
    if (token?.type === '(') {
      // "(−7)" is a negative number; anything else in brackets is a group.
      if (peek(1)?.type === 'minus' && peek(2)?.type === 'number' && peek(3)?.type === ')') {
        pos += 2;
        const value = -expectNumber();
        expect(')');
        return { kind: 'number', value };
      }
      pos++;
      const expression = parseExpression();
      expect(')');
      return { kind: 'group', expression };
    }
    const value = expectNumber();
    if (peek()?.type === '²') {
      pos++;
      return { kind: 'square', base: value };
    }
    return { kind: 'number', value };
  };

  const parseExpression = (): Expression => {
    const terms: Term[] = [parseTerm(true)];
    const operators: Operator[] = [];
    for (;;) {
      const token = peek();
      if (token?.type === 'op') {
        operators.push(token.op);
      } else if (token?.type === 'minus') {
        operators.push('-');
      } else {
        break;
      }
      pos++;
      terms.push(parseTerm(false));
    }
    return { terms, operators };
  };

  const expression = parseExpression();
  if (pos !== tokens.length) {
    throw new ExpressionError(`Unexpected trailing input in "${text}"`);
  }
  return expression;
}

export const hasMulDiv = (expression: Expression): boolean => expression.operators.some(isMulDiv);
