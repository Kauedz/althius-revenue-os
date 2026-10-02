-- ==============================================================================
-- Test Suite: 00011_rls_security_suite.sql
-- Ticket 11: Suíte Formal de Testes pgTAP para RLS e Isolamento de Tenants
-- ==============================================================================

BEGIN;

SELECT plan(11);

-- 1. Verify RLS is enabled on all critical public tables
SELECT ok((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.workspaces'::regclass), 'Tabela public.workspaces DEVE ter RLS ativado');
SELECT ok((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.workspace_members'::regclass), 'Tabela public.workspace_members DEVE ter RLS ativado');

-- 2. Verify helper function security definer property
SELECT is_definer('public', 'current_workspace_member', 'Função current_workspace_member deve ser SECURITY DEFINER');

-- 3. Anonymous user tests (must see 0 workspaces)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{}';

SELECT is_empty(
  $$ SELECT id FROM public.workspaces $$,
  'Usuário anônimo NÃO deve visualizar nenhum workspace'
);

-- 4. Negative test: Anonymous user accessing internal schema (must throw permission error)
SELECT throws_ok(
  $$ SELECT id FROM internal.master_provider_keys $$,
  '42501',
  NULL,
  'Usuário anônimo NÃO tem permissão de leitura no schema internal'
);

-- 5. Authenticated BDR user tests (User Alfa BDR)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004"}';

SELECT results_eq(
  $$ SELECT id FROM public.workspaces $$,
  $$ VALUES ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'BDR da Empresa Alfa deve enxergar exclusivamente o Workspace Alfa'
);

SELECT throws_ok(
  $$ SELECT id FROM internal.connection_secrets $$,
  '42501',
  NULL,
  'Usuário autenticado (BDR) NÃO tem permissão no schema internal'
);

-- BDR attempting to insert member into Alfa (must fail RLS check)
SELECT throws_ok(
  $$ INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status)
     VALUES ('2e55ab44-9999-9999-9999-999999999999', 'a0000000-0000-0000-0000-000000000001', '81e1259a-9999-9999-9999-999999999999', 'bdr', 'active') $$,
  '42501',
  NULL,
  'BDR é barrado pela RLS ao tentar cadastrar membro'
);

SELECT is_empty(
  $$ SELECT id FROM public.workspace_members WHERE id = '2e55ab44-9999-9999-9999-999999999999' $$,
  'BDR NÃO pode cadastrar novos membros no workspace (RLS withhold)'
);

-- 6. Authenticated Client Admin user tests (User Alfa Admin)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003"}';

-- Admin inserting new BDR into Alfa (allowed by RLS)
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status)
VALUES ('87eb998f-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000099', 'bdr', 'active');

SELECT isnt_empty(
  $$ SELECT id FROM public.workspace_members WHERE id = '87eb998f-0000-0000-0000-000000000099' $$,
  'Client Admin DEVE conseguir cadastrar novos membros no seu próprio workspace'
);

-- Cross-tenant negative test: Alfa Admin attempting to view Beta members
SELECT is_empty(
  $$ SELECT id FROM public.workspace_members WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'Admin da Alfa NÃO deve conseguir visualizar membros da Beta'
);

SELECT * FROM finish();
ROLLBACK;
