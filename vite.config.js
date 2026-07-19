import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Zene-proxy: a Deezer API-t a sajat dev szerveren keresztul erjuk el,
      // igy a StackBlitz sandbox nem blokkolja (eles verzioban a JSONP fut)
      '/dz': {
        target: 'https://api.deezer.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/dz/, ''),
      },
    },
  },
});
