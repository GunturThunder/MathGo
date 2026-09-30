import { ARENAS } from './arenas.js';
import { generateQuestions } from './generator.js';
import { createRng } from './rng.js';

/**
 * Cross-runtime check (S1-08): the app runs this in Hermes and compares the result with
 * `DETERMINISM_FINGERPRINT`, which the Node tests pin. A mismatch means the app and the server
 * would show different questions for the same match seed.
 */
export const DETERMINISM_SEED = 0x5eed_2026;

/** Questions per arena and trophy level in the sample. */
const QUESTIONS_PER_LEVEL = 25;
/** Raw RNG draws in the sample, to catch float formatting or bit-maths differences early. */
const RNG_DRAWS = 20;

/**
 * One line per RNG draw and per question: raw floats and ints from the seed, then questions for
 * every arena at its lowest and highest trophy count.
 */
export function determinismSample(seed: number = DETERMINISM_SEED): string[] {
  const rng = createRng(seed, 0);
  const lines: string[] = [];
  for (let i = 0; i < RNG_DRAWS; i++) {
    lines.push(`rng|${i}|${rng.next()}|${rng.int(-1000, 1000)}`);
  }
  for (const arena of ARENAS) {
    for (const trophies of [arena.minTrophies, arena.maxTrophies]) {
      for (const q of generateQuestions(seed, 0, QUESTIONS_PER_LEVEL, {
        arena: arena.id,
        trophies,
      })) {
        lines.push(`q|${arena.id}|${trophies}|${q.index}|${q.text}|${q.answer}`);
      }
    }
  }
  return lines;
}

/** FNV-1a (32-bit) over the UTF-16 code units of the lines, as 8 hex digits. */
export function fingerprint(lines: readonly string[]): string {
  let hash = 0x811c_9dc5;
  const text = lines.join('\n');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Fingerprint of `determinismSample(DETERMINISM_SEED)`, pinned by the Node tests. */
export const DETERMINISM_FINGERPRINT = '0c4a6ee6';
