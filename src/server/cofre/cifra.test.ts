import { describe, expect, it } from 'vitest';
import { chaveMestra, cifrar, decifrar, mascara } from './cifra.ts';

const CHAVE = Buffer.alloc(32, 7).toString('base64');

describe('cifra do cofre', () => {
  it('cifra e decifra de volta', () => {
    const k = chaveMestra({ COFRE_CHAVE_MESTRA: CHAVE });
    const c = cifrar('apify_api_segredo123', k);
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain('segredo123');
    expect(decifrar(c, k)).toBe('apify_api_segredo123');
  });
  it('cada cifra é diferente (IV novo), mesmo para o mesmo texto', () => {
    const k = chaveMestra({ COFRE_CHAVE_MESTRA: CHAVE });
    expect(cifrar('x', k)).not.toBe(cifrar('x', k));
  });
  it('chave mestra errada não decifra', () => {
    const c = cifrar('segredo', chaveMestra({ COFRE_CHAVE_MESTRA: CHAVE }));
    const outra = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 9).toString('base64') });
    expect(() => decifrar(c, outra)).toThrow();
  });
  it('texto adulterado não decifra', () => {
    const k = chaveMestra({ COFRE_CHAVE_MESTRA: CHAVE });
    const [v, iv, tag] = cifrar('segredo', k).split(':');
    const ruim = [v, iv, tag, Buffer.from('trocado').toString('base64url')].join(':');
    expect(() => decifrar(ruim, k)).toThrow();
  });
  it('aceita a chave mestra em hexadecimal (64 caracteres)', () => {
    expect(chaveMestra({ COFRE_CHAVE_MESTRA: 'ab'.repeat(32) })).toHaveLength(32);
  });
  it('sem chave mestra, ou com tamanho errado, falha com mensagem clara (nada de chave fraca)', () => {
    expect(() => chaveMestra({})).toThrow(/COFRE_CHAVE_MESTRA/);
    expect(() => chaveMestra({ COFRE_CHAVE_MESTRA: 'curta' })).toThrow(/32 bytes/);
  });
  it('máscara mostra só os 4 últimos', () => {
    expect(mascara('apify_api_abcdef1234')).toBe('1234');
    expect(mascara('abc')).toBe('abc');
  });
  it('formato cifrado bate com o que o banco aceita', () => {
    const k = chaveMestra({ COFRE_CHAVE_MESTRA: CHAVE });
    expect(cifrar('qualquer coisa', k)).toMatch(/^v1:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$/);
  });
});
