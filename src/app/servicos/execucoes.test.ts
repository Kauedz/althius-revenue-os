// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { listarExecucoes } from './execucoes';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
describe.skipIf(!bancoLocalNoAr)('Execuções (banco local)', () => {
  it('C-level lê as oito execuções com detalhes do banco, sem custo real', async () => {
    const execs = await listarExecucoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(execs).toHaveLength(8);
    expect(execs[0]).toMatchObject({ id: 'ec000000-0000-0000-0000-000000001042', titulo: 'Qualificar 1.200 importadores do Sudeste', tipo: 'Lista', status: 'Em execução', progresso: 64, processados: 768, validos: 512, credEst: 1800, credRes: 1800, credCons: 1150, etapaAtual: 3, solicitante: 'Camila Duarte' });
    expect(execs[0].plano).toHaveLength(5);
    expect(execs[0].logs).toContain('09:31 512 contas com fit acima de 70');
    expect(execs.every(e => !('custo' in e))).toBe(true);
  });
  it('estrategista lê só as execuções do workspace escolhido', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    expect(await listarExecucoes(camila, GRAO)).toEqual([]);
    expect(await listarExecucoes(camila, 'c0000000-0000-0000-0000-000000000001')).toEqual([]);
  });
  it('BDR não lê execuções nem por consulta direta', async () => {
    expect(await listarExecucoes(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT)).toEqual([]);
  });
  it('só superadmin recebe custos em dólar', async () => {
    const execs = await listarExecucoes(await entrarComoLocal('rafael@althius.com.br'), EVOLUT, true);
    expect(execs[0].custo).toBe('US$ 41,20');
    await expect(listarExecucoes(await entrarComoLocal('camila@althius.com.br'), EVOLUT, true)).rejects.toThrow('Não foi possível carregar os custos');
  });
});