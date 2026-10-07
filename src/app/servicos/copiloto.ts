// Copiloto (ADR 0068): conversa PRIVADA de cada pessoa com o assistente. A pergunta vai para o banco; o serviço
// `copiloto` responde com os números lidos do banco e, quando é trabalho, indica o agente. Não vira execução e não gasta
// crédito. A chave de envio garante que repetir a mesma pergunta (duplo clique, nova tentativa) não duplica.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MensagemCopiloto {
  id: string;
  autor: 'pessoa' | 'copiloto';
  texto: string;
  estado: 'pendente' | 'processando' | 'respondida' | 'erro';
  /** código do agente que faz o trabalho pedido (comercial, marketing, copy, revops) */
  encaminhar: string | null;
  quando: string;
}

export async function perguntarAoCopiloto(cliente: SupabaseClient, workspaceId: string, membroId: string, texto: string, chave: string)
  : Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const { data, error } = await cliente.rpc('copilot_ask', { p_workspace_id: workspaceId, p_member_id: membroId, p_texto: texto, p_chave: chave });
  if (error) {
    if (error.code === '22023' && error.message) return { ok: false, mensagem: error.message };
    return { ok: false, mensagem: error.code === '42501' ? 'Você não participa deste workspace.' : 'Não foi possível enviar a pergunta. Tente de novo.' };
  }
  if (!data?.ok) return { ok: false, mensagem: data?.erro || 'Não foi possível enviar a pergunta. Tente de novo.' };
  return { ok: true, id: data.id };
}

/** A conversa da pessoa neste workspace (o banco só devolve a dela), da mais antiga para a mais nova. */
export async function lerConversaCopiloto(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<MensagemCopiloto[]> {
  const { data, error } = await cliente.from('copilot_messages')
    .select('id, autor, texto, estado, encaminhar_para, created_at')
    .eq('workspace_id', workspaceId).eq('member_id', membroId)
    .order('created_at', { ascending: true }).limit(200);
  if (error) throw new Error('Não foi possível carregar a conversa com o Copiloto.', { cause: error });
  return (data || []).map(m => ({ id: m.id, autor: m.autor, texto: m.texto, estado: m.estado, encaminhar: m.encaminhar_para ?? null, quando: m.created_at }));
}
