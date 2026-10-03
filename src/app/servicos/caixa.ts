// Caixa de entrada: só conversas com contatos do CRM (o filtro fica no banco, na chegada da mensagem).
// A RLS decide quem vê o quê: BDR só a própria conexão; C-level, estrategista e superadmin leem.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConversaTela {
  id: string;
  de: string;
  assunto: string;
  canal: string;
  intencao: string;
  quando: string;
  conta: string;
}

export interface CaixaTela {
  kpis: Array<[rotulo: string, valor: string, detalhe: string]>;
  linhas: ConversaTela[];
}

const CANAL: Record<string, string> = { email: 'E-mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', instagram: 'Instagram' };
const INTENCAO: Record<string, string> = {
  positiva: 'Positiva', adiar: 'Adiar', objecao: 'Objeção', neutra: 'Neutra', opt_out: 'Opt-out', automatica: 'Automática'
};
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dd = (n: number) => String(n).padStart(2, '0');

export function formatarQuando(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias <= 0) return dd(d.getHours()) + ':' + dd(d.getMinutes());
  if (dias === 1) return 'Ontem';
  if (dias < 7) return DIAS[d.getDay()];
  return dd(d.getDate()) + ' ' + MESES[d.getMonth()];
}

function tempoMedioDeResposta(mensagens: Array<{ conversation_id: string; direction: string; created_at: string }>): string {
  // Para cada mensagem recebida, o tempo até a primeira resposta enviada depois dela na mesma conversa.
  const esperas: number[] = [];
  const pendente = new Map<string, number>();
  for (const m of mensagens) {
    const t = new Date(m.created_at).getTime();
    if (m.direction === 'in') { if (!pendente.has(m.conversation_id)) pendente.set(m.conversation_id, t); }
    else if (pendente.has(m.conversation_id)) { esperas.push(t - pendente.get(m.conversation_id)!); pendente.delete(m.conversation_id); }
  }
  if (!esperas.length) return '—';
  const minutos = Math.round(esperas.reduce((s, e) => s + e, 0) / esperas.length / 60_000);
  return minutos < 60 ? `${minutos} min` : `${Math.round(minutos / 60)} h`;
}

export async function listarCaixa(cliente: SupabaseClient, workspaceId: string, agora = new Date()): Promise<CaixaTela> {
  const { data: conversas, error } = await cliente
    .from('conversations')
    .select('id, channel, intent, unread, last_message_at, contact:contacts(name), account:accounts(name)')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar a caixa de entrada.', { cause: error });
  const ids = (conversas || []).map(c => c.id);
  const { data: mensagens, error: erroMensagens } = ids.length
    ? await cliente.from('messages').select('conversation_id, direction, text, created_at').in('conversation_id', ids).order('created_at')
    : { data: [] as Array<{ conversation_id: string; direction: string; text: string; created_at: string }>, error: null };
  if (erroMensagens) throw new Error('Não foi possível carregar as mensagens.', { cause: erroMensagens });

  const ultimaRecebida = new Map<string, string>();
  for (const m of mensagens || []) if (m.direction === 'in') ultimaRecebida.set(m.conversation_id, m.text);
  const semana = agora.getTime() - 7 * 86_400_000;
  const lista = conversas || [];
  const nome = (x: unknown) => (x as { name?: string } | null)?.name || '—';

  return {
    kpis: [
      ['Não lidas', String(lista.filter(c => c.unread).length), ''],
      ['Positivas', String(lista.filter(c => c.intent === 'positiva' && new Date(c.last_message_at).getTime() >= semana).length), 'na semana'],
      ['Objeções', String(lista.filter(c => c.intent === 'objecao').length), ''],
      ['Tempo de resposta', tempoMedioDeResposta(mensagens || []), 'média']
    ],
    linhas: lista.map(c => ({
      id: c.id,
      de: nome(c.contact),
      assunto: ultimaRecebida.get(c.id) || '—',
      canal: CANAL[c.channel] || c.channel,
      intencao: INTENCAO[c.intent || 'neutra'] || 'Neutra',
      quando: formatarQuando(c.last_message_at, agora),
      conta: nome(c.account)
    }))
  };
}

export type ResultadoCaixa = { ok: true } | { ok: false; mensagem: string };

async function chamar(cliente: SupabaseClient, funcao: string, workspaceId: string, membroId: string, conversaId: string, falha: string) {
  const { data, error } = await cliente.rpc(funcao, { p_workspace_id: workspaceId, p_member_id: membroId, p_conversation_id: conversaId });
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false as const, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : falha };
  }
  return data?.ok ? { ok: true as const, data } : { ok: false as const, mensagem: (data?.erro as string) || falha };
}

export async function marcarLida(cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string): Promise<ResultadoCaixa> {
  const r = await chamar(cliente, 'inbox_mark_read', workspaceId, membroId, conversaId, 'Não foi possível abrir a conversa.');
  return r.ok ? { ok: true } : r;
}

export async function pedirSugestaoDeResposta(
  cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string
): Promise<{ ok: true; execucaoId: string } | { ok: false; mensagem: string }> {
  const r = await chamar(cliente, 'inbox_request_reply', workspaceId, membroId, conversaId, 'Não foi possível pedir a sugestão. Tente de novo.');
  return r.ok ? { ok: true, execucaoId: r.data.execution_id } : r;
}

export async function excluirContatoDoCrm(cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string): Promise<ResultadoCaixa> {
  const r = await chamar(cliente, 'inbox_opt_out', workspaceId, membroId, conversaId, 'Não foi possível excluir o contato. Tente de novo.');
  return r.ok ? { ok: true } : r;
}

/** Conexões pessoais da pessoa logada neste workspace, no formato que o v18 lê (inboxCon). */
export type ConexoesTela = Record<'email' | 'linkedin' | 'whatsapp' | 'instagram', { conta: string; via?: string } | null>;

const VIA_EMAIL: Record<string, string> = { google: 'gmail', microsoft: 'outlook', imap: 'imap' };

export async function minhasConexoes(cliente: SupabaseClient, workspaceId: string): Promise<ConexoesTela> {
  const { data: usuario } = await cliente.auth.getUser();
  const conexoes: ConexoesTela = { email: null, linkedin: null, whatsapp: null, instagram: null };
  if (!usuario.user) return conexoes;
  const { data, error } = await cliente
    .from('messaging_accounts')
    .select('provider, display_name, status, member:workspace_members!inner(user_id)')
    .eq('workspace_id', workspaceId)
    .eq('member.user_id', usuario.user.id)
    .eq('status', 'connected');
  if (error) throw new Error('Não foi possível carregar suas conexões.', { cause: error });
  for (const c of data || []) {
    const conta = c.display_name || '—';
    if (VIA_EMAIL[c.provider]) conexoes.email = { conta, via: VIA_EMAIL[c.provider] };
    else if (c.provider === 'linkedin' || c.provider === 'whatsapp' || c.provider === 'instagram') conexoes[c.provider as 'linkedin' | 'whatsapp' | 'instagram'] = { conta };
  }
  return conexoes;
}
