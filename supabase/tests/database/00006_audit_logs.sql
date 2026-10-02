-- ==============================================================================
-- Test: 00006_audit_logs.sql
-- Verifies Ticket 09 - Immutability and RLS of audit_logs
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Check table existence
SELECT has_table('public', 'audit_logs', 'Tabela public.audit_logs deve existir');

-- 2. Setup mock data
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Acme Audit', 'acme-audit');

INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'active');

-- 3. Insert audit log entry
INSERT INTO public.audit_logs (id, workspace_id, actor_user_id, actor_role, action, entity_type)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'role_changed', 'member');

-- 4. Test immutability: UPDATE must throw exception
SELECT throws_ok(
  $$ UPDATE public.audit_logs SET action = 'tampered' WHERE id = '99999999-9999-9999-9999-999999999999' $$,
  'P0001',
  NULL,
  'Tentativa de UPDATE em audit_logs deve disparar exceção de tabela imutável'
);

-- 5. Test immutability: DELETE must throw exception
SELECT throws_ok(
  $$ DELETE FROM public.audit_logs WHERE id = '99999999-9999-9999-9999-999999999999' $$,
  'P0001',
  NULL,
  'Tentativa de DELETE em audit_logs deve disparar exceção de tabela imutável'
);

SELECT * FROM finish();
ROLLBACK;