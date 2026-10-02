-- ==============================================================================
-- Migration: 20261002000006_audit_logs.sql
-- Ticket 09: Setup de Auditoria Imutável (audit_logs) e Telemetria
-- ==============================================================================

-- 1. Create audit_logs table (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  actor_user_id UUID,
  actor_member_id UUID,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 
  'Trilha de auditoria append-only imutável para eventos críticos de segurança, permissões e aprovações.';

-- 2. Trigger function to enforce immutability (block UPDATE or DELETE)
CREATE OR REPLACE FUNCTION public.enforce_audit_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é uma tabela append-only imutável. Operações de UPDATE ou DELETE são estritamente proibidas.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_audit_log_immutability();

-- 3. Indices for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created
  ON public.audit_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
  ON public.audit_logs (workspace_id, entity_type, entity_id);

-- 4. Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Strategists can view workspace audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['superadmin', 'client_admin', 'strategist'])
  );

CREATE POLICY "Authenticated users can insert audit logs for their workspace"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id)
  );
