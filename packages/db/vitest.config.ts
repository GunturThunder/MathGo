import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests start PGlite (Postgres in WebAssembly); on a busy CI runner that alone can take
    // more than Vitest's default 10 s.
    hookTimeout: 30_000,
  },
});
