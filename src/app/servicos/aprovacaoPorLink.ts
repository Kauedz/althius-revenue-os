// Aprovação por link de uso único (PR 13): o que a página do link usa. Funciona SEM login: o token é a prova.
// Quem confere tudo (prazo, uso único, conteúdo, papel, "quem paga decide o gasto") é o banco.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PedidoDoLink {
  titulo: string;
  categoria: 'operacao' | 'gasto';
  motivo: string;
  impacto: string;
  previa: string;
  /** créditos estimados (nunca dólar) */
  creditos: number;
  agente: string | null;
  expiraEm: string;
  decisorPapel: string;
}

export type MotivoDoLink = 'invalid' | 'used' | 'revoked' | 'expired' | 'decided' | 'content_changed' | 'decider_invalid' | 'invalid_decision';

export const MENSAGEM_DO_LINK: Record<MotivoDoLink, string> = {
  invalid: 'Este link não é válido.',
  used: 'Este link já foi usado.',
  revoked: 'Este link foi cancelado.',
  expired: 'Este link venceu. Peça um novo.',
  decided: 'Esta aprovação já foi decidida.',
  content_changed: 'O pedido mudou depois que o link foi enviado. Peça um novo link.',
  decider_invalid: 'Este link não vale mais para você.',
  invalid_decision: 'Escolha aprovar ou rejeitar.'
};
const GENERICA = 'Não foi possível abrir o link agora. Tente de novo.';

export type ResultadoVerLink = { ok: true; pedido: PedidoDoLink } | { ok: false; mensagem: string };
export type ResultadoDecidirLink = { ok: true; decisao: 'aprovado' | 'rejeitado' } | { ok: false; mensagem: string };

const mensagem = (status: unknown) => MENSAGEM_DO_LINK[status as MotivoDoLink] ?? GENERICA;

export async function verLink(cliente: SupabaseClient, token: string): Promise<ResultadoVerLink> {
  const { data, error } = await cliente.rpc('approval_link_preview', { p_token: token });
  if (error) { console.error('[verLink]', error); return { ok: false, mensagem: GENERICA }; }
  if (!data?.ok) return { ok: false, mensagem: mensagem(data?.status) };
  return {
    ok: true,
    pedido: {
      titulo: data.titulo, categoria: data.categoria, motivo: data.motivo || '', impacto: data.impacto || '', previa: data.previa || '',
      creditos: data.creditos || 0, agente: data.agente ?? null, expiraEm: data.expira_em, decisorPapel: data.decisor_papel
    }
  };
}

export async function decidirPorLink(cliente: SupabaseClient, token: string, decisao: 'aprovado' | 'rejeitado', nota?: string): Promise<ResultadoDecidirLink> {
  const { data, error } = await cliente.rpc('approval_link_decide', { p_token: token, p_decision: decisao, p_notes: nota ?? null });
  if (error) { console.error('[decidirPorLink]', error); return { ok: false, mensagem: GENERICA }; }
  if (!data?.ok) {
    // Decisão recusada pela regra do banco (ex.: papel sem alçada): a mensagem não revela detalhe interno.
    return { ok: false, mensagem: MENSAGEM_DO_LINK[data?.status as MotivoDoLink] ?? 'A decisão não foi aceita. Peça um novo link.' };
  }
  return { ok: true, decisao: data.status };
}
