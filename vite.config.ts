import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Extension pages + service worker. The content script is built separately
// (vite.content.config.ts) because static content scripts cannot be ES modules.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  publicDir: resolve(import.meta.dirname, 'public'),
  envDir: import.meta.dirname,
  base: '',
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: true,
    modulePreload: false,
    rolldownOptions: {
      input: {
        'control-panel': resolve(import.meta.dirname, 'src/pages/control-panel/index.html'),
        permission: resolve(import.meta.dirname, 'src/pages/permission/index.html'),
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  // Classic worker so MediaPipe can load its wasm loader with importScripts().
  worker: { format: 'iife' },
});
