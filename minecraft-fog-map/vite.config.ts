import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/camping-escape-room/',
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
        // Lazy-load to avoid issues in production build
        import('./server/marker-api').then(({ handleMarkerApi }) => {
          server.middlewares.use((req, res, next) => {
            if (!handleMarkerApi(req as any, res as any)) {
              next();
            }
          });
        });
      },
    },
  ],
});
