// Testes do serviço de Início (Home): dados reais vindos do banco via RPC get_home_summary
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { obterResumoHome } from './inicio';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';
const MEMBRO_ALINE = 'd0000000-0000-0000-0000-000000000003';
const MEMBRO_LUCAS = 'd0000000-0000-0000-0000-000000000004';
const MEMBRO_EDUARDO = 'd0000000-0000-0000-0000-000000000009';

function mockSupabase(retorno: { data: any; error: any }): SupabaseClient {
  return {
    rpc: async () => retorno
  } as unknown as SupabaseClient;
}

describe('serviço de Início (mocks)', () => {
  it('formata contas, execuções e créditos vindos do banco', async () => {
    const cliente = mockSupabase({
      data: {
        contas_qualificadas: 150,
        execucoes_ativas: 5,
        alertas_bloqueios: 2,
        aprovacoes_pendentes: 4,
        creditos_disponiveis: 8500,
        creditos_limite: 10000,
        papel: 'clevel'
      },
      error: null
    });

    const home = await obterResumoHome(cliente, 'ws-1', 'membro-1');

    const contasKpi = home.kpis.find(k => k[0] === 'contas');
    expect(contasKpi).toBeDefined();
    expect(contasKpi?.[2]).toBe('150');

    const creditosKpi = home.kpis.find(k => k[0] === 'creditos');
    expect(creditosKpi).toBeDefined();
    expect(creditosKpi?.[2]).toBe('8.500');
    expect(creditosKpi?.[3]).toBe('de 10.000 no ciclo');

    const execAtivas = home.operacao.find(o => o[0] === 'Execuções ativas');
    expect(execAtivas?.[1]).toBe(5);

    const alertas = home.operacao.find(o => o[0] === 'Alertas e bloqueios');
    expect(alertas?.[1]).toBe(2);

    // ADR 0021: Nunca exibe dólar
    expect(JSON.stringify(home)).not.toMatch(/US\$|dólar/i);
  });

  it('trata falha de consulta ao RPC com erro amigável', async () => {
    const cliente = mockSupabase({
      data: null,
      error: { message: 'falha de conexão' }
    });

    await expect(obterResumoHome(cliente, 'ws-1', 'membro-1'))
      .rejects.toThrow('Não foi possível carregar o resumo do Início.');
  });
});

describe.skipIf(!bancoLocalNoAr)('serviço de Início (banco local)', () => {
  it('C-level da Evolut recebe 8 contas ativas, 3 execuções e saldo de créditos', async () => {
    const cliente = await entrarComoLocal('aline@evolut.com.br');
    const home = await obterResumoHome(cliente, EVOLUT, MEMBRO_ALINE);

    const contasKpi = home.kpis.find(k => k[0] === 'contas');
    expect(contasKpi?.[2]).toBe('8');

    const creditosKpi = home.kpis.find(k => k[0] === 'creditos');
    expect(creditosKpi?.[2]).toBe('7.950');

    const execAtivas = home.operacao.find(o => o[0] === 'Execuções ativas');
    expect(execAtivas?.[1]).toBe(3);

    const alertas = home.operacao.find(o => o[0] === 'Alertas e bloqueios');
    expect(alertas?.[1]).toBe(1);
  });

  it('BDR da Evolut vê somente suas contas atribuídas (4 contas)', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    const home = await obterResumoHome(cliente, EVOLUT, MEMBRO_LUCAS);

    const contasKpi = home.kpis.find(k => k[0] === 'contas');
    expect(contasKpi?.[2]).toBe('4');
  });

  it('isolamento de workspace: Grão Norte não enxerga dados da Evolut', async () => {
    const cliente = await entrarComoLocal('eduardo@graonorte.com.br');
    const home = await obterResumoHome(cliente, GRAO_NORTE, MEMBRO_EDUARDO);

    const contasKpi = home.kpis.find(k => k[0] === 'contas');
    expect(contasKpi?.[2]).toBe('0');
  });

  it('chamar em nome de outro membro é recusado', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    // Lucas tentando passar o membro da Aline
    await expect(obterResumoHome(cliente, EVOLUT, MEMBRO_ALINE))
      .rejects.toThrow('Não foi possível carregar o resumo do Início.');
  });
});