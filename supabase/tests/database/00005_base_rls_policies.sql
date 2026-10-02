-- ==============================================================================
-- Test: 00005_base_rls_policies.sql
-- Verifies Ticket 06 - Base RLS policies on workspaces and workspace_members
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock data
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Workspace Alfa', 'ws-alfa'),
  ('22222222-2222-2222-2222-222222222222', 'Workspace Beta', 'ws-beta');

INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bdr', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'clevel', 'active');

-- 2. Test user aaaaaaaa querying workspaces under RLS
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT id FROM public.workspaces $$,
  $$ VALUES ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Usuário do Workspace Alfa deve enxergar APENAS o Workspace Alfa'
);

-- 3. Test negative update (BDR trying to update workspace settings)
UPDATE public.workspaces SET name = 'Hacked Name' WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT name FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Workspace Alfa',
  'BDR NÃO pode atualizar o nome do workspace sob política RLS'
);

-- 4. Test cross-tenant update attempt (trying to update Workspace Beta from Alfa)
UPDATE public.workspaces SET name = 'Hacked Beta' WHERE id = '22222222-2222-2222-2222-222222222222';

RESET ROLE;

SELECT is(
  (SELECT name FROM public.workspaces WHERE id = '22222222-2222-2222-2222-222222222222'),
  'Workspace Beta',
  'Workspace Beta deve permanecer inalterado após tentativa de update cruzado'
);

SELECT * FROM finish();
ROLLBACK;