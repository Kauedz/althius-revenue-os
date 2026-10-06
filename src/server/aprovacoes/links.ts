// Emite o link de aprovação (PR 13). Só o sistema faz isso, com a chave de serviço (nunca o front). O token em texto
// aparece SÓ no retorno desta função: o banco guarda apenas o hash. Quem chama entrega o link por onde preferir
// (e-mail, WhatsApp) e não deve gravar o texto do link em log.
export interface LinkEmitido { url: string; expiraEm: string; linkId: string }
export type ErroEmissao = 'prazo_invalido' | 'aprovacao_inexistente' | 'ja_decidida' | 'decisor_invalido' | 'conteudo_alterado' | 'links_demais';

export async function emitirLinkDeAprovacao(
  o: { base: string; chaveServico: string; siteUrl: string; aprovacaoId: string; decisorMembroId: string; prazoMinutos?: number },
  buscar: typeof fetch = fetch
): Promise<{ ok: true; link: LinkEmitido } | { ok: false; erro: ErroEmissao | 'falha_no_banco' }> {
  const r = await buscar(`${o.base.replace(/\/$/, '')}/rpc/approval_link_issue`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_approval_id: o.aprovacaoId, p_decider_member_id: o.decisorMembroId, p_ttl_minutes: o.prazoMinutos ?? 60 })
  });
  if (!r.ok) return { ok: false, erro: 'falha_no_banco' };
  const d = (await r.json()) as { ok: boolean; status?: ErroEmissao; token?: string; link_id?: string; expires_at?: string };
  if (!d.ok || !d.token || !d.expires_at || !d.link_id) return { ok: false, erro: d.status ?? 'falha_no_banco' };
  return { ok: true, link: { url: `${o.siteUrl.replace(/\/$/, '')}/#/aprovar/${d.token}`, expiraEm: d.expires_at, linkId: d.link_id } };
}
