-- ==============================================================================
-- Test: 00074_agente_contexto_integracoes.sql
-- Agentes conectados, ticket 04: para o agente consultar um app conectado, o SISTEMA precisa saber quem pediu na rodada
-- em andamento (decisão do dono: vale o acesso de quem pediu). Função de sistema: só service_role.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03); Grão Norte b0..01 (estrategista d..08).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('anon', 'public.integration_agent_context(text)', 'EXECUTE'), 'Visitante não chama (o token do agente sozinho não basta)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_agent_context(text)', 'EXECUTE'), 'Nem usuário logado');
SELECT ok(has_function_privilege('service_role', 'public.integration_agent_context(text)', 'EXECUTE'), 'O sistema chama');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;

SELECT throws_ok($$ SELECT public.integration_agent_context('alt_agente_x') $$, '28000', NULL, 'token inventado recusado');

-- Sem pedido em andamento: o contexto existe, mas sem solicitante
SELECT is((SELECT public.integration_agent_context(evolut)->>'workspace_id' FROM tk), 'a0000000-0000-0000-0000-000000000001', 'O workspace vem do token, nunca de um parâmetro');
SELECT is((SELECT public.integration_agent_context(evolut)->>'agent_code' FROM tk), 'comercial', 'E o agente também');
SELECT ok((SELECT public.integration_agent_context(evolut)->'requester_member_id' = 'null'::jsonb FROM tk), 'Sem rodada em andamento: ninguém pediu');

-- Rodada em andamento: duas mensagens de pessoas diferentes; vale a mais recente
INSERT INTO public.chat_channels (id, workspace_id, slug, name) VALUES ('cc100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'teste-ctx', 'Teste contexto') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (id, workspace_id, channel_id, sender_type, sender_member_id, content, created_at) VALUES
  ('cd100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001', 'member', 'd0000000-0000-0000-0000-000000000002', 'Zoe, olha o HubSpot', now() - interval '20 seconds'),
  ('cd100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001', 'member', 'd0000000-0000-0000-0000-000000000003', 'Zoe, e o negócio da Serra Azul?', now() - interval '5 seconds');
INSERT INTO public.agent_channel_runs (id, workspace_id, channel_id, agent_id, status, deadline_at) VALUES
  ('ce100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001', 'comercial', 'in_flight', now() + interval '5 minutes');
INSERT INTO public.agent_channel_queue (workspace_id, channel_id, agent_id, message_id, status, run_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001', 'comercial', 'cd100000-0000-0000-0000-000000000001', 'in_flight', 'ce100000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'cc100000-0000-0000-0000-000000000001', 'comercial', 'cd100000-0000-0000-0000-000000000002', 'in_flight', 'ce100000-0000-0000-0000-000000000001');

SELECT is((SELECT public.integration_agent_context(evolut)->>'requester_member_id' FROM tk), 'd0000000-0000-0000-0000-000000000003', 'Solicitante = quem escreveu a mensagem mais recente da rodada (Aline)');

-- Isolamento: o agente do outro cliente nunca recebe o solicitante da Evolut
SELECT ok((SELECT public.integration_agent_context(grao)->'requester_member_id' = 'null'::jsonb FROM tk), 'CANÁRIO: o agente da Grão Norte não vê o solicitante da Evolut');
SELECT is((SELECT public.integration_agent_context(grao)->>'workspace_id' FROM tk), 'b0000000-0000-0000-0000-000000000001', 'Cada token vê só o próprio workspace');

-- Rodada encerrada: ninguém mais "está pedindo"
UPDATE public.agent_channel_runs SET status = 'done', finished_at = now() WHERE id = 'ce100000-0000-0000-0000-000000000001';
SELECT ok((SELECT public.integration_agent_context(evolut)->'requester_member_id' = 'null'::jsonb FROM tk), 'Rodada terminada: ninguém pediu (o agente não usa acesso fora de um pedido)');

-- Quem saiu do workspace não vale como solicitante
UPDATE public.agent_channel_runs SET status = 'in_flight', finished_at = NULL WHERE id = 'ce100000-0000-0000-0000-000000000001';
UPDATE public.workspace_members SET status = 'suspended' WHERE id = 'd0000000-0000-0000-0000-000000000003';
SELECT is((SELECT public.integration_agent_context(evolut)->>'requester_member_id' FROM tk), 'd0000000-0000-0000-0000-000000000002', 'Membro suspenso não vale: cai para o anterior ativo (Camila)');
UPDATE public.workspace_members SET status = 'active' WHERE id = 'd0000000-0000-0000-0000-000000000003';

-- Agente pausado pelo cliente: bloqueado
UPDATE public.workspace_agents SET estado = 'pausado' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial';
SELECT throws_ok($$ SELECT public.integration_agent_context((SELECT evolut FROM tk)) $$, '55000', NULL, 'Agente pausado: sem contexto, sem acesso a apps');

-- Auditoria do uso de app pelo agente (tabela encadeada: o trigger preenche a sequência e o hash)
SELECT ok(NOT has_function_privilege('anon', 'public.integration_agent_log(uuid, text, uuid, text, text, text)', 'EXECUTE'), 'Visitante não grava auditoria do agente');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_agent_log(uuid, text, uuid, text, text, text)', 'EXECUTE'), 'Nem usuário logado');
SELECT ok(has_function_privilege('service_role', 'public.integration_agent_log(uuid, text, uuid, text, text, text)', 'EXECUTE'), 'O sistema grava');
SELECT lives_ok($$ SELECT public.integration_agent_log('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000003', 'hubspot', 'get_crm_objects', 'ok') $$, 'Grava o uso: agente, em nome de quem, app, ferramenta, resultado');
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'agente_usou_integracao' AND new_values->>'ferramenta' = 'get_crm_objects'), 1, 'Fica na auditoria da Evolut');
SELECT is((SELECT new_values->>'em_nome_de' FROM public.audit_logs WHERE action = 'agente_usou_integracao' AND new_values->>'ferramenta' = 'get_crm_objects'), 'd0000000-0000-0000-0000-000000000003', 'Registra em nome de quem foi');
SELECT is((SELECT actor_role FROM public.audit_logs WHERE action = 'agente_usou_integracao' AND new_values->>'ferramenta' = 'get_crm_objects'), 'agent', 'Quem agiu foi o agente');
SELECT ok((SELECT seq IS NOT NULL AND hash IS NOT NULL FROM public.audit_logs WHERE action = 'agente_usou_integracao' AND new_values->>'ferramenta' = 'get_crm_objects'), 'A cadeia da auditoria foi preenchida pelo banco');
SELECT throws_ok($$ SELECT public.integration_agent_log('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000003', 'hubspot', 'x', 'talvez') $$, '22023', NULL, 'Resultado fora de ok, erro, negado: recusado');
SELECT throws_ok($$ SELECT public.integration_agent_log('a0000000-0000-0000-0000-000000000001', 'inventado', NULL, 'hubspot', 'x', 'ok') $$, '22023', NULL, 'Agente que não existe: recusado');

SELECT * FROM finish();
ROLLBACK;
