// Testes da conexão de contas (PR 05): link do assistente hospedado e aviso de conclusão. A Unipile é falsa.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { assinarPedido, assinaturaValida, iniciarConexao, type DepsConexoes } from './conexoes';
import { criarLinkHospedado } from './hospedado';
import { criarServidor } from './servidor';
import { interpretarConexao, type Banco } from './unipile';

const WS = 'a0000000-0000-0000-0000-000000000001';
const MEMBRO = 'd0000000-0000-0000-0000-000000000004';
const PEDIDO = 'f6000000-0000-0000-0000-000000000001';
const SEGREDO = 'segredo-de-teste-123';
const DSN = 'https://api-falsa.exemplo.test:1111';

/** fetch falso: guarda as chamadas e responde conforme o endereço */
function fetchFalso(opts: { banco?: { status: number; corpo: unknown }; unipile?: { status: number; corpo: unknown } } = {}) {
  const chamadas: Array<{ url: string; cabecalhos: Record<string, string>; corpo: any }> = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url, cabecalhos: init.headers as Record<string, string>, corpo: init.body ? JSON.parse(init.body as string) : undefined });
    const alvo = url.startsWith(DSN) ? (opts.unipile ?? { status: 200, corpo: { url: 'https://conectar.exemplo.test/abc' } })
      : (opts.banco ?? { status: 200, corpo: { request_id: PEDIDO, type: 'create', provider: 'instagram', reconnect_account_id: null } });
    return { ok: alvo.status < 300, status: alvo.status, json: async () => alvo.corpo };
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const deps = (buscar: typeof fetch, extra: Partial<DepsConexoes> = {}): DepsConexoes => ({
  segredo: SEGREDO, siteUrl: 'https://app.exemplo.com.br/', unipile: { dsn: DSN, apiKey: 'chave-de-teste' },
  baseBanco: 'http://rest:3000', chaveAnon: 'anon-de-teste', buscar, agora: () => new Date('2026-10-05T12:00:00Z'), ...extra
});
const pedido = { workspace_id: WS, member_id: MEMBRO, provider: 'instagram' };

describe('criarLinkHospedado', () => {
  it('monta o pedido do assistente (create) e devolve o link', async () => {
    const { f, chamadas } = fetchFalso();
    const url = await criarLinkHospedado({ dsn: DSN, apiKey: 'k' }, { tipo: 'create', provedor: 'microsoft', nome: PEDIDO, notifyUrl: 'https://x/n', sucessoUrl: 'https://x/ok', falhaUrl: 'https://x/no', expiraEm: new Date('2026-10-05T12:30:00Z') }, f);
    expect(url).toBe('https://conectar.exemplo.test/abc');
    expect(chamadas[0].url).toBe(`${DSN}/api/v1/hosted/accounts/link`);
    expect(chamadas[0].cabecalhos['X-API-KEY']).toBe('k');
    expect(chamadas[0].corpo).toMatchObject({ type: 'create', providers: ['OUTLOOK'], name: PEDIDO, notify_url: 'https://x/n', expiresOn: '2026-10-05T12:30:00.000Z' });
    expect(chamadas[0].corpo.reconnect_account).toBeUndefined();
  });
  it('reconexão leva a conta que já existe', async () => {
    const { f, chamadas } = fetchFalso();
    await criarLinkHospedado({ dsn: DSN, apiKey: 'k' }, { tipo: 'reconnect', provedor: 'linkedin', nome: PEDIDO, notifyUrl: 'n', sucessoUrl: 's', falhaUrl: 'f', expiraEm: new Date(), reconnectAccount: 'acc-9' }, f);
    expect(chamadas[0].corpo).toMatchObject({ type: 'reconnect', providers: ['LINKEDIN'], reconnect_account: 'acc-9' });
  });
  it('recusa resposta sem link seguro e erro HTTP', async () => {
    const base = { tipo: 'create', provedor: 'whatsapp', nome: 'n', notifyUrl: 'n', sucessoUrl: 's', falhaUrl: 'f', expiraEm: new Date() } as const;
    await expect(criarLinkHospedado({ dsn: DSN, apiKey: 'k' }, base, fetchFalso({ unipile: { status: 200, corpo: { url: 'http://inseguro' } } }).f)).rejects.toThrow();
    await expect(criarLinkHospedado({ dsn: DSN, apiKey: 'k' }, base, fetchFalso({ unipile: { status: 500, corpo: {} } }).f)).rejects.toThrow('HTTP 500');
  });
});

describe('iniciarConexao', () => {
  it('repassa o login da pessoa ao banco e devolve o link; o endereço de retorno é assinado', async () => {
    const { f, chamadas } = fetchFalso();
    const r = await iniciarConexao(deps(f), 'jwt-da-pessoa', pedido);
    expect(r).toEqual({ status: 200, corpo: { url: 'https://conectar.exemplo.test/abc' } });
    expect(chamadas[0].url).toBe('http://rest:3000/rpc/messaging_connect_start');
    expect(chamadas[0].cabecalhos.Authorization).toBe('Bearer jwt-da-pessoa');
    expect(chamadas[0].cabecalhos.apikey).toBe('anon-de-teste');
    expect(chamadas[0].corpo).toEqual({ p_workspace_id: WS, p_member_id: MEMBRO, p_provider: 'instagram' });
    const notify = new URL(chamadas[1].corpo.notify_url);
    expect(notify.origin + notify.pathname).toBe('https://app.exemplo.com.br/webhooks/unipile/conta');
    expect(notify.searchParams.get('r')).toBe(PEDIDO);
    expect(assinaturaValida(SEGREDO, PEDIDO, notify.searchParams.get('t')!)).toBe(true);
    expect(chamadas[1].corpo.expiresOn).toBe('2026-10-05T12:30:00.000Z');
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
  it('sem chave do provedor ou sem segredo: 503 claro (nunca simula)', async () => {
    const { f, chamadas } = fetchFalso();
    expect((await iniciarConexao(deps(f, { unipile: { dsn: DSN, apiKey: '' } }), 'jwt', pedido)).corpo).toEqual({ erro: 'conexao_indisponivel' });
    expect((await iniciarConexao(deps(f, { segredo: '' }), 'jwt', pedido)).status).toBe(503);
    expect(chamadas).toHaveLength(0);
  });
  it('provedor externo fora do ar: 502', async () => {
    const { f } = fetchFalso({ unipile: { status: 503, corpo: {} } });
    expect((await iniciarConexao(deps(f), 'jwt', pedido)).status).toBe(502);
  });
});

describe('interpretarConexao', () => {
  it('criação com sucesso e nome igual ao pedido vira conclusão', () => {
    expect(interpretarConexao({ status: 'CREATION_SUCCESS', account_id: 'acc1', name: PEDIDO }, PEDIDO)).toEqual({ tipo: 'conexao', pedidoId: PEDIDO, conta: 'acc1' });
    expect(interpretarConexao({ status: 'RECONNECTED', account_id: 'acc1', name: PEDIDO }, PEDIDO)).toMatchObject({ tipo: 'conexao' });
  });
  it('nome diferente do pedido, sem conta ou status de falha: ignorado', () => {
    expect(interpretarConexao({ status: 'CREATION_SUCCESS', account_id: 'acc1', name: 'outro' }, PEDIDO)).toMatchObject({ tipo: 'ignorar' });
    expect(interpretarConexao({ status: 'CREATION_SUCCESS', name: PEDIDO }, PEDIDO)).toMatchObject({ tipo: 'ignorar' });
    expect(interpretarConexao({ status: 'ERROR', account_id: 'a', name: PEDIDO }, PEDIDO)).toEqual({ tipo: 'ignorar', motivo: 'conexao_sem_efeito' });
    expect(interpretarConexao(null, PEDIDO)).toMatchObject({ tipo: 'ignorar' });
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
  it('/webhooks/unipile/conta: assinatura errada ou ausente é 401 e nada é concluído', async () => {
    let n = 0;
    const s = await subir({ concluirConexao: async () => { n++; return { action: 'connected' }; } });
    const corpo = { status: 'CREATION_SUCCESS', account_id: 'acc1', name: PEDIDO };
    expect((await post(`${s.url}/webhooks/unipile/conta?r=${PEDIDO}&t=errada`, corpo)).status).toBe(401);
    expect((await post(`${s.url}/webhooks/unipile/conta?r=${PEDIDO}`, corpo)).status).toBe(401);
    expect((await post(`${s.url}/webhooks/unipile/conta?r=outro&t=${assinarPedido(SEGREDO, PEDIDO)}`, corpo)).status).toBe(401);
    await s.ocioso();
    expect(n).toBe(0);
  });
  it('/webhooks/unipile/conta: assinatura certa conclui o pedido certo', async () => {
    const vistos: string[] = [];
    const s = await subir({ concluirConexao: async (p, c) => { vistos.push(`${p}:${c}`); return { action: 'connected' }; } });
    const r = await post(`${s.url}/webhooks/unipile/conta?r=${PEDIDO}&t=${assinarPedido(SEGREDO, PEDIDO)}`, { status: 'CREATION_SUCCESS', account_id: 'acc1', name: PEDIDO });
    expect(r.status).toBe(200);
    await s.ocioso();
    expect(vistos).toEqual([`${PEDIDO}:acc1`]);
  });
  it('/webhooks/unipile/conta com nome de outro pedido não conclui nada', async () => {
    let n = 0;
    const s = await subir({ concluirConexao: async () => { n++; return { action: 'connected' }; } });
    await post(`${s.url}/webhooks/unipile/conta?r=${PEDIDO}&t=${assinarPedido(SEGREDO, PEDIDO)}`, { status: 'CREATION_SUCCESS', account_id: 'acc1', name: 'f6000000-0000-0000-0000-0000000000ff' });
    await s.ocioso();
    expect(n).toBe(0);
  });
});
