import { afterEach } from 'vitest';

// Testes de tela (jsdom) ganham os matchers do DOM e limpeza entre testes.
// Testes de integração com o banco rodam em ambiente node, sem window.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => {
    cleanup();
    window.location.hash = '';
  });
}
