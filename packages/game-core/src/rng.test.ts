import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('matches the reference sequence (guards against accidental changes)', () => {
    // If this fails, every existing match seed now produces different questions.
    const rng = createRng(42, 0);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.6558336513116956, 0.8638617997057736, 0.47501156153157353,
    ]);
    const edge = createRng(0xffff_ffff, 7);
    expect([edge.int(1, 100), edge.int(1, 100), edge.int(1, 100), edge.int(1, 100)]).toEqual([
      98, 72, 22, 79,
    ]);
  });

  it('gives the same sequence for the same seed and stream', () => {
    const a = createRng(123, 5);
    const b = createRng(123, 5);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('gives different sequences for neighbouring streams and seeds', () => {
    const first = (seed: number, stream: number) => createRng(seed, stream).next();
    expect(first(123, 0)).not.toBe(first(123, 1));
    expect(first(123, 0)).not.toBe(first(124, 0));
  });

  it('keeps next() in [0, 1) and int() within inclusive bounds', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = rng.int(-3, 3);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(3);
      seen.add(n);
    }
    expect([...seen].sort((p, q) => p - q)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it('spreads int() roughly evenly', () => {
    const rng = createRng(99);
    const counts = new Array<number>(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) {
      const k = rng.int(0, 9);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const count of counts) {
      expect(Math.abs(count - draws / 10)).toBeLessThan(draws / 100);
    }
  });

  it('rejects seeds and bounds outside the allowed range', () => {
    expect(() => createRng(-1)).toThrow(RangeError);
    expect(() => createRng(2 ** 32)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
    expect(() => createRng(1, -1)).toThrow(RangeError);
    expect(() => createRng(1).int(5, 4)).toThrow(RangeError);
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });
});
