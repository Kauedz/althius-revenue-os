-- ==============================================================================
-- Test: 00040_home_summary.sql
-- Resumo do Início (Home) alimentado pelo banco de dados:
--  - privilégios de execução estritos (ADR 0023);
--  - assert_caller_is_member impede se passar por outro membro;
--  - isolamento de workspace (Evolut x Grão Norte);
--  - distinção de escopo por papel (BDR vê só suas contas qualificadas, C-level vê todas).
-- Seed: e..03 Aline (C-level Evolut, membro d..03, ws a..01),
--       e..04 Lucas (BDR Evolut, membro d..04, ws a..01),
--       e..07 Eduardo (C-level Grão Norte, membro d..09, ws b..01).
-- ==============================================================================

BEGIN;
SELECT plan(10);

-- 1. Privilégios da função (ADR 0023)
SELECT ok(NOT has_function_privilege('anon', 'public.get_home_summary(uuid, uuid)', 'EXECUTE'), 'anon não executa get_home_summary');
SELECT ok(has_function_privilege('authenticated', 'public.get_home_summary(uuid, uuid)', 'EXECUTE'), 'authenticated executa get_home_summary');

-- 2. Segurança de chamada e assert_caller_is_member
SET LOCAL ROLE authenticated;
-- Lucas (e..04) tentando chamar em nome de Aline (d..03)
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003') $$,
  '42501', NULL,
  'BDR não chama get_home_summary passando id de outro membro'
);

-- 3. Isolamento entre workspaces: C-level da Grão Norte não lê Evolut
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009') $$,
  '42501', NULL,
  'Membro da Grão Norte não lê resumo da Evolut'
);

-- 4. C-level da Evolut lê os totais do workspace
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT is(
  (public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003')->>'contas_qualificadas')::int,
  8,
  'C-level vê todas as 8 contas ativas da Evolut'
);

SELECT is(
  (public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003')->>'execucoes_ativas')::int,
  3,
  'C-level vê as 3 execuções ativas do workspace'
);

SELECT is(
  (public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003')->>'alertas_bloqueios')::int,
  1,
  'C-level vê o alerta de execução com falha'
);

SELECT is(
  (public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003')->>'creditos_disponiveis')::int,
  7950,
  'C-level vê os 7.950 créditos disponíveis na carteira'
);

-- 5. BDR da Evolut vê apenas as suas contas qualificadas (matriz: accounts.edit = own)
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT is(
  (public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004')->>'contas_qualificadas')::int,
  4,
  'BDR vê somente as suas 4 contas atribuídas'
);

-- 6. Grão Norte: dados isolados do seu próprio workspace
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';

SELECT is(
  (public.get_home_summary('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009')->>'contas_qualificadas')::int,
  0,
  'Grão Norte tem 0 contas no seed e não enxerga dados da Evolut'
);

SELECT * FROM finish();
ROLLBACK;