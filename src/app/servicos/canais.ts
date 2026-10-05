// Canais: chat do time com os agentes. A RLS decide quem vê; só funções gravam (migration 0088).
// O agente chamado no canal vira pedido na fila (política Hermes); a resposta dele chega quando o motor terminar.
import type { SupabaseClient } from '@supabase/supabase-js';
import { nomesDosMembros } from './nomes';
import { AGENTES_EXIBICAO } from '../agentes-exibicao';

/** Formato que a tela de Canais do v18 lê (this.canais()). */
export interface CanalTela {
  id: string;
  desc: string;
  novas: number;
  geral: boolean;
  pessoas: string[];
  agentes: string[];
  criador: string;
}

export interface Reacao { n: number; minha: boolean; quem: string[] }

export interface MensagemTela {
  id: string;
  sigla: string;
  autor: string;
  agente: boolean;
  hora: string;
  texto: string;
  editada: boolean;
  resp: { autor: string; texto: string } | null;
  reacoes: Record<string, Reacao>;
}

const AGENTE: Record<string, [nome: string, sigla: string]> = Object.fromEntries(Object.entries(AGENTES_EXIBICAO).map(([codigo, ag]) => [codigo, [ag.nome, ag.sigla]]));
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const sigla = (nome: string) => nome.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

function hora(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias <= 0) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (dias === 1) return 'Ontem';
  return String(d.getDate()).padStart(2, '0') + ' ' + MESES[d.getMonth()];
}

export async function listarCanais(cliente: SupabaseClient, workspaceId: string): Promise<CanalTela[]> {
  const { data: canais, error } = await cliente
    .from('chat_channels')
    .select('id, slug, description, is_general, created_by, created_at')
    .eq('workspace_id', workspaceId)
    .order('is_general', { ascending: true })
    .order('created_at');
  if (error) throw new Error('Não foi possível carregar os canais.', { cause: error });
  if (!canais?.length) return [];
  const ids = canais.map(c => c.id);
  const [pessoas, agentes, todos] = await Promise.all([
    cliente.from('chat_channel_members').select('channel_id, member_id').in('channel_id', ids),
    cliente.from('chat_channel_agents').select('channel_id, agent_id').in('channel_id', ids),
    cliente.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('status', 'active')
  ]);
  for (const r of [pessoas, agentes, todos]) if (r.error) throw new Error('Não foi possível carregar os canais.', { cause: r.error });
  const membroIds = (todos.data || []).map(m => m.id as string);
  const nomes = await nomesDosMembros(cliente, membroIds.concat(canais.map(c => c.created_by as string).filter(Boolean)), 'Não foi possível carregar os canais.');
  const ORDEM_AGENTES = ['comercial', 'marketing', 'copy', 'revops'];
  return canais.map(c => ({
    id: c.slug,
    desc: c.description || 'Canal do time',
    novas: 0,
    geral: c.is_general,
    pessoas: (c.is_general ? membroIds : (pessoas.data || []).filter(p => p.channel_id === c.id).map(p => p.member_id as string))
      .map(id => nomes.get(id) || '').filter(Boolean),
    agentes: (agentes.data || []).filter(a => a.channel_id === c.id).map(a => a.agent_id as string).sort((x, y) => ORDEM_AGENTES.indexOf(x) - ORDEM_AGENTES.indexOf(y)),
    criador: (c.created_by && nomes.get(c.created_by)) || ''
  }));
}

export async function lerMensagens(cliente: SupabaseClient, workspaceId: string, slug: string, meuMembroId: string): Promise<MensagemTela[]> {
  const { data: canal, error: erroCanal } = await cliente.from('chat_channels').select('id').eq('workspace_id', workspaceId).eq('slug', slug).maybeSingle();
  if (erroCanal) throw new Error('Não foi possível carregar as mensagens.', { cause: erroCanal });
  if (!canal) return [];
  const { data, error } = await cliente
    .from('chat_messages')
    .select('id, sender_type, sender_member_id, sender_agent_id, content, metadata, created_at')
    .eq('channel_id', canal.id)
    .order('created_at')
    .limit(500);
  if (error) throw new Error('Não foi possível carregar as mensagens.', { cause: error });
  const reacoesIds = (data || []).flatMap(m => Object.values((m.metadata?.reacoes || {}) as Record<string, string[]>).flat());
  const nomes = await nomesDosMembros(cliente, (data || []).map(m => m.sender_member_id as string).filter(Boolean).concat(reacoesIds),
    'Não foi possível carregar as mensagens.');
  return (data || []).map(m => {
    const [autor, sig] = m.sender_type === 'agent' ? AGENTE[m.sender_agent_id as string] || ['Agente', 'AG']
      : m.sender_type === 'system' ? ['Althius', 'AL'] : [nomes.get(m.sender_member_id as string) || '—', ''];
    const reacoes: Record<string, Reacao> = {};
    for (const [emoji, quem] of Object.entries((m.metadata?.reacoes || {}) as Record<string, string[]>)) {
      reacoes[emoji] = { n: quem.length, minha: quem.includes(meuMembroId), quem: quem.map(id => nomes.get(id) || '').filter(Boolean) };
    }
    return {
      id: m.id, autor, sigla: sig || sigla(autor), agente: m.sender_type !== 'member', hora: hora(m.created_at), texto: m.content,
      editada: !!m.metadata?.editada, resp: m.metadata?.resp || null, reacoes
    };
  });
}

export type ResultadoCanal = { ok: true } | { ok: false; mensagem: string };
const FALHA = 'Não foi possível concluir agora. Tente de novo.';

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>) {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false as const, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : FALHA };
  }
  return data?.ok ? { ok: true as const, data } : { ok: false as const, mensagem: (data?.erro as string) || FALHA };
}

export async function criarCanal(
  cliente: SupabaseClient, workspaceId: string, membroId: string, canal: { nome: string; desc: string; pessoas: string[]; agentes: string[] }
): Promise<{ ok: true; slug: string } | { ok: false; mensagem: string }> {
  const r = await chamar(cliente, 'chat_create_channel', { p_workspace_id: workspaceId, p_member_id: membroId, p_nome: canal.nome,
    p_descricao: canal.desc, p_pessoas: canal.pessoas, p_agentes: canal.agentes });
  return r.ok ? { ok: true, slug: r.data.slug } : r;
}

export async function mudarCanal(cliente: SupabaseClient, workspaceId: string, membroId: string, slug: string, pessoas: string[], agentes: string[]): Promise<ResultadoCanal> {
  const r = await chamar(cliente, 'chat_update_channel', { p_workspace_id: workspaceId, p_member_id: membroId, p_slug: slug, p_pessoas: pessoas, p_agentes: agentes });
  return r.ok ? { ok: true } : r;
}

export async function arquivarCanal(cliente: SupabaseClient, workspaceId: string, membroId: string, slug: string): Promise<ResultadoCanal> {
  const r = await chamar(cliente, 'chat_archive_channel', { p_workspace_id: workspaceId, p_member_id: membroId, p_slug: slug });
  return r.ok ? { ok: true } : r;
}

export async function enviarNoCanal(
  cliente: SupabaseClient, workspaceId: string, membroId: string, slug: string, texto: string,
  resposta: { autor: string; texto: string } | null, agente: string | null
): Promise<ResultadoCanal> {
  const r = await chamar(cliente, 'chat_send', { p_workspace_id: workspaceId, p_member_id: membroId, p_slug: slug, p_texto: texto,
    p_resposta: resposta, p_agente: agente });
  return r.ok ? { ok: true } : r;
}

export async function editarMensagem(cliente: SupabaseClient, workspaceId: string, membroId: string, mensagemId: string, texto: string): Promise<ResultadoCanal> {
  const r = await chamar(cliente, 'chat_edit_message', { p_workspace_id: workspaceId, p_member_id: membroId, p_message_id: mensagemId, p_texto: texto });
  return r.ok ? { ok: true } : r;
}

export async function reagir(cliente: SupabaseClient, workspaceId: string, membroId: string, mensagemId: string, emoji: string): Promise<ResultadoCanal> {
  const r = await chamar(cliente, 'chat_react', { p_workspace_id: workspaceId, p_member_id: membroId, p_message_id: mensagemId, p_emoji: emoji });
  return r.ok ? { ok: true } : r;
}
