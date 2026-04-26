import { defineConfig } from 'vite';
import { resolve } from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { handleGenerateTerrain } from './server/generate-terrain-api';

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
    https: {},
  },
  preview: {
    host: true,
    https: {},
  },
  plugins: [
    basicSsl(),
    {
      name: 'terrain-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/generate-terrain') {
            handleGenerateTerrain(req, res);
          } else {
            next();
          }
        });
      },
    },
  ],
});
