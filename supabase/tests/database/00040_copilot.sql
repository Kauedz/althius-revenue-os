-- ==============================================================================
-- Test: 00040_copilot.sql
-- Seam: copilot_request. O pedido ao Copiloto passa pela política Hermes e vira execução na fila,
-- em nome de quem pediu; nada é simulado. Seed: Lucas BDR d..04 (e..04), Aline C-level d..03 (e..03).
-- ==============================================================================

BEGIN;
SELECT no_plan();
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT is(public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '   ')->>'erro', 'Escreva o pedido.', 'Pedido vazio é recusado');
SELECT throws_ok($$ SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'oi') $$, '42501', NULL,
  'Ninguém pede em nome de outra pessoa');
CREATE TEMP TABLE pedido ON COMMIT DROP AS
SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Gerar uma lista de importadores do Sul com fit acima de 80') AS r;
SELECT is((SELECT r->>'ok' FROM pedido), 'true', 'Lucas faz o pedido');
RESET ROLE;
SELECT results_eq(
  $$ SELECT title, execution_type, requested_by_member_id::text, metadata_json->>'pedido' FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM pedido) $$,
  $$ VALUES ('Copiloto: Gerar uma lista de importadores do Sul com fit acima de 80'::text, 'Pedido ao Copiloto'::text,
             'd0000000-0000-0000-0000-000000000004'::text, 'Gerar uma lista de importadores do Sul com fit acima de 80'::text) $$,
  'Vira execução na fila, com o pedido inteiro, em nome de quem pediu');
SELECT ok(NOT has_function_privilege('anon', 'public.copilot_request(uuid, uuid, text)', 'EXECUTE'), 'Sem login não pede nada');

SELECT * FROM finish();
ROLLBACK;
