import { getArena, type ArenaRules, type Operator } from './arenas.js';
import { difficultyProgress, rangeMax, type QuestionLevel } from './difficulty.js';
import { evaluate, ExpressionError, format, type Expression, type Term } from './expression.js';
import { createRng, type Rng } from './rng.js';

export interface Question {
  /** Question number within the match, from 0. */
  readonly index: number;
  /** Display text, e.g. `7 × 8 − 12`. */
  readonly text: string;
  /** Never sent to the app during an online battle. */
  readonly answer: number;
  readonly expression: Expression;
}

/** Candidates drawn per question before giving up. Property tests show far fewer are needed. */
const MAX_ATTEMPTS = 1000;
/** Share of questions with brackets (Mixed Mountain, Power Peak). */
const GROUP_CHANCE = 0.4;
/** Share of Power Peak questions with a square or square root. */
const POWER_CHANCE = 0.6;

interface Limits {
  readonly rules: ArenaRules;
  readonly additiveMax: number;
  readonly factorMax: number;
}

type Special = 'group' | 'square' | 'sqrt';

const isMulDiv = (op: Operator | undefined): boolean => op === '*' || op === '/';

function termValue(term: Term): number {
  return evaluate({ terms: [term], operators: [] }).value;
}

function additiveNumber(rng: Rng, limits: Limits): number {
  const { min } = limits.rules.additive;
  if (min >= 0) {
    return rng.int(min, limits.additiveMax);
  }
  // Power Peak: −100 to 100, never 0.
  const value = rng.int(min, limits.additiveMax - 1);
  return value >= 0 ? value + 1 : value;
}

function factorNumber(rng: Rng, limits: Limits): number {
  return rng.int(limits.rules.factor?.min ?? 2, limits.factorMax);
}

function buildSpecial(rng: Rng, limits: Limits, special: Special): Term {
  switch (special) {
    case 'square':
      return { kind: 'square', base: factorNumber(rng, limits) };
    case 'sqrt': {
      const root = factorNumber(rng, limits);
      return { kind: 'sqrt', radicand: root * root };
    }
    case 'group':
      return {
        kind: 'group',
        expression: {
          terms: [
            { kind: 'number', value: additiveNumber(rng, limits) },
            { kind: 'number', value: additiveNumber(rng, limits) },
          ],
          operators: [rng.pick<Operator>(['+', '-'])],
        },
      };
  }
}

function pickOperators(rng: Rng, rules: ArenaRules, count: number): Operator[] {
  const operators = Array.from({ length: count }, () => rng.pick(rules.operators));
  if (rules.requiresMulDiv && !operators.some(isMulDiv)) {
    operators[rng.int(0, count - 1)] = rng.pick<Operator>(['*', '/']);
  }
  return operators;
}

/**
 * Chooses which term (if any) becomes brackets, a square or a square root. Never a divisor:
 * a divisor is picked to divide the value before it, which a fixed special term can't promise.
 */
function pickSpecials(rng: Rng, rules: ArenaRules, operators: Operator[]): Map<number, Special> {
  const specials = new Map<number, Special>();
  const termCount = operators.length + 1;
  const notDivisor = (i: number): boolean => operators[i - 1] !== '/';

  if (rules.brackets && rng.chance(GROUP_CHANCE)) {
    // Brackets matter only next to × or ÷: (24 + 16) ÷ 8, 3 × (5 + 2).
    const slots = Array.from({ length: termCount }, (_, i) => i).filter(
      (i) => notDivisor(i) && (isMulDiv(operators[i - 1]) || isMulDiv(operators[i])),
    );
    if (slots.length > 0) {
      specials.set(rng.pick(slots), 'group');
    }
  }
  if (rules.powersAndRoots && rng.chance(POWER_CHANCE)) {
    const slots = Array.from({ length: termCount }, (_, i) => i).filter(
      (i) => notDivisor(i) && !specials.has(i),
    );
    if (slots.length > 0) {
      specials.set(rng.pick(slots), rng.pick<Special>(['square', 'sqrt']));
    }
  }
  return specials;
}

/**
 * Builds one candidate, or null when a division can't be made whole. Multiplication chains are
 * built left to right so every ÷ has an exact divisor: a chain that starts with ÷ gets a
 * dividend of divisor × quotient (a times-table fact), and later divisors are picked from the
 * divisors of the chain's value so far.
 */
function buildCandidate(rng: Rng, limits: Limits): Expression | null {
  const { rules } = limits;
  const termCount = rng.int(rules.terms.min, rules.terms.max);
  const operators = pickOperators(rng, rules, termCount - 1);
  const specials = pickSpecials(rng, rules, operators);

  const terms: Term[] = [];
  let chainValue = 0;

  for (let i = 0; i < termCount; i++) {
    const before = operators[i - 1];
    const after = operators[i];
    const special = specials.get(i);
    let term: Term;

    if (before === '/') {
      const factorMin = rules.factor?.min ?? 2;
      const divisors: number[] = [];
      for (let d = factorMin; d <= limits.factorMax; d++) {
        if (chainValue % d === 0) {
          divisors.push(d);
        }
      }
      if (divisors.length === 0) {
        return null;
      }
      term = { kind: 'number', value: rng.pick(divisors) };
    } else if (special !== undefined) {
      term = buildSpecial(rng, limits, special);
    } else if (before === '*') {
      term = { kind: 'number', value: factorNumber(rng, limits) };
    } else if (after === '/') {
      term = { kind: 'number', value: factorNumber(rng, limits) * factorNumber(rng, limits) };
    } else if (after === '*') {
      term = { kind: 'number', value: factorNumber(rng, limits) };
    } else {
      term = { kind: 'number', value: additiveNumber(rng, limits) };
    }

    const value = termValue(term);
    if (before === '*') {
      chainValue *= value;
    } else if (before === '/') {
      chainValue /= value;
    } else {
      chainValue = value;
    }
    terms.push(term);
  }

  return { terms, operators };
}

function passesRules(rules: ArenaRules, expression: Expression): number | null {
  try {
    const { value, lowestRunningTotal } = evaluate(expression);
    if (value < rules.answer.min || value > rules.answer.max) {
      return null;
    }
    if (!rules.negatives && lowestRunningTotal < 0) {
      return null;
    }
    return value;
  } catch (error) {
    if (error instanceof ExpressionError) {
      return null;
    }
    throw error;
  }
}

/**
 * Builds question `index` of a match. The same seed, index and level always give the same
 * question, so both players see it and the server can rebuild it to check an answer.
 */
export function generateQuestion(seed: number, index: number, level: QuestionLevel): Question {
  const rules = getArena(level.arena);
  const progress = difficultyProgress(rules, level.trophies);
  const limits: Limits = {
    rules,
    additiveMax: rangeMax(rules.additive, progress),
    factorMax: rules.factor === null ? 0 : rangeMax(rules.factor, progress),
  };
  const rng = createRng(seed, index);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const expression = buildCandidate(rng, limits);
    if (expression === null) {
      continue;
    }
    const answer = passesRules(rules, expression);
    if (answer !== null) {
      return { index, text: format(expression), answer, expression };
    }
  }
  throw new Error(
    `No valid question after ${MAX_ATTEMPTS} attempts (seed ${seed}, index ${index}, arena ${level.arena})`,
  );
}

/** Questions `from` to `from + count − 1` of a match. */
export function generateQuestions(
  seed: number,
  from: number,
  count: number,
  level: QuestionLevel,
): Question[] {
  return Array.from({ length: count }, (_, i) => generateQuestion(seed, from + i, level));
}
