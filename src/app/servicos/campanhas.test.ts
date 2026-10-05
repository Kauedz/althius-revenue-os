// Campanhas ligadas ao banco local. Verba é gasto: estrategista pede, C-level aprova. Seed: Camila estrategista (d..02),
// Aline C-level (d..03), Lucas BDR (d..04), Eduardo C-level do Grão Norte (d..09). O seed não tem campanhas.
import { afterEach, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { campanhasVazias, criarCampanha, listarCampanhas, mudarStatusCampanha, mudarVerba, reais } from './campanhas';

const WS = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const EDUARDO = 'd0000000-0000-0000-0000-000000000009';

describe('formatação', () => {
  it('reais sem centavos e sem dólar', () => {
    expect(reais(5000)).toBe('R$ 5.000');
    expect(reais(12345.6)).toBe('R$ 12.346');
  });
  it('campanhasVazias não inventa linha nem número', () => {
    expect(campanhasVazias()).toEqual({ kpis: [], linhas: [] });
  });
});

describe.skipIf(!bancoLocalNoAr)('Campanhas (banco local)', () => {
  const adm = adminLocal();
  afterEach(async () => {
    const { data: ap } = await adm.from('approvals').select('id').eq('workspace_id', WS).eq('payload_json->>acao', 'verba_campanha');
    const ids = (ap ?? []).map(a => a.id);
    if (ids.length) {
      await adm.from('notifications').delete().in('entity_id', ids);
      await adm.from('approvals').delete().in('id', ids);
    }
    await adm.from('campaigns').delete().in('workspace_id', [WS, GRAO]);
  });

  it('sem campanhas, a lista vem vazia e os indicadores são zeros reais, sem CPL nem investimento inventados', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const t = await listarCampanhas(camila, WS);
    expect(t.linhas).toEqual([]);
    expect(t.kpis).toEqual([['Verba aprovada', '—', 'soma das campanhas'], ['Leads gerados', '—', ''], ['Pedidos de verba', '0', ''], ['Campanhas ativas', '0', '']]);
  });

  it('estrategista cria a campanha e pede a verba; só depois da aprovação do C-level a verba entra', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const r = await criarCampanha(camila, WS, CAMILA, 'Importação sem risco', 'LinkedIn Ads', 5000);
    expect(r).toMatchObject({ ok: true, pedido: true });
    if (!r.ok || !r.id) throw new Error('campanha não criada');

    let t = await listarCampanhas(camila, WS);
    expect(t.linhas).toHaveLength(1);
    expect(t.linhas[0]).toMatchObject({ nome: 'Importação sem risco', canal: 'LinkedIn Ads', verba: '—', status: 'Rascunho', investido: 'Sem dados ainda', cpl: '—' });
    expect(t.linhas[0].desc).toBe('Pedido de verba de R$ 5.000 aguardando a aprovação do C-level.');
    expect(t.kpis[2]).toEqual(['Pedidos de verba', '1', 'aguardando o C-level']);
    expect(JSON.stringify(t)).not.toMatch(/US\$|USD/);

    // O pedido aparece para o C-level decidir (mesmo caminho das Aprovações)
    const { data: pedido } = await aline.from('approvals').select('id, payload_json, category, approval_type').eq('workspace_id', WS).eq('payload_json->>acao', 'verba_campanha').single();
    expect(pedido).toMatchObject({ category: 'gasto', approval_type: 'orcamento' });
    const decisao = await aline.rpc('approval_decide', { p_approval_id: pedido!.id, p_decider_member_id: ALINE, p_decision: 'aprovado', p_payload_to_verify: pedido!.payload_json, p_notes: null });
    expect(decisao.data).toMatchObject({ success: true, status: 'aprovado' });

    t = await listarCampanhas(camila, WS);
    expect(t.linhas[0]).toMatchObject({ verba: 'R$ 5.000', verbaNumero: 5000, desc: undefined });
    expect(t.kpis[0]).toEqual(['Verba aprovada', 'R$ 5.000', 'soma das campanhas']);
    expect(t.kpis[2][1]).toBe('0');
  });

  it('C-level aplica a verba direto; estrategista reduz direto e para aumentar pede (sem duplicar o pedido)', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const c = await criarCampanha(aline, WS, ALINE, 'Remarketing', 'Meta Ads', 2000);
    expect(c).toMatchObject({ ok: true, pedido: false });
    if (!c.ok || !c.id) throw new Error('campanha não criada');
    expect((await listarCampanhas(aline, WS)).linhas[0].verba).toBe('R$ 2.000');

    expect(await mudarVerba(camila, WS, CAMILA, c.id, 1000)).toMatchObject({ ok: true, acao: 'updated' });
    expect(await mudarVerba(camila, WS, CAMILA, c.id, 4000)).toMatchObject({ ok: true, acao: 'requested' });
    expect(await mudarVerba(camila, WS, CAMILA, c.id, 6000)).toMatchObject({ ok: true, acao: 'pending_exists' });
    expect(await mudarVerba(aline, WS, ALINE, c.id, 9000)).toMatchObject({ ok: true, acao: 'updated' });
    expect((await listarCampanhas(aline, WS)).linhas[0].verba).toBe('R$ 9.000');
  });

  it('BDR não cria campanha nem mexe em status ou verba; as mensagens vêm do banco em português', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const r = await criarCampanha(lucas, WS, LUCAS, 'Do BDR', 'Meta Ads', 0);
    expect(r.ok === false && r.mensagem).toMatch(/Só estrategistas e gestores criam campanhas/);
    const c = await criarCampanha(aline, WS, ALINE, 'Da Aline', 'Evento', 0);
    if (!c.ok || !c.id) throw new Error('campanha não criada');
    expect((await mudarStatusCampanha(lucas, WS, LUCAS, c.id, 'Ativa')).ok).toBe(false);
    expect((await mudarVerba(lucas, WS, LUCAS, c.id, 100)).ok).toBe(false);
  });

  it('status, nome, canal e verba inválidos são recusados', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await criarCampanha(aline, WS, ALINE, '  ', 'Meta Ads', 0)).ok).toBe(false);
    expect((await criarCampanha(aline, WS, ALINE, 'X', 'TikTok', 0)).ok).toBe(false);
    expect((await criarCampanha(aline, WS, ALINE, 'X', 'Meta Ads', -5)).ok).toBe(false);
    const c = await criarCampanha(aline, WS, ALINE, 'Y', 'Orgânico', 0);
    if (!c.ok || !c.id) throw new Error('campanha não criada');
    expect((await mudarStatusCampanha(aline, WS, ALINE, c.id, 'Ativa')).ok).toBe(true);
    expect((await mudarStatusCampanha(aline, WS, ALINE, c.id, 'Voando')).ok).toBe(false);
    expect((await listarCampanhas(aline, WS)).linhas[0].status).toBe('Ativa');
  });

  it('isolamento: o Grão Norte não vê nem mexe em campanha da Evolut', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const c = await criarCampanha(aline, WS, ALINE, 'Da Evolut', 'Google Ads', 3000);
    if (!c.ok || !c.id) throw new Error('campanha não criada');
    expect((await listarCampanhas(eduardo, GRAO)).linhas).toEqual([]);
    expect((await listarCampanhas(eduardo, WS)).linhas).toEqual([]);
    expect((await mudarStatusCampanha(eduardo, GRAO, EDUARDO, c.id, 'Pausada')).ok).toBe(false);
    expect((await mudarVerba(eduardo, GRAO, EDUARDO, c.id, 1)).ok).toBe(false);
  });
});
