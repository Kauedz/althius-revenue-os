// Aprendizados e playbook dos agentes (ADR 0024). Aprendizado não é tela própria: as sugestões
// aparecem na aba Playbook de cada agente; o estrategista aplica no rascunho ou descarta, e publica.
import type { SupabaseClient } from '@supabase/supabase-js';

/** Formato que a aba Playbook do v18 lê (window.ALTHIUS_SUGESTOES[agente]). */
export interface SugestaoTela {
  id: string;
  aprendizado: string;
  mudanca: string;
  origem: string;
}

export async function listarSugestoes(cliente: SupabaseClient, workspaceId: string): Promise<Record<string, SugestaoTela[]>> {
  const { data, error } = await cliente
    .from('learning_entries')
    .select('id, agent_id, suggestion_text, proposed_change, evidence')
    .eq('workspace_id', workspaceId)
    .eq('status', 'sugerida')
    .order('created_at');
  if (error) throw new Error('Não foi possível carregar as sugestões dos agentes.', { cause: error });
  const porAgente: Record<string, SugestaoTela[]> = {};
  for (const l of data || []) {
    (porAgente[l.agent_id] ||= []).push({ id: l.id, aprendizado: l.suggestion_text, mudanca: l.proposed_change || '', origem: l.evidence || '' });
  }
  return porAgente;
}

/** Texto do playbook publicado de cada agente (window.ALTHIUS_PLAYBOOK[agente]). */
export async function lerPlaybooks(cliente: SupabaseClient, workspaceId: string): Promise<Record<string, string>> {
  const { data, error } = await cliente
    .from('agent_playbooks')
    .select('agent_id, content_markdown')
    .eq('workspace_id', workspaceId)
    .eq('is_published', true);
  if (error) throw new Error('Não foi possível carregar os playbooks dos agentes.', { cause: error });
  return Object.fromEntries((data || []).map(p => [p.agent_id, p.content_markdown]));
}

export type ResultadoAprendizado = { ok: true } | { ok: false; mensagem: string };

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>, falha: string) {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false as const, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : falha };
  }
  return data?.ok ? { ok: true as const, data } : { ok: false as const, mensagem: (data?.erro as string) || falha };
}

export async function decidirAprendizado(
  cliente: SupabaseClient, workspaceId: string, membroId: string, id: string, decisao: 'aplicada' | 'descartada'
): Promise<ResultadoAprendizado> {
  const r = await chamar(cliente, 'learning_decide', { p_workspace_id: workspaceId, p_member_id: membroId, p_entry_id: id, p_decisao: decisao },
    'Não foi possível registrar a decisão. Tente de novo.');
  return r.ok ? { ok: true } : r;
}

export async function publicarPlaybook(
  cliente: SupabaseClient, workspaceId: string, membroId: string, agente: string, texto: string
): Promise<{ ok: true; versao: string } | { ok: false; mensagem: string }> {
  const r = await chamar(cliente, 'agent_playbook_publish', { p_workspace_id: workspaceId, p_member_id: membroId, p_agent_code: agente, p_conteudo: texto },
    'Não foi possível publicar o playbook. Tente de novo.');
  return r.ok ? { ok: true, versao: r.data.versao } : r;
}
