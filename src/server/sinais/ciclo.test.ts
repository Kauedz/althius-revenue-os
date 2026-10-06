import { describe, expect, it } from 'vitest';
import { rodarSinais } from './ciclo.ts';
import type { AdaptadorApify } from './adaptadores/tipos.ts';

const pedido = (n: number, extra: Record<string, unknown> = {}) => ({
  run_id: `run-${n}`, workspace_id: 'ws-1', account_id: `acc-${n}`, account_name: `Empresa ${n}`, account_domain: `e${n}.test`,
  signal_code: 'vagas_cargo', signal_name: 'Vagas abertas por cargo', credits: 5, periodo: '2026-W41', frequencia: 'semanal',
  fontes: [
    { fonte: 'apify', ator: 'principal/ator', teto_usd: 0.05, max_itens: 25 },
    { fonte: 'apify', ator: 'reserva/ator', teto_usd: 0.1, max_itens: 25, reserva: true }
  ], ...extra
});

/** Banco falso: devolve os pedidos e anota o que o coletor entregou. Nenhuma chamada real. */
function bancoFalso(pedidos: unknown[]) {
  const rpc: Array<{ nome: string; corpo: Record<string, unknown> }> = [];
  const buscar = (async (url: string, init: RequestInit) => {
    const nome = url.split('/rpc/')[1];
    const corpo = JSON.parse(String(init.body));
    rpc.push({ nome, corpo });
    if (nome === 'signal_collect_next') return Response.json(pedidos);
    return Response.json({ acao: nome === 'signal_collect_finish' ? 'concluido' : 'falhou', eventos_novos: (corpo.p_eventos as unknown[] | undefined)?.length ?? 0 });
  }) as unknown as typeof fetch;
  return { buscar, rpc };
}

const adaptadorFalso = (eventosPorAtor: Record<string, unknown[]>): AdaptadorApify => ({
  entrada: (ator) => ({ ator }),
  eventos: (ator, itens) => itens.map((i, k) => ({ chave: `${ator}|${k}`, texto: String(i), evidencia: 'e', fonte: 'f', quando: '2026-10-05T00:00:00.000Z' })).concat((eventosPorAtor[ator] ?? []) as never[])
});

const base = { base: 'http://rest:3000', chaveServico: 'svc', esperaCustoMs: 0 };

describe('uma rodada da coleta de sinais', () => {
  it('pede trabalho ao banco, roda a fonte e entrega os acontecimentos com o custo real', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1)]);
    const chamadas: unknown[] = [];
    const pool = { coletar: async (ator: string, entrada: unknown, op: unknown) => { chamadas.push([ator, entrada, op]); return { itens: ['vaga A', 'vaga B'], runId: 'r', conta: 'Conta 1', custoUsd: 0.0024 }; } };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) }, agora: () => 1 });
    expect(rpc[0]).toEqual({ nome: 'signal_collect_next', corpo: { p_limit: 20 } });
    expect(chamadas).toEqual([['principal/ator', { ator: 'principal/ator' }, { maxItens: 25, tetoUsd: 0.05, build: undefined, memoriaMb: undefined, esperaCustoMs: 0 }]]);
    const fim = rpc.find(x => x.nome === 'signal_collect_finish')!;
    expect(fim.corpo.p_run_id).toBe('run-1');
    expect(fim.corpo.p_itens).toBe(2);
    expect(fim.corpo.p_custo_usd).toBe(0.0024);
    expect((fim.corpo.p_eventos as unknown[]).length).toBe(2);
    expect(r).toMatchObject({ ok: true, pedidos: 1, concluidos: 1, falhas: 0, eventos_novos: 2 });
  });

  it('o ator principal falha: usa o de reserva e soma o custo das duas tentativas', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1)]);
    const pool = { coletar: async (ator: string) => {
      if (ator === 'principal/ator') throw new Error('Apify: o ator demorou demais e foi interrompido.');
      return { itens: ['v'], runId: 'r', conta: 'c', custoUsd: 0.002 };
    } };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(rpc.some(x => x.nome === 'signal_collect_fail')).toBe(false);
    expect(rpc.find(x => x.nome === 'signal_collect_finish')!.corpo.p_custo_usd).toBe(0.002);
    expect(r).toMatchObject({ concluidos: 1 });
  });

  it('todas as fontes falham: registra a falha com o motivo e NÃO entrega nenhum acontecimento', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1)]);
    const pool = { coletar: async () => { throw new Error('Apify: nenhuma chave conseguiu rodar (chave recusada pela Apify).'); } };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(rpc.some(x => x.nome === 'signal_collect_finish')).toBe(false);
    const falha = rpc.find(x => x.nome === 'signal_collect_fail')!;
    expect(falha.corpo.p_run_id).toBe('run-1');
    expect(String(falha.corpo.p_mensagem)).toMatch(/chave recusada/);
    expect(r).toMatchObject({ pedidos: 1, concluidos: 0, falhas: 1, eventos_novos: 0 });
  });

  it('resposta sem nenhum item é um resultado válido (sem novidade), não uma falha', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1)]);
    const pool = { coletar: async () => ({ itens: [], runId: 'r', conta: 'c', custoUsd: 0.001 }) };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect((rpc.find(x => x.nome === 'signal_collect_finish')!.corpo.p_eventos as unknown[])).toEqual([]);
    expect(r).toMatchObject({ concluidos: 1, falhas: 0 });
  });

  it('sinal sem adaptador ou fonte ainda não suportada: falha clara, sem chamar a Apify', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1, { signal_code: 'sinal_novo' }), pedido(2, { fontes: [{ fonte: 'rss', url: 'x' }] })]);
    let chamou = 0;
    const pool = { coletar: async () => { chamou++; return { itens: [], runId: null, conta: 'c', custoUsd: null }; } };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(chamou).toBe(0);
    const falhas = rpc.filter(x => x.nome === 'signal_collect_fail').map(x => String(x.corpo.p_mensagem));
    expect(falhas[0]).toMatch(/sem adaptador/i);
    expect(falhas[1]).toMatch(/fonte.*não.*suportada/i);
    expect(r).toMatchObject({ falhas: 2 });
  });

  it('o custo desconhecido segue como nulo (nunca inventa um número)', async () => {
    const { buscar, rpc } = bancoFalso([pedido(1)]);
    const pool = { coletar: async () => ({ itens: ['v'], runId: null, conta: 'c', custoUsd: null }) };
    await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(rpc.find(x => x.nome === 'signal_collect_finish')!.corpo.p_custo_usd).toBeNull();
  });

  it('respeita o limite de execuções ao mesmo tempo (a conta grátis da Apify aceita 5)', async () => {
    const { buscar } = bancoFalso([1, 2, 3, 4, 5, 6, 7].map(n => pedido(n)));
    let agora = 0; let maximo = 0;
    const pool = { coletar: async () => { agora++; maximo = Math.max(maximo, agora); await new Promise(r => setTimeout(r, 15)); agora--; return { itens: [], runId: null, conta: 'c', custoUsd: null }; } };
    const r = await rodarSinais({ ...base, buscar, pool, concorrencia: 3, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(maximo).toBe(3);
    expect(r).toMatchObject({ concluidos: 7 });
  });

  it('banco fora do ar ou recusando: devolve erro claro e não roda nada', async () => {
    let chamou = 0;
    const pool = { coletar: async () => { chamou++; return { itens: [], runId: null, conta: 'c', custoUsd: null }; } };
    const fora = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    expect(await rodarSinais({ ...base, buscar: fora, pool, adaptadores: {} })).toEqual({ ok: false, erro: 'banco indisponível' });
    const recusa = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    expect(await rodarSinais({ ...base, buscar: recusa, pool, adaptadores: {} })).toEqual({ ok: false, erro: 'banco recusou o pedido de coleta (HTTP 401)' });
    expect(chamou).toBe(0);
  });

  it('o resultado da rodada só tem números (nada de nome, texto ou id de cliente)', async () => {
    const { buscar } = bancoFalso([pedido(1)]);
    const pool = { coletar: async () => ({ itens: ['v'], runId: 'r', conta: 'c', custoUsd: 0.5 }) };
    const r = await rodarSinais({ ...base, buscar, pool, adaptadores: { vagas_cargo: adaptadorFalso({}) } });
    expect(Object.values(r).every(v => typeof v === 'number' || typeof v === 'boolean')).toBe(true);
  });
});
