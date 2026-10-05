// @vitest-environment node
// Seam: Relatórios (página analytics) só com números que o banco devolve.
import { describe, expect, it } from 'vitest';
import { SEM_DADOS, listarRelatorios } from './relatorios';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';

describe('listarRelatorios (unitário / mapeamento)', () => {
  function mockSupabase(opcoes: { rpc?: { data?: unknown; error?: { message: string; code?: string } | null }; tabelas?: Record<string, { data?: unknown; error?: { message: string } | null }> }) {
    const tabelas = opcoes.tabelas || {};
    return {
      rpc: () => Promise.resolve(opcoes.rpc || { data: null, error: null }),
      from: (tabela: string) => {
        const resp = tabelas[tabela] || { data: [], error: null };
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          then: (resolve: any) => Promise.resolve(resp).then(resolve)
        };
        return chain;
      }
    } as any;
  }

  it('mostra só o que o banco devolve e deixa "Sem dados ainda" onde não há dado', async () => {
    const cliente = mockSupabase({
      rpc: {
        data: {
          total_active_pipeline_amount: '30000.00',
          weighted_pipeline_amount: '16500.00',
          won_revenue_amount: '0',
          campaign_leads_count: 12,
          stages: [
            { stage_key: 'entrada', label: 'Prospecção', order_index: 1, deals_count: 2, total_amount: '10000' },
            { stage_key: 'ganho', label: 'Ganho', order_index: 6, deals_count: 0, total_amount: '0' }
          ]
        },
        error: null
      },
      tabelas: {
        view_pipeline_analytics: {
          data: [
            { motion: 'slg', stage_key: 'entrada', order_index: 1, deals_count: 2, total_amount: '10000' },
            { motion: 'mlg', stage_key: 'entrada', order_index: 1, deals_count: 1, total_amount: '5000' }
          ],
          error: null
        },
        view_cadence_performance: {
          data: [{ cadence_name: 'Importadores', total_enrolled: 10, responded_count: 4, response_rate_pct: '40.0' }],
          error: null
        },
        campaigns: {
          data: [
            { channel_type: 'linkedin_ads', leads_count: 8, budget_usd: '2500.00' },
            { channel_type: 'linkedin_ads', leads_count: 4, budget_usd: '100.00' }
          ],
          error: null
        },
        credit_transactions: {
          data: [
            { type: 'consume', amount: 10, agent_code: 'comercial' },
            { type: 'grant', amount: 9999, agent_code: null },
            { type: 'consume', amount: 5, agent_code: 'copy' }
          ],
          error: null
        },
        accounts: {
          data: [
            { id: '1', last_signal_text: 'Vaga aberta', status: 'ativa' },
            { id: '2', last_signal_text: null, status: 'ativa' }
          ],
          error: null
        }
      }
    });

    const relatorio = await listarRelatorios(cliente, 'ws-1');
    const texto = JSON.stringify(relatorio);
    expect(texto).not.toMatch(/US\$|dólar|dolar|2500|4,8|512/);
    expect(relatorio.kpis.map(k => k.valor)).toEqual([
      'R$ 30.000,00',
      'R$ 16.500,00',
      'R$ 0,00',
      '12'
    ]);
    expect(relatorio.funil.find(f => f.label === 'Contas qualificadas')?.n).toBe('2');
    expect(relatorio.funil.find(f => f.label === 'Contas com sinal')?.n).toBe('1');
    expect(relatorio.funil.find(f => f.label === 'Leads em cadência')?.n).toBe('10');
    expect(relatorio.funil.find(f => f.label === 'Respostas')?.n).toBe('4');
    expect(relatorio.funil.find(f => f.label === 'Reuniões')?.n).toBe(SEM_DADOS);
    expect(relatorio.funil.find(f => f.label === 'Negócios abertos')?.n).toBe('2');
    expect(relatorio.cadencias[0]).toMatchObject({ nome: 'Importadores', contatos: '10 contatos', resposta: '40%' });
    expect(relatorio.canais[0]).toMatchObject({ nome: 'LinkedIn Ads', leads: '12 leads', inv: SEM_DADOS, cpl: SEM_DADOS });
    expect(relatorio.creditos.map(c => c.usd).every(u => u === '')).toBe(true);
    expect(relatorio.creditos.find(c => c.nome === 'Zoe')?.creditos).toBe('10');
    expect(relatorio.creditos.find(c => c.nome === 'Lia')?.creditos).toBe('5');
    expect(relatorio.custoReuniao).toBe(SEM_DADOS);
    expect(relatorio.linhas[0].nome).toBe(SEM_DADOS);
    const entrada = relatorio.etapas.find(e => e.nome === 'Prospecção');
    expect(entrada?.cels[0].v).toBe('R$ 10.000,00');
    expect(entrada?.cels[0].n).toBe('2 negócios');
    expect(entrada?.cels[1].n).toBe('1 negócio');
    expect(entrada?.cels[3].n).toBe('3 negócios');
  });

  it('consulta vazia não inventa os números do protótipo', async () => {
    const cliente = mockSupabase({ rpc: { data: null, error: null }, tabelas: {} });
    const relatorio = await listarRelatorios(cliente, 'ws-1');
    const texto = JSON.stringify(relatorio);
    expect(texto).not.toMatch(/4,8|512|684|1\.304|US\$/);
    expect(relatorio.funil.every(f => f.n === SEM_DADOS)).toBe(true);
    expect(relatorio.cadencias[0].nome).toBe(SEM_DADOS);
    expect(relatorio.canais[0].nome).toBe(SEM_DADOS);
    expect(relatorio.creditos[0].nome).toBe(SEM_DADOS);
    expect(relatorio.creditos[0].usd).toBe('');
    expect(relatorio.kpis.every(k => k.valor === SEM_DADOS)).toBe(true);
  });

  it('falha do funil vira erro claro, sem número inventado', async () => {
    const cliente = mockSupabase({ rpc: { data: null, error: { message: 'Sem acesso a este workspace.', code: '42501' } } });
    await expect(listarRelatorios(cliente, 'ws-1')).rejects.toThrow('Sem acesso a este workspace.');
  });

  it('falha ao ler o pipeline vira erro claro', async () => {
    const cliente = mockSupabase({
      rpc: { data: { total_active_pipeline_amount: 0, weighted_pipeline_amount: 0, won_revenue_amount: 0, campaign_leads_count: 0, stages: [] }, error: null },
      tabelas: { view_pipeline_analytics: { data: null, error: { message: 'view indisponível' } } }
    });
    await expect(listarRelatorios(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar o pipeline dos relatórios.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Relatórios (banco local)', () => {
  it('C-level vê créditos e pipeline que existem no banco, e "Sem dados ainda" no resto', async () => {
    const relatorio = await listarRelatorios(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    const texto = JSON.stringify(relatorio);
    expect(texto).not.toMatch(/US\$|4,8 mi|1\.304/);
    expect(relatorio.creditos.find(c => c.nome === 'Zoe')?.creditos).toBe('1.540');
    expect(relatorio.creditos.find(c => c.nome === 'Lia')?.creditos).toBe('310');
    expect(relatorio.creditos.find(c => c.nome === 'Jax')?.creditos).toBe('120');
    expect(relatorio.creditos.find(c => c.nome === 'Neo')?.creditos).toBe('80');
    expect(relatorio.creditos.every(c => c.usd === '')).toBe(true);
    expect(relatorio.kpis.find(k => k.label === 'Pipeline em aberto')?.valor).toBe('R$ 0,00');
    expect(relatorio.funil.find(f => f.label === 'Contas qualificadas')?.n).toBe('8');
    expect(relatorio.funil.find(f => f.label === 'Reuniões')?.n).toBe(SEM_DADOS);
    expect(relatorio.custoReuniao).toBe(SEM_DADOS);
    expect(relatorio.canais[0].inv).toBe(SEM_DADOS);
  });

  it('membro da Grão Norte não vê relatório da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarRelatorios(eduardo, EVOLUT)).rejects.toThrow('Sem acesso a este workspace.');
    const grao = await listarRelatorios(eduardo, GRAO_NORTE);
    const texto = JSON.stringify(grao);
    expect(texto).not.toMatch(/1\.540|Serra Azul|Importadores/);
    expect(grao.creditos[0].nome).toBe(SEM_DADOS);
    expect(grao.funil.find(f => f.label === 'Contas qualificadas')?.n).toBe('0');
  });

  it('BDR lê os relatórios do próprio workspace', async () => {
    const relatorio = await listarRelatorios(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(relatorio.creditos.find(c => c.nome === 'Zoe')?.creditos).toBe('1.540');
  });
});
