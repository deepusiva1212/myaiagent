// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API calls to the Fastify backend (avoids CORS in dev)
      '/api': {
        target:    'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy WebSocket upgrades — critical for /ws/* routes
      '/ws': {
        target:    'ws://localhost:3001',
        ws:        true,        // ← enables WebSocket proxying
        changeOrigin: true,
      },
    },
  },
});
