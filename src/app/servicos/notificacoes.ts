// Notificações funcionais por membro e marcação como lida (ADR 0036).
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificacaoTupla = [
  titulo: string,
  texto: string,
  quando: string,
  id: string,
  lida: boolean
];

export interface NotificacaoRegistro {
  id: string;
  workspace_id: string;
  recipient_member_id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export function formatarTempoRelativo(dataIso: string, agora = new Date()): string {
  const d = new Date(dataIso);
  const diffSegundos = Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 1000));
  if (diffSegundos < 60) return 'agora';
  const diffMinutos = Math.floor(diffSegundos / 60);
  if (diffMinutos < 60) return `há ${diffMinutos} min`;
  const diffHoras = Math.floor(diffMinutos / 60);
  if (diffHoras < 24) return `há ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return 'ontem';
  return `há ${diffDias} d`;
}

export async function listarNotificacoes(
  cliente: SupabaseClient,
  workspaceId: string,
  membroId: string
): Promise<NotificacaoTupla[]> {
  const { data, error } = await cliente
    .from('notifications')
    .select('id, workspace_id, recipient_member_id, type, title, body, read_at, created_at')
    .eq('workspace_id', workspaceId)
    .eq('recipient_member_id', membroId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    throw new Error('Não foi possível carregar as notificações.', { cause: error });
  }

  return (data as NotificacaoRegistro[]).map(n => [
    n.title,
    n.body || '',
    formatarTempoRelativo(n.created_at),
    n.id,
    Boolean(n.read_at)
  ]);
}

export async function marcarNotificacoesComoLidas(
  cliente: SupabaseClient,
  membroId: string,
  notificacaoId?: string
): Promise<void> {
  const { error } = await cliente.rpc('mark_notifications_read', {
    p_member_id: membroId,
    p_notification_id: notificacaoId ?? null
  });

  if (error) {
    throw new Error('Não foi possível marcar as notificações como lidas.', { cause: error });
  }
}