// @vitest-environment node
// Uma rodada do enriquecimento: banco falso, internet falsa e Apify falsa (nenhuma chamada real).
import { describe, expect, it } from 'vitest';
import { rodarEnriquecimento } from './ciclo.ts';

const conta = (n: number) => ({
  id: `acc-${n}`, nome: `Canário ${n}`, dominio: `canario${n}.test`, cnpj: null, razao_social: null, cidade: null, uf: null, cep: null, endereco: null,
  lat: null, lng: null, linkedin_nome: null, linkedin_url: null
});
const empresa = (n: number) => ({ job_id: `job-e${n}`, etapa: 'empresa', workspace_id: 'ws-1', creditos: 5, teto_usd: 0.0481, conta: conta(n) });
const pessoas = (n: number) => ({
  job_id: `job-p${n}`, etapa: 'pessoas', workspace_id: 'ws-1', creditos: 10, teto_usd: 0.0962, conta: conta(n),
  personas_alvo: [{ cargo: 'CEO', papel: 'decisor' }], max_pessoas: 5, ja_tem: []
});

function mundoFalso(trabalhos: unknown[], site: Record<string, Response> = {}) {
  const rpc: Array<{ nome: string; corpo: Record<string, any> }> = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    if (url.includes('/rpc/')) {
      const nome = url.split('/rpc/')[1];
      rpc.push({ nome, corpo: JSON.parse(String(init?.body)) });
      if (nome === 'enrichment_next') return Response.json(trabalhos);
      return Response.json({ acao: 'concluido' });
    }
    for (const [p, r] of Object.entries(site)) if (url.startsWith(p)) return r.clone();
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  return { buscar, rpc };
}
const base = { base: 'http://rest:3000', chaveServico: 'svc', esperaCustoMs: 0, empresa: { esperar: async () => undefined } };
const semApify = { coletar: async () => { throw new Error('Nenhuma chave da Apify cadastrada. O superadmin cadastra em Fornecedores.'); } };

describe('uma rodada do enriquecimento', () => {
  it('empresa: entrega os campos achados com a fonte de cada um e custo zero', async () => {
    const { buscar, rpc } = mundoFalso([empresa(1)], {
      'https://canario1.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario1.test': new Response('CNPJ 12.345.678/0001-95', { headers: { 'content-type': 'text/html' } }),
      'https://brasilapi.com.br/api/cnpj/v1/12345678000195': Response.json({ razao_social: 'CANARIO LTDA', uf: 'SP', municipio: 'CAMPINAS' })
    });
    const r = await rodarEnriquecimento({ ...base, buscar, pool: semApify });
    expect(r).toEqual({ ok: true, pedidos: 1, concluidos: 1, falhas: 0 });
    expect(rpc[0]).toEqual({ nome: 'enrichment_next', corpo: { p_limit: 10 } });
    const fim = rpc.find(x => x.nome === 'enrichment_finish')!;
    expect(fim.corpo).toMatchObject({ p_job_id: 'job-e1', p_custo_usd: 0 });
    expect(fim.corpo.p_resultado.campos).toMatchObject({ cnpj: '12345678000195', razao_social: 'CANARIO LTDA', city: 'Campinas', state_uf: 'SP' });
    expect(fim.corpo.p_resultado.fontes.cnpj).toBe('Site da empresa');
  });

  it('empresa sem CNPJ no site: busca no Google, confere na Receita e entrega com o custo real da busca', async () => {
    const { buscar, rpc } = mundoFalso([empresa(1)], {
      'https://canario1.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario1.test': new Response('Fale conosco', { headers: { 'content-type': 'text/html' } }),
      'https://brasilapi.com.br/api/cnpj/v1/12345678000195': Response.json({ razao_social: 'CANARIO 1 LTDA', nome_fantasia: 'CANARIO 1', uf: 'SP', municipio: 'CAMPINAS' })
    });
    const chamadas: Array<{ ator: string; entrada: any; op: any }> = [];
    const pool = {
      coletar: async (ator: string, entrada: Record<string, unknown>, op: unknown) => {
        chamadas.push({ ator, entrada, op });
        return { itens: [{ organicResults: [{ title: 'Canário 1 - CNPJ 12.345.678/0001-95', description: '' }] }], runId: 'r', conta: 'c', custoUsd: 0.003 };
      }
    };
    await rodarEnriquecimento({ ...base, buscar, pool });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].ator).toBe('apify/google-search-scraper');
    expect(chamadas[0].entrada.queries).toBe('CNPJ "Canário 1"');
    expect(chamadas[0].op.tetoUsd).toBeLessThanOrEqual(0.0481 / 2);
    const fim = rpc.find(x => x.nome === 'enrichment_finish')!;
    expect(fim.corpo.p_custo_usd).toBe(0.003);
    expect(fim.corpo.p_resultado.campos).toMatchObject({ cnpj: '12345678000195', razao_social: 'CANARIO 1 LTDA' });
  });

  it('empresa sem CNPJ e sem chave da Apify: segue com as fontes grátis e custo zero', async () => {
    const { buscar, rpc } = mundoFalso([empresa(1)], {
      'https://canario1.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario1.test': new Response('Fale conosco', { headers: { 'content-type': 'text/html' } })
    });
    const r = await rodarEnriquecimento({ ...base, buscar, pool: semApify });
    expect(r).toMatchObject({ concluidos: 1, falhas: 0 });
    expect(rpc.find(x => x.nome === 'enrichment_finish')!.corpo.p_custo_usd).toBe(0);
  });

  it('Receita fora do ar: avisa a falha (o banco devolve o crédito e tenta depois)', async () => {
    const { buscar, rpc } = mundoFalso([empresa(1)], {
      'https://canario1.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario1.test': new Response('CNPJ 12.345.678/0001-95', { headers: { 'content-type': 'text/html' } }),
      'https://brasilapi.com.br': new Response('', { status: 503 }),
      'https://minhareceita.org': new Response('', { status: 503 })
    });
    const r = await rodarEnriquecimento({ ...base, buscar, pool: semApify });
    expect(r).toMatchObject({ concluidos: 0, falhas: 1 });
    expect(rpc.find(x => x.nome === 'enrichment_fail')!.corpo).toEqual({ p_job_id: 'job-e1', p_mensagem: 'Consulta à Receita Federal fora do ar agora.' });
    expect(rpc.some(x => x.nome === 'enrichment_finish')).toBe(false);
  });

  it('pessoas sem chave da Apify: falha clara, nada inventado', async () => {
    const { buscar, rpc } = mundoFalso([pessoas(2)]);
    const r = await rodarEnriquecimento({ ...base, buscar, pool: semApify });
    expect(r).toMatchObject({ falhas: 1 });
    expect(rpc.find(x => x.nome === 'enrichment_fail')!.corpo.p_mensagem).toMatch(/Nenhuma chave da Apify/);
  });

  it('pessoas: entrega as pessoas achadas e o custo real somado', async () => {
    const { buscar, rpc } = mundoFalso([pessoas(2)]);
    const pool = {
      coletar: async (ator: string) => ator === 'apify/google-search-scraper'
        ? { itens: [{ organicResults: [{ title: 'Bia Rocha - CEO - Canário 2 | LinkedIn', url: 'https://www.linkedin.com/in/bia-rocha', description: '' }] }], runId: 'r', conta: 'c', custoUsd: 0.005 }
        : { itens: [{ linkedinUrl: 'https://www.linkedin.com/in/bia-rocha', firstName: 'Bia', lastName: 'Rocha', photo: 'https://media.licdn.test/bia.jpg' }], runId: 'r', conta: 'c', custoUsd: 0.004 }
    };
    await rodarEnriquecimento({ ...base, buscar, pool });
    const fim = rpc.find(x => x.nome === 'enrichment_finish')!;
    expect(fim.corpo.p_resultado.pessoas).toEqual([{ nome: 'Bia Rocha', cargo: 'CEO', papel: 'decisor', linkedin_url: 'https://www.linkedin.com/in/bia-rocha', foto_url: 'https://media.licdn.test/bia.jpg', telefones: [] }]);
    expect(fim.corpo.p_custo_usd).toBeCloseTo(0.009, 6);
  });

  it('banco fora do ar ou recusando: erro claro e nada roda', async () => {
    const fora = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await rodarEnriquecimento({ ...base, buscar: fora, pool: semApify })).toEqual({ ok: false, erro: 'banco indisponível' });
    const recusa = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    expect(await rodarEnriquecimento({ ...base, buscar: recusa, pool: semApify })).toEqual({ ok: false, erro: 'banco recusou o pedido de enriquecimento (HTTP 401)' });
  });

  it('o resultado da rodada só tem números', async () => {
    const { buscar } = mundoFalso([]);
    const r = await rodarEnriquecimento({ ...base, buscar, pool: semApify });
    expect(r).toEqual({ ok: true, pedidos: 0, concluidos: 0, falhas: 0 });
  });
});
