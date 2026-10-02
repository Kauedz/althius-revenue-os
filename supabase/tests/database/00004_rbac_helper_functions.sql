-- ==============================================================================
-- Test: 00004_rbac_helper_functions.sql
-- Verifies Ticket 05 - Role resolution and RBAC helper functions
-- ==============================================================================

BEGIN;

-- 1. Check function existence
SELECT has_function('public', 'current_workspace_member', 'Função current_workspace_member deve existir');
SELECT has_function('public', 'has_workspace_role', ARRAY['uuid', 'text[]'], 'Função has_workspace_role deve existir');
SELECT has_function('public', 'is_workspace_member', ARRAY['uuid'], 'Função is_workspace_member deve existir');

-- 2. Setup mock data
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'acme-corp');

INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bdr', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'client_admin', 'suspended');

-- 3. Test has_workspace_role behavior with mock JWT session
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT is(
  public.is_workspace_member('11111111-1111-1111-1111-111111111111'),
  true,
  'Usuário ativo aaaaaaaa deve ser identificado como membro do workspace'
);

SELECT is(
  public.has_workspace_role('11111111-1111-1111-1111-111111111111', ARRAY['bdr', 'sdr']),
  true,
  'Usuário com papel bdr deve ter acesso validado para lista contendo bdr'
);

SELECT is(
  public.has_workspace_role('11111111-1111-1111-1111-111111111111', ARRAY['client_admin', 'strategist']),
  false,
  'Usuário com papel bdr NÃO pode ter acesso validado para client_admin ou strategist'
);

-- 4. Test suspended user (must NOT be treated as active member)
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT is(
  public.is_workspace_member('11111111-1111-1111-1111-111111111111'),
  false,
  'Membro suspenso não deve ser reconhecido como membro ativo'
);

ROLLBACK;
