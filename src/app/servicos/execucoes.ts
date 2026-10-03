import type { SupabaseClient } from '@supabase/supabase-js';
const STATUS: Record<string,string> = { pending_approval:'Aguardando aprovação',scheduled:'Agendada',queued:'Na fila',reserving_credits:'Reservando créditos',running:'Em execução',paused:'Pausada',completed:'Concluída',partial:'Concluída parcialmente',failed:'Falhou',cancelled:'Cancelada' };
export interface ExecucaoTela {
  id:string; titulo:string; tipo:string; agente:string|null; campanha:string; solicitante:string; horario:string;
  status:string; progresso:number; processados:number; validos:number; credEst:number; credRes:number; credCons:number;
  plano:string[]; etapaAtual:number; logs:string[]; erros:string[]; integracoes:string[]; aprovacao:string; custo?:string;
}
export async function listarExecucoes(cliente: SupabaseClient, workspaceId:string, custos=false):Promise<ExecucaoTela[]> {
  const {data,error}=await cliente.from('executions').select('id,title,execution_type,agent_code,campaign_name,requested_by_member_id,requester_label,display_time,created_at,status,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).order('id',{ascending:false});
  if(error || !data) throw new Error('Não foi possível carregar as execuções.',{cause:error});
  const ids=[...new Set(data.filter(e=>!e.requester_label).map(e=>e.requested_by_member_id))];
  const {data:membros,error:erroMembros}=ids.length?await cliente.from('workspace_members').select('id,user_id').in('id',ids):{data:[],error:null};
  if(erroMembros) throw new Error('Não foi possível carregar os solicitantes.',{cause:erroMembros});
  const users=[...new Set((membros||[]).map(m=>m.user_id))];
  const {data:perfis,error:erroPerfis}=users.length?await cliente.from('profiles').select('id,name').in('id',users):{data:[],error:null};
  if(erroPerfis) throw new Error('Não foi possível carregar os solicitantes.',{cause:erroPerfis});
  const nomes=new Map((perfis||[]).map(p=>[p.id,p.name]));
  const porMembro=new Map((membros||[]).map(m=>[m.id,nomes.get(m.user_id)]));
  const porExecucao=new Map<string,number>();
  if(custos) {
    const resp=await cliente.rpc('execution_costs',{p_workspace_id:workspaceId});
    if(resp.error) throw new Error('Não foi possível carregar os custos reais.',{cause:resp.error});
    for(const custo of resp.data||[]) porExecucao.set(custo.execution_id,Number(custo.cost_usd));
  }
  return data.map(e=>{
    const solicitante=e.requester_label || porMembro.get(e.requested_by_member_id);
    if(!solicitante) throw new Error('Não foi possível identificar o solicitante da execução.');
    if(!STATUS[e.status]) throw new Error('O estado da execução não é reconhecido.');
    return {id:e.id,titulo:e.title,tipo:e.execution_type,agente:e.agent_code,campanha:e.campaign_name,solicitante,
      horario:e.display_time || new Date(e.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),status:STATUS[e.status],
      progresso:e.progress,processados:e.processed_count,validos:e.valid_count,credEst:e.estimated_credits,credRes:e.reserved_credits,credCons:e.actual_credits,
      plano:e.plan,etapaAtual:e.current_step,logs:e.logs,erros:e.errors,integracoes:e.integrations,aprovacao:e.approval_label,
      ...(custos?{custo:porExecucao.has(e.id)?'US$ '+porExecucao.get(e.id)!.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}:{})};
  });
}
export async function controlarExecucao(cliente:SupabaseClient,id:string,membroId:string,acao:'pause'|'resume'|'cancel'|'repeat') {
  const {data,error}=await cliente.rpc('execution_control',{p_execution_id:id,p_member_id:membroId,p_action:acao});
  if(error) throw new Error(error.code==='42501'?'Você não tem permissão para controlar esta execução.':'Não foi possível registrar o controle da execução.',{cause:error});
  if(!data?.success) throw new Error(data?.reason || 'O controle da execução não foi registrado.');
  return data as {success:true;status:string;execution_id?:string;approval_id?:string};
}