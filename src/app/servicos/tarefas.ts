// Tarefas ligadas ao banco, no formato da lista genérica do v18 (ALTHIUS_MOD.tasks).
// O BDR vê (e cria) só as dele; gestores veem todas. Quem garante isso é o banco (RLS e funções task_*).
import type { SupabaseClient } from '@supabase/supabase-js';
import { diaCivil, prazoTexto } from './inicio';
import { falhaDoBanco, type Resultado } from './pipeline';
import { nomesDosMembros } from './nomes';

export interface TarefaLinha {
  id: string;
  titulo: string;
  tipo: string;
  conta: string;
  prazo: string;
  status: string;
  resp: string;
  respId: string;
  /** texto pronto / roteiro (nota da tarefa) */
  roteiro?: string;
  /** ordenação por prazo (ISO) */
  vence: string;
}

export interface TarefasTela {
  kpis: string[][];
  linhas: TarefaLinha[];
}

export const CANAL_TELA: Record<string, string> = {
  call: 'Ligação', email: 'E-mail', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', instagram: 'Instagram', reuniao: 'Reunião', crm: 'CRM', outro: 'Outro'
};
export const CANAL_BANCO: Record<string, string> = Object.fromEntries(Object.entries(CANAL_TELA).map(([k, v]) => [v, k]));
const STATUS_TELA: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
export const STATUS_BANCO: Record<string, string> = { Pendente: 'pendente', 'Em andamento': 'em_andamento', 'Concluída': 'concluida' };

export const tarefasVazias = (): TarefasTela => ({ kpis: [], linhas: [] });

export async function listarTarefas(cliente: SupabaseClient, workspaceId: string, agora = new Date()): Promise<TarefasTela> {
  const { data, error } = await cliente.from('tasks')
    .select('id, title, channel, status, due_at, note, assignee_member_id, completed_at, account:accounts(name)')
    .eq('workspace_id', workspaceId).order('due_at').limit(500);
  if (error) throw new Error('Não foi possível carregar as tarefas.', { cause: error });
  const nomes = await nomesDosMembros(cliente, (data || []).map(t => t.assignee_member_id as string), 'Não foi possível carregar os responsáveis das tarefas.');

  const linhas: TarefaLinha[] = (data || []).map(t => {
    const conta = (Array.isArray(t.account) ? t.account[0] : t.account) as { name: string } | null;
    const prazo = prazoTexto(t.due_at, agora);
    const atrasada = t.status !== 'concluida' && prazo.dias !== null && prazo.dias < 0;
    return {
      id: t.id, titulo: t.title, tipo: t.channel ? CANAL_TELA[t.channel] ?? t.channel : '—', conta: conta?.name ?? '—',
      prazo: t.status === 'concluida' ? prazo.texto.replace('Atrasada · ', '') : prazo.texto,
      status: atrasada ? 'Atrasada' : STATUS_TELA[t.status] ?? t.status, resp: nomes.get(t.assignee_member_id) || '—', respId: t.assignee_member_id,
      roteiro: t.note ?? undefined, vence: t.due_at
    };
  });

  const abertas = (data || []).filter(t => t.status !== 'concluida');
  const hoje = abertas.filter(t => diaCivil(new Date(t.due_at)) === diaCivil(agora)).length;
  const atrasadas = abertas.filter(t => diaCivil(new Date(t.due_at)) < diaCivil(agora)).length;
  const ligacoes = abertas.filter(t => t.channel === 'call').length;
  const semana = (data || []).filter(t => t.status === 'concluida' && t.completed_at && agora.getTime() - new Date(t.completed_at).getTime() <= 7 * 86400000).length;
  const kpis = [
    ['Para hoje', String(hoje), ''],
    ['Atrasadas', String(atrasadas), atrasadas ? 'pedem ação' : ''],
    ['Ligações pendentes', String(ligacoes), ''],
    ['Concluídas na semana', String(semana), 'últimos 7 dias']
  ];
  return { kpis, linhas };
}

export interface DadosTarefa {
  titulo: string;
  /** rótulo da tela: Ligação, E-mail... */
  canal: string;
  contaId: string | null;
  contatoId: string | null;
  responsavelId: string;
  agente: string | null;
  /** ISO */
  prazo: string;
  /** rótulo da tela: Pendente, Em andamento, Concluída */
  status: string;
  nota: string;
}

export async function criarTarefa(cliente: SupabaseClient, ws: string, membro: string, d: DadosTarefa): Promise<Resultado> {
  const { data, error } = await cliente.rpc('task_create', {
    p_workspace_id: ws, p_member_id: membro, p_title: d.titulo, p_channel: CANAL_BANCO[d.canal] ?? 'outro', p_account_id: d.contaId, p_contact_id: d.contatoId,
    p_assignee_member_id: d.responsavelId, p_agent_id: d.agente, p_due_at: d.prazo, p_status: STATUS_BANCO[d.status] ?? 'pendente', p_note: d.nota
  });
  if (error) return falhaDoBanco(error, 'Não foi possível criar a tarefa. Tente de novo.');
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

export async function mudarStatusTarefa(cliente: SupabaseClient, ws: string, membro: string, tarefaId: string, status: string): Promise<Resultado> {
  const { error } = await cliente.rpc('task_set_status', { p_workspace_id: ws, p_member_id: membro, p_task_id: tarefaId, p_status: STATUS_BANCO[status] ?? status });
  return error ? falhaDoBanco(error, 'Não foi possível atualizar a tarefa. Tente de novo.') : { ok: true };
}

export async function adiarTarefa(cliente: SupabaseClient, ws: string, membro: string, tarefaId: string, dias: number): Promise<Resultado> {
  const { error } = await cliente.rpc('task_postpone', { p_workspace_id: ws, p_member_id: membro, p_task_id: tarefaId, p_days: dias });
  return error ? falhaDoBanco(error, 'Não foi possível adiar a tarefa. Tente de novo.') : { ok: true };
}
