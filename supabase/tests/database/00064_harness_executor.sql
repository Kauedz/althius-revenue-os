-- ==============================================================================
-- Test: 00064_harness_executor.sql
-- O harness só pega agentes com executor registrado (p_only) e o lote traz o nome e o papel de quem escreveu.
-- Seed: Evolut a0..01 (Aline C-level d..03/e..03 "Aline Xavier"; Camila estrategista d..02); Grão Norte b0..01 (C-level d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('service_role', 'public.agent_harness_claim(integer, integer, integer, integer, jsonb)', 'EXECUTE'), 'Sistema pega lote');
SELECT ok(NOT has_function_privilege('authenticated', 'public.agent_harness_claim(integer, integer, integer, integer, jsonb)', 'EXECUTE'), 'Usuário logado não pega lote');
SELECT ok(NOT has_function_privilege('anon', 'public.agent_harness_claim(integer, integer, integer, integer, jsonb)', 'EXECUTE'), 'Visitante não pega lote');
SELECT is((SELECT count(*)::int FROM pg_proc WHERE proname = 'agent_harness_claim' AND pronamespace = 'public'::regnamespace), 1, 'Só existe UMA função de pegar lote (sem sobrecarga que confunda a API)');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.nome_do_membro(uuid)', 'EXECUTE'), 'A busca do nome é interna');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Executor teste', 'x',
  ARRAY['d0000000-0000-0000-0000-000000000002']::uuid[], ARRAY['comercial', 'marketing'])->>'ok', 'true', 'Canal criado');
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'executor-teste', '@Zoe, liste as contas quentes', NULL, 'comercial');
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'executor-teste', '@Jax, e as campanhas?', NULL, 'marketing');
RESET ROLE;
UPDATE public.agent_channel_queue SET created_at = now() - interval '1 minute';

-- Sem lista: pega todos. Com lista: só os registrados; os outros esperam sem gastar tentativa.
SELECT is(jsonb_array_length(public.agent_harness_claim(3, 15, 300, 5, '[]'::jsonb)), 0, 'Lista vazia de executores: nada é pego');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE status = 'pending' AND attempts = 0), 2, 'Os pedidos esperam na fila, sem gastar tentativa');
SELECT is((SELECT count(*)::int FROM public.executions e JOIN public.agent_channel_queue q ON q.execution_id = e.id WHERE e.status = 'running' OR e.reserved_credits > 0), 0, 'E sem reservar crédito');
SELECT is(jsonb_array_length(public.agent_harness_claim(3, 15, 300, 5, '["a0000000-0000-0000-0000-000000000001/marketing"]'::jsonb)), 1, 'Só o agente com executor registrado é pego');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'comercial' AND status = 'pending'), 1, 'O outro continua esperando');
SELECT is(jsonb_array_length(public.agent_harness_claim(3, 15, 300, 5, '["b0000000-0000-0000-0000-000000000001/comercial"]'::jsonb)), 0, 'Executor registrado para OUTRO workspace não pega o pedido da Evolut');

-- Nome e papel de quem escreveu vão no lote.
CREATE TEMP TABLE l ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5, '["a0000000-0000-0000-0000-000000000001/comercial"]'::jsonb) AS x;
SELECT is((SELECT x->0->'mensagens'->0->>'autor' FROM l), 'Aline Xavier', 'O lote diz o nome de quem escreveu');
SELECT is((SELECT x->0->'mensagens'->0->>'papel' FROM l), 'clevel', 'E o papel');
SELECT ok((SELECT NOT (x::text LIKE '%usd%') FROM l), 'Nada de dólar no lote');

-- Sem lista (nulo), o comportamento antigo: pega o que estiver pronto.
SELECT public.agent_harness_finish((SELECT (x->0->>'run_id')::uuid FROM l), true, 'ok', NULL);
SELECT is(jsonb_array_length(public.agent_harness_claim(3, 15, 300, 5)), 0, 'Sem pendência pronta, nada é pego (chamada antiga de 4 parâmetros segue valendo)');

SELECT * FROM finish();
ROLLBACK;
