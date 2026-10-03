// @vitest-environment node
// Seam: serviço de Agentes (listarAgentes, pausarAgente, salvarCapacidades) contra o banco local,
// verificado só pelo próprio serviço (sem consultar tabelas por fora).
import { afterAll, describe, expect, it } from 'vitest';
import { listarAgentes, pausarAgente, salvarCapacidades, type AgenteBase } from './agentes';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const BASE: AgenteBase[] = [
  { id: 'comercial', nome: 'Agente Comercial' }, { id: 'marketing', nome: 'Agente de Marketing' },
  { id: 'copy', nome: 'Agente de Copy' }, { id: 'revops', nome: 'Agente de RevOps' }
];

describe.skipIf(!bancoLocalNoAr)('Agentes (banco local)', () => {
  afterAll(async () => {
    // Devolve o seed: agente ativo e capacidade padrão.
    const aline = await entrarComoLocal('aline@evolut.com.br');
    await pausarAgente(aline, EVOLUT, ALINE, 'comercial', false);
    const camila = await entrarComoLocal('camila@althius.com.br');
    await salvarCapacidades(camila, EVOLUT, CAMILA, 'copy', { escreverCrm: false });
  });

  it('lista os 4 agentes com o texto do produto e a situação real do workspace', async () => {
    const agentes = await listarAgentes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, BASE);
    expect(agentes.map(a => a.id)).toEqual(['comercial', 'marketing', 'copy', 'revops']);
    const comercial = agentes[0];
    expect(comercial).toMatchObject({ nome: 'Agente Comercial', estado: 'ativo', autonomia: 'Assistido', responsavel: 'Camila Duarte' });
    expect(typeof comercial.execCiclo).toBe('number');
    expect(typeof comercial.pendencias).toBe('number');
    expect(comercial.conhecimento).toEqual([]);
  });

  it('agente sem execuções não mostra taxa de sucesso inventada', async () => {
    const agentes = await listarAgentes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, BASE);
    for (const a of agentes) {
      if (a.execCiclo === 0 && a.ultima === 'Sem execuções') expect(a.sucesso).toBe('—');
      expect(a.sucesso === '—' || (typeof a.sucesso === 'number' && a.sucesso >= 0 && a.sucesso <= 100)).toBe(true);
    }
  });

  it('C-level pausa e retoma; a lista mostra a mudança', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect(await pausarAgente(aline, EVOLUT, ALINE, 'comercial', true)).toEqual({ ok: true });
    expect((await listarAgentes(aline, EVOLUT, BASE))[0].estado).toBe('pausado');
    expect(await pausarAgente(aline, EVOLUT, ALINE, 'comercial', false)).toEqual({ ok: true });
    expect((await listarAgentes(aline, EVOLUT, BASE))[0].estado).toBe('ativo');
  });

  it('BDR recebe o motivo e nada muda', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await pausarAgente(lucas, EVOLUT, LUCAS, 'comercial', true)).toEqual({ ok: false, mensagem: 'Seu papel não pausa agentes.' });
    expect((await listarAgentes(lucas, EVOLUT, BASE))[0].estado).toBe('ativo');
  });

  it('estrategista liga uma capacidade; C-level não', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    expect(await salvarCapacidades(camila, EVOLUT, CAMILA, 'copy', { escreverCrm: true })).toEqual({ ok: true });
    expect((await listarAgentes(camila, EVOLUT, BASE)).find(a => a.id === 'copy')?.caps.escreverCrm).toBe(true);
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect(await salvarCapacidades(aline, EVOLUT, ALINE, 'copy', { escreverCrm: false })).toEqual({ ok: false, mensagem: 'Seu papel não configura agentes.' });
  });

  it('outro workspace não vê os agentes da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    expect(await listarAgentes(eduardo, EVOLUT, BASE)).toEqual([]);
  });
});
