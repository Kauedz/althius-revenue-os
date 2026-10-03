-- ==============================================================================
-- Test: 00008_roles_matrix_and_rls.sql
-- Verifies Ticket 01 - Roles, 33-Capability Matrix, and Base RLS Isolation
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock data: 2 workspaces (evolut and grao)
INSERT INTO public.workspaces (id, name, slug, site_domain, logo_url, logo_source) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut', 'evolut.com.br', 'https://evolut.com.br/logo.png', 'site'),
  ('22222222-2222-2222-2222-222222222222', 'Grão Norte', 't-grao', 'grao.com.br', 'https://grao.com.br/logo.png', 'site')
ON CONFLICT (id) DO NOTHING;

-- Setup mock users:
-- u_super: superadmin of evolut (and global platform operator)
-- u_estra: estrategista assigned ONLY to evolut
-- u_clevel: clevel of evolut
-- u_bdr: bdr of evolut
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'estrategista', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 2. Verify roles table has exactly the 4 canonical roles
SELECT results_eq(
  $$ SELECT id FROM public.roles ORDER BY id $$,
  $$ VALUES ('bdr'), ('clevel'), ('estrategista'), ('superadmin') $$,
  'Roles table must contain exactly the 4 canonical roles'
);

-- 3. Verify exactly 132 capabilities seeded (33 capabilities * 4 roles)
SELECT is(
  (SELECT count(*)::integer FROM public.role_permissions),
  132,
  'Role permissions table must contain all 132 seeded capability records'
);

-- 4. Verify check_permission function logic for various roles
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
SET LOCAL ROLE authenticated;

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'admin'),
  true,
  'Superadmin must have permission for admin'
);

-- Test Estrategista permissions
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'admin'),
  false,
  'Estrategista must NOT have permission for admin'
);

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'approvals.spend'),
  false,
  'Estrategista has scope request for approvals.spend so direct execution must return false'
);

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'agents.configure'),
  true,
  'Estrategista must have permission to configure agents'
);

-- Test C-level permissions
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'approvals.spend'),
  true,
  'C-level must have permission to approve spend'
);

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'pipeline.boards'),
  true,
  'C-level must have permission to manage pipeline boards'
);

-- Test BDR permissions
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd"}';

SELECT is(
  public.check_permission('11111111-1111-1111-1111-111111111111'::uuid, 'pipeline.boards'),
  false,
  'BDR must NOT have permission to manage pipeline boards'
);

SELECT is(
  public.check_permission(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'accounts.edit',
    '87eb998f-0000-0000-0000-000000000004'::uuid
  ),
  true,
  'BDR must have permission to edit their OWN account (owner is the member id)'
);

SELECT is(
  public.check_permission(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'accounts.edit',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
  ),
  false,
  'BDR must NOT match ownership against the login id; owners are member ids'
);

SELECT is(
  public.check_permission(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'accounts.edit',
    NULL
  ),
  true,
  'OWN without a target stays allowed so lists and policies can ask the question'
);

SELECT is(
  public.check_permission(
    '11111111-1111-1111-1111-111111111111'::uuid, 
    'accounts.edit', 
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
  ),
  false,
  'BDR must NOT have permission to edit an account owned by someone else'
);

-- 5. Test RLS Multi-Tenancy on workspaces:
-- Superadmin should see both workspaces
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT is(
  (SELECT count(*)::integer FROM public.workspaces WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2,
  'Superadmin must see all workspaces in the system'
);

-- Estrategista (only assigned to evolut) should see ONLY evolut
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT results_eq(
  $$ SELECT id FROM public.workspaces $$,
  $$ VALUES ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'Estrategista must see ONLY their assigned workspace (evolut)'
);

-- BDR should see ONLY evolut
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-dddd-dddd-dddd-dddddddddddd"}';

SELECT results_eq(
  $$ SELECT id FROM public.workspaces $$,
  $$ VALUES ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'BDR must see ONLY their assigned workspace (evolut)'
);

-- 6. Test RLS Branding Updates:
-- BDR cannot update workspace branding
UPDATE public.workspaces 
SET name = 'Evolut Hacked by BDR' 
WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT name FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Evolut Trading',
  'BDR cannot update workspace details under RLS'
);

-- C-level CAN update workspace branding
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

UPDATE public.workspaces 
SET site_domain = 'novo.evolut.com.br' 
WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT site_domain FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111'),
  'novo.evolut.com.br',
  'C-level CAN update workspace branding under RLS'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;