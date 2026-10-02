import { supabase } from '../lib/supabase';

export interface AuditLogEntry {
  workspaceId: string;
  actorUserId?: string;
  actorMemberId?: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    workspace_id: entry.workspaceId,
    actor_user_id: entry.actorUserId,
    actor_member_id: entry.actorMemberId,
    actor_role: entry.actorRole,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    old_values: entry.oldValues,
    new_values: entry.newValues,
    ip_address: entry.ipAddress,
    user_agent: entry.userAgent,
  });

  if (error) {
    console.error('[Audit Log Error] Falha ao registrar evento de auditoria:', error.message);
  }
}
