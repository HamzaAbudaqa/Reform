import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react() as any],
  test: {
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      include: [
        'components/**/*.tsx',
        'lib/**/*.ts',
        'types/**/*.ts',
      ],
      exclude: [
        'node_modules',
        '__tests__',
        '**/*.d.ts',
        'components/demo/MockDashboardBefore.tsx',
        'components/demo/MockDashboardAfter.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
