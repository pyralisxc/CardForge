import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/infrastructure/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 15_000,
  },
});
