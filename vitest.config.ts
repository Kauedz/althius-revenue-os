import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    // Os testes de integração compartilham o mesmo banco local: um arquivo por vez evita corrida
    fileParallelism: false,
    // Datas e prazos são exibidos no horário de Brasília
    env: { TZ: 'America/Sao_Paulo' }
  }
});
