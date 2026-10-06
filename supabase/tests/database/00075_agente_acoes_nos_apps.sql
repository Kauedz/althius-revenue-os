-- ==============================================================================
-- Test: 00075_agente_acoes_nos_apps.sql
-- Agentes conectados, ticket 05: o agente PROPÕE uma ação num app conectado (ex.: HubSpot); vira aprovação; só depois de
-- aprovada a ação é executada UMA vez, com o acesso de quem pediu. Funções de sistema (service_role); isolamento por cliente.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03); Grão Norte b0..01 (estrategista d..08).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('anon', 'public.integration_agent_propose(text, text, text, text, jsonb, text, text, text)', 'EXECUTE'), 'Visitante não propõe ação em app');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_agent_propose(text, text, text, text, jsonb, text, text, text)', 'EXECUTE'), 'Nem usuário logado');
SELECT ok(has_function_privilege('service_role', 'public.integration_agent_propose(text, text, text, text, jsonb, text, text, text)', 'EXECUTE'), 'O serviço de integrações propõe, depois de validar a ferramenta');
SELECT ok(NOT has_function_privilege('anon', 'public.integration_action_claim()', 'EXECUTE'), 'Visitante não reivindica ação para executar');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_action_claim()', 'EXECUTE'), 'Nem usuário logado');
SELECT ok(has_function_privilege('service_role', 'public.integration_action_claim()', 'EXECUTE'), 'O executor reivindica');
SELECT ok(NOT has_function_privilege('anon', 'public.integration_action_finish(uuid, boolean, text)', 'EXECUTE'), 'Visitante não conclui ação');
SELECT ok(has_function_privilege('service_role', 'public.integration_action_finish(uuid, boolean, text)', 'EXECUTE'), 'O executor conclui');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;

-- Uma rodada em andamento: a Aline pediu
INSERT INTO public.chat_channels (id, workspace_id, slug, name) VALUES ('cc100000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'teste-acao', 'Teste ação') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (id, workspace_id, channel_id, sender_type, sender_member_id, content) VALUES
  ('cd100000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000005', 'member', 'd0000000-0000-0000-0000-000000000003', 'Zoe, atualize o negócio no HubSpot');
INSERT INTO public.agent_channel_runs (id, workspace_id, channel_id, agent_id, status, deadline_at) VALUES
  ('ce100000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000005', 'comercial', 'in_flight', now() + interval '5 minutes');
INSERT INTO public.agent_channel_queue (workspace_id, channel_id, agent_id, message_id, status, run_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000005', 'comercial', 'cd100000-0000-0000-0000-000000000005', 'in_flight', 'ce100000-0000-0000-0000-000000000005');

-- Proposta
SELECT throws_ok($$ SELECT public.integration_agent_propose('alt_agente_x', 'hubspot', 'manage_crm_objects', 'HubSpot', '{"id": "1"}'::jsonb, 'motivo', 'k-0', 'ana@norte.test') $$, '28000', NULL, 'token inventado recusado');
CREATE TEMP TABLE prop ON COMMIT DROP AS SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{"id": "1", "valor": 5000}'::jsonb, 'O cliente confirmou o novo valor por e-mail', 'k-acao-1', 'ana@norte.test') AS r;
SELECT is((SELECT r->>'ok' FROM prop), 'true', 'A proposta é aceita');
SELECT is((SELECT r->>'status' FROM prop), 'aguardando_aprovacao', 'E fica aguardando aprovação');
SELECT is((SELECT count(*)::int FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop) AND status = 'pendente' AND category = 'operacao' AND approval_type = 'execucao'), 1, 'Vira uma aprovação de operação, pendente');
SELECT is((SELECT requested_by_member_id::text FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'd0000000-0000-0000-0000-000000000002', 'Quem pede é o responsável pelo agente (como nas outras propostas)');
SELECT is((SELECT payload_json->>'em_nome_de' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'd0000000-0000-0000-0000-000000000003', 'A ação será feita em nome de quem pediu (Aline)');
SELECT ok((SELECT title LIKE '%HubSpot%' AND title LIKE '%manage_crm_objects%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'O título diz o app e a ação');
SELECT ok((SELECT preview LIKE '%5000%' AND impact LIKE '%ana@norte.test%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'A aprovação mostra o que será feito e em qual conta');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'aguardando', 'A ação fica guardada, aguardando');

-- Idempotência
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{"id": "1", "valor": 5000}'::jsonb, 'O cliente confirmou o novo valor por e-mail', 'k-acao-1', 'ana@norte.test')->>'approval_id'), (SELECT r->>'approval_id' FROM prop), 'A mesma proposta repetida não cria outra aprovação');
SELECT is((SELECT count(*)::int FROM internal.integration_actions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'Nem outra ação guardada');

-- Validações
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'nome com espaço', 'HubSpot', '{}'::jsonb, 'm', 'k-v1', 'x')->>'ok'), 'false', 'Nome de ferramenta estranho é recusado');
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'HubSpot!', 'manage_crm_objects', 'HubSpot', '{}'::jsonb, 'm', 'k-v2', 'x')->>'ok'), 'false', 'Código de app estranho é recusado');
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '[1]'::jsonb, 'm', 'k-v3', 'x')->>'ok'), 'false', 'Argumentos precisam ser um objeto');
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', jsonb_build_object('x', repeat('a', 9000)), 'm', 'k-v4', 'x')->>'ok'), 'false', 'Argumentos grandes demais são recusados');
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{}'::jsonb, '   ', 'k-v5', 'x')->>'ok'), 'false', 'Sem motivo é recusado');
SELECT is((SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{}'::jsonb, 'm', '', 'x')->>'ok'), 'false', 'Sem chave de idempotência é recusado');

-- Isolamento: o agente do outro cliente não tem solicitante, então nada é proposto
SELECT is((SELECT public.integration_agent_propose((SELECT grao FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{}'::jsonb, 'm', 'k-gn', 'x')->>'ok'), 'false', 'CANÁRIO: sem pessoa pedindo, o agente da Grão Norte não propõe nada');
SELECT is((SELECT count(*)::int FROM internal.integration_actions WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'Nada guardado para a Grão Norte');

-- Antes de aprovar, nada é reivindicado
SELECT is((SELECT public.integration_action_claim()), NULL::jsonb, 'Aprovação pendente: nenhuma ação é entregue ao executor');

-- Aprovada: o executor recebe UMA vez
UPDATE public.approvals SET status = 'aprovado', decided_by_member_id = 'd0000000-0000-0000-0000-000000000003', decided_at = now() WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop);
CREATE TEMP TABLE c1 ON COMMIT DROP AS SELECT public.integration_action_claim() AS r;
SELECT is((SELECT r->>'ferramenta' FROM c1), 'manage_crm_objects', 'Aprovada: o executor recebe a ação');
SELECT is((SELECT r->>'member_id' FROM c1), 'd0000000-0000-0000-0000-000000000003', 'Com o acesso de quem pediu (Aline)');
SELECT is((SELECT r->'argumentos'->>'valor' FROM c1), '5000', 'Com os argumentos aprovados');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'executando', 'Marcada como executando antes de tocar no app');
SELECT is((SELECT public.integration_action_claim()), NULL::jsonb, 'Uma vez só: ninguém mais recebe a mesma ação');

-- Conclusão
SELECT lives_ok($$ SELECT public.integration_action_finish((SELECT (r->>'approval_id')::uuid FROM prop), true, 'Negócio atualizado') $$, 'Conclui com sucesso');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'feita', 'Fica feita');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE recipient_member_id = 'd0000000-0000-0000-0000-000000000003' AND type = 'agent_action_done' AND entity_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 1, 'Quem pediu é avisado do resultado');
SELECT lives_ok($$ SELECT public.integration_action_finish((SELECT (r->>'approval_id')::uuid FROM prop), false, 'tentativa de sobrescrever') $$, 'Concluir de novo não quebra');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'feita', 'Mas não muda o que já foi concluído');

-- Recusada: nunca executa
CREATE TEMP TABLE prop2 ON COMMIT DROP AS SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{"id": "2"}'::jsonb, 'Outro pedido', 'k-acao-2', 'ana@norte.test') AS r;
UPDATE public.approvals SET status = 'rejeitado', decided_by_member_id = 'd0000000-0000-0000-0000-000000000003', decided_at = now() WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop2);
SELECT is((SELECT public.integration_action_claim()), NULL::jsonb, 'Recusada: o executor não recebe nada');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop2)), 'cancelada', 'E a ação é cancelada');

-- Travada em "executando": nunca é repetida (poderia executar duas vezes)
CREATE TEMP TABLE prop3 ON COMMIT DROP AS SELECT public.integration_agent_propose((SELECT evolut FROM tk), 'hubspot', 'manage_crm_objects', 'HubSpot', '{"id": "3"}'::jsonb, 'Terceiro pedido', 'k-acao-3', 'ana@norte.test') AS r;
UPDATE public.approvals SET status = 'aprovado', decided_by_member_id = 'd0000000-0000-0000-0000-000000000003', decided_at = now() WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop3);
SELECT is((SELECT public.integration_action_claim()->>'ferramenta'), 'manage_crm_objects', 'Terceira ação reivindicada');
UPDATE internal.integration_actions SET started_at = now() - interval '30 minutes' WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop3);
SELECT is((SELECT public.integration_action_claim()), NULL::jsonb, 'Travada: não é entregue de novo');
SELECT is((SELECT status FROM internal.integration_actions WHERE approval_id = (SELECT (r->>'approval_id')::uuid FROM prop3)), 'falhou', 'É marcada como falha, para uma pessoa conferir (nunca repetida sozinha)');

-- Auditoria
SELECT ok((SELECT count(*) >= 1 FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'agente_acao_integracao_concluida'), 'A conclusão fica na auditoria');

SELECT * FROM finish();
ROLLBACK;
