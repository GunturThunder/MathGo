import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('allows max events per window per key, then refuses until the window slides', () => {
    const limiter = new RateLimiter<number>(3, 1_000);
    expect([0, 100, 200, 300].map((t) => limiter.allow(0, t))).toEqual([true, true, true, false]);
    expect(limiter.allow(1, 300)).toBe(true); // another player is unaffected
    expect(limiter.allow(0, 999)).toBe(false);
    expect(limiter.allow(0, 1_001)).toBe(true); // the event at 0 left the window
  });
});
