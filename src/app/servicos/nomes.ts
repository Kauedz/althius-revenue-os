// Nome de exibição dos membros (workspace_members → profiles). Falha vira erro claro, nunca nome inventado.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function nomesDosMembros(cliente: SupabaseClient, membroIds: string[], mensagemDeErro: string): Promise<Map<string, string>> {
  const ids = [...new Set(membroIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data: membros, error: erroMembros } = await cliente.from('workspace_members').select('id, user_id').in('id', ids);
  if (erroMembros) throw new Error(mensagemDeErro, { cause: erroMembros });
  const userIds = [...new Set((membros || []).map(m => m.user_id))];
  const { data: perfis, error: erroPerfis } = userIds.length
    ? await cliente.from('profiles').select('id, name').in('id', userIds)
    : { data: [] as Array<{ id: string; name: string }>, error: null };
  if (erroPerfis) throw new Error(mensagemDeErro, { cause: erroPerfis });
  const nomePorUser = new Map((perfis || []).map(p => [p.id, p.name]));
  return new Map((membros || []).map(m => [m.id, nomePorUser.get(m.user_id) || '']));
}
