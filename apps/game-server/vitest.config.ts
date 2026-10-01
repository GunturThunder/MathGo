import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // @colyseus/testing 0.18.6 boots every Server instance on port 2568 (it ignores the port
    // argument), so test files that boot a server must not run at the same time.
    fileParallelism: false,
    // Some tests start PGlite (Postgres in WebAssembly), which can take over 10 s on busy CI.
    hookTimeout: 30_000,
  },
});
