// Conversa direta e PRIVADA de uma pessoa com um agente (migration 124, ADR 0059). É um canal de um tipo próprio: as mensagens
// são lidas e enviadas pelo mesmo caminho dos canais (`lerMensagens`, `enviarNoCanal`); aqui ficam só abrir, listar, renomear
// e arquivar. Falha do banco vira mensagem clara: nunca uma lista ou uma resposta inventada.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConversaDireta {
  slug: string;
  titulo: string;
  /** "agora", "09:05", "ontem" ou "28 set" */
  quando: string;
  ultima: string | null;
  /** o agente ainda não respondeu (a mensagem está na fila ou em andamento) */
  aguardando: boolean;
}

export type ResultadoConversa = { ok: true } | { ok: false; mensagem: string };
const FALHA = 'Não foi possível concluir agora. Tente de novo.';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const segundos = (agora.getTime() - d.getTime()) / 1000;
  if (segundos < 60) return 'agora';
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return String(d.getDate()).padStart(2, '0') + ' ' + MESES[d.getMonth()];
}

/** O título da conversa nasce da primeira mensagem: uma linha, até 40 caracteres. */
export function tituloDaPrimeiraMensagem(texto: string): string {
  const linha = texto.replace(/\s+/g, ' ').trim();
  if (!linha) return 'Nova conversa';
  return linha.length <= 40 ? linha : linha.slice(0, 39).trimEnd() + '…';
}

export async function listarConversas(cliente: SupabaseClient, workspaceId: string, membroId: string, agente: string, agora: Date = new Date()): Promise<ConversaDireta[]> {
  const { data, error } = await cliente.rpc('agent_direct_list', { p_workspace_id: workspaceId, p_member_id: membroId, p_agente: agente });
  if (error) throw new Error('Não foi possível carregar as conversas.', { cause: error });
  if (!Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map(c => ({
    slug: String(c.slug),
    titulo: typeof c.titulo === 'string' && c.titulo ? c.titulo : 'Nova conversa',
    quando: quandoFoi(String(c.atualizada_em ?? ''), agora),
    ultima: typeof c.ultima === 'string' ? c.ultima : null,
    aguardando: c.aguardando === true
  }));
}

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>) {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false as const, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : FALHA };
  }
  const d = (data ?? {}) as { ok?: boolean; slug?: string; erro?: string };
  return d.ok ? { ok: true as const, slug: d.slug } : { ok: false as const, mensagem: d.erro || FALHA };
}

export async function abrirConversa(cliente: SupabaseClient, workspaceId: string, membroId: string, agente: string, titulo?: string): Promise<{ ok: true; slug: string } | { ok: false; mensagem: string }> {
  const r = await chamar(cliente, 'agent_direct_create', { p_workspace_id: workspaceId, p_member_id: membroId, p_agente: agente, p_titulo: titulo ?? null });
  return r.ok && r.slug ? { ok: true, slug: r.slug } : { ok: false, mensagem: r.ok ? FALHA : r.mensagem };
}

export async function renomearConversa(cliente: SupabaseClient, workspaceId: string, membroId: string, slug: string, titulo: string): Promise<ResultadoConversa> {
  const r = await chamar(cliente, 'agent_direct_title', { p_workspace_id: workspaceId, p_member_id: membroId, p_slug: slug, p_titulo: titulo });
  return r.ok ? { ok: true } : r;
}

export async function arquivarConversa(cliente: SupabaseClient, workspaceId: string, membroId: string, slug: string): Promise<ResultadoConversa> {
  const r = await chamar(cliente, 'agent_direct_archive', { p_workspace_id: workspaceId, p_member_id: membroId, p_slug: slug });
  return r.ok ? { ok: true } : r;
}
