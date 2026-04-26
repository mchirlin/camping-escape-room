import { defineConfig } from 'vite';
import { resolve } from 'path';
import { handleMarkerApi } from './server/marker-api';
import { handleGenerateTerrain } from './server/generate-terrain-api';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/camping-escape-room/' : '/',
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
  plugins: [
    {
      name: 'marker-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/generate-terrain') {
            handleGenerateTerrain(req as any, res as any);
          } else if (!handleMarkerApi(req as any, res as any)) {
            next();
          }
        });
      },
    },
  ],
}));
