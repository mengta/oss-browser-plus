import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@renderer': path.resolve(ROOT, 'app/renderer'),
      '@app': path.resolve(ROOT, 'app'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,

    include: ['test/renderer/**/*.test.js', 'test/preload/**/*.test.js'],
    setupFiles: ['test/renderer/setup.js'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['app/**/*.{js,vue}'],
      exclude: ['app/renderer/main.js', 'app/preload/api-manifest.js'],
      thresholds: {
        statements: 82,
        lines: 84,
        branches: 70,
        functions: 75,
      },
    },
  },
});