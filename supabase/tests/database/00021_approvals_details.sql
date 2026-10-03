-- ==============================================================================
-- Test: 00021_approvals_details.sql
-- Aprovações com os campos que a tela mostra, "Solicitar ajustes" e leitura por papel.
-- Seed: Evolut a0..01; Camila estrategista d..02, Aline C-level d..03 (e..03),
--       Lucas BDR d..04 (e..04), Mateus C-level d..05; Rafael superadmin d..01 (e..01).
-- ==============================================================================

BEGIN;
SELECT plan(12);

SELECT has_column('public', 'approvals', 'approval_type', 'Aprovação tem tipo (copy, lista, orçamento...)');
SELECT has_column('public', 'approvals', 'preview', 'Aprovação tem prévia do que será feito');
SELECT has_column('public', 'approvals', 'deadline_at', 'Aprovação tem prazo');
SELECT has_column('public', 'approvals', 'history', 'Aprovação tem histórico');

SELECT is(
  (SELECT count(*)::int FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND status = 'pendente'),
  5,
  'Seed: Evolut começa com as 5 aprovações pendentes do protótipo'
);

-- Tipo de gasto precisa estar na categoria gasto (quem paga decide)
SELECT throws_ok(
  $$ INSERT INTO public.approvals (workspace_id, category, approval_type, title, requested_by_member_id, payload_hash)
     VALUES ('a0000000-0000-0000-0000-000000000001', 'operacao', 'orcamento', 'Verba', 'd0000000-0000-0000-0000-000000000002', 'x') $$,
  '23514', NULL,
  'Orçamento classificado como operação é recusado'
);

INSERT INTO public.approvals (id, workspace_id, category, approval_type, title, requested_by_member_id, status, payload_json, payload_hash, history)
VALUES ('ab000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'operacao', 'copy', 'E-mail T1',
        'd0000000-0000-0000-0000-000000000005', 'pendente', '{"x": 1}'::jsonb,
        encode(extensions.digest('{"x": 1}'::jsonb::text, 'sha256'), 'hex'), '["08:05 Criada"]'::jsonb);

-- Solicitar ajustes exige o que ajustar
SELECT is(
  public.approval_decide('ab000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 'ajustes_solicitados', '{"x": 1}'::jsonb, '  ')->>'status',
  'ajuste_sem_texto',
  'Pedir ajuste sem dizer o quê é recusado'
);

SELECT is(
  public.approval_decide('ab000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 'ajustes_solicitados', '{"x": 1}'::jsonb, 'Tom mais direto')->>'status',
  'ajustes_solicitados',
  'C-level pede ajustes com texto'
);

SELECT results_eq(
  $$ SELECT status, decision_notes, jsonb_array_length(history) FROM public.approvals WHERE id = 'ab000000-0000-0000-0000-0000000000a1' $$,
  $$ VALUES ('ajustes_solicitados'::text, 'Tom mais direto'::text, 2) $$,
  'Pedido de ajuste fica gravado com o texto e entra no histórico'
);

-- Leitura por papel
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is_empty(
  $$ SELECT 1 FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'BDR não lê a fila de aprovações do workspace'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT ok(
  (SELECT count(*) FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') >= 5,
  'C-level lê a fila de aprovações do workspace'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is_empty(
  $$ SELECT 1 FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'C-level de outro cliente não lê as aprovações da Evolut'
);

SELECT * FROM finish();
ROLLBACK;
