import { DETERMINISM_FINGERPRINT } from '@mathgo/game-core';
import { describeResult, runDeterminismCheck } from './determinism-check';

describe('runDeterminismCheck', () => {
  it('imports game-core and matches the Node fingerprint (Jest runs in Node, not Hermes)', () => {
    const result = runDeterminismCheck();
    expect(result.actual).toBe(DETERMINISM_FINGERPRINT);
    expect(result.passed).toBe(true);
    expect(result.engine).toBe('other');
    expect(result.firstQuestion).toBe('q|1|0|0|1 + 6|7');
    expect(describeResult(result)).toMatch(/^\[S1-08\] PASS engine=other seed=\d+ expected=\w{8}/);
  });
});
