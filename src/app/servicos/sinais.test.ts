// @vitest-environment node
// Seam: Sinais (página signals) lista só os sinais de compra que o banco devolve, em modo somente leitura.
import { describe, expect, it } from 'vitest';
import { SEM_DADOS, avisoDeColeta, listarSinais, sinaisSemDados } from './sinais';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';
const RECENTE = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const ANTIGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

describe('listarSinais (unitário / mapeamento)', () => {
  function mockSupabase(opcoes: { coleta?: { data?: unknown; error?: { message: string } | null }; rpc?: { data?: unknown; error?: { message: string; code?: string } | null }; tabelas?: Record<string, { data?: unknown; error?: { message: string } | null }> }) {
    const tabelas = opcoes.tabelas || {};
    return {
      rpc: (nome: string) => Promise.resolve(nome === 'signal_codes_com_coleta' ? (opcoes.coleta || { data: [], error: null }) : (opcoes.rpc || { data: { stages: [] }, error: null })),
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

  describe('coleta automática (ticket 01 da coleta de sinais)', () => {
    const defs = {
      data: [
        { id: 's1', agent_code: 'comercial', code: 'vagas_cargo', name: 'Vagas abertas por cargo', credits_per_account: 5, default_on: true },
        { id: 's3', agent_code: 'comercial', code: 'rodada_investimento', name: 'Rodada de investimento ou M&A', credits_per_account: 4, default_on: true }
      ],
      error: null
    };

    it('marca só o sinal que já coleta de verdade; os outros seguem "em breve"', async () => {
      const cliente = mockSupabase({ coleta: { data: ['vagas_cargo'], error: null }, tabelas: { signal_definitions: defs } });
      const sinais = await listarSinais(cliente, 'ws-1');
      const itens = sinais.grupos.flatMap(g => g.itens);
      expect(itens.find(i => i.nome === 'Vagas abertas por cargo')?.coleta).toBe(true);
      expect(itens.find(i => i.nome.startsWith('Rodada'))?.coleta).toBe(false);
      expect(sinais.coletando).toEqual(['Vagas abertas por cargo']);
      expect(avisoDeColeta(sinais)).toBe('Coleta automática ativa para: Vagas abertas por cargo. Os demais sinais chegam em breve.');
    });

    it('sem nenhum sinal coletando, o aviso continua "em breve"', async () => {
      const cliente = mockSupabase({ coleta: { data: [], error: null }, tabelas: { signal_definitions: defs } });
      const sinais = await listarSinais(cliente, 'ws-1');
      expect(sinais.coletando).toEqual([]);
      expect(avisoDeColeta(sinais)).toBe('Coleta automática em breve.');
      expect(avisoDeColeta(sinaisSemDados())).toBe('Coleta automática em breve.');
    });

    it('não consegue saber quais coletam: não afirma que coleta (fica "em breve") e a tela carrega', async () => {
      const cliente = mockSupabase({ coleta: { data: null, error: { message: 'falhou' } }, tabelas: { signal_definitions: defs } });
      const sinais = await listarSinais(cliente, 'ws-1');
      expect(sinais.coletando).toEqual([]);
      expect(sinais.grupos.flatMap(g => g.itens).every(i => i.coleta === false)).toBe(true);
    });

    it('nunca mostra dólar nem custo do fornecedor', async () => {
      const cliente = mockSupabase({ coleta: { data: ['vagas_cargo'], error: null }, tabelas: { signal_definitions: defs } });
      expect(JSON.stringify(await listarSinais(cliente, 'ws-1'))).not.toMatch(/US\$|dólar|dolar|usd/i);
    });
  });

  it('mostra o catálogo e o evento que o banco devolve, e "Sem dados ainda" no que falta', async () => {
    const cliente = mockSupabase({
      tabelas: {
        signal_definitions: {
          data: [
            { id: 's1', agent_code: 'comercial', code: 'vagas_cargo', name: 'Vagas abertas por cargo', credits_per_account: 5, frequency: 'semanal', default_on: true },
            { id: 's2', agent_code: 'marketing', code: 'seguidores_concorrente', name: 'Seguidores de concorrente', credits_per_account: 20, frequency: 'mensal', default_on: false },
            { id: 's3', agent_code: 'comercial', code: 'rodada_investimento', name: 'Rodada de investimento ou M&A', credits_per_account: 4, frequency: 'semanal', default_on: true }
          ],
          error: null
        },
        workspace_signal_settings: {
          data: [{ signal_id: 's3', enabled: false, frequency: 'mensal' }],
          error: null
        },
        signal_events: {
          data: [{
            id: 'e1',
            detected_at: RECENTE,
            payload: { texto: 'Gerente de Importação' },
            accounts: { name: 'Conta do banco', fit: 80 },
            signal_definitions: { name: 'Vagas abertas por cargo', code: 'vagas_cargo' }
          }, {
            id: 'e2',
            detected_at: ANTIGO,
            payload: {},
            accounts: { name: 'Conta antiga', fit: null },
            signal_definitions: { name: 'Anúncios ativos', code: 'anuncios_ativos' }
          }],
          error: null
        }
      }
    });

    const sinais = await listarSinais(cliente, 'ws-1');
    const texto = JSON.stringify(sinais);
    expect(texto).not.toMatch(/US\$|dólar|dolar/);
    expect(sinais.kpis.map(k => k.valor)).toEqual(['1', '1', '0', '0']);
    expect(sinais.kpis.every(k => k.delta === '')).toBe(true); // ADR 0064: sem repetir "Sem dados ainda" embaixo do número
    expect(sinais.eventos[0]).toMatchObject({
      id: 'e1',
      conta: 'Conta do banco',
      tipo: 'Vagas abertas por cargo',
      detalhe: 'Gerente de Importação',
      fit: '80'
    });
    expect(sinais.eventos[0].quando).not.toBe(SEM_DADOS);
    expect(sinais.eventos[1]).toMatchObject({ conta: 'Conta antiga', detalhe: SEM_DADOS, fit: SEM_DADOS });
    const comercial = sinais.grupos.find(g => g.codigo === 'comercial');
    expect(comercial?.itens.find(s => s.nome === 'Vagas abertas por cargo')).toMatchObject({ custo: '5', ativo: true });
    expect(comercial?.itens.find(s => s.nome === 'Rodada de investimento ou M&A')?.ativo).toBe(false);
    expect(sinais.grupos.find(g => g.codigo === 'marketing')?.itens[0]).toMatchObject({ custo: '20', ativo: false });
    expect(sinais.resumo).toBe('1 sinal ativo de 3');
  });

  it('consulta sem eventos não inventa as linhas do protótipo', async () => {
    const cliente = mockSupabase({
      tabelas: {
        signal_definitions: {
          data: [{ id: 's1', agent_code: 'comercial', code: 'vagas_cargo', name: 'Vagas abertas por cargo', credits_per_account: 5, frequency: 'semanal', default_on: true }],
          error: null
        }
      }
    });
    const sinais = await listarSinais(cliente, 'ws-1');
    const texto = JSON.stringify(sinais);
    expect(texto).not.toMatch(/Serra Azul|Delta Saúde|Rio Claro|Campo Belo|64|US\$/);
    expect(sinais.kpis.every(k => k.valor === '0')).toBe(true);
    expect(sinais.eventos).toEqual([{ id: 'sem-dados', conta: SEM_DADOS, tipo: SEM_DADOS, detalhe: SEM_DADOS, fit: SEM_DADOS, quando: SEM_DADOS }]);
    expect(sinais.grupos[0].itens[0].nome).toBe('Vagas abertas por cargo');
  });

  it('falha de acesso vira erro claro', async () => {
    const cliente = mockSupabase({ rpc: { data: null, error: { message: 'Sem acesso a este workspace.', code: '42501' } } });
    await expect(listarSinais(cliente, 'ws-1')).rejects.toThrow('Sem acesso a este workspace.');
  });

  it('falha ao ler os eventos vira erro claro', async () => {
    const cliente = mockSupabase({
      tabelas: {
        signal_definitions: { data: [], error: null },
        signal_events: { data: null, error: { message: 'relacao indisponivel' } }
      }
    });
    await expect(listarSinais(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar os sinais de compra.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Sinais (banco local)', () => {
  it('C-level vê o catálogo do banco e nenhum evento inventado', async () => {
    const sinais = await listarSinais(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    const texto = JSON.stringify(sinais);
    expect(texto).not.toMatch(/US\$|Serra Azul|Delta Saúde|Rio Claro|Campo Belo/);
    expect(sinais.resumo).toBe('19 sinais ativos de 20');
    expect(sinais.grupos.find(g => g.codigo === 'comercial')?.itens.find(s => s.nome === 'Vagas abertas por cargo')).toMatchObject({ custo: '5', ativo: true });
    expect(sinais.grupos.find(g => g.codigo === 'marketing')?.itens.find(s => s.nome === 'Seguidores de concorrente')).toMatchObject({ custo: '20', ativo: false });
    expect(sinais.grupos.find(g => g.codigo === 'comercial')?.itens.find(s => s.nome === 'Rodada de investimento ou M&A')?.ativo).toBe(true);
    expect(sinais.eventos).toEqual([{ id: 'sem-dados', conta: SEM_DADOS, tipo: SEM_DADOS, detalhe: SEM_DADOS, fit: SEM_DADOS, quando: SEM_DADOS }]);
    expect(sinais.kpis.every(k => k.valor === '0' && k.delta === '')).toBe(true);
  });

  it('membro da Grão Norte não vê sinais da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarSinais(eduardo, EVOLUT)).rejects.toThrow('Sem acesso a este workspace.');
    const grao = await listarSinais(eduardo, GRAO_NORTE);
    const texto = JSON.stringify(grao);
    expect(texto).not.toMatch(/Serra Azul|Delta Saúde|Importadores/);
    expect(grao.eventos[0].conta).toBe(SEM_DADOS);
  });

  it('BDR lê os sinais do próprio workspace', async () => {
    const sinais = await listarSinais(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(sinais.grupos.find(g => g.codigo === 'copy')?.itens.find(s => s.nome === 'Posts do decisor')?.custo).toBe('3');
  });
});
