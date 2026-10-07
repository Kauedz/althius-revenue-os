// @vitest-environment node
// Seam: Prospecção (página prospecting) lista só as listas de prospecção que o banco devolve, em modo somente leitura.
import { describe, expect, it } from 'vitest';
import { SEM_DADOS, listarProspeccao } from './prospeccao';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';

describe('listarProspeccao (unitário / mapeamento)', () => {
  function mockSupabase(opcoes: { rpc?: { data?: unknown; error?: { message: string; code?: string } | null }; tabelas?: Record<string, { data?: unknown; error?: { message: string } | null }> }) {
    const tabelas = opcoes.tabelas || {};
    return {
      rpc: () => Promise.resolve(opcoes.rpc || { data: { stages: [] }, error: null }),
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

  it('mostra a lista que o banco devolve e "Sem dados ainda" no que falta', async () => {
    const cliente = mockSupabase({
      tabelas: {
        executions: {
          data: [
            { id: 'l1', title: 'Lista do banco', execution_type: 'Lista', agent_code: 'comercial', status: 'running', processed_count: 10, valid_count: 7, actual_credits: 3 },
            { id: 'l2', title: '', execution_type: 'Enriquecimento', agent_code: null, status: 'outro', processed_count: null, valid_count: null, actual_credits: null }
          ],
          error: null
        }
      }
    });
    const tela = await listarProspeccao(cliente, 'ws-1');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/US\$|dólar|dolar|1\.946|2\.050|81%/);
    expect(tela.kpis.map(k => k.valor)).toEqual(['2', SEM_DADOS, SEM_DADOS, SEM_DADOS]);
    expect(tela.kpis.every(k => k.delta === '')).toBe(true); // ADR 0064: sem repetir "Sem dados ainda" embaixo do número
    expect(tela.listas[0]).toEqual({ id: 'l1', nome: 'Lista do banco', origem: 'Zoe', contas: '10', validos: '7', status: 'Em execução' });
    expect(tela.listas[1]).toEqual({ id: 'l2', nome: SEM_DADOS, origem: SEM_DADOS, contas: SEM_DADOS, validos: SEM_DADOS, status: SEM_DADOS });
  });

  it('consulta vazia não inventa as listas do protótipo', async () => {
    const cliente = mockSupabase({ tabelas: { executions: { data: [], error: null } } });
    const tela = await listarProspeccao(cliente, 'ws-1');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/Importadores do Sudeste|feira Intermodal|Reengajamento|1\.946|US\$/);
    expect(tela.kpis.every(k => k.valor === '0')).toBe(true);
    expect(tela.listas).toEqual([{ id: 'sem-dados', nome: SEM_DADOS, origem: SEM_DADOS, contas: SEM_DADOS, validos: SEM_DADOS, status: SEM_DADOS }]);
  });

  it('falha de acesso vira erro claro', async () => {
    const cliente = mockSupabase({ rpc: { data: null, error: { message: 'Sem acesso a este workspace.', code: '42501' } } });
    await expect(listarProspeccao(cliente, 'ws-1')).rejects.toThrow('Sem acesso a este workspace.');
  });

  it('falha ao ler as listas vira erro claro', async () => {
    const cliente = mockSupabase({ tabelas: { executions: { data: null, error: { message: 'relacao indisponivel' } } } });
    await expect(listarProspeccao(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar as listas de prospecção.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Prospecção (banco local)', () => {
  it('C-level vê só as listas e enriquecimentos do banco', async () => {
    const tela = await listarProspeccao(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/US\$|1\.946|2\.050|81%|Importadores do Sudeste|feira Intermodal|Reengajamento/);
    expect(tela.listas.map(l => l.nome).sort()).toEqual([
      'Enriquecer 80 contatos de feira',
      'Lista de 300 indústrias do Sul',
      'Mapear comitê de 48 contas quentes',
      'Qualificar 1.200 importadores do Sudeste'
    ]);
    const qualificar = tela.listas.find(l => l.nome.startsWith('Qualificar'));
    expect(qualificar).toMatchObject({ origem: 'Zoe', contas: '768', validos: '512', status: 'Em execução' });
    expect(tela.listas.find(l => l.nome.startsWith('Mapear'))).toMatchObject({ contas: '48', validos: '39', status: 'Concluída parcialmente' });
    expect(tela.listas.find(l => l.nome.startsWith('Lista de 300'))).toMatchObject({ contas: '0', validos: '0', status: 'Agendada' });
    expect(tela.listas.find(l => l.nome.startsWith('Enriquecer'))).toMatchObject({ contas: '0', validos: '0', status: 'Na fila' });
    expect(tela.kpis.map(k => k.valor)).toEqual(['4', '816', '551', '1.540']);
    expect(texto).not.toMatch(/Rascunhar e-mails|Relatório semanal|Atualizar 120|Leitura semanal/);
  });

  it('membro da Grão Norte não vê listas da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarProspeccao(eduardo, EVOLUT)).rejects.toThrow('Sem acesso a este workspace.');
    const grao = await listarProspeccao(eduardo, GRAO_NORTE);
    const texto = JSON.stringify(grao);
    expect(texto).not.toMatch(/Qualificar 1\.200|importadores do Sudeste|Serra Azul/);
    expect(grao.listas[0].nome).toBe(SEM_DADOS);
  });

  it('BDR não recebe as listas que o banco esconde de quem não vê execuções', async () => {
    const tela = await listarProspeccao(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/Qualificar 1\.200|US\$/);
    expect(tela.kpis.every(k => k.valor === '0')).toBe(true);
    expect(tela.listas[0].nome).toBe(SEM_DADOS);
  });
});
