import { defineConfig } from 'vite';
import { resolve } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  base: '/minecraft-escape-room/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'block-nets': resolve(__dirname, 'block-nets.html'),
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  plugins: [],
});
