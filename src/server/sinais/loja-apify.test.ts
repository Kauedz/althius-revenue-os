// @vitest-environment node
// Loja da Apify (ADR 0060): só endereços públicos, preço convertido em créditos, nunca dólar para o agente. Loja falsa.
import { describe, expect, it } from 'vitest';
import { buscarFontes, detalharFonte, precoEmCreditos } from './loja-apify.ts';
import { PRECO_CREDITO_BRL } from '../../app/precos.ts';

const credito = (usd: number) => Math.round((usd * 5.5 / PRECO_CREDITO_BRL) * 10) / 10;

const itemDaLoja = (extra: Record<string, unknown> = {}) => ({
  username: 'valig', name: 'linkedin-jobs-scraper', title: 'LinkedIn Jobs', description: '$0.4/1K jobs | Scrape LinkedIn job listings',
  stats: { totalUsers30Days: 4311, publicActorRunStats30Days: { TOTAL: 200, SUCCEEDED: 198 } }, actorReviewRating: 4.67,
  currentPricingInfo: { pricingModel: 'PRICE_PER_DATASET_ITEM', pricePerUnitUsd: 0.0004 }, ...extra
});

function loja(rotas: Record<string, unknown>) {
  const pedidos: string[] = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    pedidos.push(url);
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/Authorization/i);
    const chave = Object.keys(rotas).find(k => url.includes(k));
    return chave ? Response.json({ data: rotas[chave] }) : new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

describe('preço em créditos', () => {
  it('por resultado', () => {
    expect(precoEmCreditos({ pricingModel: 'PRICE_PER_DATASET_ITEM', pricePerUnitUsd: 0.002 })).toEqual({ modelo: 'por_resultado', creditos_por_100_resultados: credito(0.2) });
  });
  it('por evento: o evento principal no plano mais caro, mais o início', () => {
    const p = precoEmCreditos({ pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: {
      'apify-actor-start': { isOneTimeEvent: true, eventPriceUsd: 0.00005 },
      'apify-default-dataset-item': { isPrimaryEvent: true, eventTieredPricingUsd: { FREE: { tieredEventPriceUsd: 0.002 }, GOLD: { tieredEventPriceUsd: 0.001 } } }
    } } });
    expect(p).toEqual({ modelo: 'por_evento', creditos_por_100_resultados: credito(0.2 + 0.00005) });
  });
  it('aluguel mensal e uso de máquina: sem número inventado', () => {
    expect(precoEmCreditos({ pricingModel: 'FLAT_PRICE_PER_MONTH', pricePerUnitUsd: 30 }).creditos_por_100_resultados).toBeNull();
    expect(precoEmCreditos({ pricingModel: 'FREE' }).creditos_por_100_resultados).toBeNull();
    expect(precoEmCreditos(null)).toEqual({ modelo: 'desconhecido', creditos_por_100_resultados: null });
  });
});

describe('busca na loja', () => {
  it('resume cada fonte sem chave, sem dólar e tira as de aluguel e descontinuadas', async () => {
    const { buscar, pedidos } = loja({ '/store?': { items: [
      itemDaLoja(),
      itemDaLoja({ name: 'aluguel', currentPricingInfo: { pricingModel: 'FLAT_PRICE_PER_MONTH', pricePerUnitUsd: 25 } }),
      itemDaLoja({ name: 'velho', isDeprecated: true }),
      itemDaLoja({ name: 'sem-nota', actorReviewRating: 0 })
    ] } });
    const r = await buscarFontes('linkedin jobs', 5, buscar);
    expect(pedidos[0]).toMatch(/^https:\/\/api\.apify\.com\/v2\/store\?search=linkedin\+jobs/);
    expect(r.map(f => f.ator)).toEqual(['valig/linkedin-jobs-scraper', 'valig/sem-nota']);
    expect(r[0]).toMatchObject({ usuarios_30_dias: 4311, avaliacao: 4.7, sucesso_30_dias: 99, preco: { modelo: 'por_resultado', creditos_por_100_resultados: credito(0.04) } });
    expect(r[1].avaliacao).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/\$|usd|dólar/i);
  });
  it('busca vazia é erro claro; loja fora do ar também', async () => {
    await expect(buscarFontes('  ', 5, loja({}).buscar)).rejects.toThrow(/Diga o que procurar/);
    const caiu = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    await expect(buscarFontes('x', 5, caiu)).rejects.toThrow(/não respondeu/);
  });
});

describe('detalhe de uma fonte', () => {
  it('traz os parâmetros da entrada (com opções e exemplos), o exemplo e o leia-me', async () => {
    const { buscar, pedidos } = loja({
      '/acts/valig~linkedin-jobs-scraper': { ...itemDaLoja(), stats: { actorReviewRating: 4.6, totalUsers30Days: 10 }, taggedBuilds: { latest: { buildId: 'B1' } },
        exampleRunInput: { body: '{"keywords":"dev"}' }, pricingInfos: [{ pricingModel: 'PRICE_PER_DATASET_ITEM', pricePerUnitUsd: 0.0004, startedAt: '2025-01-01T00:00:00Z' }] },
      '/actor-builds/B1': { readme: 'Leia-me. Custa $1 per 1000 results.', inputSchema: JSON.stringify({ required: ['keywords'], properties: {
        keywords: { type: 'string', description: 'Busca', example: 'Dev' },
        datePosted: { type: 'string', enum: ['r86400', 'r604800'], default: 'r604800' }
      } }) }
    });
    const d = await detalharFonte('valig/linkedin-jobs-scraper', buscar);
    expect(pedidos.map(p => p.replace('https://api.apify.com/v2', ''))).toEqual(['/acts/valig~linkedin-jobs-scraper', '/actor-builds/B1']);
    expect(d!.parametros).toEqual([
      { nome: 'keywords', tipo: 'string', obrigatorio: true, descricao: 'Busca', exemplo: 'Dev' },
      { nome: 'datePosted', tipo: 'string', obrigatorio: false, opcoes: ['r86400', 'r604800'], exemplo: 'r604800' }
    ]);
    expect(d!.exemplo_de_entrada).toEqual({ keywords: 'dev' });
    expect(d!.leia_me).not.toMatch(/\$/);
    expect(d!.preco.creditos_por_100_resultados).toBe(credito(0.04));
  });
  it('ator em formato estranho é recusado sem consultar nada; inexistente devolve nulo', async () => {
    const { buscar, pedidos } = loja({});
    await expect(detalharFonte('../etc', buscar)).rejects.toThrow(/inválido/);
    expect(pedidos).toHaveLength(0);
    expect(await detalharFonte('dono/nao-existe', buscar)).toBeNull();
  });
});
