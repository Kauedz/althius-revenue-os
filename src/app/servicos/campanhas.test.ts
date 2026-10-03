// @vitest-environment node
// Seam: Campanhas lista o que o banco devolve. Rascunho grava. Ativar canal pago nao liga: vai ao Hermes.
import { afterAll, describe, expect, it } from 'vitest';
import { SEM_DADOS, ativarCampanha, listarCampanhas, salvarCampanha } from './campanhas';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const EDUARDO = 'd0000000-0000-0000-0000-000000000009';
const ORGANICA = 'Campanha organica da tela';
const PAGA = 'Campanha paga da tela';
const NAO_CRIA = 'Seu papel não cria campanha.';
const NAO_PARTICIPA = 'Você não participa deste workspace.';
const PARA_APROVACAO = 'A ativação foi para Aprovações. Quem paga decide a verba.';
const PARA_EXECUCAO = 'A ativação foi para Execuções. A campanha não foi ligada.';

function rpcOk(data: unknown) {
  return { rpc: () => Promise.resolve({ data, error: null }) } as any;
}

describe('listarCampanhas (unitario)', () => {
  it('mostra canal, leads e status reais e deixa dinheiro como Sem dados ainda', async () => {
    const tela = await listarCampanhas(rpcOk({
      ok: true,
      pode_editar: true,
      itens: [
        { id: '1', name: 'Campanha real', channel_type: 'linkedin_ads', status: 'rascunho', leads_count: 3, updated_at: '2026-10-01T12:00:00Z' },
        { id: '2', name: 'Outra', channel_type: 'organico', status: 'ativa', leads_count: 0, updated_at: '2026-09-01T12:00:00Z' }
      ]
    }), 'ws', 'm');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/US\$|R\$|dolar|Importação sem risco|30\.000|1,9/);
    expect(tela.podeEditar).toBe(true);
    expect(tela.kpis[0][1]).toBe(SEM_DADOS);
    expect(tela.kpis[1][1]).toBe('3');
    expect(tela.kpis[2][1]).toBe(SEM_DADOS);
    expect(tela.kpis[3][1]).toBe('1');
    expect(tela.linhas[0]).toMatchObject({ nome: 'Campanha real', canal: 'LinkedIn Ads', investido: SEM_DADOS, leads: '3', cpl: SEM_DADOS, status: 'Rascunho' });
    expect(tela.linhas[1]).toMatchObject({ canal: 'Orgânico', status: 'Ativa', leads: '0' });
  });

  it('lista vazia nao inventa o prototipo', async () => {
    const tela = await listarCampanhas(rpcOk({ ok: true, pode_editar: false, itens: [] }), 'ws', 'm');
    expect(tela.linhas).toEqual([]);
    expect(tela.kpis[1][1]).toBe('0');
    expect(tela.kpis[3][1]).toBe('0');
    expect(tela.kpis[0][1]).toBe(SEM_DADOS);
    expect(JSON.stringify(tela)).not.toMatch(/Importação sem risco|Remarketing|Guia de conta/);
  });

  it('falha de rede vira erro claro', async () => {
    const cliente = { rpc: () => Promise.resolve({ data: null, error: { message: 'x' } }) } as any;
    await expect(listarCampanhas(cliente, 'ws', 'm')).rejects.toThrow('Não foi possível carregar as campanhas.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Campanhas (banco local)', () => {
  const criados: string[] = [];
  afterAll(async () => {
    const admin = adminLocal();
    if (criados.length) {
      const porCampanha = await admin.from('approvals').select('id, payload_json');
      const idsAprov = (porCampanha.data || []).filter(a => criados.includes(String((a.payload_json as { campaign_id?: string } | null)?.campaign_id))).map(a => a.id);
      if (idsAprov.length) {
        await admin.from('notifications').delete().in('entity_id', idsAprov);
        await admin.from('approvals').delete().in('id', idsAprov);
      }
      const execs = await admin.from('executions').select('id, metadata_json');
      const idsExec = (execs.data || []).filter(e => criados.includes(String((e.metadata_json as { campaign_id?: string } | null)?.campaign_id))).map(e => e.id);
      if (idsExec.length) await admin.from('executions').delete().in('id', idsExec);
      await admin.from('campaigns').delete().in('id', criados);
    }
  });

  it('estrategista grava rascunho, pago vai para Aprovacoes, C-level vai para Execucoes, BDR nao cria, Grao Norte nao ve', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const salvo = await salvarCampanha(camila, EVOLUT, CAMILA, { nome: ORGANICA, canal: 'Orgânico' });
    expect(salvo.ok).toBe(true);
    if (salvo.ok) criados.push(salvo.id);
    const tela = await listarCampanhas(camila, EVOLUT, CAMILA);
    expect(tela.podeEditar).toBe(true);
    expect(tela.linhas.find(l => l.nome === ORGANICA)).toMatchObject({ status: 'Rascunho', canal: 'Orgânico', investido: SEM_DADOS, cpl: SEM_DADOS });
    const idOrg = tela.linhas.find(l => l.nome === ORGANICA)!.id;
    const ligou = await ativarCampanha(camila, EVOLUT, CAMILA, idOrg);
    expect(ligou).toMatchObject({ ok: true, destino: 'ativa' });
    const depois = await listarCampanhas(camila, EVOLUT, CAMILA);
    expect(depois.linhas.find(l => l.id === idOrg)?.status).toBe('Ativa');
    expect(depois.kpis[3][1]).toBe('1');

    const paga = await salvarCampanha(camila, EVOLUT, CAMILA, { nome: PAGA, canal: 'LinkedIn Ads' });
    expect(paga.ok).toBe(true);
    if (paga.ok) criados.push(paga.id);
    const pediu = await ativarCampanha(camila, EVOLUT, CAMILA, paga.ok ? paga.id : '');
    expect(pediu).toEqual({ ok: true, destino: 'aprovacao', mensagem: PARA_APROVACAO });
    const ainda = await listarCampanhas(camila, EVOLUT, CAMILA);
    expect(ainda.linhas.find(l => l.nome === PAGA)?.status).toBe('Rascunho');

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const exec = await ativarCampanha(aline, EVOLUT, ALINE, paga.ok ? paga.id : '');
    expect(exec).toMatchObject({ ok: true, destino: 'execucao', mensagem: PARA_EXECUCAO });
    const status = await listarCampanhas(aline, EVOLUT, ALINE);
    expect(status.linhas.find(l => l.nome === PAGA)?.status).toBe('Rascunho');
    expect(JSON.stringify(status)).not.toMatch(/US\$|R\$/);

    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const negado = await salvarCampanha(lucas, EVOLUT, LUCAS, { nome: 'Campanha do Lucas no teste', canal: 'Evento' });
    expect(negado).toEqual({ ok: false, mensagem: NAO_CRIA });
    const leitura = await listarCampanhas(lucas, EVOLUT, LUCAS);
    expect(leitura.podeEditar).toBe(false);
    expect(leitura.linhas.some(l => l.nome === PAGA)).toBe(true);

    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarCampanhas(eduardo, EVOLUT, EDUARDO)).rejects.toThrow(NAO_PARTICIPA);
    const grao = await listarCampanhas(eduardo, GRAO, EDUARDO);
    expect(JSON.stringify(grao)).not.toContain(PAGA);
    expect(grao.linhas).toEqual([]);
  });
});
