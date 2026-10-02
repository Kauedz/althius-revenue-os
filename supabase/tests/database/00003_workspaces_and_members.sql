-- ==============================================================================
-- Test: 00003_workspaces_and_members.sql
-- Verifies Ticket 04 - Workspaces and Workspace Memberships
-- ==============================================================================

BEGIN;

-- 1. Check table existence
SELECT has_table('public', 'workspaces', 'Tabela public.workspaces deve existir');
SELECT has_table('public', 'workspace_members', 'Tabela public.workspace_members deve existir');

-- 2. Create sample workspaces
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Empresa Alfa', 'empresa-alfa'),
  ('22222222-2222-2222-2222-222222222222', 'Empresa Beta', 'empresa-beta');

-- 3. Associate single user in two different workspaces with different roles
INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'client_admin'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bdr');

SELECT results_eq(
  $$ SELECT role FROM public.workspace_members WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' ORDER BY role $$,
  $$ VALUES ('bdr'::text), ('client_admin'::text) $$,
  'Usuário deve ser capaz de atuar em múltiplos workspaces com papéis distintos'
);

-- 4. Verify uniqueness constraint (cannot insert duplicate membership)
SELECT throws_ok(
  $$ INSERT INTO public.workspace_members (workspace_id, user_id, role) 
     VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'viewer') $$,
  '23505',
  NULL,
  'Inserção de membro duplicado no mesmo workspace deve falhar com violação de unicidade'
);

ROLLBACK;
