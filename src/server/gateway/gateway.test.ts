import { describe, expect, it } from 'vitest';
import { criarGateway } from './gateway.ts';
import type { Cofre, SegredoLido } from '../cofre/cofre.ts';

const modelo = (n: number, config: Record<string, unknown> = {}): SegredoLido => ({
  id: `m${n}`, rotulo: `Modelo ${n}`, segredo: `chave-${n}`,
  config: { api: 'openai', base_url: `https://prov${n}.exemplo.com/v1`, modelo: `nome-${n}`, ...config }
});
const WS = 'a0000000-0000-0000-0000-000000000001';

function montar(modelos: SegredoLido[], upstream: (url: string, init: RequestInit) => Response | Promise<Response>, opcoes: { token?: 'ok' | 'invalido' | 'pausado'; cofreFora?: boolean } = {}) {
  const usos: Array<[string, string | null]> = [];
  const registros: Array<Record<string, any>> = [];
  const chamadas: Array<{ url: string; auth: string; corpo: any }> = [];
  let agora = 0;
  const buscar = (async (url: string, init: RequestInit) => {
    if (String(url).includes('/rpc/agent_runtime_resolve')) {
      if (opcoes.token === 'invalido') return Response.json({ code: '28000' }, { status: 400 });
      if (opcoes.token === 'pausado') return Response.json({ code: '55000' }, { status: 400 });
      return Response.json({ workspace_id: WS, agent_code: 'comercial' });
    }
    if (String(url).includes('/rpc/llm_registrar_uso')) { registros.push(JSON.parse(String(init.body))); return Response.json(null); }
    const h = init.headers as Record<string, string>;
    chamadas.push({ url: String(url), auth: h.Authorization ?? h['x-api-key'] ?? '', corpo: JSON.parse(String(init.body)) });
    return upstream(String(url), init);
  }) as unknown as typeof fetch;
  const cofre: Cofre = {
    ler: async () => { if (opcoes.cofreFora) throw new Error('fora'); return modelos; },
    marcarUso: async (id, erro) => { usos.push([id, erro ?? null]); }, invalidar: () => {}
  };
  const g = criarGateway({ baseBanco: 'http://banco', chaveServico: 's', cofre, buscar, agora: () => agora });
  const pedir = (corpo: unknown, auth: string | null = 'Bearer alt_agente_x', caminho = '/v1/chat/completions', metodo = 'POST') =>
    g.tratar({ metodo, caminho, autorizacao: auth ?? undefined, corpo: corpo === undefined ? '' : JSON.stringify(corpo) });
  return { pedir, usos, registros, chamadas, avancar: (ms: number) => { agora += ms; } };
}
const oai = (texto = 'Oi!', uso = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }) =>
  Response.json({ id: 'c', object: 'chat.completion', created: 1, model: 'nome-1', choices: [{ index: 0, message: { role: 'assistant', content: texto }, finish_reason: 'stop' }], usage: uso });
const PEDIDO = { model: 'althius', messages: [{ role: 'user', content: 'Oi' }] };

describe('gateway do modelo de IA', () => {
  it('sem token, token inválido ou agente pausado: 401/401/403 e nada sai para o provedor', async () => {
    const a = montar([modelo(1)], () => oai());
    expect((await a.pedir(PEDIDO, null)).status).toBe(401);
    const b = montar([modelo(1)], () => oai(), { token: 'invalido' });
    expect((await b.pedir(PEDIDO)).status).toBe(401);
    const c = montar([modelo(1)], () => oai(), { token: 'pausado' });
    expect((await c.pedir(PEDIDO)).status).toBe(403);
    expect(a.chamadas.length + b.chamadas.length + c.chamadas.length).toBe(0);
  });

  it('OpenAI: repassa com a chave do cofre, troca o nome do modelo e devolve com o nome lógico', async () => {
    const m = montar([modelo(1)], () => oai('Olá!'));
    const r = await m.pedir({ ...PEDIDO, stream: false, stream_options: { include_usage: true }, tools: [{ type: 'function', function: { name: 'f', parameters: {} } }] });
    expect(r.status).toBe(200);
    expect(m.chamadas[0].url).toBe('https://prov1.exemplo.com/v1/chat/completions');
    expect(m.chamadas[0].auth).toBe('Bearer chave-1');
    expect(m.chamadas[0].corpo.model).toBe('nome-1');
    expect(m.chamadas[0].corpo.stream).toBe(false);
    expect(m.chamadas[0].corpo.stream_options).toBeUndefined();
    expect(m.chamadas[0].corpo.tools).toHaveLength(1);
    const corpo = JSON.parse(r.corpo);
    expect(corpo.model).toBe('althius');
    expect(corpo.choices[0].message.content).toBe('Olá!');
    expect(r.corpo).not.toContain('chave-1');
  });

  it('Claude: traduz o pedido e a resposta', async () => {
    const m = montar([modelo(1, { api: 'anthropic', base_url: '', modelo: 'claude-x' })], () => Response.json({ id: 'msg', content: [{ type: 'text', text: 'Olá da Claude' }], stop_reason: 'end_turn', usage: { input_tokens: 7, output_tokens: 3 } }));
    const r = await m.pedir({ messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'Oi' }] });
    expect(m.chamadas[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(m.chamadas[0].auth).toBe('chave-1');
    expect(m.chamadas[0].corpo).toMatchObject({ model: 'claude-x', system: 'S', max_tokens: 4096 });
    expect(JSON.parse(r.corpo).choices[0].message.content).toBe('Olá da Claude');
    expect(JSON.parse(r.corpo).usage.total_tokens).toBe(10);
  });

  it('stream pedido: entrega em pedaços (SSE) mesmo com o provedor respondendo inteiro', async () => {
    const m = montar([modelo(1)], () => oai('Texto'));
    const r = await m.pedir({ ...PEDIDO, stream: true });
    expect(r.tipo).toBe('text/event-stream');
    expect(r.corpo).toContain('"content":"Texto"');
    expect(r.corpo.endsWith('data: [DONE]\n\n')).toBe(true);
    expect(m.chamadas[0].corpo.stream).toBe(false);
  });

  it('registra o uso por cliente e agente; custo só se o preço foi informado', async () => {
    const com = montar([modelo(1, { preco_entrada: 2, preco_saida: 10 })], () => oai());
    await com.pedir(PEDIDO);
    expect(com.registros[0]).toMatchObject({ p_workspace_id: WS, p_agente: 'comercial', p_rotulo: 'Modelo 1', p_modelo: 'nome-1', p_tokens_entrada: 100, p_tokens_saida: 20 });
    expect(com.registros[0].p_custo_usd).toBeCloseTo((100 * 2 + 20 * 10) / 1e6, 8);
    const sem = montar([modelo(1)], () => oai());
    await sem.pedir(PEDIDO);
    expect(sem.registros[0].p_custo_usd).toBeNull();
  });

  it('ordem pela prioridade; se o principal falha, usa o reserva e anota o erro do principal', async () => {
    const m = montar([modelo(1, { prioridade: 20 }), modelo(2, { prioridade: 5 })], url => url.includes('prov2') ? new Response('{}', { status: 429 }) : oai('do reserva'));
    const r = await m.pedir(PEDIDO);
    expect(m.chamadas.map(c => c.url.split('/')[2])).toEqual(['prov2.exemplo.com', 'prov1.exemplo.com']);
    expect(JSON.parse(r.corpo).choices[0].message.content).toBe('do reserva');
    expect(m.usos[0][0]).toBe('m2');
    expect(m.usos[0][1]).toMatch(/limite/i);
    expect(m.usos.some(([id, e]) => id === 'm1' && e === null)).toBe(true);
  });

  it('principal com problema fica de molho por 60s (não atrasa todo pedido); depois volta a ser tentado', async () => {
    const m = montar([modelo(1, { prioridade: 1 }), modelo(2, { prioridade: 2 })], url => url.includes('prov1') ? new Response('{}', { status: 500 }) : oai());
    await m.pedir(PEDIDO);
    m.chamadas.length = 0;
    await m.pedir(PEDIDO);
    expect(m.chamadas.map(c => c.url.split('/')[2])).toEqual(['prov2.exemplo.com']);
    m.avancar(61_000);
    m.chamadas.length = 0;
    await m.pedir(PEDIDO);
    expect(m.chamadas[0].url).toContain('prov1');
  });

  it('todos falham: 502 com mensagem genérica (sem texto do provedor, sem chave)', async () => {
    const m = montar([modelo(1), modelo(2)], () => new Response('{"error":"chave-1 inválida"}', { status: 401 }));
    const r = await m.pedir(PEDIDO);
    expect(r.status).toBe(502);
    expect(JSON.parse(r.corpo).error.type).toBe('modelo_indisponivel');
    expect(r.corpo).not.toContain('chave-');
    expect(m.registros).toHaveLength(0);
  });

  it('sem modelo cadastrado ou cofre fora: 503 claro (nunca resposta inventada)', async () => {
    const a = await montar([], () => oai()).pedir(PEDIDO);
    expect(a.status).toBe(503);
    expect(JSON.parse(a.corpo).error.message).toMatch(/modelo de IA/i);
    const b = await montar([modelo(1)], () => oai(), { cofreFora: true }).pedir(PEDIDO);
    expect(b.status).toBe(503);
  });

  it('pedido inválido: 400; rota desconhecida: 404; GET /v1/models lista o nome lógico', async () => {
    const m = montar([modelo(1)], () => oai());
    expect((await m.pedir(undefined)).status).toBe(400);
    expect((await m.pedir(PEDIDO, 'Bearer x', '/v1/outra')).status).toBe(404);
    const lista = await m.pedir(undefined, 'Bearer x', '/v1/models', 'GET');
    expect(JSON.parse(lista.corpo).data[0].id).toBe('althius');
  });

  it('modelo sem endereço (OpenAI) ou chave que não decifrou não derruba: pula', async () => {
    const m = montar([modelo(1, { base_url: '' }), modelo(2)], () => oai());
    expect((await m.pedir(PEDIDO)).status).toBe(200);
    expect(m.chamadas).toHaveLength(1);
  });
});
