import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend .NET (MaRa.Api)  ajuster le port si nécessaire.
      '/api': { target: 'http://localhost:5080', changeOrigin: true, secure: false },
    },
  },
});
