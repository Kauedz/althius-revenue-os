import type { SupabaseClient } from '@supabase/supabase-js';

export type CanalTarefa = 'call' | 'email' | 'whatsapp' | 'linkedin' | 'instagram' | 'outro';
export type StatusTarefa = 'pendente' | 'em_andamento' | 'concluida';
export interface NovaTarefa {
  titulo: string; responsavelId: string; prazo: string; canal: CanalTarefa;
  contaId?: string; contatoId?: string; nota?: string; agenteId?: string; status?: StatusTarefa;
}
export interface Tarefa extends NovaTarefa { id: string; workspaceId: string; status: StatusTarefa; origem: string; concluidaEm: string | null }
interface LinhaTarefa {
  id: string; workspace_id: string; title: string; assignee_member_id: string; due_at: string;
  channel: CanalTarefa; account_id: string | null; contact_id: string | null; note: string | null;
  agent_id: string | null; status: StatusTarefa; source: string; completed_at: string | null;
}
const daLinha = (t: LinhaTarefa): Tarefa => ({
  id:t.id,workspaceId:t.workspace_id,titulo:t.title,responsavelId:t.assignee_member_id,prazo:t.due_at,
  canal:t.channel,contaId:t.account_id || undefined,contatoId:t.contact_id || undefined,
  nota:t.note || undefined,agenteId:t.agent_id || undefined,status:t.status,origem:t.source,concluidaEm:t.completed_at
});
function falha(mensagem:string,causa:unknown):Error {
  return new Error(mensagem+' Tentar de novo.',{cause:causa});
}
export async function listarTarefas(cliente:SupabaseClient,workspaceId:string):Promise<Tarefa[]> {
  try {
    const r=await cliente.from('tasks').select('id,workspace_id,title,assignee_member_id,due_at,channel,account_id,contact_id,note,agent_id,status,source,completed_at')
      .eq('workspace_id',workspaceId).order('due_at').order('id');
    if(r.error || !r.data) throw r.error || new Error('Resposta sem dados.');
    return r.data.map(daLinha);
  } catch(erro) { throw falha('Não foi possível carregar as tarefas.',erro); }
}
export async function criarTarefa(cliente:SupabaseClient,workspaceId:string,membroId:string,chave:string,tarefa:NovaTarefa):Promise<Tarefa> {
  let r;
  try {
    r=await cliente.rpc('task_create',{
      p_workspace_id:workspaceId,p_member_id:membroId,p_idempotency_key:chave,
      p_task:{title:tarefa.titulo,assignee_member_id:tarefa.responsavelId,due_at:tarefa.prazo,channel:tarefa.canal,
        account_id:tarefa.contaId,contact_id:tarefa.contatoId,note:tarefa.nota,agent_id:tarefa.agenteId,status:tarefa.status || 'pendente'}
    });
  } catch(erro) { throw falha('Não foi possível registrar a tarefa.',erro); }
  if(r.error || !r.data?.id) throw falha(r.error?.code==='42501' || r.error?.code==='22023' ? r.error.message : 'Não foi possível registrar a tarefa.',r.error);
  return daLinha(r.data);
}
/** Registra a conclusão. A RPC não chama provedores de mensagens. */
export async function concluirTarefa(cliente:SupabaseClient,membroId:string,tarefaId:string):Promise<void> {
  let r;
  try { r=await cliente.rpc('task_send_now',{p_task_id:tarefaId,p_member_id:membroId}); }
  catch(erro) { throw falha('Não foi possível concluir a tarefa.',erro); }
  if(r.error || r.data?.status!=='concluida') throw falha(r.error?.code==='42501' ? r.error.message : 'Não foi possível concluir a tarefa.',r.error);
}
export async function adiarTarefa(cliente:SupabaseClient,membroId:string,tarefaId:string,prazo:string):Promise<Tarefa> {
  let r;
  try { r=await cliente.rpc('task_reschedule',{p_task_id:tarefaId,p_member_id:membroId,p_due_at:prazo}); }
  catch(erro) { throw falha('Não foi possível adiar a tarefa.',erro); }
  if(r.error || !r.data?.id) throw falha(['42501','22023','23514'].includes(r.error?.code || '') ? r.error!.message : 'Não foi possível adiar a tarefa.',r.error);
  return daLinha(r.data);
}