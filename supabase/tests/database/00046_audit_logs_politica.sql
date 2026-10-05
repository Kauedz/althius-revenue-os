-- ==============================================================================
-- Test: 00046_audit_logs_politica.sql
-- Política de acesso do audit_logs (ADR 0040), achados do PR da corrente (ADR 0038):
--   1. Qualquer membro logado gravava linha de auditoria direto pela API (INSERT liberado).
--      Agora só o banco grava: audit_write e funções de sistema (SECURITY DEFINER) e service_role.
--   2. A leitura citava papéis que não existem (client_admin, strategist). Pela matriz
--      (capacidade admin) só o superadmin lê; a política passa a dizer isso.
-- Seed: Rafael superadmin e..01 (membro de Evolut e Grão Norte); Aline C-level e..03 (Evolut a0..01).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. A política de INSERT pela API deixou de existir
SELECT is((SELECT count(*) FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass AND polcmd = 'a'), 0::bigint,
  'audit_logs não tem política de INSERT para quem está logado');
SELECT is((SELECT count(*) FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass), 1::bigint, 'Sobrou uma só política (a de leitura)');
SELECT ok(NOT (SELECT pg_get_expr(polqual, polrelid) ~ '(client_admin|strategist)' FROM pg_policy WHERE polrelid = 'public.audit_logs'::regclass AND polcmd = 'r'),
  'A política de leitura não cita papéis que não existem');

-- 2. Permissões na tabela: logado só lê; sem login nada; backend continua gravando
SELECT ok(has_table_privilege('authenticated', 'public.audit_logs', 'SELECT'), 'Quem está logado pode ler (a RLS decide quem vê)');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'Quem está logado não grava direto');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'), 'Quem está logado não altera direto');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'), 'Quem está logado não apaga direto');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_logs', 'TRUNCATE'), 'Quem está logado não esvazia a tabela (o gatilho de imutabilidade não pega TRUNCATE)');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'SELECT'), 'Sem login não lê');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'INSERT'), 'Sem login não grava');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_logs', 'TRUNCATE'), 'Sem login não esvazia a tabela');
SELECT ok(has_table_privilege('service_role', 'public.audit_logs', 'INSERT'), 'Backend (service_role) continua gravando');

-- 3. O caminho oficial de gravação continua funcionando (audit_write é SECURITY DEFINER)
SELECT lives_ok($$ SELECT public.audit_write('a0000000-0000-0000-0000-000000000001', NULL, 'teste.oficial', 'teste', 'ref', '{}'::jsonb) $$,
  'audit_write grava normalmente');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'teste.oficial'), 1::bigint, 'A linha gravada por audit_write existe');
INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type)
VALUES ('b0000000-0000-0000-0000-000000000001', 'system', 'teste.grao', 'teste');

-- 4. Quem está logado não grava linha falsa, nem C-level nem superadmin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type) VALUES ('a0000000-0000-0000-0000-000000000001', 'clevel', 'falsa.clevel', 'teste') $$,
  '42501', NULL, 'C-level não grava auditoria direto pela API');
SELECT throws_ok($$ INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type) VALUES ('b0000000-0000-0000-0000-000000000001', 'clevel', 'falsa.outro', 'teste') $$,
  '42501', NULL, 'Nem no workspace de outro cliente');

-- 5. Leitura: C-level não lê (matriz: admin = Não); superadmin lê
SELECT is((SELECT count(*) FROM public.audit_logs), 0::bigint, 'C-level não vê nenhuma linha de auditoria, nem do próprio workspace');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'teste.oficial'), 1::bigint, 'Superadmin lê a auditoria da Evolut');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'teste.grao'), 1::bigint, 'Superadmin lê a auditoria do Grão Norte');
SELECT throws_ok($$ INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type) VALUES ('a0000000-0000-0000-0000-000000000001', 'superadmin', 'falsa.super', 'teste') $$,
  '42501', NULL, 'Nem o superadmin grava auditoria direto pela API');

SELECT * FROM finish();
ROLLBACK;
