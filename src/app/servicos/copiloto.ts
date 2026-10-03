// Copiloto: o pedido vira execução na fila pela política Hermes (migration 0089). Nada é simulado.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function pedirAoCopiloto(
  cliente: SupabaseClient, workspaceId: string, membroId: string, texto: string
): Promise<{ ok: true; execucaoId: string } | { ok: false; mensagem: string }> {
  const { data, error } = await cliente.rpc('copilot_request', { p_workspace_id: workspaceId, p_member_id: membroId, p_texto: texto });
  if (error) {
    console.error('[copilot_request]', error);
    return { ok: false, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : 'Não foi possível enviar o pedido. Tente de novo.' };
  }
  return data?.ok ? { ok: true, execucaoId: data.execution_id } : { ok: false, mensagem: data?.erro || 'Não foi possível enviar o pedido. Tente de novo.' };
}
