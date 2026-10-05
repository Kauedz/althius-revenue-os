import { describe, expect, it } from 'vitest';
import { trocarNoEnv } from './trocar-chave-unipile.mjs';

describe('trocarNoEnv', () => {
  it('troca só a linha da variável', () => {
    expect(trocarNoEnv('A=1\nUNIPILE_API_KEY=velha\nB=2\n', 'UNIPILE_API_KEY', 'nova')).toBe('A=1\nUNIPILE_API_KEY=nova\nB=2\n');
  });
  it('acrescenta quando não existe, antes da linha vazia final', () => {
    expect(trocarNoEnv('A=1\n', 'UNIPILE_API_KEY', 'nova')).toBe('A=1\nUNIPILE_API_KEY=nova\n');
    expect(trocarNoEnv('A=1', 'UNIPILE_API_KEY', 'nova')).toBe('A=1\nUNIPILE_API_KEY=nova');
  });
  it('não confunde variável de nome parecido', () => {
    expect(trocarNoEnv('UNIPILE_API_KEY_X=1\n', 'UNIPILE_API_KEY', 'n')).toBe('UNIPILE_API_KEY_X=1\nUNIPILE_API_KEY=n\n');
  });
  it('recusa chave com quebra de linha (injeção de outras variáveis)', () => {
    expect(() => trocarNoEnv('A=1\n', 'UNIPILE_API_KEY', 'x\nSERVICE_ROLE_KEY=y')).toThrow();
  });
});
