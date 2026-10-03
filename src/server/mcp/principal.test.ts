// @vitest-environment node
// Seam: configuração do servidor MCP lida do ambiente do perfil do Hermes Agent.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executadoDiretamente, lerConfiguracao } from './principal';
import { ANON_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';

const jwt = (role: string) => 'x.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.y';

describe('lerConfiguracao', () => {
  const base = { ALTHIUS_SUPABASE_URL: URL_LOCAL, ALTHIUS_SUPABASE_CHAVE_PUBLICA: ANON_LOCAL, ALTHIUS_AGENTE_TOKEN: 'alt_agente_abc' };

  it('lê endereço, chave pública e token do agente', () => {
    expect(lerConfiguracao(base)).toEqual({ url: URL_LOCAL, chavePublica: ANON_LOCAL, token: 'alt_agente_abc' });
  });

  it('falta de qualquer item é erro claro', () => {
    expect(() => lerConfiguracao({ ...base, ALTHIUS_AGENTE_TOKEN: '' })).toThrow('Falta ALTHIUS_AGENTE_TOKEN');
    expect(() => lerConfiguracao({ ...base, ALTHIUS_SUPABASE_URL: undefined })).toThrow('Falta ALTHIUS_SUPABASE_URL');
  });

  it('recusa a chave de sistema: o agente nunca roda com acesso a todos os clientes', () => {
    expect(() => lerConfiguracao({ ...base, ALTHIUS_SUPABASE_CHAVE_PUBLICA: jwt('service_role') })).toThrow('chave de sistema');
    expect(() => lerConfiguracao({ ...base, ALTHIUS_SUPABASE_CHAVE_PUBLICA: 'sb_' + 'secret_qualquer' })).toThrow('chave de sistema');
  });

  it('token precisa ser de agente da Althius', () => {
    expect(() => lerConfiguracao({ ...base, ALTHIUS_AGENTE_TOKEN: 'outra-coisa' })).toThrow('alt_agente_');
  });
});

describe('executadoDiretamente', () => {
  const aqui = fileURLToPath(new URL('./principal.ts', import.meta.url));

  it('reconhece o próprio arquivo, inclusive por um atalho de pasta', () => {
    const atalho = join(mkdtempSync(join(tmpdir(), 'althius-')), 'atalho');
    symlinkSync(dirname(aqui), atalho, 'junction');
    expect(executadoDiretamente(pathToFileURL(aqui).href, join(atalho, 'principal.ts'))).toBe(true);
  });

  it('outro arquivo ou nenhum não conta', () => {
    expect(executadoDiretamente(pathToFileURL(aqui).href, fileURLToPath(new URL('./althius.ts', import.meta.url)))).toBe(false);
    expect(executadoDiretamente(pathToFileURL(aqui).href, undefined)).toBe(false);
  });
});
