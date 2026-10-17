import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Build de démonstration : charge l'API simulée avant le bundle. */
const demoMock = () => ({
  name: 'mara-demo-mock',
  transformIndexHtml: (html) => html.replace('<head>', '<head><script src="/demo/mock-api.js"></script>'),
});

export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), demoMock()] : [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend .NET (MaRa.Api)  ajuster le port si nécessaire.
      '/api': { target: 'http://localhost:5080', changeOrigin: true, secure: false },
    },
  },
}));
