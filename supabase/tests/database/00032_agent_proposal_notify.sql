-- ==============================================================================
-- Test: 00032_agent_proposal_notify.sql
-- Seam: agent_propose_update (porta do agente). Quando o agente propõe, quem decide
-- operação naquele workspace (C-level e estrategista ativos) é avisado; ninguém de outro workspace.
-- Seed Evolut: Camila estrategista d..02, Aline C-level d..03, Lucas BDR d..04, Mateus C-level d..05.
-- Grão Norte: Camila d..08, Eduardo C-level d..09.
-- ==============================================================================

BEGIN;
SELECT no_plan();

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut;
CREATE TEMP TABLE prop ON COMMIT DROP AS
SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'cargo', 'Diretora Comercial', 'Assinatura de e-mail', 'k-aviso-1') AS r FROM tk;
CREATE TEMP TABLE avisados ON COMMIT DROP AS
SELECT recipient_member_id::text AS membro, workspace_id, title, type
FROM public.notifications WHERE entity_type = 'approval' AND entity_id = (SELECT (r->>'approval_id')::uuid FROM prop);

SELECT set_eq(
  $$ SELECT membro FROM avisados $$,
  ARRAY['d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005'],
  'Estrategista e os dois C-level da Evolut são avisados');
SELECT ok(NOT EXISTS (SELECT 1 FROM avisados WHERE membro = 'd0000000-0000-0000-0000-000000000004'), 'BDR não é avisado (não decide operação)');
SELECT ok(NOT EXISTS (SELECT 1 FROM avisados WHERE workspace_id <> 'a0000000-0000-0000-0000-000000000001'), 'Ninguém de outro workspace é avisado');
SELECT ok((SELECT bool_and(type = 'approval_required' AND title = 'Agente Comercial pede aprovação: Atualizar cargo de Aline Xavier (Serra Azul Têxtil)') FROM avisados),
  'Aviso diz qual agente pede e o quê');

-- Repetir a mesma proposta (idempotente) não avisa de novo.
SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'cargo', 'Diretora Comercial', 'Assinatura de e-mail', 'k-aviso-1') FROM tk;
SELECT is((SELECT count(*)::int FROM public.notifications WHERE entity_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 3,
  'Proposta repetida não duplica avisos');

-- Aprovação criada por pessoa (sem agente) segue como antes: este gatilho não avisa.
INSERT INTO public.approvals (id, workspace_id, category, approval_type, title, requested_by_member_id, payload_hash)
VALUES ('ab000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-000000000001', 'operacao', 'copy', 'Manual', 'd0000000-0000-0000-0000-000000000002', 'x');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE entity_id = 'ab000000-0000-0000-0000-0000000000c2'), 0,
  'Aprovação pedida por pessoa não passa por este aviso');

SELECT * FROM finish();
ROLLBACK;
