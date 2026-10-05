// Seam: src/app/servicos/inicio.ts (obterResumoHome)
﻿// Testes do serviço de Início (Home): dados reais vindos do banco via RPC get_home_summary
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { obterResumoHome } from './inicio';
import { SEM_DADOS } from './relatorios';
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

const RPC_REAL = {
  contas_qualificadas: 8, execucoes_ativas: 3, alertas_bloqueios: 1, aprovacoes_pendentes: 5,
  creditos_disponiveis: 7950, creditos_limite: 10000, papel: 'clevel',
  oportunidades_abertas: 2, campanhas_ativas: 1, cadencias_ativas: 2, agentes_trabalhando: 1,
  acoes: [
    { titulo: 'Ligar para a conta X', responsavel: 'Lucas Teixeira', prazo: '2026-10-05T14:00:00Z', origem: 'manual', agente: null },
    { titulo: 'Rever ICP', responsavel: null, prazo: null, origem: 'agente', agente: 'copy' }
  ],
  timeline: [
    { id: '1', titulo: 'Relatório semanal', tipo: 'Relatório', status: 'completed', quando: '2026-10-05T12:31:00Z' },
    { id: '2', titulo: 'Leitura de mídia', tipo: null, status: 'failed', quando: '2026-10-04T09:00:00Z' },
    { id: '3', titulo: 'Mapear comitê', tipo: 'Mapeamento', status: 'partial', quando: '2026-09-20T09:00:00Z' }
  ],
  mapa: { SP: 3, MG: 1 },
  contas_sem_localizacao: 2
};
const AGORA = new Date('2026-10-05T15:00:00Z'); // 12:00 em Brasília

describe('serviço de Início: nada inventado (mocks)', () => {
  it('KPIs sem fonte no banco mostram "Sem dados ainda", e os com fonte mostram o número real', async () => {
    const home = await obterResumoHome(mockSupabase({ data: RPC_REAL, error: null }), 'ws', 'm', AGORA);
    const k = (chave: string) => home.kpis.find(x => x[0] === chave);
    expect(k('oportunidades')?.[2]).toBe('2');
    expect(k('contas')?.[2]).toBe('8');
    expect(k('creditos')?.[2]).toBe('7.950');
    for (const semFonte of ['pipeline', 'leads', 'respostas', 'reunioes', 'midia']) {
      expect(k(semFonte)?.[2], semFonte).toBe(SEM_DADOS);
      expect(k(semFonte)?.[3], `${semFonte} sem variação inventada`).toBe('');
    }
    expect(k('contas')?.[3]).toBe('');
    expect(k('oportunidades')?.[3]).toBe('');
  });

  it('nenhum número, nome de pessoa ou evento do protótipo escapa para a tela', async () => {
    const home = await obterResumoHome(mockSupabase({ data: { ...RPC_REAL, acoes: [], timeline: [], mapa: {} }, error: null }), 'ws', 'm', AGORA);
    const texto = JSON.stringify(home);
    for (const inventado of ['R$ 4,8 mi', '1.946', '+184', '+620', 'R$ 30.000', '62% do orçamento', '6,1% de taxa', 'Douglas Quites', 'Aline Xavier', 'Serra Azul', 'Grão Norte Alimentos', 'Importação sem risco', 'Comitê de 48 contas', '512 contas']) {
      expect(texto, inventado).not.toContain(inventado);
    }
  });

  it('operação vem do banco: campanhas, cadências e agentes trabalhando', async () => {
    const home = await obterResumoHome(mockSupabase({ data: RPC_REAL, error: null }), 'ws', 'm', AGORA);
    const op = Object.fromEntries(home.operacao);
    expect(op['Campanhas ativas']).toBe(1);
    expect(op['Cadências ativas']).toBe(2);
    expect(op['Agentes trabalhando']).toBe(1);
    expect(op['Execuções ativas']).toBe(3);
    expect(op['Alertas e bloqueios']).toBe(1);
  });

  it('ações vêm das tarefas: prazo em horário de Brasília, origem da tarefa, prioridade pelo prazo', async () => {
    const home = await obterResumoHome(mockSupabase({ data: RPC_REAL, error: null }), 'ws', 'm', AGORA);
    expect(home.acoes).toEqual([
      { titulo: 'Ligar para a conta X', resp: 'Lucas Teixeira', prazo: 'Hoje, 11:00', origem: 'Manual', prioridade: 'Alta' },
      { titulo: 'Rever ICP', resp: 'Sem responsável', prazo: 'Sem prazo', origem: 'Lia', prioridade: 'Média' }
    ]);
  });

  it('linha do tempo vem das execuções: horário, título e tom pelo status; vazia continua vazia', async () => {
    const home = await obterResumoHome(mockSupabase({ data: RPC_REAL, error: null }), 'ws', 'm', AGORA);
    expect(home.timeline).toEqual([
      ['09:31', 'Relatório', 'Relatório semanal', 'ok'],
      ['Ontem', 'Execução', 'Leitura de mídia', 'erro'],
      ['20/09', 'Mapeamento', 'Mapear comitê', 'aviso']
    ]);
    const vazio = await obterResumoHome(mockSupabase({ data: { ...RPC_REAL, timeline: [], acoes: [] }, error: null }), 'ws', 'm', AGORA);
    expect(vazio.timeline).toEqual([]);
    expect(vazio.acoes).toEqual([]);
  });

  it('mapa: contagem real por estado e contas sem localização', async () => {
    const home = await obterResumoHome(mockSupabase({ data: RPC_REAL, error: null }), 'ws', 'm', AGORA);
    expect(home.mapa).toEqual({ SP: 3, MG: 1 });
    expect(home.semLocalizacao).toBe(2);
  });

  it('banco sem os campos novos (resposta antiga) não vira número inventado', async () => {
    const home = await obterResumoHome(mockSupabase({ data: { contas_qualificadas: 1, execucoes_ativas: 0, alertas_bloqueios: 0, aprovacoes_pendentes: 0, creditos_disponiveis: 0, creditos_limite: 0, papel: 'clevel' }, error: null }), 'ws', 'm', AGORA);
    expect(home.kpis.find(x => x[0] === 'oportunidades')?.[2]).toBe(SEM_DADOS);
    expect(home.mapa).toEqual({});
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

  it('Início da Evolut: operação, linha do tempo e mapa reais; BDR sem execuções; nada do protótipo', async () => {
    const aline = await obterResumoHome(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, MEMBRO_ALINE);
    expect(aline.timeline).toHaveLength(7);
    expect(aline.mapa).toMatchObject({ SP: 3 });
    expect(Object.values(aline.mapa).reduce((a, b) => a + b, 0)).toBe(8);
    expect(JSON.stringify(aline)).not.toMatch(/Douglas Quites|R\$ 4,8 mi|1\.946/);
    expect(aline.kpis.find(k => k[0] === 'pipeline')?.[2]).toBe(SEM_DADOS);
    const lucas = await obterResumoHome(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT, MEMBRO_LUCAS);
    expect(lucas.timeline).toEqual([]);
    expect(lucas.mapa).toEqual({ MT: 1, SP: 3 });
  });
});
