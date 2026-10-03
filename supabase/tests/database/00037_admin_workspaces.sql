-- ==============================================================================
-- Test: 00037_admin_workspaces.sql
-- Seam: Superadmin → Workspaces (admin_workspaces, admin_create_workspace, admin_agent_tokens,
-- admin_revoke_agent_tokens). Só o superadmin; cliente novo nasce com agentes, carteira e convite do C-level.
-- Seed: Rafael superadmin e..01; Camila estrategista e..02 (camila@althius.com.br); Aline C-level e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SET LOCAL ROLE authenticated;

-- 1. Só o superadmin.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.admin_workspaces() $$, '42501', NULL, 'C-level não lista os clientes da Althius');
SELECT throws_ok($$ SELECT public.admin_create_workspace('X', 'x-teste', 'a@b.com.br', NULL) $$, '42501', NULL, 'C-level não cria workspace');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.admin_workspaces() $$, '42501', NULL, 'Estrategista não lista os clientes da Althius');

-- 2. Lista.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.admin_workspaces()) w WHERE w->>'slug' IN ('evolut', 'grao', 'vertice')), 3, 'Superadmin vê os 3 clientes do seed');
SELECT ok((SELECT w @> '{"slug": "evolut", "nome": "Evolut Trading", "status": "active"}' AND (w->>'membros')::int >= 6 AND w ? 'saldo' AND w ? 'clevel'
           FROM jsonb_array_elements(public.admin_workspaces()) w WHERE w->>'slug' = 'evolut'),
  'Cada cliente vem com membros, C-level e saldo');

-- 3. Criar.
SELECT is(public.admin_create_workspace('  ', 'novo-cliente', 'diretora@novocliente.com.br', NULL)->>'erro', 'Digite o nome do cliente.', 'Nome é obrigatório');
SELECT is(public.admin_create_workspace('Novo Cliente', 'Novo Cliente!', 'diretora@novocliente.com.br', NULL)->>'erro',
  'Endereço curto: 3 a 40 letras minúsculas, números ou hífen.', 'Endereço curto é validado');
SELECT is(public.admin_create_workspace('Outro', 'evolut', 'diretora@novocliente.com.br', NULL)->>'erro', 'Já existe um cliente com esse endereço.', 'Endereço não repete');
SELECT is(public.admin_create_workspace('Novo Cliente', 'novo-cliente', 'não é e-mail', NULL)->>'erro', 'E-mail do C-level inválido.', 'E-mail do C-level é validado');
SELECT is(public.admin_create_workspace('Novo Cliente', 'novo-cliente', 'diretora@novocliente.com.br', 'ninguem@althius.com.br')->>'erro',
  'O estrategista precisa ter conta na Althius.', 'Estrategista tem de existir');

CREATE TEMP TABLE novo ON COMMIT DROP AS
SELECT public.admin_create_workspace('Novo Cliente S.A.', 'novo-cliente', ' Diretora@NovoCliente.com.br ', 'camila@althius.com.br') AS r;
GRANT SELECT ON novo TO authenticated;
SELECT is((SELECT r->>'ok' FROM novo), 'true', 'Superadmin cria o cliente');
RESET ROLE;
SELECT is((SELECT name FROM public.workspaces WHERE slug = 'novo-cliente'), 'Novo Cliente S.A.', 'Workspace criado');
SELECT set_eq(
  $$ SELECT wm.role FROM public.workspace_members wm JOIN public.workspaces w ON w.id = wm.workspace_id WHERE w.slug = 'novo-cliente' $$,
  ARRAY['superadmin', 'estrategista'], 'Superadmin e estrategista já entram como membros');
SELECT is((SELECT count(*)::int FROM public.workspace_agents a JOIN public.workspaces w ON w.id = a.workspace_id
           WHERE w.slug = 'novo-cliente' AND a.responsavel_member_id IS NOT NULL), 4, 'Os 4 agentes nascem com a estrategista responsável');
SELECT ok(EXISTS (SELECT 1 FROM public.credit_wallets c JOIN public.workspaces w ON w.id = c.workspace_id WHERE w.slug = 'novo-cliente'), 'Carteira de créditos criada');
SELECT results_eq(
  $$ SELECT i.email, i.role, i.status FROM public.workspace_invites i JOIN public.workspaces w ON w.id = i.workspace_id WHERE w.slug = 'novo-cliente' $$,
  $$ VALUES ('diretora@novocliente.com.br'::text, 'clevel'::text, 'pending'::text) $$,
  'C-level recebe convite (e-mail normalizado)');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'workspace.criado'), 'Criação vai para a auditoria');

-- 4. Chaves dos agentes: aparecem uma vez; revogar desliga.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.admin_agent_tokens((SELECT (r->>'workspace_id')::uuid FROM novo)) $$, '42501', NULL, 'C-level não gera chave de agente');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
CREATE TEMP TABLE chaves ON COMMIT DROP AS SELECT public.admin_agent_tokens((SELECT (r->>'workspace_id')::uuid FROM novo)) AS c;
GRANT SELECT ON chaves TO anon;
SELECT ok((SELECT c ?& ARRAY['comercial', 'marketing', 'copy', 'revops'] AND c->>'copy' LIKE 'alt_agente_%' FROM chaves), 'Gera uma chave para cada agente');
SELECT is(public.admin_revoke_agent_tokens((SELECT (r->>'workspace_id')::uuid FROM novo))->>'revogadas', '4', 'Revoga as 4 chaves');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_list_contacts((SELECT c->>'copy' FROM chaves)) $$, '28000', NULL, 'Chave revogada não abre mais nada');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
