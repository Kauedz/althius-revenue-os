// @vitest-environment node
// Seam: Prospecção (página prospecting, ADR 0067) mostra as CANDIDATAS que as buscas da Zoe trouxeram e o estado de cada
// busca, lidos do banco. Incluir e excluir passam pela função do banco (só gestores; o crédito não volta). Nunca dólar.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decidirCandidatas, listarProspeccao, prospeccaoVazia } from './prospeccao';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';

function mockSupabase(tabelas: Record<string, { data?: unknown; error?: { message: string } | null }>, rpc?: { data?: unknown; error?: { message: string; code?: string } | null }) {
  return {
    rpc: () => Promise.resolve(rpc || { data: null, error: null }),
    from: (tabela: string) => {
      const resp = tabelas[tabela] || { data: [], error: null };
      const chain: any = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, then: (ok: any) => Promise.resolve(resp).then(ok) };
      return chain;
    }
  } as any;
}

const busca = (x: Record<string, unknown> = {}) => ({
  id: 's1', titulo: 'Google Maps: clínica · Campinas', source_code: 'google_maps', estado: 'concluida', max_empresas: 50, creditos_estimados: 50,
  creditos_cobrados: 3, encontradas: 3, repetidas: 2, fora_do_filtro: 0, mensagem: null, created_at: '2026-10-07T12:00:00Z', ...x
});
const candidata = (x: Record<string, unknown> = {}) => ({
  id: 'c1', search_id: 's1', nome: 'Clínica Sorriso', dominio: 'clinicasorriso.com.br', cidade: 'Campinas', uf: 'SP', categoria: 'Dentista', estado: 'candidata', ...x
});

describe('listarProspeccao (unitário)', () => {
  it('candidatas viram linhas, com a busca de origem; sem site aparece "Sem site"', async () => {
    const tela = await listarProspeccao(mockSupabase({
      prospect_searches: { data: [busca()], error: null },
      prospect_candidates: { data: [candidata(), candidata({ id: 'c2', nome: 'Odonto Insta', dominio: null, categoria: null })], error: null }
    }), 'ws-1');
    expect(tela.linhas[0]).toMatchObject({ id: 'c1', nome: 'Clínica Sorriso', site: 'clinicasorriso.com.br', local: 'Campinas/SP', categoria: 'Dentista', busca: 'Google Maps: clínica · Campinas', status: 'Candidata' });
    expect(tela.linhas[1]).toMatchObject({ site: 'Sem site', categoria: '—', semSite: true });
    expect(JSON.stringify(tela)).not.toMatch(/US\$|d[oó]lar|usd/i);
  });

  it('números: buscas, candidatas esperando decisão, incluídas e créditos gastos em buscas', async () => {
    const tela = await listarProspeccao(mockSupabase({
      prospect_searches: { data: [busca(), busca({ id: 's2', estado: 'reservada', creditos_cobrados: 0 }), busca({ id: 's3', estado: 'aprovacao', creditos_cobrados: 0 })], error: null },
      prospect_candidates: { data: [candidata(), candidata({ id: 'c2', estado: 'incluida' }), candidata({ id: 'c3', estado: 'excluida' })], error: null }
    }), 'ws-1');
    expect(tela.kpis.map(k => [k[0], k[1]])).toEqual([['Buscas', '3'], ['Candidatas', '1'], ['Incluídas', '1'], ['Créditos em buscas', '3']]);
    expect(tela.kpis[0][2]).toBe('1 rodando · 1 aguardando aprovação');
  });

  it('o resumo diz o estado das buscas recentes, em créditos', async () => {
    const tela = await listarProspeccao(mockSupabase({
      prospect_searches: { data: [busca(), busca({ id: 's2', titulo: 'Receita: 8630504 · SP', estado: 'erro', mensagem: 'A fonte demorou demais', creditos_cobrados: 0 })], error: null },
      prospect_candidates: { data: [], error: null }
    }), 'ws-1');
    expect(tela.buscas[0]).toBe('Google Maps: clínica · Campinas: concluída, 3 novas, 2 repetidas, 3 créditos');
    expect(tela.buscas[1]).toBe('Receita: 8630504 · SP: erro (A fonte demorou demais), crédito devolvido');
  });

  it('sem buscas: tela vazia de verdade, sem nada do protótipo', async () => {
    const tela = await listarProspeccao(mockSupabase({}), 'ws-1');
    expect(tela).toEqual(prospeccaoVazia());
    expect(JSON.stringify(tela)).not.toMatch(/Importadores do Sudeste|feira Intermodal|1\.946/);
  });

  it('falha ao ler vira erro claro (nunca número inventado)', async () => {
    await expect(listarProspeccao(mockSupabase({ prospect_candidates: { data: null, error: { message: 'x' } } }), 'ws-1'))
      .rejects.toThrow('Não foi possível carregar a prospecção.');
  });

  it('decidir: recusa do banco vira mensagem clara', async () => {
    const r = await decidirCandidatas(mockSupabase({}, { data: null, error: { message: 'Só gestores do cliente (C-level ou estrategista) incluem ou excluem candidatas.', code: '42501' } }), 'ws', 'm', ['c1'], 'incluir');
    expect(r).toEqual({ ok: false, mensagem: 'Só gestores do cliente (C-level ou estrategista) incluem ou excluem candidatas.' });
  });
});

describe.skipIf(!bancoLocalNoAr)('Prospecção (banco local)', () => {
  const BUSCA = 'c8399999-0000-0000-0000-000000000001';
  const admin = adminLocal();
  beforeAll(async () => {
    await admin.from('prospect_searches').delete().eq('id', BUSCA);
    const s = await admin.from('prospect_searches').insert({ id: BUSCA, workspace_id: EVOLUT, agent_code: 'comercial', source_code: 'google_maps', titulo: 'Google Maps: TESTE-PROSP · Campinas',
      parametros: { busca: 'TESTE-PROSP', local: 'Campinas' }, max_empresas: 10, creditos_estimados: 10, estado: 'concluida', creditos_cobrados: 2, encontradas: 2 });
    expect(s.error).toBeNull();
    const c = await admin.from('prospect_candidates').insert([
      { workspace_id: EVOLUT, search_id: BUSCA, chave: 'teste-prosp:1', nome: 'TESTE-PROSP Um', dominio: 'teste-prosp-um.test', cidade: 'Campinas', uf: 'SP', fonte: 'Google Maps' },
      { workspace_id: EVOLUT, search_id: BUSCA, chave: 'teste-prosp:2', nome: 'TESTE-PROSP Dois', fonte: 'Google Maps' }
    ]);
    expect(c.error).toBeNull();
  });
  afterAll(async () => {
    await admin.from('prospect_searches').delete().eq('id', BUSCA);
    await admin.from('accounts').delete().eq('workspace_id', EVOLUT).in('domain', ['teste-prosp-um.test', 'teste-prosp-dois.test']);
  });

  it('C-level vê as candidatas da Evolut; a Grão Norte não vê nada da Evolut', async () => {
    const aline = await listarProspeccao(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(aline.linhas.filter(l => l.nome.startsWith('TESTE-PROSP')).map(l => l.nome).sort()).toEqual(['TESTE-PROSP Dois', 'TESTE-PROSP Um']);
    const grao = await listarProspeccao(await entrarComoLocal('eduardo@graonorte.com.br'), GRAO_NORTE);
    expect(JSON.stringify(grao)).not.toMatch(/TESTE-PROSP/);
  });

  it('BDR não decide; C-level inclui (vira conta) e a sem site pede o site', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const tela = await listarProspeccao(lucas, EVOLUT);
    const um = tela.linhas.find(l => l.nome === 'TESTE-PROSP Um')!;
    const dois = tela.linhas.find(l => l.nome === 'TESTE-PROSP Dois')!;
    const bdr = await decidirCandidatas(lucas, EVOLUT, 'd0000000-0000-0000-0000-000000000004', [um.id], 'incluir');
    expect(bdr.ok).toBe(false);

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const r = await decidirCandidatas(aline, EVOLUT, 'd0000000-0000-0000-0000-000000000003', [um.id, dois.id], 'incluir');
    expect(r).toMatchObject({ ok: true, incluidas: 1, semSite: 1 });
    const r2 = await decidirCandidatas(aline, EVOLUT, 'd0000000-0000-0000-0000-000000000003', [dois.id], 'incluir', { [dois.id]: 'teste-prosp-dois.test' });
    expect(r2).toMatchObject({ ok: true, incluidas: 1, semSite: 0 });
    const contas = await aline.from('accounts').select('domain').eq('workspace_id', EVOLUT).in('domain', ['teste-prosp-um.test', 'teste-prosp-dois.test']);
    expect((contas.data || []).length).toBe(2);
  });
});
