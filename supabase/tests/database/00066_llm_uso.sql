-- ==============================================================================
-- Test: 00066_llm_uso.sql
-- Registro do uso do modelo de IA (gateway, ADR 0050): só o sistema grava, só o superadmin vê, e o custo em dólar
-- só aparece na tela do superadmin. Seed: Rafael (superadmin) e0..01; Aline (C-level Evolut) e0..03; Evolut a0..01.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('service_role', 'public.llm_registrar_uso(uuid, text, text, text, integer, integer, numeric)', 'EXECUTE'), 'Sistema registra uso');
SELECT ok(NOT has_function_privilege('authenticated', 'public.llm_registrar_uso(uuid, text, text, text, integer, integer, numeric)', 'EXECUTE'), 'Usuário logado não registra uso');
SELECT ok(NOT has_function_privilege('anon', 'public.llm_registrar_uso(uuid, text, text, text, integer, integer, numeric)', 'EXECUTE'), 'Visitante não registra uso');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.llm_uso', 'SELECT'), 'Tabela de uso fechada para usuário');
SELECT ok(NOT has_table_privilege('anon', 'internal.llm_uso', 'SELECT'), 'Tabela de uso fechada para visitante');

SELECT lives_ok($$SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'comercial', 'Principal', 'modelo-x', 1000, 200, 0.012345)$$, 'Registra uso com custo');
SELECT lives_ok($$SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'copy', 'Principal', 'modelo-x', 500, 100, NULL)$$, 'Registra uso sem preço configurado (custo desconhecido, não inventado)');
SELECT lives_ok($$SELECT public.llm_registrar_uso('b0000000-0000-0000-0000-000000000001', 'comercial', 'Principal', 'modelo-x', 50, 10, 0.001)$$, 'Registra uso de outro cliente');
SELECT throws_ok($$SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'comercial', 'P', 'm', -1, 0, NULL)$$, '22023', NULL, 'Quantidade negativa é recusada');
SELECT throws_ok($$SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'invasor', 'P', 'm', 1, 1, NULL)$$, '22023', NULL, 'Agente que não existe é recusado');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT ok((SELECT u ?& ARRAY['tokens_mes', 'custo_modelo_usd'] FROM jsonb_array_elements(public.admin_usage()) u LIMIT 1), 'Uso global do superadmin traz tokens e custo do modelo');
SELECT is((SELECT (u->>'tokens_mes')::int FROM jsonb_array_elements(public.admin_usage()) u WHERE u->>'id' = 'a0000000-0000-0000-0000-000000000001'), 1800, 'Soma os tokens do cliente no mês (1000+200+500+100)');
SELECT is((SELECT (u->>'custo_modelo_usd')::numeric FROM jsonb_array_elements(public.admin_usage()) u WHERE u->>'id' = 'a0000000-0000-0000-0000-000000000001'), 0.012345, 'Custo soma só o que tem preço');
SELECT is((SELECT (u->>'tokens_mes')::int FROM jsonb_array_elements(public.admin_usage()) u WHERE u->>'id' = 'b0000000-0000-0000-0000-000000000001'), 60, 'Cada cliente só soma o próprio uso');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.admin_usage()$$, '42501', NULL, 'C-level não vê o uso (nem o custo)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
