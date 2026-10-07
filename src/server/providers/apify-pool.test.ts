import { describe, expect, it } from 'vitest';
import { criarPoolApify } from './apify-pool.ts';
import type { Cofre, SegredoLido } from '../cofre/cofre.ts';

const chave = (n: number): SegredoLido => ({ id: `k${n}`, rotulo: `Conta ${n}`, segredo: `tok-${n}`, config: {} });
function cofreCom(itens: SegredoLido[]) {
  const usos: Array<[string, string | null]> = [];
  const cofre: Cofre = { ler: async () => itens, marcarUso: async (id, erro) => { usos.push([id, erro ?? null]); }, invalidar: () => {} };
  return { cofre, usos };
}
const ok = (id = 'run1') => Response.json({ data: { id, status: 'READY' } }, { status: 201 });

describe('rodízio da Apify (quantas chaves o superadmin cadastrar)', () => {
  it('divide o trabalho: cada pedido vai para a chave menos ocupada', async () => {
    const { cofre } = cofreCom([1, 2, 3, 4, 5, 6].map(chave));
    const usadas: string[] = [];
    const liberar: Array<() => void> = [];
    const buscar = (async (_u: string, init: RequestInit) => {
      usadas.push(String((init.headers as Record<string, string>).Authorization));
      await new Promise<void>(r => liberar.push(r));
      return ok();
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {} });
    const pedidos = [1, 2, 3, 4, 5, 6].map(() => pool.executar('ator/x', {}));
    await new Promise(r => setTimeout(r, 20));
    expect(new Set(usadas).size).toBe(6); // seis pedidos ao mesmo tempo, seis chaves diferentes
    liberar.forEach(f => f());
    await Promise.all(pedidos);
  });

  it('manda a chave no cabeçalho (nunca na URL) e devolve qual conta rodou', async () => {
    const { cofre, usos } = cofreCom([chave(1)]);
    let url = '';
    const buscar = (async (u: string) => { url = u; return ok('abc'); }) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).executar('ator/x', { a: 1 });
    expect(r).toEqual({ runId: 'abc', conta: 'Conta 1', status: 'READY' });
    expect(url).toBe('https://api.apify.com/v2/acts/ator%2Fx/runs');
    expect(url).not.toContain('tok-1');
    expect(usos).toEqual([['k1', null]]);
  });

  it('chave recusada: anota o erro, tenta a próxima e pula a ruim por um tempo', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    let agora = 0;
    const tentadas: string[] = [];
    const buscar = (async (_u: string, init: RequestInit) => {
      const a = String((init.headers as Record<string, string>).Authorization);
      tentadas.push(a);
      return a.endsWith('tok-1') ? new Response('{}', { status: 401 }) : ok();
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {}, agora: () => agora });
    expect((await pool.executar('a/b', {})).conta).toBe('Conta 2');
    expect(usos[0]).toEqual(['k1', expect.stringMatching(/recus/i)]);
    tentadas.length = 0;
    await pool.executar('a/b', {});
    expect(tentadas).toEqual(['Bearer tok-2']); // a ruim está de molho
    agora += 61_000;
    tentadas.length = 0;
    await pool.executar('a/b', {});
    expect(tentadas).toContain('Bearer tok-1'); // passado o tempo, volta a tentar
  });

  it('limite de requisição (429): troca de chave sem marcar como recusada', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    const buscar = (async (_u: string, init: RequestInit) => String((init.headers as Record<string, string>).Authorization).endsWith('tok-1') ? new Response('{}', { status: 429 }) : ok()) as unknown as typeof fetch;
    expect((await criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {})).conta).toBe('Conta 2');
  });

  it('todas falham: erro claro (nunca resultado inventado)', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    const buscar = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {})).rejects.toThrow(/Apify/);
  });

  it('sem nenhuma chave (cofre vazio e sem .env): erro claro que manda cadastrar na tela', async () => {
    const { cofre } = cofreCom([]);
    await expect(criarPoolApify({ cofre, buscar: (async () => ok()) as unknown as typeof fetch, env: {} }).executar('a/b', {})).rejects.toThrow(/chave da Apify/i);
  });

  it('cofre vazio ou desligado: usa as chaves APIFY_TOKEN_* do .env (quantas houver)', async () => {
    const usadas: string[] = [];
    const buscar = (async (_u: string, init: RequestInit) => { usadas.push(String((init.headers as Record<string, string>).Authorization)); return ok(); }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre: null, buscar, env: { APIFY_TOKEN_1: 'env-1', APIFY_TOKEN_7: 'env-7' } });
    await pool.executar('a/b', {});
    expect(usadas).toHaveLength(1);
    expect(pool.chaves ? (await pool.chaves()).length : 0).toBe(2);
  });
});

describe('coleta de itens pelo rodízio (ticket 01 da coleta de sinais)', () => {
  const itensOk = (itens: unknown, runId: string | null = 'run-9') =>
    new Response(JSON.stringify(itens), { status: 201, headers: runId ? { 'x-apify-run-id': runId, 'content-type': 'application/json' } : { 'content-type': 'application/json' } });

  it('roda o ator de forma síncrona com teto de gasto, limite de itens e versão; chave só no cabeçalho', async () => {
    const { cofre } = cofreCom([chave(1)]);
    const chamadas: Array<{ url: string; auth: string; corpo: unknown }> = [];
    const buscar = (async (u: string, init: RequestInit = {}) => {
      chamadas.push({ url: u, auth: String((init.headers as Record<string, string>)?.Authorization), corpo: init.body ? JSON.parse(String(init.body)) : null });
      if (u.includes('run-sync-get-dataset-items')) return itensOk([{ title: 'Vaga A' }, { title: 'Vaga B' }]);
      return Response.json({ data: { id: 'run-9', status: 'SUCCEEDED', usageTotalUsd: 0.0024 } });
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {} });
    const r = await pool.coletar('valig/linkedin-jobs-scraper', { keywords: 'x' }, { maxItens: 25, tetoUsd: 0.05, build: 'latest', memoriaMb: 512, esperaCustoMs: 0 });
    expect(r.itens).toEqual([{ title: 'Vaga A' }, { title: 'Vaga B' }]);
    expect(r.runId).toBe('run-9');
    expect(r.conta).toBe('Conta 1');
    expect(r.custoUsd).toBe(0.0024);
    const u = new URL(chamadas[0].url);
    expect(u.pathname).toBe('/v2/acts/valig~linkedin-jobs-scraper/run-sync-get-dataset-items');
    expect(u.searchParams.get('maxTotalChargeUsd')).toBe('0.05');
    expect(u.searchParams.get('maxItems')).toBe('25');
    expect(u.searchParams.get('build')).toBe('latest');
    expect(u.searchParams.get('memory')).toBe('512');
    expect(chamadas[0].auth).toBe('Bearer tok-1');
    expect(chamadas[0].url).not.toContain('tok-1');
    expect(chamadas[0].corpo).toEqual({ keywords: 'x' });
  });

  it('sem o cabeçalho do id da execução, acha a última execução do ator (só se começou depois da chamada)', async () => {
    const { cofre } = cofreCom([chave(1)]);
    const t0 = 1_800_000_000_000;
    const buscar = (async (u: string) => {
      if (u.includes('run-sync-get-dataset-items')) return itensOk([{ a: 1 }], null);
      // A Apify só entende o nome do ator com "~" nesta rota (com "%2F" responde 404; o protótipo já usava "~").
      if (u.endsWith('/v2/acts/a~b/runs/last')) return Response.json({ data: { id: 'run-ultimo', startedAt: new Date(t0 + 500).toISOString() } });
      if (u.includes('/runs/last')) return new Response('{}', { status: 404 });
      return Response.json({ data: { id: 'run-ultimo', usageTotalUsd: 0.001 } });
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {}, agora: () => t0 });
    const r = await pool.coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01, esperaCustoMs: 0 });
    expect(r.runId).toBe('run-ultimo');
    expect(r.custoUsd).toBe(0.001);
  });

  it('a Apify ainda está fechando a conta: relê até o custo estabilizar e usa o valor final', async () => {
    const { cofre } = cofreCom([chave(1)]);
    const preco = { pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: { item: { eventPriceUsd: 0.0004 }, start: { eventPriceUsd: 0.001 } } } };
    const leituras = [
      { usageTotalUsd: 0, chargedEventCounts: { start: 1 }, pricingInfo: preco },
      { usageTotalUsd: 0.0014, chargedEventCounts: { start: 1, item: 1 }, pricingInfo: preco },
      { usageTotalUsd: 0.0018, chargedEventCounts: { start: 1, item: 2 }, pricingInfo: preco },
      { usageTotalUsd: 0.0018, chargedEventCounts: { start: 1, item: 2 }, pricingInfo: preco }
    ];
    let n = 0;
    const buscar = (async (u: string) => u.includes('run-sync') ? itensOk([{ a: 1 }, { a: 2 }]) : Response.json({ data: leituras[Math.min(n++, leituras.length - 1)] })) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01, esperaCustoMs: 1 });
    expect(r.custoUsd).toBe(0.0018);
    expect(n).toBeLessThanOrEqual(4);
  });

  it('não consegue ler o custo: devolve os itens e o custo nulo (nunca um número inventado)', async () => {
    const { cofre } = cofreCom([chave(1)]);
    const buscar = (async (u: string) => u.includes('run-sync') ? itensOk([{ a: 1 }]) : new Response('{}', { status: 500 })) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01, esperaCustoMs: 0 });
    expect(r.itens).toHaveLength(1);
    expect(r.custoUsd).toBeNull();
  });

  it('chave recusada (401): usa a próxima chave', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    const buscar = (async (u: string, init: RequestInit = {}) => {
      const a = String((init.headers as Record<string, string>)?.Authorization);
      if (!u.includes('run-sync')) return Response.json({ data: { id: 'r', usageTotalUsd: 0 } });
      return a.endsWith('tok-1') ? new Response('{}', { status: 401 }) : itensOk([{ ok: 1 }]);
    }) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01, esperaCustoMs: 0 });
    expect(r.conta).toBe('Conta 2');
    expect(usos[0][0]).toBe('k1');
  });

  it('entrada recusada pelo ator (400): erro claro na hora, sem culpar nem trocar a chave', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    let n = 0;
    const buscar = (async () => { n++; return new Response('{"error":{"message":"Input is not valid"}}', { status: 400 }); }) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01 })).rejects.toThrow(/entrada.*400/i);
    expect(n).toBe(1);
    expect(usos).toEqual([]);
  });

  it('prazo estourado (408): erro claro, sem trocar de chave', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    let n = 0;
    const buscar = (async () => { n++; return new Response('{}', { status: 408 }); }) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01 })).rejects.toThrow(/demorou/i);
    expect(n).toBe(1);
  });

  it('resposta que não é uma lista de itens: erro (nunca vira "nenhum item")', async () => {
    const { cofre } = cofreCom([chave(1)]);
    const buscar = (async () => itensOk({ erro: 'x' })) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0.01 })).rejects.toThrow(/inesperada/i);
  });

  it('sem teto de gasto: recusa antes de chamar (nunca roda sem limite)', async () => {
    const { cofre } = cofreCom([chave(1)]);
    let n = 0;
    const buscar = (async () => { n++; return itensOk([]); }) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 0 })).rejects.toThrow(/teto/i);
    expect(n).toBe(0);
  });
});

// ADR 0071: cinco contas gratuitas, cada uma com o seu limite do mês. Esgotou uma, passa para a próxima.
describe('conta que esgotou o limite do mês (contas gratuitas em rodízio)', () => {
  const esgotada = () => Response.json({ error: { type: 'platform-feature-disabled', message: 'Monthly usage hard limit exceeded' } }, { status: 403 });
  const itens = () => Response.json([{ a: 1 }], { status: 200, headers: { 'x-apify-run-id': 'r1' } });

  it('402 ou 403 com cara de limite: a próxima conta assume, a esgotada some por horas e a tela diz o motivo', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2), chave(3)]);
    let agora = 0;
    const tentadas: string[] = [];
    const buscar = (async (_u: string, init: RequestInit) => {
      const a = String((init.headers as Record<string, string>).Authorization);
      tentadas.push(a);
      if (a.endsWith('tok-1')) return esgotada();
      if (a.endsWith('tok-2')) return Response.json({ error: { type: 'not-enough-usage-to-run-paid-actor' } }, { status: 402 });
      return ok();
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {}, agora: () => agora });
    expect((await pool.executar('a/b', {})).conta).toBe('Conta 3');
    expect(usos.filter(([, e]) => e && /Limite do mês esgotado/.test(e)).map(([id]) => id).sort()).toEqual(['k1', 'k2']);
    expect(usos.some(([, e]) => e && /recusada/.test(e))).toBe(false); // não é "chave recusada"
    // Uma hora depois: as duas esgotadas continuam de molho; só a boa roda.
    tentadas.length = 0; agora += 60 * 60_000;
    await pool.executar('a/b', {});
    expect(tentadas).toEqual(['Bearer tok-3']);
    // Seis horas depois, tenta de novo (a conta pode ter renovado).
    tentadas.length = 0; agora += 6 * 60 * 60_000;
    await pool.executar('a/b', {});
    expect(tentadas[0]).toMatch(/tok-[12]$/);
  });

  it('403 sem cara de limite continua sendo chave recusada', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    const buscar = (async (_u: string, init: RequestInit) => String((init.headers as Record<string, string>).Authorization).endsWith('tok-1') ? Response.json({ error: { message: 'Forbidden' } }, { status: 403 }) : ok()) as unknown as typeof fetch;
    await criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {});
    expect(usos).toContainEqual(['k1', 'Chave recusada pela Apify.']);
  });

  it('na coleta (endpoint síncrono) vale a mesma regra', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    const buscar = (async (_u: string, init: RequestInit) => String((init.headers as Record<string, string>).Authorization).endsWith('tok-1') ? esgotada() : itens()) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).coletar('a/b', {}, { maxItens: 5, tetoUsd: 1, esperaCustoMs: 0 });
    expect(r.conta).toBe('Conta 2');
    expect(r.itens).toEqual([{ a: 1 }]);
    expect(usos).toContainEqual(['k1', expect.stringMatching(/Limite do mês esgotado/)]);
  });

  it('todas as contas esgotadas: erro claro (e nada simulado)', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    const buscar = (async () => esgotada()) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {})).rejects.toThrow('limite do mês esgotado');
  });
});
