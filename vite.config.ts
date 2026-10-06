import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    // Só no desenvolvimento: em produção o Caddy encaminha estas rotas para o serviço `webhooks` (docker/Caddyfile).
    proxy: {
      '/cofre': 'http://127.0.0.1:3100',
      '/integracoes': 'http://127.0.0.1:3100'
    }
  }
});
