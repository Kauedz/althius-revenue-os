-- ==============================================================================
-- Migration: 20261002000093_audit_logs_politica.sql
-- Política de acesso do audit_logs (ADR 0040). Corrige dois achados do PR da corrente (ADR 0038):
--
-- 1. A política de INSERT da 0006 deixava qualquer membro logado gravar linha de auditoria direto
--    pela API (a linha falsa entrava encadeada, mas continuava falsa). Agora só o banco grava:
--    public.audit_write e as funções de sistema (SECURITY DEFINER, dona postgres) e o service_role.
-- 2. A política de leitura citava papéis que não existem mais (client_admin, strategist).
--    Pela matriz (capacidade admin) só o superadmin lê. O efeito prático não muda: a política
--    passa a dizer o que sempre valeu.
-- Também: anon e authenticated tinham todas as permissões de tabela (inclusive TRUNCATE, que o gatilho
-- de imutabilidade não pega). Passam a ter só SELECT (authenticated), e a RLS decide quem vê.
-- ==============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs for their workspace" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins and Strategists can view workspace audit logs" ON public.audit_logs;

CREATE POLICY "Superadmin le a auditoria do workspace"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['superadmin']));

REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
