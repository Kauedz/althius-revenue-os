-- ==============================================================================
-- Test: 00047_bootstrap_superadmin.sql
-- Primeiro superadmin em produção (ADR 0041). Função de sistema, só service_role.
-- Cria o workspace interno "Althius", a linha de superadmin, a carteira e a auditoria,
-- e se recusa a rodar se já existir superadmin ativo.
-- Seed: Rafael superadmin e..01; Aline C-level e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Permissões (ADR 0023: função nova nasce fechada)
SELECT has_function('public', 'bootstrap_superadmin', ARRAY['uuid'], 'Existe public.bootstrap_superadmin(uuid)');
SELECT ok(NOT has_function_privilege('anon', 'public.bootstrap_superadmin(uuid)', 'EXECUTE'), 'Sem login não cria superadmin');
SELECT ok(NOT has_function_privilege('authenticated', 'public.bootstrap_superadmin(uuid)', 'EXECUTE'), 'Quem está logado não cria superadmin (nem o superadmin: é função de sistema)');
SELECT ok(has_function_privilege('service_role', 'public.bootstrap_superadmin(uuid)', 'EXECUTE'), 'Backend (service_role) cria');

-- 2. Com superadmin ativo (o do seed) ela se recusa
SELECT throws_ok($$ SELECT public.bootstrap_superadmin('e0000000-0000-0000-0000-000000000003') $$, 'P0001',
  'Já existe superadmin ativo. Esta operação só serve para o primeiro.', 'Recusa quando já existe superadmin ativo');
SELECT is((SELECT count(*) FROM public.workspaces WHERE slug = 'althius-interno'), 0::bigint, 'A recusa não deixa workspace pela metade');

-- 3. Servidor novo: ninguém é superadmin ativo
UPDATE public.workspace_members SET status = 'suspended' WHERE role = 'superadmin';

SELECT throws_ok($$ SELECT public.bootstrap_superadmin('99999999-9999-9999-9999-999999999999') $$, 'P0001',
  'Usuário não encontrado.', 'Recusa usuário que não existe');
SELECT throws_ok($$ SELECT public.bootstrap_superadmin(NULL) $$, 'P0001', 'Usuário não encontrado.', 'Recusa usuário vazio');

SELECT lives_ok($$ SELECT public.bootstrap_superadmin('e0000000-0000-0000-0000-000000000003') $$, 'Cria o primeiro superadmin');

SELECT is((SELECT count(*) FROM public.workspaces WHERE slug = 'althius-interno' AND status = 'active'), 1::bigint, 'Criou o workspace interno ativo');
SELECT is((SELECT count(*) FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
            WHERE w.slug = 'althius-interno' AND m.user_id = 'e0000000-0000-0000-0000-000000000003' AND m.role = 'superadmin' AND m.status = 'active'),
  1::bigint, 'A pessoa é superadmin ativa do workspace interno');
SELECT is((SELECT count(*) FROM public.credit_wallets c JOIN public.workspaces w ON w.id = c.workspace_id WHERE w.slug = 'althius-interno'), 1::bigint,
  'O workspace interno tem carteira de créditos');

-- 4. Auditoria: registrada, sem ator de tela (é operação de sistema), com a corrente íntegra
SELECT is((SELECT count(*) FROM public.audit_logs l JOIN public.workspaces w ON w.id = l.workspace_id
            WHERE w.slug = 'althius-interno' AND l.action = 'superadmin.bootstrap' AND l.actor_role = 'system'), 1::bigint,
  'Registrou superadmin.bootstrap na auditoria');
SELECT is((SELECT l.new_values->>'user_id' FROM public.audit_logs l JOIN public.workspaces w ON w.id = l.workspace_id
            WHERE w.slug = 'althius-interno' AND l.action = 'superadmin.bootstrap'), 'e0000000-0000-0000-0000-000000000003', 'A auditoria diz quem virou superadmin');
SELECT is((SELECT public.audit_verify_chain(id)->>'integra' FROM public.workspaces WHERE slug = 'althius-interno'), 'true', 'Corrente de auditoria do workspace interno íntegra');

-- 5. Segunda execução recusa (agora existe superadmin ativo), inclusive para outra pessoa
SELECT throws_ok($$ SELECT public.bootstrap_superadmin('e0000000-0000-0000-0000-000000000003') $$, 'P0001',
  'Já existe superadmin ativo. Esta operação só serve para o primeiro.', 'Segunda execução recusa');
SELECT throws_ok($$ SELECT public.bootstrap_superadmin('e0000000-0000-0000-0000-000000000004') $$, 'P0001',
  'Já existe superadmin ativo. Esta operação só serve para o primeiro.', 'Recusa também para outra pessoa');
SELECT is((SELECT count(*) FROM public.workspaces WHERE slug = 'althius-interno'), 1::bigint, 'Não duplica o workspace interno');

-- 6. De fato vale como superadmin para o resto do sistema
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT ok(public.is_superadmin(), 'is_superadmin() é verdadeiro para quem foi criado');
SELECT lives_ok($$ SELECT public.admin_health() $$, 'O novo superadmin abre a tela Saúde');

SELECT * FROM finish();
ROLLBACK;
