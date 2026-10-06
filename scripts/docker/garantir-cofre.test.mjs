import { describe, expect, it } from 'vitest';
import { comChaveMestra } from './garantir-cofre.mjs';

describe('garantir chave mestra do cofre', () => {
  it('acrescenta quando falta, sem mexer no resto', () => {
    const r = comChaveMestra('A=1\nB=2\n', () => 'abc');
    expect(r.criada).toBe(true);
    expect(r.texto).toContain('A=1\nB=2\n');
    expect(r.texto).toContain('COFRE_CHAVE_MESTRA=abc');
  });
  it('preenche quando a linha existe vazia', () => {
    const r = comChaveMestra('A=1\nCOFRE_CHAVE_MESTRA=\nB=2\n', () => 'abc');
    expect(r.texto).toBe('A=1\nCOFRE_CHAVE_MESTRA=abc\nB=2\n');
  });
  it('NUNCA troca uma chave que já existe (as chaves guardadas ficariam ilegíveis)', () => {
    const t = 'COFRE_CHAVE_MESTRA=minha\n';
    const r = comChaveMestra(t, () => 'outra');
    expect(r).toEqual({ texto: t, criada: false });
  });
  it('a chave gerada tem 64 letras hexadecimais (32 bytes)', () => {
    expect(comChaveMestra('A=1\n').texto).toMatch(/COFRE_CHAVE_MESTRA=[0-9a-f]{64}\n/);
  });
});
