// Painel de coleta (ADR 0069): porcentagem e créditos, nunca dólar; o teto de sinais só o C-level muda.
import { afterAll, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { kpisDaColeta, lerPainelDeColeta, salvarTetoDeSinais } from './coleta';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const GRAO_CEO = 'd0000000-0000-0000-0000-000000000009';

describe('kpisDaColeta', () => {
  it('mostra porcentagem, créditos que ainda cabem e o teto de sinais; nunca dólar', () => {
    const k = kpisDaColeta({ coletaPercentual: 37, coletaRestanteCreditos: 3200, coletaAtingida: false, sinaisTeto: 2000, sinaisGasto: 120, contasMonitoradas: 9, podeEditarTeto: true });
    expect(k).toEqual([
      ['Coleta do mês', '37%', 'restam cerca de 3.200 créditos de coleta'],
      ['Sinais no mês', '120 de 2.000', 'créditos de sinais (teto mensal)'],
      ['Contas monitoradas', '9', 'os sinais delas rodam sozinhos']
    ]);
    expect(JSON.stringify(k)).not.toMatch(/US\$|dólar|usd/i);
  });

  it('limite atingido e sinais desligados são ditos com clareza', () => {
    const k = kpisDaColeta({ coletaPercentual: 100, coletaRestanteCreditos: 0, coletaAtingida: true, sinaisTeto: 0, sinaisGasto: 0, contasMonitoradas: 0, podeEditarTeto: false });
    expect(k[0][2]).toBe('limite atingido: fale com a Althius');
    expect(k[1]).toEqual(['Sinais no mês', '0 de 0', 'sinais automáticos desligados']);
  });
});

describe.skipIf(!bancoLocalNoAr)('Painel de coleta (banco local)', () => {
  const adm = adminLocal();
  afterAll(async () => { await adm.from('workspace_settings').update({ teto_sinais_mes: 2000 }).eq('workspace_id', EVOLUT); });

  it('a estrategista lê o painel, mas não muda o teto de sinais', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const p = await lerPainelDeColeta(camila, EVOLUT, CAMILA);
    expect(p.coletaPercentual).toBeGreaterThanOrEqual(0);
    expect(p.coletaPercentual).toBeLessThanOrEqual(100);
    expect(p.podeEditarTeto).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/usd/i);
    expect(await salvarTetoDeSinais(camila, EVOLUT, CAMILA, 500)).toEqual({ ok: false, mensagem: 'Só o C-level e o superadmin mudam o teto de sinais.' });
  });

  it('o C-level muda o teto e o painel mostra o novo valor; valor inválido é recusado', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await lerPainelDeColeta(aline, EVOLUT, ALINE)).podeEditarTeto).toBe(true);
    expect(await salvarTetoDeSinais(aline, EVOLUT, ALINE, 1500)).toEqual({ ok: true });
    expect((await lerPainelDeColeta(aline, EVOLUT, ALINE)).sinaisTeto).toBe(1500);
    expect(await salvarTetoDeSinais(aline, EVOLUT, ALINE, -3)).toMatchObject({ ok: false });
    expect(await salvarTetoDeSinais(aline, EVOLUT, ALINE, 2.5)).toMatchObject({ ok: false });
    expect(await salvarTetoDeSinais(aline, EVOLUT, ALINE, 5_000_000)).toEqual({ ok: false, mensagem: 'O teto vai de 0 a 1.000.000 créditos.' });
  });

  it('isolamento: quem é de outro cliente não lê o painel nem muda o teto', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(lerPainelDeColeta(eduardo, EVOLUT, GRAO_CEO)).rejects.toThrow('Não foi possível carregar a coleta do mês.');
    expect(await salvarTetoDeSinais(eduardo, EVOLUT, GRAO_CEO, 10)).toMatchObject({ ok: false });
  });
});
