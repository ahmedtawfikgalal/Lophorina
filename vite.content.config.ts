import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Static content scripts run as classic scripts, so this entry is a single IIFE bundle.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome116',
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/adapters/youtube/content-script.ts'),
      formats: ['iife'],
      name: 'LophorinaYouTube',
      fileName: () => 'youtube-content.js',
    },
  },
});
