-- ==============================================================================
-- Test: 00020_rpc_security.sql
-- Funções privilegiadas (SECURITY DEFINER) chamadas pela API:
--  - quem não está logado não chama nada sensível;
--  - funções de sistema (créditos, auditoria, webhooks) só o backend (service_role) chama;
--  - quem chama em nome de um membro precisa SER esse membro;
--  - leitura agregada respeita o workspace de quem chama.
-- Seed: e..03 Aline (C-level Evolut, membro d..03), e..04 Lucas (BDR Evolut, d..04),
--       e..07 Eduardo (C-level Grão Norte, d..09).
-- ==============================================================================

BEGIN;
SELECT plan(19);

-- 1. Ninguém sem login executa funções sensíveis
SELECT ok(NOT has_function_privilege('anon', 'public.credit_consume(uuid, uuid, integer, integer, text, text)', 'EXECUTE'), 'anon não consome créditos');
SELECT ok(NOT has_function_privilege('anon', 'public.credit_reserve(uuid, uuid, integer, text, text)', 'EXECUTE'), 'anon não reserva créditos');
SELECT ok(NOT has_function_privilege('anon', 'public.approval_decide(uuid, uuid, text, jsonb, text)', 'EXECUTE'), 'anon não decide aprovação');
SELECT ok(NOT has_function_privilege('anon', 'public.hermes_evaluate_action(uuid, uuid, text, uuid, integer, boolean, text, jsonb)', 'EXECUTE'), 'anon não aciona o Hermes');
SELECT ok(NOT has_function_privilege('anon', 'public.unipile_ingest_message(text, text, text, text, text, text, boolean, text)', 'EXECUTE'), 'anon não injeta mensagem');

-- 2. Funções de sistema: nem usuário logado chama direto (só o backend com service_role)
SELECT ok(NOT has_function_privilege('authenticated', 'public.credit_consume(uuid, uuid, integer, integer, text, text)', 'EXECUTE'), 'usuário não consome créditos direto');
SELECT ok(NOT has_function_privilege('authenticated', 'public.credit_reserve(uuid, uuid, integer, text, text)', 'EXECUTE'), 'usuário não reserva créditos direto');
SELECT ok(NOT has_function_privilege('authenticated', 'public.audit_write(uuid, uuid, text, text, text, jsonb)', 'EXECUTE'), 'usuário não escreve auditoria direto');
SELECT ok(NOT has_function_privilege('authenticated', 'public.unipile_ingest_message(text, text, text, text, text, text, boolean, text)', 'EXECUTE'), 'usuário não injeta mensagem de webhook');
SELECT ok(NOT has_function_privilege('authenticated', 'public.process_signal_event(uuid, uuid, uuid, uuid, text, jsonb, integer, text, text)', 'EXECUTE'), 'usuário não grava sinal de coleta');
SELECT ok(has_function_privilege('service_role', 'public.credit_consume(uuid, uuid, integer, integer, text, text)', 'EXECUTE'), 'backend (service_role) consome créditos');

-- 3. Ações do usuário continuam disponíveis para quem está logado
SELECT ok(has_function_privilege('authenticated', 'public.approval_decide(uuid, uuid, text, jsonb, text)', 'EXECUTE'), 'usuário logado decide aprovação');
SELECT ok(has_function_privilege('authenticated', 'public.has_workspace_role(uuid, text[])', 'EXECUTE'), 'helpers de RLS seguem disponíveis');

-- 4. Quem chama em nome de um membro precisa ser esse membro
INSERT INTO public.approvals (id, workspace_id, category, title, requested_by_member_id, status, payload_json, payload_hash)
VALUES ('ab000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'gasto', 'Verba LinkedIn',
        'd0000000-0000-0000-0000-000000000002', 'pendente', '{"valor": 1}'::jsonb,
        encode(extensions.digest('{"valor": 1}'::jsonb::text, 'sha256'), 'hex'));

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.approval_decide('ab000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'aprovado', '{"valor": 1}'::jsonb) $$,
  '42501', NULL,
  'BDR não aprova gasto se passando pelo C-level'
);

SELECT throws_ok(
  $$ SELECT public.hermes_evaluate_action('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'credits.buy') $$,
  '42501', NULL,
  'BDR não aciona o Hermes em nome de outro membro'
);

-- 5. Leitura agregada: só do workspace de quem chama
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok(
  $$ SELECT public.get_revenue_funnel_summary('a0000000-0000-0000-0000-000000000001') $$,
  '42501', NULL,
  'C-level da Grão Norte não lê o funil da Evolut'
);

-- 6. O caminho legítimo continua funcionando
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  public.approval_decide('ab000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'aprovado', '{"valor": 1}'::jsonb)->>'status',
  'aprovado',
  'C-level aprova em nome próprio'
);
SELECT lives_ok(
  $$ SELECT public.get_revenue_funnel_summary('a0000000-0000-0000-0000-000000000001') $$,
  'C-level da Evolut lê o funil da Evolut'
);

-- 7. Funções futuras não nascem abertas para todo mundo
-- Migrations rodam como postgres; é a regra padrão dele que vale para funções novas
RESET ROLE;
SET LOCAL ROLE postgres;
CREATE FUNCTION public.__teste_funcao_nova() RETURNS int LANGUAGE sql AS 'SELECT 1';
SELECT ok(NOT has_function_privilege('anon', 'public.__teste_funcao_nova()', 'EXECUTE'), 'função nova não fica executável por anon por padrão');

SELECT * FROM finish();
ROLLBACK;
