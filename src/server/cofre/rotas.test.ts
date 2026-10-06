import { describe, expect, it } from 'vitest';
import { chaveMestra, decifrar } from './cifra.ts';
import { guardarSegredo, testarSegredo, type DepsCofre } from './rotas.ts';
import type { Cofre } from './cofre.ts';

const K = chaveMestra({ COFRE_CHAVE_MESTRA: '12'.repeat(32) });
const SUPER = 'e0000000-0000-0000-0000-000000000001';

function montar(opcoes: { papel?: 'superadmin' | 'outro' | 'sem_login'; lidos?: Record<string, Array<{ id: string; rotulo: string; segredo: string; config: Record<string, unknown> }>>; sonda?: (url: string, auth: string) => number } = {}) {
  const gravado: Array<Record<string, any>> = [];
  const usos: Array<[string, string | null]> = [];
  const sondas: Array<{ url: string; auth: string }> = [];
  let invalidou = 0;
  const buscar = (async (url: string, init: RequestInit) => {
    const u = String(url);
    if (u.includes('/rpc/cofre_conferir_superadmin')) {
      if (opcoes.papel === 'sem_login') return new Response('{}', { status: 401 });
      if (opcoes.papel === 'outro') return Response.json({ code: '42501' }, { status: 403 });
      return Response.json(SUPER);
    }
    if (u.includes('/rpc/cofre_guardar')) { gravado.push(JSON.parse(String(init.body))); return Response.json('id-novo'); }
    if (u.startsWith('https://')) {
      const auth = String((init.headers as Record<string, string>).Authorization);
      sondas.push({ url: u, auth });
      return new Response('{}', { status: (opcoes.sonda ?? (() => 200))(u, auth) });
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  const cofre: Cofre = {
    ler: async p => opcoes.lidos?.[p] ?? [],
    marcarUso: async (id, erro) => { usos.push([id, erro ?? null]); },
    invalidar: () => { invalidou++; }
  };
  const deps: DepsCofre = { baseBanco: 'http://banco', chaveAnon: 'anon', chaveServico: 'servico', chave: K, cofre, buscar };
  return { deps, gravado, usos, sondas, invalidou: () => invalidou };
}

describe('guardar segredo', () => {
  it('superadmin guarda: vai CIFRADO, com máscara e com o id de quem guardou', async () => {
    const m = montar();
    const r = await guardarSegredo(m.deps, 'jwt', { provedor: 'apify', rotulo: 'Conta 1', segredo: 'apify_api_ABCDEFGH1234' });
    expect(r).toEqual({ status: 200, corpo: { ok: true, id: 'id-novo' } });
    const g = m.gravado[0];
    expect(g.p_provedor).toBe('apify');
    expect(g.p_final).toBe('1234');
    expect(g.p_quem).toBe(SUPER);
    expect(JSON.stringify(g)).not.toContain('ABCDEFGH');
    expect(decifrar(g.p_cifrado, K)).toBe('apify_api_ABCDEFGH1234');
    expect(m.invalidou()).toBe(1);
  });
  it('sem login: 401; não superadmin: 403; nada é gravado', async () => {
    const a = montar({ papel: 'sem_login' });
    expect((await guardarSegredo(a.deps, '', { provedor: 'apify', rotulo: 'x', segredo: 'abcdefgh1234' })).status).toBe(401);
    const b = montar({ papel: 'outro' });
    expect((await guardarSegredo(b.deps, 'jwt', { provedor: 'apify', rotulo: 'x', segredo: 'abcdefgh1234' })).status).toBe(403);
    expect(a.gravado.length + b.gravado.length).toBe(0);
  });
  it('recusa pedido ruim (provedor, rótulo, segredo curto ou com espaço) com 400', async () => {
    const m = montar();
    for (const corpo of [
      { provedor: 'outro', rotulo: 'x', segredo: 'abcdefgh1234' },
      { provedor: 'apify', rotulo: '', segredo: 'abcdefgh1234' },
      { provedor: 'apify', rotulo: 'x', segredo: 'curto' },
      { provedor: 'apify', rotulo: 'x', segredo: 'tem espaco no meio 123' },
      null
    ]) expect((await guardarSegredo(m.deps, 'jwt', corpo)).status).toBe(400);
    expect(m.gravado).toHaveLength(0);
  });
  it('modelo de IA exige endereço https e nome do modelo; Unipile aceita endereço opcional', async () => {
    const m = montar();
    expect((await guardarSegredo(m.deps, 'jwt', { provedor: 'modelo_ia', rotulo: 'm', segredo: 'sk-abcdefgh1234' })).status).toBe(400);
    expect((await guardarSegredo(m.deps, 'jwt', { provedor: 'modelo_ia', rotulo: 'm', segredo: 'sk-abcdefgh1234', config: { base_url: 'http://exemplo.com/v1', modelo: 'x' } })).status).toBe(400);
    expect((await guardarSegredo(m.deps, 'jwt', { provedor: 'modelo_ia', rotulo: 'm', segredo: 'sk-abcdefgh1234', config: { base_url: 'https://api.exemplo.com/v1/', modelo: 'gpt-x' } })).status).toBe(200);
    expect(m.gravado[0].p_config).toEqual({ base_url: 'https://api.exemplo.com/v1', modelo: 'gpt-x' });
    expect((await guardarSegredo(m.deps, 'jwt', { provedor: 'unipile', rotulo: 'u', segredo: 'unipile-abcdefgh', config: { url: 'ftp://x' } })).status).toBe(400);
    expect((await guardarSegredo(m.deps, 'jwt', { provedor: 'unipile', rotulo: 'u', segredo: 'unipile-abcdefgh' })).status).toBe(200);
  });
  it('config desconhecida é descartada (só entra o que o fornecedor usa)', async () => {
    const m = montar();
    await guardarSegredo(m.deps, 'jwt', { provedor: 'apify', rotulo: 'x', segredo: 'abcdefgh1234', config: { qualquer: 'coisa' } });
    expect(m.gravado[0].p_config).toEqual({});
  });
});

describe('testar segredo', () => {
  const lidos = {
    apify: [{ id: 'a1', rotulo: 'A', segredo: 'tok-apify-1234', config: {} }],
    modelo_ia: [{ id: 'm1', rotulo: 'M', segredo: 'sk-modelo-1234', config: { base_url: 'https://api.exemplo.com/v1', modelo: 'x' } }],
    unipile: [{ id: 'u1', rotulo: 'U', segredo: 'unipile-1234', config: {} }]
  };
  it('Apify: chama /users/me com a chave e anota o uso', async () => {
    const m = montar({ lidos });
    const r = await testarSegredo(m.deps, 'jwt', { id: 'a1' });
    expect(r).toEqual({ status: 200, corpo: { ok: true } });
    expect(m.sondas[0]).toEqual({ url: 'https://api.apify.com/v2/users/me', auth: 'Bearer tok-apify-1234' });
    expect(m.usos).toEqual([['a1', null]]);
  });
  it('chave recusada: diz isso claro, anota o erro e NÃO vaza a chave', async () => {
    const m = montar({ lidos, sonda: () => 401 });
    const r = await testarSegredo(m.deps, 'jwt', { id: 'a1' });
    expect(r.status).toBe(200);
    expect(r.corpo.ok).toBe(false);
    expect(String(r.corpo.mensagem)).toMatch(/recus/i);
    expect(JSON.stringify(r)).not.toContain('tok-apify');
    expect(m.usos[0][0]).toBe('a1');
    expect(m.usos[0][1]).toMatch(/recus/i);
  });
  it('Modelo de IA: chama {base_url}/models', async () => {
    const m = montar({ lidos });
    await testarSegredo(m.deps, 'jwt', { id: 'm1' });
    expect(m.sondas[0]).toEqual({ url: 'https://api.exemplo.com/v1/models', auth: 'Bearer sk-modelo-1234' });
  });
  it('Unipile: sem teste automático (não inventamos endereço de teste)', async () => {
    const m = montar({ lidos });
    const r = await testarSegredo(m.deps, 'jwt', { id: 'u1' });
    expect(r.corpo).toMatchObject({ ok: false, sem_teste: true });
    expect(m.sondas).toHaveLength(0);
  });
  it('não superadmin: 403; id que não existe: 404', async () => {
    expect((await testarSegredo(montar({ papel: 'outro', lidos }).deps, 'jwt', { id: 'a1' })).status).toBe(403);
    expect((await testarSegredo(montar({ lidos }).deps, 'jwt', { id: 'nao-existe' })).status).toBe(404);
  });
});
