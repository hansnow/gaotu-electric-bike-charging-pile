import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['frontend/**', 'node_modules/**', 'public/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['status-tracker.ts'],
      exclude: ['**/*.test.ts', '**/*.config.ts', 'node_modules/**'],
    },
  },
});
