import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Integration tests share one Postgres schema, so they must not interleave.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
