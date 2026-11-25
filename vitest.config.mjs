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
    include: ['test/renderer/**/*.test.js'],
    setupFiles: ['test/renderer/setup.js'],
    passWithNoTests: false,
  },
});