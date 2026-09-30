import {
  DETERMINISM_FINGERPRINT,
  DETERMINISM_SEED,
  determinismSample,
  fingerprint,
} from '@mathgo/game-core';

export interface DeterminismResult {
  /** Hermes in dev and release builds; anything else means the check did not test Hermes. */
  readonly engine: 'hermes' | 'other';
  readonly seed: number;
  readonly expected: string;
  readonly actual: string;
  readonly passed: boolean;
  /** First question of the sample, to eyeball against Node. */
  readonly firstQuestion: string;
}

/**
 * S1-08: builds game-core's fixed-seed sample in this JS engine and compares its fingerprint with
 * the one pinned by the Node tests.
 */
export function runDeterminismCheck(): DeterminismResult {
  const lines = determinismSample(DETERMINISM_SEED);
  const actual = fingerprint(lines);
  const hermes = (globalThis as { HermesInternal?: unknown }).HermesInternal;
  return {
    engine: hermes === undefined || hermes === null ? 'other' : 'hermes',
    seed: DETERMINISM_SEED,
    expected: DETERMINISM_FINGERPRINT,
    actual,
    passed: actual === DETERMINISM_FINGERPRINT,
    firstQuestion: lines.find((line) => line.startsWith('q|')) ?? '',
  };
}

/** One line for logcat / the Metro terminal, e.g. `[S1-08] PASS engine=hermes …`. */
export function describeResult(result: DeterminismResult): string {
  return [
    `[S1-08] ${result.passed ? 'PASS' : 'FAIL'}`,
    `engine=${result.engine}`,
    `seed=${result.seed}`,
    `expected=${result.expected}`,
    `actual=${result.actual}`,
  ].join(' ');
}
