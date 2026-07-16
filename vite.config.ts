import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
  },
});
