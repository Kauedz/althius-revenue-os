// @vitest-environment node
// O agente testa uma fonte de sinal (ADR 0060): banco falso, Apify falsa. Nenhuma API real. Confere o caminho do crédito
// (reserva → cobra / devolve), que o agente nunca vê dólar e que a entrada pela metade nunca chega à fonte.
import { describe, expect, it } from 'vitest';
import { amostraDosItens, camposDosItens, testarFonteDoAgente } from './agente.ts';

const TOKEN = 'alt_agente_lia';
const inicioOk = {
  ok: true, teste_id: 't-1', creditos: 3, teto_usd: 0.0289, frequencia: 'semanal',
  conta: { nome: 'Acme S.A.', dominio: 'acme.com.br', linkedin_nome: 'Acme', linkedin_url: null }
};

function banco(inicio: unknown, status = 200) {
  const rpc: Array<{ nome: string; corpo: Record<string, unknown> }> = [];
  const buscar = (async (url: string, init: RequestInit) => {
    const nome = url.split('/rpc/')[1];
    const corpo = JSON.parse(String(init.body));
    rpc.push({ nome, corpo });
    if (nome === 'signal_agent_test_start') return new Response(JSON.stringify(inicio), { status });
    return Response.json({ acao: corpo.p_ok ? 'cobrado' : 'devolvido' });
  }) as unknown as typeof fetch;
  return { buscar, rpc };
}
const base = { base: 'http://rest:3000', chaveServico: 'svc', agora: () => Date.parse('2026-10-06T12:00:00Z') };
const pedido = (extra: Record<string, unknown> = {}) => ({
  sinal: 'noticias_empresa', conta_id: 'c-1', ator: 'dono/noticias', entrada: { q: '"{{empresa}}"' },
  mapeamento: { texto: 'Notícia: {{title}}', chave: '{{url}}', vinculo: 'entrada', quando: 'date' }, ...extra
});

describe('teste de fonte pelo agente', () => {
  it('roda com o teto do banco, cobra, e devolve campos, amostra e os eventos que o mapeamento geraria (sem dólar)', async () => {
    const { buscar, rpc } = banco(inicioOk);
    const chamadas: unknown[] = [];
    const pool = { coletar: async (ator: string, entrada: unknown, op: unknown) => {
      chamadas.push([ator, entrada, op]);
      return { itens: [{ title: 'Acme inaugura fábrica', url: 'https://n.test/1', date: '2026-10-05T10:00:00Z', meta: { lang: 'pt' } }], runId: 'r', conta: 'c', custoUsd: 0.0123 };
    } };
    const r = await testarFonteDoAgente({ ...base, buscar, pool }, TOKEN, pedido());
    expect(rpc[0]).toEqual({ nome: 'signal_agent_test_start', corpo: { p_token: TOKEN, p_signal_code: 'noticias_empresa', p_account_id: 'c-1', p_ator: 'dono/noticias' } });
    expect(chamadas[0]).toEqual(['dono/noticias', { q: '"Acme S.A."' }, expect.objectContaining({ maxItens: 5, tetoUsd: 0.0289, prazoSeg: 45 })]);
    expect(rpc[1]).toEqual({ nome: 'signal_agent_test_finish', corpo: { p_teste_id: 't-1', p_ok: true, p_itens: 1, p_custo_usd: 0.0123, p_mensagem: 'ok' } });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, itens: 1, creditos_cobrados: 3, eventos_gerados: 1 });
    expect(r.corpo.campos).toEqual(expect.arrayContaining(['title', 'url', 'date', 'meta', 'meta.lang']));
    expect((r.corpo.eventos as Array<{ texto: string }>)[0].texto).toBe('Notícia: Acme inaugura fábrica');
    expect(JSON.stringify(r.corpo)).not.toMatch(/0\.0123|usd|dólar|teto/i);
  });

  it('o banco recusa (sem pessoa pedindo, conta de outro cliente, limite do dia): nada roda e a mensagem vai ao agente', async () => {
    const { buscar } = banco({ ok: false, erro: 'Nenhuma pessoa pediu agora: o teste gasta créditos e só roda a pedido de alguém.' });
    let rodou = false;
    const r = await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async () => { rodou = true; return { itens: [], runId: null, conta: '', custoUsd: null }; } } }, TOKEN, pedido());
    expect(rodou).toBe(false);
    expect(r).toEqual({ status: 400, corpo: { erro: 'teste_recusado', mensagem: expect.stringMatching(/pediu/) } });
  });

  it('token inválido: 401 (sem prefixo nem pergunta ao banco; com prefixo, o banco diz 28000)', async () => {
    expect((await testarFonteDoAgente({ ...base, pool: { coletar: async () => { throw new Error('x'); } } }, 'outro', pedido())).status).toBe(401);
    const { buscar } = banco({ code: '28000', message: 'Token' }, 401);
    expect((await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async () => { throw new Error('x'); } } }, TOKEN, pedido())).status).toBe(401);
  });

  it('a fonte falha: devolve o crédito e diz o motivo', async () => {
    const { buscar, rpc } = banco(inicioOk);
    const r = await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async () => { throw new Error('Apify recusou a entrada do ator (HTTP 400).'); } } }, TOKEN, pedido());
    expect(rpc[1].corpo).toMatchObject({ p_ok: false, p_custo_usd: null });
    expect(r.corpo).toMatchObject({ ok: false, erro: 'fonte_falhou', creditos_cobrados: 0 });
    expect(String(r.corpo.mensagem)).toMatch(/HTTP 400/);
  });

  it('só itens de erro é falha, não "sem novidade"', async () => {
    const { buscar, rpc } = banco(inicioOk);
    await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async () => ({ itens: [{ error: 'blocked' }], runId: 'r', conta: 'c', custoUsd: 0.001 }) } }, TOKEN, pedido());
    expect(rpc[1].corpo).toMatchObject({ p_ok: false });
  });

  it('a conta não tem o dado que a entrada pede: devolve o crédito sem chamar a fonte', async () => {
    const { buscar, rpc } = banco(inicioOk);
    let rodou = false;
    const r = await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async () => { rodou = true; return { itens: [], runId: null, conta: '', custoUsd: null }; } } }, TOKEN, pedido({ entrada: { url: '{{linkedin_url}}' } }));
    expect(rodou).toBe(false);
    expect(rpc[1].corpo).toMatchObject({ p_ok: false });
    expect(String(r.corpo.mensagem)).toMatch(/linkedin_url/);
  });

  it('pedido malformado: 400 sem gastar nada', async () => {
    const { buscar, rpc } = banco(inicioOk);
    const pool = { coletar: async () => ({ itens: [], runId: null, conta: '', custoUsd: null }) };
    expect((await testarFonteDoAgente({ ...base, buscar, pool }, TOKEN, pedido({ entrada: [1] }))).status).toBe(400);
    expect((await testarFonteDoAgente({ ...base, buscar, pool }, TOKEN, pedido({ ator: '' }))).status).toBe(400);
    expect((await testarFonteDoAgente({ ...base, buscar, pool }, TOKEN, pedido({ entrada: { q: 'x'.repeat(5000) } }))).status).toBe(400);
    expect(rpc).toHaveLength(0);
  });

  it('nunca mais de 10 itens num teste', async () => {
    const { buscar } = banco(inicioOk);
    let op: { maxItens?: number } = {};
    await testarFonteDoAgente({ ...base, buscar, pool: { coletar: async (_a: string, _e: unknown, o: { maxItens: number }) => { op = o; return { itens: [], runId: null, conta: '', custoUsd: null }; } } }, TOKEN, pedido({ max_itens: 500 }));
    expect(op.maxItens).toBe(10);
  });
});

describe('ajudas do teste', () => {
  it('lista os campos até dois níveis e corta a amostra', () => {
    expect(camposDosItens([{ a: 1, b: { c: 2, d: { e: 3 } }, f: [{ g: 1 }] }])).toEqual(['a', 'b', 'b.c', 'b.d', 'f', 'f.0.g']);
    const grande = { texto: 'x'.repeat(5000) };
    const a = amostraDosItens([grande, grande, grande, grande]);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a.join('').length).toBeLessThanOrEqual(6000);
  });
});
