-- ==============================================================================
-- Test: 00043_copilot.sql
-- Seam: copilot_request. O pedido ao Copiloto passa pela política Hermes e vira execução na fila,
-- em nome de quem pediu; nada é simulado. Repetir o mesmo pedido (mesma chave) não duplica execução,
-- cobrança, aprovação nem aviso. Pedido que vai para Aprovações é "enviado", não "falhou".
-- Seed: Lucas BDR d..04 (e..04), Aline C-level d..03 (e..03), workspaces a..01 (Evolut) e b..01 (Grão Norte).
-- ==============================================================================

BEGIN;
SELECT no_plan();
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT is(public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '   ', gen_random_uuid())->>'erro', 'Escreva o pedido.', 'Pedido vazio é recusado');
SELECT is(public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', repeat('x', 4001), gen_random_uuid())->>'erro',
  'Pedido longo demais (até 4.000 caracteres).', 'Pedido acima de 4.000 caracteres é recusado');
SELECT is(public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'oi', NULL)->>'erro',
  'Pedido sem chave de envio.', 'Sem chave de idempotência o pedido é recusado');
SELECT throws_ok($$ SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'oi', gen_random_uuid()) $$, '42501', NULL,
  'Ninguém pede em nome de outra pessoa');

-- Isolamento: Lucas é do workspace Evolut e não pede nada no workspace Grão Norte.
SELECT is(public.copilot_request('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Pedido em outro workspace', gen_random_uuid())->>'ok', 'false',
  'Membro de um workspace não pede no workspace de outro cliente');

-- Caso feliz e repetição com a mesma chave.
CREATE TEMP TABLE pedido ON COMMIT DROP AS
SELECT '11111111-1111-1111-1111-111111111111'::uuid AS chave,
       public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Gerar uma lista de importadores do Sul com fit acima de 80', '11111111-1111-1111-1111-111111111111') AS r;
CREATE TEMP TABLE repeticao ON COMMIT DROP AS
SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Gerar uma lista de importadores do Sul com fit acima de 80', '11111111-1111-1111-1111-111111111111') AS r;
GRANT SELECT ON pedido, repeticao TO PUBLIC;
SELECT is((SELECT r->>'ok' FROM pedido), 'true', 'Lucas faz o pedido');
SELECT is((SELECT r->>'execution_id' FROM repeticao), (SELECT r->>'execution_id' FROM pedido), 'Repetir com a mesma chave devolve a mesma execução');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.executions WHERE metadata_json->>'chave' = '11111111-1111-1111-1111-111111111111'), 1,
  'A repetição não cria segunda execução (nem segunda cobrança)');
SELECT results_eq(
  $$ SELECT title, execution_type, requested_by_member_id::text, metadata_json->>'pedido' FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM pedido) $$,
  $$ VALUES ('Copiloto: Gerar uma lista de importadores do Sul com fit acima de 80'::text, 'Pedido ao Copiloto'::text,
             'd0000000-0000-0000-0000-000000000004'::text, 'Gerar uma lista de importadores do Sul com fit acima de 80'::text) $$,
  'Vira execução na fila, com o pedido inteiro, em nome de quem pediu');

-- Caminho de recusa que vira aprovação: teto de créditos baixo no workspace.
UPDATE public.workspace_settings SET credit_mode = 'approval', approval_threshold = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE pedido_caro ON COMMIT DROP AS
SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Pedido que passa do teto', '22222222-2222-2222-2222-222222222222') AS r;
CREATE TEMP TABLE pedido_caro_2 ON COMMIT DROP AS
SELECT public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Pedido que passa do teto', '22222222-2222-2222-2222-222222222222') AS r;
GRANT SELECT ON pedido_caro, pedido_caro_2 TO PUBLIC;
SELECT is((SELECT r->>'ok' FROM pedido_caro), 'true', 'Pedido acima do teto é aceito: foi enviado para Aprovações, não falhou');
SELECT is((SELECT r->>'status' FROM pedido_caro), 'requires_approval', 'O retorno diz que o pedido foi para Aprovações');
SELECT is((SELECT r->>'approval_id' FROM pedido_caro_2), (SELECT r->>'approval_id' FROM pedido_caro), 'Repetir o pedido não cria outra aprovação');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.approvals WHERE payload_json->>'chave' = '22222222-2222-2222-2222-222222222222'), 1, 'Só existe uma aprovação pendente');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE entity_type = 'approval' AND entity_id = (SELECT (r->>'approval_id')::uuid FROM pedido_caro)), 1,
  'O C-level é avisado uma vez só');
SELECT is((SELECT count(*)::int FROM public.executions WHERE metadata_json->>'chave' = '22222222-2222-2222-2222-222222222222'), 0, 'Nada entra na fila antes da aprovação');

-- Papel sem permissão continua sendo recusa de verdade (sem aprovação).
DELETE FROM public.role_permissions WHERE role_id = 'bdr' AND capability_key = 'agents.chat';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.copilot_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Sem papel', gen_random_uuid())->>'ok', 'false',
  'Papel sem permissão é recusado');

RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.copilot_request(uuid, uuid, text, uuid)', 'EXECUTE'), 'Sem login não pede nada');
SELECT ok(has_function_privilege('authenticated', 'public.copilot_request(uuid, uuid, text, uuid)', 'EXECUTE'), 'Quem está logado pode pedir');

SELECT * FROM finish();
ROLLBACK;
