import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/new/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/detail': 'http://localhost:8788',
      '/events': 'http://localhost:8788',
      '/statistics': 'http://localhost:8788',
      '/api': 'http://localhost:8788'
    }
  },
  build: {
    outDir: '../public/new',
    emptyOutDir: true,
    sourcemap: mode === 'development'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
}));
