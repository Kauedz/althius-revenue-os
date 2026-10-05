// Testes da conexão de contas (PR 05): link do assistente hospedado e aviso de conclusão. A Unipile é falsa.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { iniciarConexao, type DepsConexoes } from './conexoes';
import { criarLinkHospedado } from './hospedado';
import { criarServidor } from './servidor';
import { assinarCorpo, type Banco } from './unipile';

const WS = 'a0000000-0000-0000-0000-000000000001';
const MEMBRO = 'd0000000-0000-0000-0000-000000000004';
const PEDIDO = 'f6000000-0000-0000-0000-000000000001';
const SEGREDO = 'segredo-de-teste-123';
const URL_API = 'https://api-falsa.exemplo.test';
const config = (apiKey = 'chave-de-teste') => () => ({ apiKey, url: URL_API });

/** fetch falso: guarda as chamadas e responde conforme o endereço */
function fetchFalso(opts: { banco?: { status: number; corpo: unknown }; unipile?: { status: number; corpo: unknown } } = {}) {
  const chamadas: Array<{ url: string; cabecalhos: Record<string, string>; corpo: any }> = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url, cabecalhos: init.headers as Record<string, string>, corpo: init.body ? JSON.parse(init.body as string) : undefined });
    const alvo = url.startsWith(URL_API) ? (opts.unipile ?? { status: 200, corpo: { link: 'https://conectar.exemplo.test/abc' } })
      : (opts.banco ?? { status: 200, corpo: { request_id: PEDIDO, type: 'create', provider: 'instagram', reconnect_account_id: null } });
    return { ok: alvo.status < 300, status: alvo.status, json: async () => alvo.corpo };
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const deps = (buscar: typeof fetch, extra: Partial<DepsConexoes> = {}): DepsConexoes => ({
  siteUrl: 'https://app.exemplo.com.br/', obterConfig: config(),
  baseBanco: 'http://rest:3000', chaveAnon: 'anon-de-teste', buscar, agora: () => new Date('2026-10-05T12:00:00Z'), ...extra
});
const pedido = { workspace_id: WS, member_id: MEMBRO, provider: 'instagram' };

describe('criarLinkHospedado', () => {
  const base = { tipo: 'create', provedor: 'whatsapp', pedidoId: PEDIDO, retornoUrl: 'https://x/volta', expiraEm: new Date('2026-10-05T12:30:00Z') } as const;
  it('monta o pedido do link (v2) e devolve o link', async () => {
    const { f, chamadas } = fetchFalso();
    const url = await criarLinkHospedado(config('k'), { ...base, provedor: 'microsoft' }, f);
    expect(url).toBe('https://conectar.exemplo.test/abc');
    expect(chamadas[0].url).toBe(`${URL_API}/v2/auth/link`);
    expect(chamadas[0].cabecalhos['X-API-KEY']).toBe('k');
    expect(chamadas[0].corpo).toEqual({ expires_on: '2026-10-05T12:30:00.000Z', redirect_uri: 'https://x/volta', state: PEDIDO, providers: ['outlook'] });
  });
  it('aceita o link dentro de data (formato alternativo da resposta)', async () => {
    const { f } = fetchFalso({ unipile: { status: 200, corpo: { data: { link: 'https://conectar.exemplo.test/z' } } } });
    expect(await criarLinkHospedado(config(), base, f)).toBe('https://conectar.exemplo.test/z');
  });
  it('reconexão leva a conta que já existe, sem lista de provedores', async () => {
    const { f, chamadas } = fetchFalso();
    await criarLinkHospedado(config(), { ...base, tipo: 'reconnect', provedor: 'linkedin', reconnectAccount: 'acc-9' }, f);
    expect(chamadas[0].corpo).toMatchObject({ state: PEDIDO, account_id: 'acc-9' });
    expect(chamadas[0].corpo.providers).toBeUndefined();
  });
  it('recusa resposta sem link seguro, erro HTTP e falta de chave (sem chamar)', async () => {
    await expect(criarLinkHospedado(config(), base, fetchFalso({ unipile: { status: 200, corpo: { link: 'http://inseguro' } } }).f)).rejects.toThrow();
    await expect(criarLinkHospedado(config(), base, fetchFalso({ unipile: { status: 500, corpo: {} } }).f)).rejects.toThrow('HTTP 500');
    const { f, chamadas } = fetchFalso();
    await expect(criarLinkHospedado(config(''), base, f)).rejects.toThrow('sem chave');
    expect(chamadas).toHaveLength(0);
  });
});

describe('iniciarConexao', () => {
  it('repassa o login da pessoa ao banco e devolve o link; o pedido volta no state', async () => {
    const { f, chamadas } = fetchFalso();
    const r = await iniciarConexao(deps(f), 'jwt-da-pessoa', pedido);
    expect(r).toEqual({ status: 200, corpo: { url: 'https://conectar.exemplo.test/abc' } });
    expect(chamadas[0].url).toBe('http://rest:3000/rpc/messaging_connect_start');
    expect(chamadas[0].cabecalhos.Authorization).toBe('Bearer jwt-da-pessoa');
    expect(chamadas[0].cabecalhos.apikey).toBe('anon-de-teste');
    expect(chamadas[0].corpo).toEqual({ p_workspace_id: WS, p_member_id: MEMBRO, p_provider: 'instagram' });
    expect(chamadas[1].corpo.state).toBe(PEDIDO);
    expect(chamadas[1].corpo.redirect_uri).toBe('https://app.exemplo.com.br/#/inbox');
    expect(chamadas[1].corpo.expires_on).toBe('2026-10-05T12:30:00.000Z');
  });
  it('a chave do provedor nunca vai ao banco, e o login da pessoa nunca vai ao provedor', async () => {
    const { f, chamadas } = fetchFalso();
    await iniciarConexao(deps(f), 'jwt-da-pessoa', pedido);
    expect(JSON.stringify(chamadas[0])).not.toContain('chave-de-teste');
    expect(JSON.stringify(chamadas[1])).not.toContain('jwt-da-pessoa');
  });
  it('banco recusa (42501): 403 e o provedor nem é chamado', async () => {
    const { f, chamadas } = fetchFalso({ banco: { status: 400, corpo: { code: '42501' } } });
    expect((await iniciarConexao(deps(f), 'jwt', pedido)).status).toBe(403);
    expect(chamadas).toHaveLength(1);
  });
  it('sem login: 401 sem chamar nada', async () => {
    const { f, chamadas } = fetchFalso();
    expect((await iniciarConexao(deps(f), '', pedido)).status).toBe(401);
    expect(chamadas).toHaveLength(0);
  });
  it('pedido inválido: 400', async () => {
    const { f } = fetchFalso();
    expect((await iniciarConexao(deps(f), 'jwt', { ...pedido, provider: 'telegram' })).status).toBe(400);
    expect((await iniciarConexao(deps(f), 'jwt', { ...pedido, member_id: 'nao-e-uuid' })).status).toBe(400);
    expect((await iniciarConexao(deps(f), 'jwt', null)).status).toBe(400);
  });
  it('sem chave do provedor: 503 claro (nunca simula)', async () => {
    const { f, chamadas } = fetchFalso();
    expect((await iniciarConexao(deps(f, { obterConfig: config('') }), 'jwt', pedido)).corpo).toEqual({ erro: 'conexao_indisponivel' });
    expect(chamadas).toHaveLength(0);
  });
  it('trocar a chave vale no pedido seguinte', async () => {
    const { f, chamadas } = fetchFalso();
    let chave = 'antiga';
    const d = deps(f, { obterConfig: () => ({ apiKey: chave, url: URL_API }) });
    await iniciarConexao(d, 'jwt', pedido);
    chave = 'nova';
    await iniciarConexao(d, 'jwt', pedido);
    const dosProvedor = chamadas.filter(c => c.url.startsWith(URL_API)).map(c => c.cabecalhos['X-API-KEY']);
    expect(dosProvedor).toEqual(['antiga', 'nova']);
  });
  it('provedor externo fora do ar: 502', async () => {
    const { f } = fetchFalso({ unipile: { status: 503, corpo: {} } });
    expect((await iniciarConexao(deps(f), 'jwt', pedido)).status).toBe(502);
  });
});

describe('rotas HTTP de conexão', () => {
  let abertos: Array<() => Promise<void>> = [];
  afterEach(async () => { for (const f of abertos) await f(); abertos = []; });

  async function subir(banco: Partial<Banco> = {}, comConexoes = true) {
    const { f, chamadas } = fetchFalso();
    const completo: Banco = {
      ingerirMensagem: async () => ({ action: 'persisted' }), definirStatus: async () => ({ action: 'updated' }),
      novaRelacao: async () => ({ action: 'connected' }), concluirConexao: async () => ({ action: 'connected' }), ...banco
    };
    const { servidor, ocioso } = criarServidor({ segredo: SEGREDO, banco: completo, log: () => {}, esperaMs: 1, conexoes: comConexoes ? deps(f) : undefined });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
    const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    return { url, ocioso, chamadas };
  }
  const post = (url: string, corpo: unknown, cabecalhos: Record<string, string> = {}) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) });

  it('/conexoes/link: sem Authorization 401; com login devolve o link', async () => {
    const s = await subir();
    expect((await post(s.url + '/conexoes/link', pedido)).status).toBe(401);
    const r = await post(s.url + '/conexoes/link', pedido, { Authorization: 'Bearer jwt-x' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ url: 'https://conectar.exemplo.test/abc' });
  });
  it('/conexoes/link sem a rota configurada: 503', async () => {
    const s = await subir({}, false);
    expect((await post(s.url + '/conexoes/link', pedido, { Authorization: 'Bearer jwt-x' })).status).toBe(503);
  });
  const avisoDeConta = (extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'ev9', type: 'account.add', account_id: 'acc1', payload: { state: PEDIDO, account: { provider: 'google' } }, ...extra });
  const enviarAviso = (url: string, corpo: string, segredo = SEGREDO) => {
    const t = String(Math.floor(Date.now() / 1000));
    return fetch(url + '/webhooks/unipile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Unipile-Signature': `t=${t},v0=${assinarCorpo(corpo, t, segredo)}` }, body: corpo });
  };
  it('aviso account.add com assinatura errada não conclui nada', async () => {
    let n = 0;
    const s = await subir({ concluirConexao: async () => { n++; return { action: 'connected' }; } });
    expect((await enviarAviso(s.url, avisoDeConta(), 'segredo-errado')).status).toBe(401);
    await s.ocioso();
    expect(n).toBe(0);
  });
  it('aviso account.add assinado conclui o pedido que veio no state', async () => {
    const vistos: string[] = [];
    const s = await subir({ concluirConexao: async (p, c) => { vistos.push(`${p}:${c}`); return { action: 'connected' }; } });
    expect((await enviarAviso(s.url, avisoDeConta())).status).toBe(200);
    await s.ocioso();
    expect(vistos).toEqual([`${PEDIDO}:acc1`]);
  });
  it('aviso account.add sem state de pedido não conclui nada', async () => {
    let n = 0;
    const s = await subir({ concluirConexao: async () => { n++; return { action: 'connected' }; } });
    await enviarAviso(s.url, avisoDeConta({ payload: { state: 'outra-coisa' } }));
    await s.ocioso();
    expect(n).toBe(0);
  });
  it('a rota antiga /webhooks/unipile/conta não existe mais', async () => {
    const s = await subir();
    expect((await post(s.url + '/webhooks/unipile/conta', {})).status).toBe(404);
  });
});
