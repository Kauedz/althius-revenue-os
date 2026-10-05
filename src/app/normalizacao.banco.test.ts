// @vitest-environment node
// Alinhamento: o TypeScript (`normalizarDominio`) e o banco (`public.normalize_domain`, migration 0103) têm que
// dar o MESMO resultado nos casos comuns. Só chama uma função pura do banco; não grava nada.
// Exceção documentada: domínio com acento. O TypeScript converte para punycode (`café.com.br` → `xn--caf-dma.com.br`);
// o banco guarda o acento como está (comentário da migration 0103).
import { describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr } from '../test/supabaseLocal';
import { normalizarDominio } from './normalizacao';

/** [entrada, domínio esperado nos DOIS lados] */
const VALIDOS_COMUNS: Array<[string, string]> = [
  ['empresa.com.br', 'empresa.com.br'],
  ['www.empresa.com.br', 'empresa.com.br'],
  ['WWW.Empresa.COM.br', 'empresa.com.br'],
  ['http://empresa.com.br', 'empresa.com.br'],
  ['https://empresa.com.br', 'empresa.com.br'],
  ['HTTPS://WWW.Empresa.com.br/', 'empresa.com.br'],
  ['https://www.empresa.com.br/produtos/importacao?x=1#topo', 'empresa.com.br'],
  ['empresa.com.br:8443', 'empresa.com.br'],
  ['http://empresa.com.br:80', 'empresa.com.br'],
  ['https://usuario:senha@empresa.com.br:443/x', 'empresa.com.br'],
  ['empresa.com.br.', 'empresa.com.br'],
  ['empresa.com.br...', 'empresa.com.br'],
  ['  https://www.empresa.com.br  ', 'empresa.com.br'],
  ['//www.empresa.com.br/x', 'empresa.com.br'],
  ['https:\\\\www.empresa.com.br\\x', 'empresa.com.br'],
  ['contato@empresa.com.br', 'empresa.com.br'],
  ['www.www.www.empresa.com.br', 'empresa.com.br'],
  ['https://Loja.Empresa.com.br/x', 'loja.empresa.com.br'],
  ['twenty.co.uk', 'twenty.co.uk'],
  ['xn--caf-dma.com.br', 'xn--caf-dma.com.br']
];

const INVALIDOS_COMUNS = [
  '',
  '   ',
  'http://',
  'localhost',
  'http://localhost:3000',
  '127.0.0.1',
  '192.168.0.10',
  'empresa',
  'serra azul.com.br',
  'not a domain',
  'javascript:alert(1)',
  '<script>',
  '-ruim.com.br',
  'www.'
];

describe.skipIf(!bancoLocalNoAr)('normalizarDominio (TypeScript) × public.normalize_domain (banco)', () => {
  const consultarBanco = async (texto: string | null): Promise<string | null> => {
    const { data, error } = await adminLocal().rpc('normalize_domain', { p: texto });
    if (error) throw new Error(`rpc normalize_domain falhou: ${error.message}`);
    return data as string | null;
  };

  it.each(VALIDOS_COMUNS)('mesmo resultado nos dois lados: %j → %s', async (entrada, esperado) => {
    expect(await consultarBanco(entrada)).toBe(esperado);
    expect(normalizarDominio(entrada)).toBe(esperado);
  });

  it.each(INVALIDOS_COMUNS)('os dois lados recusam: %j', async entrada => {
    expect(await consultarBanco(entrada)).toBeNull();
    expect(normalizarDominio(entrada)).toBeNull();
  });

  it('nulo: os dois lados devolvem nulo', async () => {
    expect(await consultarBanco(null)).toBeNull();
    expect(normalizarDominio(null)).toBeNull();
  });

  it('EXCEÇÃO conhecida: domínio com acento (TypeScript converte para punycode, o banco guarda o acento)', async () => {
    expect(await consultarBanco('café.com.br')).toBe('café.com.br');
    expect(normalizarDominio('café.com.br')).toBe('xn--caf-dma.com.br');
    expect(await consultarBanco('https://www.MÜNCHEN.de/')).toBe('münchen.de');
    expect(normalizarDominio('https://www.MÜNCHEN.de/')).toBe('xn--mnchen-3ya.de');
  });
});
