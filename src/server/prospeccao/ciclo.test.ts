// @vitest-environment node
// Uma rodada da prospecção: banco falso e Apify falsa (nenhuma chamada real).
import { describe, expect, it } from 'vitest';
import { rodarProspeccao } from './ciclo.ts';

const busca = (n: number, extra: Record<string, unknown> = {}) => ({
  search_id: `s-${n}`, workspace_id: 'ws-1', titulo: 'Google Maps: clínica · Campinas', parametros: { busca: 'clínica', local: 'Campinas, SP, Brasil' },
  max_empresas: 30, teto_usd: 0.2885,
  fonte: {
    codigo: 'google_maps', nome: 'Google Maps', ator: 'compass/crawler-google-places',
    entrada: { searchStringsArray: ['{{busca}}'], locationQuery: '{{local}}', maxCrawledPlacesPerSearch: '{{max}}' },
    mapeamento: { chave: 'placeId', prefixo_chave: 'gmaps:', nome: 'title', site: 'website' }
  },
  ...extra
});

function bancoFalso(fila: unknown[]) {
  const rpc: Array<{ nome: string; corpo: Record<string, any> }> = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    const nome = url.split('/rpc/')[1];
    rpc.push({ nome, corpo: JSON.parse(String(init?.body)) });
    if (nome === 'prospect_next') return Response.json(fila);
    return Response.json({ acao: 'concluido' });
  }) as unknown as typeof fetch;
  return { buscar, rpc };
}
const base = { base: 'http://rest:3000', chaveServico: 'svc', esperaCustoMs: 0 };

describe('uma rodada da prospecção', () => {
  it('roda o ator com a entrada montada, o máximo e o teto, e entrega os itens no formato comum com o custo real', async () => {
    const { buscar, rpc } = bancoFalso([busca(1)]);
    const chamadas: Array<{ ator: string; entrada: any; op: any }> = [];
    const pool = {
      coletar: async (ator: string, entrada: Record<string, unknown>, op: any) => {
        chamadas.push({ ator, entrada, op });
        return { itens: [{ title: 'Clínica Sorriso', placeId: 'A1', website: 'clinicasorriso.com.br' }, { title: 'Sem chave' }], runId: 'r', conta: 'c', custoUsd: 0.004 };
      }
    };
    const r = await rodarProspeccao({ ...base, buscar, pool });
    expect(r).toEqual({ ok: true, pedidos: 1, concluidos: 1, falhas: 0 });
    expect(rpc[0]).toEqual({ nome: 'prospect_next', corpo: { p_limit: 5 } });
    expect(chamadas[0].ator).toBe('compass/crawler-google-places');
    expect(chamadas[0].entrada).toEqual({ searchStringsArray: ['clínica'], locationQuery: 'Campinas, SP, Brasil', maxCrawledPlacesPerSearch: 30 });
    expect(chamadas[0].op).toMatchObject({ maxItens: 30, tetoUsd: 0.2885 });
    const fim = rpc.find(x => x.nome === 'prospect_finish')!;
    expect(fim.corpo).toEqual({ p_search_id: 's-1', p_itens: [{ chave: 'gmaps:A1', nome: 'Clínica Sorriso', site: 'clinicasorriso.com.br' }], p_custo_usd: 0.004 });
  });

  it('sem chave da Apify: falha com a mensagem clara (o banco devolve o crédito)', async () => {
    const { buscar, rpc } = bancoFalso([busca(1)]);
    const pool = { coletar: async () => { throw new Error('Nenhuma chave da Apify cadastrada. O superadmin cadastra em Fornecedores.'); } };
    const r = await rodarProspeccao({ ...base, buscar, pool });
    expect(r).toMatchObject({ ok: true, concluidos: 0, falhas: 1 });
    expect(rpc.find(x => x.nome === 'prospect_fail')!.corpo).toEqual({ p_search_id: 's-1', p_mensagem: 'Nenhuma chave da Apify cadastrada. O superadmin cadastra em Fornecedores.' });
    expect(rpc.some(x => x.nome === 'prospect_finish')).toBe(false);
  });

  it('entrada que não monta (parâmetro faltando no texto) falha sem chamar o ator', async () => {
    const { buscar, rpc } = bancoFalso([busca(1, { fonte: { ...busca(1).fonte, entrada: { q: 'empresas em {{cidade}}' } } })]);
    let chamou = false;
    const pool = { coletar: async () => { chamou = true; return { itens: [], runId: null, conta: '', custoUsd: 0 }; } };
    await rodarProspeccao({ ...base, buscar, pool });
    expect(chamou).toBe(false);
    expect(rpc.find(x => x.nome === 'prospect_fail')).toBeTruthy();
  });

  it('banco fora do ar: a rodada diz isso e não chama o ator', async () => {
    const buscar = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const r = await rodarProspeccao({ ...base, buscar, pool: { coletar: async () => { throw new Error('não devia'); } } });
    expect(r).toEqual({ ok: false, erro: 'banco indisponível' });
  });
});
