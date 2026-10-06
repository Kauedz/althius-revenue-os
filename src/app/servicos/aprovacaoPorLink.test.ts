// @vitest-environment node
// Seam: página do link de aprovação (sem login), com o banco local de verdade.
import { afterAll, describe, expect, it } from 'vitest';
import { decidirPorLink, MENSAGEM_DO_LINK, verLink } from './aprovacaoPorLink';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, novoClienteLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const CAMILA_GRAO = 'd0000000-0000-0000-0000-000000000008';

describe.skipIf(!bancoLocalNoAr)('Aprovação por link (banco local, sem login)', () => {
  const admin = adminLocal();
  const criadas: string[] = [];
  const campanhas: string[] = [];

  // O pedido nasce pelo caminho da tela (campaign_set_budget, como a estrategista): assim o hash do conteúdo é o do banco.
  let seq = 0;
  async function aprovacao(ws: string, membro: string, para: number, deAntes = 1000): Promise<{ id: string; campanha: string }> {
    const campanha = `fb000000-0000-0000-0000-00000000f${String(++seq).padStart(3, '0')}`;
    campanhas.push(campanha);
    const { error: e1 } = await admin.from('campaigns').upsert({ id: campanha, workspace_id: ws, name: `Campanha do link ${seq} (teste)`, channel_type: 'linkedin_ads', status: 'ativa', budget_brl: deAntes, created_by: membro });
    if (e1) throw e1;
    const camila = await entrarComoLocal('camila@althius.com.br');
    const { data, error } = await camila.rpc('campaign_set_budget', { p_workspace_id: ws, p_member_id: membro, p_campaign_id: campanha, p_amount: para });
    if (error || data.action !== 'requested') throw new Error('pedido: ' + JSON.stringify(error ?? data));
    criadas.push(data.approval_id);
    return { id: data.approval_id, campanha };
  }
  async function emitir(aprovacaoId: string, decisor: string, minutos = 60): Promise<string> {
    const { data, error } = await admin.rpc('approval_link_issue', { p_approval_id: aprovacaoId, p_decider_member_id: decisor, p_ttl_minutes: minutos });
    if (error || !data.ok) throw new Error('emissão: ' + JSON.stringify(error ?? data));
    return data.token;
  }

  afterAll(async () => {
    if (criadas.length) {
      await admin.from('notifications').delete().in('entity_id', criadas);
      await admin.from('approvals').delete().in('id', criadas);
    }
    await admin.from('campaigns').delete().in('id', campanhas);
  });

  const verbaDe = async (campanha: string) => Number((await admin.from('campaigns').select('budget_brl').eq('id', campanha).single()).data?.budget_brl);

  it('o visitante (sem login) vê o pedido, em créditos e sem ids, e decide uma única vez', async () => {
    const { id, campanha } = await aprovacao(EVOLUT, CAMILA, 4000);
    const token = await emitir(id, ALINE);
    const visitante = novoClienteLocal();

    const visto = await verLink(visitante, token);
    expect(visto).toMatchObject({ ok: true, pedido: { categoria: 'gasto', creditos: 0, decisorPapel: 'clevel' } });
    expect(JSON.stringify(visto)).not.toMatch(/payload|workspace|usd|US\$/i);

    expect(await decidirPorLink(visitante, token, 'aprovado', 'Pelo celular')).toEqual({ ok: true, decisao: 'aprovado' });
    expect(await verbaDe(campanha)).toBe(4000);

    expect(await decidirPorLink(visitante, token, 'aprovado')).toEqual({ ok: false, mensagem: MENSAGEM_DO_LINK.used });
    expect(await verLink(visitante, token)).toEqual({ ok: false, mensagem: MENSAGEM_DO_LINK.used });
  });

  it('link inventado, vencido e de conteúdo alterado são recusados com mensagem clara', async () => {
    const visitante = novoClienteLocal();
    expect(await verLink(visitante, 'alt_aprov_inventado_inventado_inventado')).toEqual({ ok: false, mensagem: MENSAGEM_DO_LINK.invalid });

    const a = await aprovacao(EVOLUT, CAMILA, 4500);
    const token = await emitir(a.id, ALINE);
    await admin.from('approval_links').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('approval_id', a.id);
    expect(await decidirPorLink(visitante, token, 'aprovado')).toEqual({ ok: false, mensagem: MENSAGEM_DO_LINK.expired });

    const b = await aprovacao(EVOLUT, CAMILA, 4600);
    const token2 = await emitir(b.id, ALINE);
    await admin.from('approvals').update({ payload_json: { acao: 'verba_campanha', campaign_id: b.campanha, campanha: 'x', canal: 'linkedin_ads', de: 1000, para: 99999 } }).eq('id', b.id);
    expect(await decidirPorLink(visitante, token2, 'aprovado')).toEqual({ ok: false, mensagem: MENSAGEM_DO_LINK.content_changed });
    expect(await verbaDe(b.campanha)).toBe(1000);
  });

  it('o link da Evolut não decide a aprovação da Grão Norte', async () => {
    const evolut = await aprovacao(EVOLUT, CAMILA, 4700);
    const grao = await aprovacao(GRAO, CAMILA_GRAO, 900, 500);
    const token = await emitir(evolut.id, ALINE);
    expect(await decidirPorLink(novoClienteLocal(), token, 'aprovado')).toEqual({ ok: true, decisao: 'aprovado' });
    expect((await admin.from('approvals').select('status').eq('id', grao.id).single()).data?.status).toBe('pendente');
    expect(await verbaDe(grao.campanha)).toBe(500);
  });

  it('o visitante não emite link nem lê a tabela de links', async () => {
    const visitante = novoClienteLocal();
    const a = await aprovacao(EVOLUT, CAMILA, 4800);
    const r = await visitante.rpc('approval_link_issue', { p_approval_id: a.id, p_decider_member_id: ALINE, p_ttl_minutes: 60 });
    expect(r.error).not.toBeNull();
    const t = await visitante.from('approval_links').select('id');
    expect(t.data ?? []).toEqual([]);
  });
});
