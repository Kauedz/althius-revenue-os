-- ==============================================================================
-- Test: 00058_agentes_pipeline.sql
-- ADR 0043, fatia B: o agente lista e PROPÕE negócios e mudança de etapa; só a aprovação aplica.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03, Lucas BDR d..04, conta c0..01),
--       Grão Norte b0..01 (estrategista d..08, C-level d..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Fixtures: um quadro de cada workspace (do padrão), uma conta na Grão Norte e um negócio em cada.
CREATE TEMP TABLE fx ON COMMIT DROP AS SELECT
  (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_evolut,
  (SELECT id FROM public.pipelines WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_grao;
GRANT SELECT ON fx TO anon;
INSERT INTO public.accounts (id, workspace_id, name, domain, status)
VALUES ('ca000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Cerealista Boa Safra', 'boasafra.com.br', 'ativa');
INSERT INTO public.opportunities (id, workspace_id, pipeline_id, account_id, stage_key, title, amount, owner_member_id)
VALUES ('f9000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', 'qualificacao', 'CANÁRIO negócio EVOLUT-9902', 12345.67, 'd0000000-0000-0000-0000-000000000004'),
       ('f9000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', (SELECT q_grao FROM fx), 'ca000000-0000-0000-0000-0000000000b1', 'entrada', 'Negócio Grão Norte', 100, 'd0000000-0000-0000-0000-000000000008');

SELECT ok(has_function_privilege('anon', 'public.agent_list_deals(text, text)', 'EXECUTE'), 'Porta do agente: listar negócios aceita só o token');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_move_deal(text, uuid, text, text, text)', 'EXECUTE'), 'Porta do agente: propor mover');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_deal(text, uuid, uuid, numeric, text, uuid, date, text, text)', 'EXECUTE'), 'Porta do agente: propor negócio');
SELECT ok(NOT has_function_privilege('anon', 'public.approvals_aplicar_agente_pipeline()', 'EXECUTE'), 'Visitante não chama o aplicador');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;
GRANT SELECT ON tk TO anon;

SET LOCAL ROLE anon;

SELECT throws_ok($$ SELECT public.agent_list_deals('alt_agente_x') $$, '28000', NULL, 'listar negócios: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_list_pipelines('alt_agente_x') $$, '28000', NULL, 'listar quadros: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_list_accounts('alt_agente_x') $$, '28000', NULL, 'listar contas: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_propose_move_deal('alt_agente_x', 'f9000000-0000-0000-0000-0000000000a1', 'proposta', 'x', 'k') $$, '28000', NULL, 'propor mover: token inventado recusado');

-- Leitura isolada por workspace.
SELECT ok((SELECT public.agent_list_deals(evolut)::text LIKE '%EVOLUT-9902%' FROM tk), 'Evolut enxerga o próprio negócio');
SELECT ok((SELECT public.agent_list_deals(grao)::text NOT LIKE '%EVOLUT-9902%' FROM tk), 'CANÁRIO: Grão Norte nunca enxerga negócio da Evolut');
SELECT ok((SELECT public.agent_list_deals(evolut) @> '[{"id": "f9000000-0000-0000-0000-0000000000a1", "etapa": "qualificacao", "valor_reais": 12345.67, "status": "ativa"}]'::jsonb FROM tk), 'Negócio vem com etapa, valor em reais e status');
SELECT ok((SELECT public.agent_list_deals(evolut)::text NOT LIKE '%usd%' FROM tk), 'Nenhum dólar na resposta');
SELECT throws_ok($$ SELECT public.agent_list_deals((SELECT evolut FROM tk), 'qualquer') $$, '22023', NULL, 'Status inválido é recusado');
SELECT ok((SELECT public.agent_list_pipelines(evolut)::text LIKE '%' || (SELECT q_evolut::text FROM fx) || '%' AND public.agent_list_pipelines(grao)::text NOT LIKE '%' || (SELECT q_evolut::text FROM fx) || '%' FROM tk), 'Quadros: só os do próprio workspace');
SELECT ok((SELECT public.agent_list_accounts(grao)::text LIKE '%Boa Safra%' AND public.agent_list_accounts(evolut)::text NOT LIKE '%Boa Safra%' FROM tk), 'Contas: só as do próprio workspace');

-- Mover: validações.
SELECT is((SELECT public.agent_propose_move_deal(grao, 'f9000000-0000-0000-0000-0000000000a1', 'proposta', 'motivo', 'k-m-cross')->>'ok' FROM tk), 'false', 'Grão Norte não move negócio da Evolut');
SELECT is((SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'inexistente', 'motivo', 'k-m-etapa')->>'ok' FROM tk), 'false', 'Etapa inexistente é recusada');
SELECT is((SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'qualificacao', 'motivo', 'k-m-mesma')->>'erro' FROM tk), 'O negócio já está nesta etapa.', 'Mesma etapa é recusada');
SELECT is((SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'proposta', ' ', 'k-m-motivo')->>'ok' FROM tk), 'false', 'Sem motivo é recusado');

CREATE TEMP TABLE mv ON COMMIT DROP AS
SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'proposta', 'Reunião de proposta marcada', 'k-m-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM mv), 'aguardando_aprovacao', 'Mover vira aprovação pendente');
SELECT is((SELECT (public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'proposta', 'Reunião de proposta marcada', 'k-m-1')->>'approval_id') FROM tk), (SELECT r->>'approval_id' FROM mv), 'Mesma chave devolve a mesma aprovação');
RESET ROLE;

SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key IN ('k-m-cross', 'k-m-etapa', 'k-m-mesma', 'k-m-motivo')), 0, 'Propostas recusadas não criam aprovação');
SELECT results_eq(
  $$ SELECT category, approval_type, agent_code, status FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM mv) $$,
  $$ VALUES ('operacao'::text, 'execucao'::text, 'comercial'::text, 'pendente'::text) $$,
  'Mover é operação do agente, pendente');
SELECT is((SELECT stage_key FROM public.opportunities WHERE id = 'f9000000-0000-0000-0000-0000000000a1'), 'qualificacao', 'Antes da aprovação, o negócio não muda de etapa');

-- Aprovação aplica: etapa, chance padrão e histórico com QUEM aprovou.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM mv), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM mv)))->>'success',
  'true', 'C-level aprova a mudança de etapa');
SELECT results_eq(
  $$ SELECT stage_key, win_probability FROM public.opportunities WHERE id = 'f9000000-0000-0000-0000-0000000000a1' $$,
  $$ VALUES ('proposta'::text, (SELECT default_probability FROM public.stage_definitions WHERE stage_key = 'proposta')) $$,
  'Depois da aprovação, o negócio está na etapa nova com a chance padrão dela');
SELECT results_eq(
  $$ SELECT from_stage_key, to_stage_key, moved_by_member_id::text FROM public.opportunity_stage_history WHERE opportunity_id = 'f9000000-0000-0000-0000-0000000000a1' $$,
  $$ VALUES ('qualificacao'::text, 'proposta'::text, 'd0000000-0000-0000-0000-000000000003'::text) $$,
  'O histórico guarda quem aprovou o movimento');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.proposta_aplicada' AND entity_type = 'opportunity' AND entity_id = 'f9000000-0000-0000-0000-0000000000a1'), 'Aplicação fica na auditoria');

-- Proposta velha: se o negócio mudou de etapa depois do pedido, não sobrescreve.
RESET ROLE;
SET LOCAL ROLE anon;
CREATE TEMP TABLE mv2 ON COMMIT DROP AS
SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'negociacao', 'teste', 'k-m-2') AS r FROM tk;
RESET ROLE;
UPDATE public.opportunities SET stage_key = 'descoberta' WHERE id = 'f9000000-0000-0000-0000-0000000000a1';
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM mv2), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM mv2)));
SELECT is((SELECT stage_key FROM public.opportunities WHERE id = 'f9000000-0000-0000-0000-0000000000a1'), 'descoberta', 'Proposta velha não sobrescreve etapa mudada depois');
SELECT ok((SELECT history::text LIKE '%não aplicada%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM mv2)), 'Histórico explica que não foi aplicada');

-- Negócio perdido/arquivado não recebe proposta.
UPDATE public.opportunities SET status = 'arquivada' WHERE id = 'f9000000-0000-0000-0000-0000000000a1';
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_move_deal(evolut, 'f9000000-0000-0000-0000-0000000000a1', 'negociacao', 'teste', 'k-m-3')->>'erro' FROM tk), 'Este negócio não está mais ativo.', 'Negócio arquivado não é movido');
RESET ROLE;
UPDATE public.opportunities SET status = 'ativa' WHERE id = 'f9000000-0000-0000-0000-0000000000a1';

-- Criar negócio: validações.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_deal(evolut, (SELECT q_grao FROM fx), 'c0000000-0000-0000-0000-000000000001', 1000, 'entrada', 'd0000000-0000-0000-0000-000000000004', NULL, 'motivo', 'k-d-q')->>'ok' FROM tk), 'false', 'Quadro de outro workspace é recusado');
SELECT is((SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'ca000000-0000-0000-0000-0000000000b1', 1000, 'entrada', 'd0000000-0000-0000-0000-000000000004', NULL, 'motivo', 'k-d-c')->>'ok' FROM tk), 'false', 'Conta de outro workspace é recusada');
SELECT is((SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', 1000, 'entrada', 'd0000000-0000-0000-0000-000000000008', NULL, 'motivo', 'k-d-r')->>'ok' FROM tk), 'false', 'Responsável de outro workspace é recusado');
SELECT is((SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', -5, 'entrada', 'd0000000-0000-0000-0000-000000000004', NULL, 'motivo', 'k-d-v')->>'ok' FROM tk), 'false', 'Valor negativo é recusado');
SELECT is((SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', 1000, 'ganho', 'd0000000-0000-0000-0000-000000000004', NULL, 'motivo', 'k-d-g')->>'ok' FROM tk), 'false', 'Negócio novo não nasce ganho');

CREATE TEMP TABLE dl ON COMMIT DROP AS
SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', 25000, NULL, 'd0000000-0000-0000-0000-000000000004', '2026-12-31', 'Conta com sinal forte de compra', 'k-d-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM dl), 'aguardando_aprovacao', 'Criar negócio vira aprovação pendente');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key IN ('k-d-q', 'k-d-c', 'k-d-r', 'k-d-v', 'k-d-g')), 0, 'Propostas recusadas não criam aprovação');
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND amount = 25000), 0, 'Antes da aprovação, o negócio não existe');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM dl), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM dl)));
SELECT results_eq(
  $$ SELECT stage_key, amount::text, status, owner_member_id::text, close_date::text, win_probability FROM public.opportunities WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND amount = 25000 $$,
  $$ VALUES ('entrada'::text, '25000.00'::text, 'ativa'::text, 'd0000000-0000-0000-0000-000000000004'::text, '2026-12-31'::text, (SELECT default_probability FROM public.stage_definitions WHERE stage_key = 'entrada')) $$,
  'Depois da aprovação o negócio existe, na etapa de entrada, com chance padrão, dono e data');

-- Rejeitado: nada é criado.
RESET ROLE;
SET LOCAL ROLE anon;
CREATE TEMP TABLE dl2 ON COMMIT DROP AS
SELECT public.agent_propose_deal(evolut, (SELECT q_evolut FROM fx), 'c0000000-0000-0000-0000-000000000001', 777, 'entrada', 'd0000000-0000-0000-0000-000000000004', NULL, 'teste', 'k-d-2') AS r FROM tk;
RESET ROLE;
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM dl2), 'd0000000-0000-0000-0000-000000000003', 'rejeitado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM dl2)));
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE amount = 777), 0, 'Rejeitada: nenhum negócio');

-- Agente pausado.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET LOCAL ROLE authenticated;
SELECT public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', true);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_list_deals((SELECT evolut FROM tk)) $$, '55000', NULL, 'Agente pausado não lê negócios');
SELECT throws_ok($$ SELECT public.agent_propose_move_deal((SELECT evolut FROM tk), 'f9000000-0000-0000-0000-0000000000a1', 'proposta', 'x', 'k-pausa') $$, '55000', NULL, 'Agente pausado não propõe');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
