import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{js,ts}'],
    exclude: ['node_modules', 'dist', '**/*.worker.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
