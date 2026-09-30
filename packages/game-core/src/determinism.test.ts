import { describe, expect, it } from 'vitest';
import {
  DETERMINISM_FINGERPRINT,
  DETERMINISM_SEED,
  determinismSample,
  fingerprint,
} from './determinism.js';

describe('determinism check', () => {
  it('matches the pinned fingerprint in Node (the app checks the same value in Hermes)', () => {
    // If this fails, every existing match seed now produces different questions. Update the pin
    // only for an intended generator change, and re-run the check in the app.
    expect(fingerprint(determinismSample(DETERMINISM_SEED))).toBe(DETERMINISM_FINGERPRINT);
  });

  it('samples raw RNG draws and questions for every arena at both trophy ends', () => {
    const lines = determinismSample();
    expect(lines).toHaveLength(20 + 5 * 2 * 25);
    expect(lines.slice(0, 2)).toEqual([
      'rng|0|0.03947569848969579|599',
      'rng|1|0.5610127944964916|329',
    ]);
    expect(lines[20]).toBe('q|1|0|0|1 + 6|7');
    const arenas = new Set(lines.filter((l) => l.startsWith('q|')).map((l) => l.split('|')[1]));
    expect([...arenas]).toEqual(['1', '2', '3', '4', '5']);
  });

  it('gives a different fingerprint for a different seed', () => {
    expect(fingerprint(determinismSample(DETERMINISM_SEED + 1))).not.toBe(DETERMINISM_FINGERPRINT);
  });

  it('fingerprint is FNV-1a over the joined lines', () => {
    expect(fingerprint([])).toBe('811c9dc5');
    expect(fingerprint(['a'])).toBe('e40c292c');
    expect(fingerprint(['a', 'b'])).not.toBe(fingerprint(['ab']));
  });
});
