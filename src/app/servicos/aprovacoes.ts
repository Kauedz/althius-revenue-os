// Aprovações: fila pendente do workspace no formato que a tela do v18 lê
// (fonte/data.js -> APPROVALS) e decisão gravada pelo banco (approval_decide).
import type { SupabaseClient } from '@supabase/supabase-js';

/** Item da fila, nos nomes de campo do protótipo, mais o conteúdo aprovado (para o hash de uso único). */
export interface AprovacaoTela {
  id: string;
  tipo: string;
  titulo: string;
  solicitante: string;
  agente: string | null;
  motivo: string;
  impacto: string;
  previa: string;
  creditos: number;
  prazo: string;
  historico: string[];
  conteudo: unknown;
}

/** Rótulos da tela. Os de gasto contêm "Orçamento" ou "acima de limite": é assim que o v18 reconhece gasto. */
export const ROTULO_TIPO: Record<string, string> = {
  copy: 'Copy',
  lista: 'Lista',
  crm: 'Alteração de CRM',
  execucao: 'Execução',
  orcamento: 'Orçamento',
  execucao_limite: 'Execução acima de limite',
  creditos: 'Orçamento · compra de créditos'
};

export type DecisaoTela = 'Aprovada' | 'Rejeitada' | 'Ajustes solicitados';
const DECISAO_BANCO: Record<DecisaoTela, string> = {
  Aprovada: 'aprovado',
  Rejeitada: 'rejeitado',
  'Ajustes solicitados': 'ajustes_solicitados'
};

const MENSAGEM: Record<string, string> = {
  unauthorized_decider_for_spend: 'Só o C-level ou o superadmin aprovam gastos. O pedido continua na fila.',
  unauthorized_decider_for_operation: 'Seu papel não decide esta aprovação.',
  payload_tampered_hash_mismatch: 'O conteúdo mudou depois do pedido. Esta aprovação foi invalidada e precisa ser pedida de novo.',
  approval_already_processed: 'Esta aprovação já foi decidida por outra pessoa.',
  ajuste_sem_texto: 'Diga o que precisa ser ajustado.',
  approval_not_found: 'Esta aprovação não existe mais.'
};
const MENSAGEM_GENERICA = 'Não foi possível registrar a decisão agora. Tente de novo em instantes.';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Prazo como a tela mostra: "Hoje, 14:00", "Amanhã", "Ter, 09:00", "20 out" ou "Venceu 01 out". */
export function formatarPrazo(iso: string | null, agora = new Date()): string {
  if (!iso) return '—';
  const prazo = new Date(iso);
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferencaDias = Math.round((dia(prazo) - dia(agora)) / 86_400_000);
  const hora = doisDigitos(prazo.getHours()) + ':' + doisDigitos(prazo.getMinutes());
  const data = doisDigitos(prazo.getDate()) + ' ' + MESES[prazo.getMonth()];
  if (diferencaDias < 0) return 'Venceu ' + data;
  if (diferencaDias === 0) return 'Hoje, ' + hora;
  if (diferencaDias === 1) return 'Amanhã';
  if (diferencaDias < 7) return DIAS[prazo.getDay()] + ', ' + hora;
  return data.replace(/^0/, '');
}

/** Fila de aprovações pendentes do workspace. A RLS devolve vazio para quem não decide nem pediu. */
export async function listarAprovacoes(cliente: SupabaseClient, workspaceId: string): Promise<AprovacaoTela[]> {
  const { data, error } = await cliente.from('approvals')
    .select('id, approval_type, title, requested_by_member_id, agent_code, reason, impact, preview, estimated_credits, deadline_at, history, payload_json')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pendente')
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .order('created_at');
  if (error) throw new Error('Não foi possível carregar as aprovações.', { cause: error });
  if (!data.length) return [];

  const nomes = await nomesDosMembros(cliente, [...new Set(data.map(a => a.requested_by_member_id as string))]);
  return data.map(a => ({
    id: a.id,
    tipo: ROTULO_TIPO[a.approval_type] || a.approval_type,
    titulo: a.title,
    solicitante: nomes.get(a.requested_by_member_id) || 'Alguém do time',
    agente: a.agent_code,
    motivo: a.reason || '',
    impacto: a.impact || '',
    previa: a.preview || '',
    creditos: a.estimated_credits || 0,
    prazo: formatarPrazo(a.deadline_at),
    historico: Array.isArray(a.history) ? a.history.map(String) : [],
    conteudo: a.payload_json
  }));
}

async function nomesDosMembros(cliente: SupabaseClient, membroIds: string[]): Promise<Map<string, string>> {
  if (!membroIds.length) return new Map();
  const { data: membros, error: erroMembros } = await cliente.from('workspace_members').select('id, user_id').in('id', membroIds);
  if (erroMembros) throw new Error('Não foi possível carregar os solicitantes das aprovações.', { cause: erroMembros });
  const userIds = [...new Set((membros || []).map(m => m.user_id))];
  const { data: perfis, error: erroPerfis } = userIds.length
    ? await cliente.from('profiles').select('id, name').in('id', userIds)
    : { data: [] as Array<{ id: string; name: string }>, error: null };
  if (erroPerfis) throw new Error('Não foi possível carregar os solicitantes das aprovações.', { cause: erroPerfis });
  const nomePorUser = new Map((perfis || []).map(p => [p.id, p.name]));
  return new Map((membros || []).map(m => [m.id, nomePorUser.get(m.user_id) || '']));
}

export type ResultadoDecisao = { ok: true } | { ok: false; mensagem: string };

/** Grava a decisão. O banco confere papel, alçada de gasto, conteúdo (hash) e uso único. */
export async function decidirAprovacao(
  cliente: SupabaseClient,
  pedido: { aprovacao: Pick<AprovacaoTela, 'id' | 'conteudo'>; membroId: string; decisao: DecisaoTela; notas?: string }
): Promise<ResultadoDecisao> {
  const { data, error } = await cliente.rpc('approval_decide', {
    p_approval_id: pedido.aprovacao.id,
    p_decider_member_id: pedido.membroId,
    p_decision: DECISAO_BANCO[pedido.decisao],
    p_payload_to_verify: pedido.aprovacao.conteudo,
    p_notes: pedido.notas ?? null
  });
  if (error) {
    console.error('[decidirAprovacao]', error);
    return { ok: false, mensagem: error.code === '42501' ? 'Você não tem permissão para esta decisão.' : MENSAGEM_GENERICA };
  }
  if (data?.success) return { ok: true };
  return { ok: false, mensagem: MENSAGEM[data?.status] || MENSAGEM_GENERICA };
}
