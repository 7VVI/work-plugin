import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.config';

export default defineConfig(({ command }) => ({
  plugins: [vue(), crx({ manifest })],
  define: {
    __APP_TARGET__: JSON.stringify('extension'),
  },
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@protocol': fileURLToPath(new URL('./shared/protocol', import.meta.url)),
    },
  },
  build: {
    // 开发模式输出到 dist-dev，避免覆盖已加载到浏览器的生产构建 dist
    outDir: command === 'serve' ? 'dist-dev' : 'dist',
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
  },
}));
