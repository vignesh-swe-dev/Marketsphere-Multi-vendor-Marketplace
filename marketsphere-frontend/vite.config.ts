import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where the separately-running backend lives (development only).
  const backendTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:4000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      // Browser talks to ONE origin (this dev server); /api is forwarded to the backend.
      // That avoids CORS in development and keeps httpOnly cookies same-origin.
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true },
      },
    },
  };
});
