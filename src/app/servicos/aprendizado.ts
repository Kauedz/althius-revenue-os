// Consentimento do cliente para o aprendizado compartilhado entre contas (ADR 0052). Começa desligado; só o C-level do
// workspace decide; o aviso aparece uma vez. Quem confere tudo é o banco.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EstadoAprendizado { aceito: boolean; avisoVisto: boolean; podeDecidir: boolean }
export type ResultadoLeitura = { ok: true; estado: EstadoAprendizado } | { ok: false; mensagem: string };
export type ResultadoDecisao = { ok: true } | { ok: false; mensagem: string };

export async function lerConsentimento(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<ResultadoLeitura> {
  const { data, error } = await cliente.rpc('learning_consent_get', { p_workspace_id: workspaceId, p_member_id: membroId });
  if (error || !data) return { ok: false, mensagem: 'Não foi possível ler esta configuração. Tente de novo.' };
  const d = data as { aceito: boolean; popup_visto: boolean; pode_decidir: boolean };
  return { ok: true, estado: { aceito: !!d.aceito, avisoVisto: !!d.popup_visto, podeDecidir: !!d.pode_decidir } };
}

export async function decidirConsentimento(cliente: SupabaseClient, workspaceId: string, membroId: string, aceito: boolean): Promise<ResultadoDecisao> {
  const { error } = await cliente.rpc('learning_consent_set', { p_workspace_id: workspaceId, p_member_id: membroId, p_aceito: aceito });
  if (!error) return { ok: true };
  return { ok: false, mensagem: error.code === '42501' ? 'Só o C-level do workspace decide sobre isso.' : 'Não foi possível salvar. Tente de novo.' };
}

/** true só na PRIMEIRA vez que o C-level vê o aviso (o banco garante); false depois, ou para quem não decide. */
export async function marcarAvisoVisto(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<boolean> {
  const { data, error } = await cliente.rpc('learning_consent_popup_visto', { p_workspace_id: workspaceId, p_member_id: membroId });
  return !error && data === true;
}
