// @vitest-environment node
// Sincronia das contas com a ponte (ADR 0070): a conexão acha a conta sem depender do webhook, o estado acompanha a ponte.
// Ponte e banco falsos; nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import { estadoV1, estadoV2, ponteViaApi, sincronizarContas, type BancoSincronia, type ContaDaPonte, type EstadoDoBanco, type Ponte } from './sincronizar.ts';

const T0 = '2026-10-07T18:00:00.000Z';
const conta = (id: string, provedor: ContaDaPonte['provedor'], extra: Partial<ContaDaPonte> = {}): ContaDaPonte => ({ id, provedor, estado: 'connected', criadaEm: new Date('2026-10-07T18:05:00.000Z'), ...extra });
const ponte = (contas: ContaDaPonte[], completa = true): Ponte => ({ listarContas: async () => ({ contas, completa }) });

function banco(estado: EstadoDoBanco, conclusao: { action: string; reason?: string } = { action: 'connected' }) {
  const feitos: string[] = [];
  const b: BancoSincronia = {
    estado: async () => estado,
    concluirConexao: async (pedido, c) => { feitos.push(`conexao:${pedido}:${c}`); return conclusao; },
    definirEstado: async (c, e) => { feitos.push(`estado:${c}:${e}`); return { action: 'updated' }; }
  };
  return { b, feitos };
}
const quieto = () => {};

describe('conexão sem webhook', () => {
  it('um pedido aberto acha a única conta nova do mesmo provedor e a liga', async () => {
    const { b, feitos } = banco({ pendentes: [{ id: 'p1', provider: 'linkedin', criado_em: T0 }], registradas: [] });
    const r = await sincronizarContas({ banco: b, ponte: ponte([conta('acc-li', 'linkedin'), conta('acc-wa', 'whatsapp')]), log: quieto });
    expect(r).toMatchObject({ conectadas: 1, ambiguas: 0 });
    expect(feitos).toEqual(['conexao:p1:acc-li']);
  });
  it('duas candidatas: não adivinha (o dono do pedido não é decidido pela ponte)', async () => {
    const { b, feitos } = banco({ pendentes: [{ id: 'p1', provider: 'linkedin', criado_em: T0 }], registradas: [] });
    const r = await sincronizarContas({ banco: b, ponte: ponte([conta('a', 'linkedin'), conta('b', 'linkedin')]), log: quieto });
    expect(r).toMatchObject({ conectadas: 0, ambiguas: 1 });
    expect(feitos).toEqual([]);
  });
  it('conta criada ANTES do pedido (com 1 minuto de tolerância) ou que já é de alguém não conta como candidata', async () => {
    const { b, feitos } = banco({ pendentes: [{ id: 'p1', provider: 'whatsapp', criado_em: T0 }], registradas: [{ conta: 'ja-minha', provider: 'whatsapp', status: 'connected' }] });
    const r = await sincronizarContas({ banco: b, ponte: ponte([conta('velha', 'whatsapp', { criadaEm: new Date('2026-10-07T17:00:00.000Z') }), conta('ja-minha', 'whatsapp')]), log: quieto });
    expect(r).toMatchObject({ conectadas: 0, semConta: 1 });
    expect(feitos).toEqual([]);
  });
  it('dois pedidos de provedores diferentes acham cada um a sua conta; a mesma conta nunca vai para dois pedidos', async () => {
    const { b, feitos } = banco({ pendentes: [{ id: 'p1', provider: 'whatsapp', criado_em: T0 }, { id: 'p2', provider: 'instagram', criado_em: T0 }, { id: 'p3', provider: 'whatsapp', criado_em: T0 }], registradas: [] });
    const r = await sincronizarContas({ banco: b, ponte: ponte([conta('wa', 'whatsapp'), conta('ig', 'instagram')]), log: quieto });
    expect(r.conectadas).toBe(2);
    expect(feitos.filter(f => f.startsWith('conexao'))).toEqual(['conexao:p1:wa', 'conexao:p2:ig']);
  });
  it('o banco recusar (conta de outra pessoa, pedido vencido) não derruba nada e não conta como conectada', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const { b } = banco({ pendentes: [{ id: 'p1', provider: 'linkedin', criado_em: T0 }], registradas: [] }, { action: 'ignored', reason: 'request_expired' });
    const r = await sincronizarContas({ banco: b, ponte: ponte([conta('acc-li', 'linkedin')]), log: l => logs.push(l) });
    expect(r.conectadas).toBe(0);
    expect(logs[0]).toMatchObject({ msg: 'conexao_nao_concluida', motivo: 'request_expired' });
  });
});

describe('estado das contas', () => {
  const registradas = (status: string) => [{ conta: 'acc', provider: 'linkedin' as const, status }];
  it('a ponte diz que caiu: attention; que voltou: connected; só grava quando muda', async () => {
    let x = banco({ pendentes: [], registradas: registradas('connected') });
    await sincronizarContas({ banco: x.b, ponte: ponte([conta('acc', 'linkedin', { estado: 'attention' })]), log: quieto });
    expect(x.feitos).toEqual(['estado:acc:attention']);
    x = banco({ pendentes: [], registradas: registradas('attention') });
    await sincronizarContas({ banco: x.b, ponte: ponte([conta('acc', 'linkedin', { estado: 'connected' })]), log: quieto });
    expect(x.feitos).toEqual(['estado:acc:connected']);
    x = banco({ pendentes: [], registradas: registradas('connected') });
    expect(await sincronizarContas({ banco: x.b, ponte: ponte([conta('acc', 'linkedin')]), log: quieto })).toMatchObject({ atualizadas: 0 });
    expect(x.feitos).toEqual([]);
  });
  it('estado desconhecido da ponte (conectando) não muda nada', async () => {
    const x = banco({ pendentes: [], registradas: registradas('connected') });
    await sincronizarContas({ banco: x.b, ponte: ponte([conta('acc', 'linkedin', { estado: null })]), log: quieto });
    expect(x.feitos).toEqual([]);
  });
  it('conta que a ponte já não lista vira disconnected, mas só se a listagem veio completa', async () => {
    let x = banco({ pendentes: [], registradas: registradas('connected') });
    await sincronizarContas({ banco: x.b, ponte: ponte([], true), log: quieto });
    expect(x.feitos).toEqual(['estado:acc:disconnected']);
    x = banco({ pendentes: [], registradas: registradas('connected') });
    await sincronizarContas({ banco: x.b, ponte: ponte([], false), log: quieto });
    expect(x.feitos).toEqual([]);
  });
  it('o log nunca leva id de conta nem nada pessoal', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const x = banco({ pendentes: [{ id: 'p1', provider: 'linkedin', criado_em: T0 }], registradas: registradas('connected') });
    await sincronizarContas({ banco: x.b, ponte: ponte([conta('acc', 'linkedin', { estado: 'attention' }), conta('SEGREDO-ID-NOVO', 'linkedin')]), log: l => logs.push(l) });
    expect(JSON.stringify(logs)).not.toContain('SEGREDO-ID-NOVO');
    expect(JSON.stringify(logs)).not.toContain('"acc"');
  });
});

describe('a ponte de verdade (fetch falso)', () => {
  const resposta = (corpo: unknown, status = 200) => (async (url: string, init: RequestInit) => { chamadas.push({ url, chave: (init.headers as Record<string, string>)['X-API-KEY'] }); return { ok: status < 300, status, json: async () => corpo }; }) as unknown as typeof fetch;
  const chamadas: Array<{ url: string; chave: string }> = [];

  it('estado: v1 por fonte (tudo OK conecta, problema pede atenção) e v2 por status', () => {
    expect(estadoV1([{ status: 'OK' }, { status: 'OK' }])).toBe('connected');
    expect(estadoV1([{ status: 'OK' }, { status: 'CREDENTIALS' }])).toBe('attention');
    expect(estadoV1([{ status: 'CONNECTING' }])).toBeNull();
    expect(estadoV1([])).toBeNull();
    expect(estadoV2('running')).toBe('connected');
    expect(estadoV2('errored')).toBe('attention');
    expect(estadoV2('degraded')).toBeNull();
  });
  it('v1: lê /api/v1/accounts, traduz os tipos e ignora o que não é nosso', async () => {
    chamadas.length = 0;
    const lista = await ponteViaApi(() => ({ apiKey: 'k', url: 'https://api68.unipile.com:19840' }), resposta({ items: [
      { id: 'a1', type: 'GOOGLE_OAUTH', created_at: '2026-10-07T18:35:44.743Z', sources: [{ status: 'OK' }, { status: 'OK' }] },
      { id: 'a2', type: 'LINKEDIN', created_at: '2026-10-07T18:10:45.100Z', sources: [{ status: 'CREDENTIALS' }] },
      { id: 'a3', type: 'TELEGRAM', created_at: '2026-10-07T18:10:45.100Z', sources: [{ status: 'OK' }] },
      { id: 'a4', type: 'WHATSAPP', created_at: 'data inválida', sources: [{ status: 'OK' }] }
    ] })).listarContas();
    expect(chamadas[0]).toEqual({ url: 'https://api68.unipile.com:19840/api/v1/accounts?limit=250', chave: 'k' });
    expect(lista.contas.map(c => [c.id, c.provedor, c.estado])).toEqual([['a1', 'google', 'connected'], ['a2', 'linkedin', 'attention']]);
    expect(lista.completa).toBe(true);
  });
  it('v2: lê /v2/accounts, e has_more marca a lista como incompleta', async () => {
    chamadas.length = 0;
    const lista = await ponteViaApi(() => ({ apiKey: 'k', url: 'https://api.unipile.com' }), resposta({ data: [{ id: 'b1', provider: 'outlook', status: 'running', created_at: '2026-10-07T18:00:00Z' }], has_more: true })).listarContas();
    expect(chamadas[0].url).toBe('https://api.unipile.com/v2/accounts/?limit=100');
    expect(lista.contas).toHaveLength(1);
    expect(lista.contas[0]).toMatchObject({ provedor: 'microsoft', estado: 'connected' });
    expect(lista.completa).toBe(false);
  });
  it('sem chave ou com recusa da ponte: erro claro (e o ciclo de envio segue)', async () => {
    await expect(ponteViaApi(() => ({ apiKey: '', url: 'https://api.unipile.com' }), resposta({})).listarContas()).rejects.toThrow('sem chave');
    await expect(ponteViaApi(() => ({ apiKey: 'k', url: 'https://api.unipile.com' }), resposta({}, 401)).listarContas()).rejects.toThrow('HTTP 401');
  });
});
