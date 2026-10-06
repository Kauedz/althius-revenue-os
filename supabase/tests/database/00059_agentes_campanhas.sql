-- ==============================================================================
-- Test: 00059_agentes_campanhas.sql
-- ADR 0043, fatia C: o agente lista e PROPÕE campanhas, verba e status; só a aprovação aplica.
-- Verba maior é GASTO: só o C-level decide (quem pede não decide). Nada vaza entre workspaces.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03); Grão Norte b0..01 (estrategista d..08, C-level d..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

INSERT INTO public.campaigns (id, workspace_id, name, channel_type, status, budget_brl, created_by) VALUES
  ('fa000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'CANÁRIO campanha EVOLUT-6604', 'linkedin_ads', 'rascunho', 1000, 'd0000000-0000-0000-0000-000000000002'),
  ('fa000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Campanha Grão Norte', 'meta_ads', 'rascunho', 500, 'd0000000-0000-0000-0000-000000000008');

SELECT ok(has_function_privilege('anon', 'public.agent_list_campaigns(text)', 'EXECUTE'), 'Porta do agente: listar campanhas aceita só o token');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_campaign_budget(text, uuid, numeric, text, text)', 'EXECUTE'), 'Porta do agente: propor verba');
SELECT ok(NOT has_function_privilege('anon', 'public.approvals_aplicar_agente_campanhas()', 'EXECUTE'), 'Visitante não chama o aplicador');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000008') AS grao;
GRANT SELECT ON tk TO anon;

SET LOCAL ROLE anon;

SELECT throws_ok($$ SELECT public.agent_list_campaigns('alt_agente_x') $$, '28000', NULL, 'listar: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_propose_campaign_budget('alt_agente_x', 'fa000000-0000-0000-0000-0000000000a1', 5000, 'x', 'k') $$, '28000', NULL, 'propor verba: token inventado recusado');

-- Leitura isolada.
SELECT ok((SELECT public.agent_list_campaigns(evolut)::text LIKE '%EVOLUT-6604%' FROM tk), 'Evolut enxerga a própria campanha');
SELECT ok((SELECT public.agent_list_campaigns(grao)::text NOT LIKE '%EVOLUT-6604%' FROM tk), 'CANÁRIO: Grão Norte nunca enxerga campanha da Evolut');
SELECT ok((SELECT public.agent_list_campaigns(evolut) @> '[{"id": "fa000000-0000-0000-0000-0000000000a1", "verba_reais": 1000, "status": "rascunho", "canal": "linkedin_ads"}]'::jsonb FROM tk), 'Campanha vem com canal, status e verba em reais');
SELECT ok((SELECT public.agent_list_campaigns(evolut)::text NOT LIKE '%usd%' FROM tk), 'Nenhum dólar na resposta');

-- Validações da verba.
SELECT is((SELECT public.agent_propose_campaign_budget(grao, 'fa000000-0000-0000-0000-0000000000a1', 5000, 'motivo', 'k-b-cross')->>'ok' FROM tk), 'false', 'Grão Norte não mexe na verba da Evolut');
SELECT is((SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', -1, 'motivo', 'k-b-neg')->>'ok' FROM tk), 'false', 'Verba negativa é recusada');
SELECT is((SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 1000, 'motivo', 'k-b-igual')->>'erro' FROM tk), 'A campanha já tem essa verba.', 'Mesma verba é recusada');
SELECT is((SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 5000, '  ', 'k-b-motivo')->>'ok' FROM tk), 'false', 'Sem motivo é recusado');

-- Aumento de verba: GASTO.
CREATE TEMP TABLE vb ON COMMIT DROP AS
SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 5000, 'CPL abaixo da meta', 'k-b-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM vb), 'aguardando_aprovacao', 'Aumento de verba vira aprovação pendente');
SELECT is((SELECT (public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 5000, 'CPL abaixo da meta', 'k-b-1')->>'approval_id') FROM tk), (SELECT r->>'approval_id' FROM vb), 'Mesma chave devolve a mesma aprovação');
SELECT is((SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 7000, 'outro valor', 'k-b-2')->>'ok' FROM tk), 'false', 'Com pedido de verba pendente, outro não empilha');
RESET ROLE;

SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key IN ('k-b-cross', 'k-b-neg', 'k-b-igual', 'k-b-motivo', 'k-b-2')), 0, 'Propostas recusadas não criam aprovação');
SELECT results_eq(
  $$ SELECT category, approval_type, agent_code, status FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb) $$,
  $$ VALUES ('gasto'::text, 'orcamento'::text, 'marketing'::text, 'pendente'::text) $$,
  'Aumento de verba é gasto (orçamento), pendente');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 1000, 'Antes da aprovação, a verba não muda');
-- O conteúdo precisa sobreviver à ida e volta pelo JavaScript (que escreve 1000, não 1000.00), senão o hash não bate.
SELECT is((SELECT payload_json->'de' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb))::text, '1000', 'Verba atual guardada sem zeros à direita (hash estável)');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.campaign_set_budget('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', 'fa000000-0000-0000-0000-0000000000b1', 900)->>'action', 'requested', 'Pedido de verba pela tela também nasce');
SELECT is((SELECT payload_json->'de' FROM public.approvals WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND payload_json->>'acao' = 'verba_campanha')::text, '500', 'Tela: verba atual também sem zeros à direita (hash estável)');

-- Quem pede não decide o gasto: a estrategista não aprova.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT isnt(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM vb), 'd0000000-0000-0000-0000-000000000002', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb)))->>'success',
  'true', 'Estrategista não aprova verba');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 1000, 'Gasto não aprovado: a verba não muda');

-- C-level aprova: a verba entra (pelo mesmo gatilho da tela).
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM vb), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb)))->>'success',
  'true', 'C-level aprova a verba');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 5000, 'Depois da aprovação, a verba da campanha é a nova');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'campaign.budget_applied' AND entity_id = 'fa000000-0000-0000-0000-0000000000a1'), 'Aplicação fica na auditoria');

-- Redução de verba: não é gasto, é operação.
RESET ROLE;
SET LOCAL ROLE anon;
CREATE TEMP TABLE vb2 ON COMMIT DROP AS
SELECT public.agent_propose_campaign_budget(evolut, 'fa000000-0000-0000-0000-0000000000a1', 2000, 'Campanha saturada', 'k-b-3') AS r FROM tk;
RESET ROLE;
SELECT results_eq(
  $$ SELECT category, approval_type FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb2) $$,
  $$ VALUES ('operacao'::text, 'execucao'::text) $$,
  'Reduzir a verba não é gasto');

-- Verba mudou depois do pedido: não sobrescreve.
UPDATE public.campaigns SET budget_brl = 3000 WHERE id = 'fa000000-0000-0000-0000-0000000000a1';
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM vb2), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb2)));
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 3000, 'Pedido velho não sobrescreve verba mudada depois');
SELECT ok((SELECT history::text LIKE '%não aplicada%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM vb2)), 'Histórico explica que não foi aplicada');

-- Criar campanha (sem verba).
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_campaign(evolut, '', 'linkedin_ads', 'motivo', 'k-c-nome')->>'ok' FROM tk), 'false', 'Campanha sem nome é recusada');
SELECT is((SELECT public.agent_propose_campaign(evolut, 'Nova', 'tiktok', 'motivo', 'k-c-canal')->>'ok' FROM tk), 'false', 'Canal inválido é recusado');
CREATE TEMP TABLE cp ON COMMIT DROP AS
SELECT public.agent_propose_campaign(evolut, 'Webinar de outubro', 'evento', 'Pipeline de eventos está vazio', 'k-c-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM cp), 'aguardando_aprovacao', 'Criar campanha vira aprovação pendente');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.campaigns WHERE name = 'Webinar de outubro'), 0, 'Antes da aprovação, a campanha não existe');
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM cp), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM cp)));
SELECT results_eq(
  $$ SELECT status, budget_brl::int, channel_type, workspace_id::text FROM public.campaigns WHERE name = 'Webinar de outubro' $$,
  $$ VALUES ('rascunho'::text, 0, 'evento'::text, 'a0000000-0000-0000-0000-000000000001'::text) $$,
  'Depois da aprovação a campanha existe, em rascunho, sem verba, no workspace certo');

-- Status.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_campaign_status(evolut, 'fa000000-0000-0000-0000-0000000000a1', 'rascunho', 'motivo', 'k-s-igual')->>'erro' FROM tk), 'A campanha já está neste status.', 'Mesmo status é recusado');
SELECT is((SELECT public.agent_propose_campaign_status(evolut, 'fa000000-0000-0000-0000-0000000000a1', 'voando', 'motivo', 'k-s-inv')->>'ok' FROM tk), 'false', 'Status inválido é recusado');
SELECT is((SELECT public.agent_propose_campaign_status(grao, 'fa000000-0000-0000-0000-0000000000a1', 'ativa', 'motivo', 'k-s-cross')->>'ok' FROM tk), 'false', 'Grão Norte não muda status da Evolut');
CREATE TEMP TABLE st ON COMMIT DROP AS
SELECT public.agent_propose_campaign_status(evolut, 'fa000000-0000-0000-0000-0000000000a1', 'ativa', 'Criativos aprovados', 'k-s-1') AS r FROM tk;
RESET ROLE;
SELECT is((SELECT status FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 'rascunho', 'Antes da aprovação, o status não muda');
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM st), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM st)));
SELECT is((SELECT status FROM public.campaigns WHERE id = 'fa000000-0000-0000-0000-0000000000a1'), 'ativa', 'Depois da aprovação, a campanha está ativa');

-- Agente pausado.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET LOCAL ROLE authenticated;
SELECT public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'marketing', true);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_list_campaigns((SELECT evolut FROM tk)) $$, '55000', NULL, 'Agente pausado não lê campanhas');
SELECT throws_ok($$ SELECT public.agent_propose_campaign_budget((SELECT evolut FROM tk), 'fa000000-0000-0000-0000-0000000000a1', 9000, 'x', 'k-pausa') $$, '55000', NULL, 'Agente pausado não propõe verba');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
