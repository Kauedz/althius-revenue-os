// Copiloto: o pedido vira execução na fila pela política Hermes (migrations 0089 e 0090). Nada é simulado.
// A chave de envio garante que repetir o mesmo pedido (duplo clique, nova tentativa) não duplique nada.
import type { SupabaseClient } from '@supabase/supabase-js';

export type RespostaCopiloto =
  | { ok: true; execucaoId: string; paraAprovacao: false }
  | { ok: true; aprovacaoId: string; paraAprovacao: true; motivo: string | null }
  | { ok: false; mensagem: string };

export async function pedirAoCopiloto(
  cliente: SupabaseClient, workspaceId: string, membroId: string, texto: string, chave: string
): Promise<RespostaCopiloto> {
  const { data, error } = await cliente.rpc('copilot_request', { p_workspace_id: workspaceId, p_member_id: membroId, p_texto: texto, p_chave: chave });
  if (error) {
    console.error('[copilot_request]', error);
    return { ok: false, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : 'Não foi possível enviar o pedido. Tente de novo.' };
  }
  if (!data?.ok) return { ok: false, mensagem: data?.erro || 'Não foi possível enviar o pedido. Tente de novo.' };
  if (data.status === 'requires_approval') return { ok: true, paraAprovacao: true, aprovacaoId: data.approval_id, motivo: data.motivo ?? null };
  return { ok: true, paraAprovacao: false, execucaoId: data.execution_id };
}
