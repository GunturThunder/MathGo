import base from '@mathgo/config/eslint';
import { defineConfig } from 'eslint/config';

// game-core runs in Node and in the app, and must be deterministic: no clock, no Math.random,
// no platform APIs outside tests.
export default defineConfig([
  base,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'game-core must not read the clock.' },
        { name: 'console', message: 'game-core has no I/O.' },
        { name: 'process', message: 'game-core must not depend on Node.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use createRng() from rng.ts.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['node:*'] }],
    },
  },
]);
