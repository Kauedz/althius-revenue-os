-- ==============================================================================
-- Test: 00057_agentes_tarefas_cadencias.sql
-- ADR 0043, fatia A: o agente lista e PROPÕE tarefas e inscrições em cadência; só a aprovação aplica.
-- Gasto (cadência com envio automático) só o C-level decide. Nada vaza entre workspaces.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03, Lucas BDR d..04), contatos cb..01/cb..02;
--       Grão Norte b0..01 (estrategista d..08, C-level d..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Dados do teste
INSERT INTO public.accounts (id, workspace_id, name, domain, status)
VALUES ('ca000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Cerealista Boa Safra', 'boasafra.com.br', 'ativa');
INSERT INTO public.contacts (id, workspace_id, account_id, name)
VALUES ('cc000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000b1', 'Renata Lopes');
INSERT INTO public.tasks (id, workspace_id, title, assignee_member_id, status)
VALUES ('f7000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'CANÁRIO tarefa EVOLUT-4417', 'd0000000-0000-0000-0000-000000000004', 'pendente'),
       ('f7000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Tarefa da Grão Norte', 'd0000000-0000-0000-0000-000000000008', 'pendente');
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES
  ('f8000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'CANÁRIO cadência auto EVOLUT', 'ativa'),
  ('f8000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'Cadência só manual', 'ativa'),
  ('f8000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Cadência Grão Norte', 'ativa');
INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, subject, body, delay_days) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-0000000000a1', 1, 'email', 'auto', 'Oi', 'Olá {{primeiro_nome}}', 0),
  ('a0000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-0000000000a1', 2, 'whatsapp', 'auto', NULL, 'Segue o contato', 2),
  ('a0000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-0000000000a1', 3, 'call', 'manual', NULL, 'Ligar', 3),
  ('a0000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-0000000000a2', 1, 'linkedin', 'manual', NULL, 'Conectar', 0),
  ('b0000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-0000000000b1', 1, 'email', 'auto', 'Oi', 'Olá', 0);

-- 1. Permissões: a porta do agente aceita só o token; as peças internas ficam fechadas.
SELECT ok(has_function_privilege('anon', 'public.agent_list_tasks(text, text)', 'EXECUTE'), 'Porta do agente: listar tarefas aceita só o token');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_task(text, text, uuid, uuid, integer, text, text, text)', 'EXECUTE'), 'Porta do agente: propor tarefa');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_enrollment(text, uuid, uuid, text, text)', 'EXECUTE'), 'Porta do agente: propor inscrição');
SELECT ok(NOT has_function_privilege('anon', 'internal.agente_propor(public.agent_runtime_tokens, text, text, text, text, text, text, jsonb, text, integer)', 'EXECUTE'), 'Visitante não chama o criador interno de propostas');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.cadence_enroll_core(uuid, uuid, uuid, uuid, uuid)', 'EXECUTE'), 'Usuário logado não chama o núcleo da inscrição');
SELECT ok(NOT has_function_privilege('anon', 'public.approvals_aplicar_agente_operacoes()', 'EXECUTE'), 'Visitante não chama o aplicador');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;
GRANT SELECT ON tk TO anon;

SET LOCAL ROLE anon;

-- 2. Token inventado é recusado em todas as ferramentas.
SELECT throws_ok($$ SELECT public.agent_list_tasks('alt_agente_x') $$, '28000', NULL, 'listar tarefas: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_list_cadences('alt_agente_x') $$, '28000', NULL, 'listar cadências: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_list_members('alt_agente_x') $$, '28000', NULL, 'listar membros: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_propose_task('alt_agente_x', 'x', NULL, 'd0000000-0000-0000-0000-000000000004', 1, NULL, 'x', 'k') $$, '28000', NULL, 'propor tarefa: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_propose_enrollment('alt_agente_x', 'f8000000-0000-0000-0000-0000000000a1', 'cb000000-0000-0000-0000-000000000001', 'x', 'k') $$, '28000', NULL, 'propor inscrição: token inventado recusado');

-- 3. Leitura: cada agente enxerga só o próprio workspace.
SELECT ok((SELECT public.agent_list_tasks(evolut)::text LIKE '%EVOLUT-4417%' FROM tk), 'Evolut enxerga a própria tarefa');
SELECT ok((SELECT public.agent_list_tasks(grao)::text NOT LIKE '%EVOLUT-4417%' FROM tk), 'CANÁRIO: Grão Norte nunca enxerga tarefa da Evolut');
SELECT is((SELECT jsonb_array_length(public.agent_list_tasks(grao)) FROM tk), 1, 'Grão Norte vê só a própria tarefa');
SELECT is((SELECT jsonb_array_length(public.agent_list_tasks(evolut, 'concluida')) FROM tk), 0, 'Filtro por status funciona');
SELECT throws_ok($$ SELECT public.agent_list_tasks((SELECT evolut FROM tk), 'qualquer') $$, '22023', NULL, 'Status inválido é recusado');
SELECT ok((SELECT public.agent_list_cadences(evolut)::text LIKE '%CANÁRIO cadência auto EVOLUT%' FROM tk), 'Evolut enxerga a própria cadência');
SELECT ok((SELECT public.agent_list_cadences(grao)::text NOT LIKE '%EVOLUT%' FROM tk), 'CANÁRIO: Grão Norte nunca enxerga cadência da Evolut');
SELECT ok((SELECT public.agent_list_cadences(evolut) @> '[{"id": "f8000000-0000-0000-0000-0000000000a1", "passos": 3, "passos_automaticos": 2, "creditos_por_contato": 8}]'::jsonb FROM tk), 'Cadência mostra passos, automáticos e custo em créditos');
SELECT ok((SELECT public.agent_list_members(evolut)::text LIKE '%d0000000-0000-0000-0000-000000000004%' AND public.agent_list_members(grao)::text NOT LIKE '%d0000000-0000-0000-0000-000000000004%' FROM tk), 'Membros: só os do próprio workspace');

-- 4. Propor tarefa: validações (nada é criado quando recusa).
SELECT is((SELECT public.agent_propose_task(evolut, '   ', NULL, 'd0000000-0000-0000-0000-000000000004', 1, NULL, 'motivo', 'k-t-vazio')->>'ok' FROM tk), 'false', 'Título vazio é recusado');
SELECT is((SELECT public.agent_propose_task(evolut, 'Ligar', NULL, 'd0000000-0000-0000-0000-000000000004', 1, NULL, '  ', 'k-t-semmotivo')->>'ok' FROM tk), 'false', 'Sem motivo é recusado');
SELECT is((SELECT public.agent_propose_task(evolut, 'Ligar', NULL, 'd0000000-0000-0000-0000-000000000004', 91, NULL, 'motivo', 'k-t-prazo')->>'ok' FROM tk), 'false', 'Prazo acima de 90 dias é recusado');
SELECT is((SELECT public.agent_propose_task(evolut, 'Ligar', NULL, 'd0000000-0000-0000-0000-000000000008', 1, NULL, 'motivo', 'k-t-resp')->>'ok' FROM tk), 'false', 'Responsável de outro workspace é recusado');
SELECT is((SELECT public.agent_propose_task(evolut, 'Ligar', 'cc000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000004', 1, NULL, 'motivo', 'k-t-contato')->>'ok' FROM tk), 'false', 'Contato de outro workspace é recusado');

-- Proposta válida.
CREATE TEMP TABLE tp ON COMMIT DROP AS
SELECT public.agent_propose_task(evolut, 'Ligar para Aline sobre a proposta', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 2, 'Citar o case', 'Aline abriu o e-mail 3 vezes', 'k-t-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM tp), 'aguardando_aprovacao', 'Tarefa proposta vira aprovação pendente');
SELECT is((SELECT (public.agent_propose_task(evolut, 'Ligar para Aline sobre a proposta', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 2, 'Citar o case', 'Aline abriu o e-mail 3 vezes', 'k-t-1')->>'approval_id') FROM tk),
  (SELECT r->>'approval_id' FROM tp), 'Mesma chave devolve a mesma aprovação');
RESET ROLE;

SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key IN ('k-t-vazio', 'k-t-semmotivo', 'k-t-prazo', 'k-t-resp', 'k-t-contato')), 0, 'Propostas recusadas não criam aprovação');
SELECT results_eq(
  $$ SELECT category, approval_type, agent_code, requested_by_member_id::text, status FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM tp) $$,
  $$ VALUES ('operacao'::text, 'execucao'::text, 'comercial'::text, 'd0000000-0000-0000-0000-000000000002'::text, 'pendente'::text) $$,
  'Tarefa é operação: mostra o agente e quem responde por ele');
SELECT is((SELECT count(*)::int FROM public.tasks WHERE title = 'Ligar para Aline sobre a proposta'), 0, 'Antes da aprovação, nenhuma tarefa existe');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = (SELECT (r->>'approval_id')::uuid FROM tp) AND action = 'agente.proposta_criada'), 'Proposta fica na auditoria');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications WHERE entity_id = (SELECT (r->>'approval_id')::uuid FROM tp) AND recipient_member_id = 'd0000000-0000-0000-0000-000000000003'), 'O C-level é avisado da proposta');

-- 5. Aprovação cria a tarefa, com origem "agente".
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM tp), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM tp)))->>'success',
  'true', 'C-level aprova a tarefa');
SELECT results_eq(
  $$ SELECT source, agent_id, assignee_member_id::text, contact_id::text, status, (due_at > now() + interval '1 day 23 hours') FROM public.tasks WHERE title = 'Ligar para Aline sobre a proposta' $$,
  $$ VALUES ('agente'::text, 'comercial'::text, 'd0000000-0000-0000-0000-000000000004'::text, 'cb000000-0000-0000-0000-000000000001'::text, 'pendente'::text, true) $$,
  'Depois da aprovação a tarefa existe, do agente, para o responsável certo, com prazo');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.proposta_aplicada' AND entity_type = 'task' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'Aplicação fica na auditoria');

-- Responsável que saiu entre o pedido e a aprovação: a tarefa NÃO é criada e o histórico explica.
RESET ROLE;
SET LOCAL ROLE anon;
CREATE TEMP TABLE tp2 ON COMMIT DROP AS
SELECT public.agent_propose_task(evolut, 'Tarefa para quem vai sair', NULL, 'd0000000-0000-0000-0000-000000000004', 0, NULL, 'teste', 'k-t-2') AS r FROM tk;
RESET ROLE;
UPDATE public.workspace_members SET status = 'suspended' WHERE id = 'd0000000-0000-0000-0000-000000000004';
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM tp2), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM tp2)));
SELECT is((SELECT count(*)::int FROM public.tasks WHERE title = 'Tarefa para quem vai sair'), 0, 'Responsável inativo: tarefa não é criada');
SELECT ok((SELECT history::text LIKE '%Tarefa não criada%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM tp2)), 'Histórico explica por que não criou');
UPDATE public.workspace_members SET status = 'active' WHERE id = 'd0000000-0000-0000-0000-000000000004';

-- Rejeitada: nada é criado.
SET LOCAL ROLE anon;
CREATE TEMP TABLE tp3 ON COMMIT DROP AS
SELECT public.agent_propose_task(evolut, 'Tarefa rejeitada', NULL, 'd0000000-0000-0000-0000-000000000004', 0, NULL, 'teste', 'k-t-3') AS r FROM tk;
RESET ROLE;
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM tp3), 'd0000000-0000-0000-0000-000000000003', 'rejeitado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM tp3)));
SELECT is((SELECT count(*)::int FROM public.tasks WHERE title = 'Tarefa rejeitada'), 0, 'Rejeitada: nenhuma tarefa');

-- 6. Inscrição em cadência: validações.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000b1', 'cb000000-0000-0000-0000-000000000001', 'motivo', 'k-e-cadgrao')->>'ok' FROM tk), 'false', 'Cadência de outro workspace é recusada');
SELECT is((SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000a1', 'cc000000-0000-0000-0000-0000000000b1', 'motivo', 'k-e-contgrao')->>'ok' FROM tk), 'false', 'Contato de outro workspace é recusado');
SELECT is((SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000a1', 'cb000000-0000-0000-0000-000000000001', '', 'k-e-semmotivo')->>'ok' FROM tk), 'false', 'Sem motivo é recusado');

-- Com envio automático: é GASTO.
CREATE TEMP TABLE ep ON COMMIT DROP AS
SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000a1', 'cb000000-0000-0000-0000-000000000001', 'Aline respondeu o convite', 'k-e-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM ep), 'aguardando_aprovacao', 'Inscrição proposta vira aprovação pendente');
RESET ROLE;
SELECT results_eq(
  $$ SELECT category, approval_type, estimated_credits, status FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM ep) $$,
  $$ VALUES ('gasto'::text, 'execucao_limite'::text, 8, 'pendente'::text) $$,
  'Cadência com envio automático é gasto, com os créditos estimados');
SELECT is((SELECT count(*)::int FROM public.cadence_enrollments WHERE cadence_id = 'f8000000-0000-0000-0000-0000000000a1'), 0, 'Antes da aprovação, ninguém é inscrito');

-- Quem pede não decide o gasto: a estrategista (que responde pelo agente) não aprova.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT isnt(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM ep), 'd0000000-0000-0000-0000-000000000002', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM ep)))->>'success',
  'true', 'Estrategista não aprova gasto');
SELECT is((SELECT count(*)::int FROM public.cadence_enrollments WHERE cadence_id = 'f8000000-0000-0000-0000-0000000000a1'), 0, 'Gasto não aprovado: ninguém é inscrito');

-- C-level aprova: inscreve, com a espera do primeiro passo e dono da conta.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM ep), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM ep)))->>'success',
  'true', 'C-level aprova o gasto');
SELECT is((SELECT count(*)::int FROM public.cadence_enrollments WHERE cadence_id = 'f8000000-0000-0000-0000-0000000000a1' AND contact_id = 'cb000000-0000-0000-0000-000000000001' AND status = 'ativa'), 1, 'Depois da aprovação, o contato está inscrito');
SELECT is((SELECT count(*)::int FROM public.cadence_enrollment_steps es JOIN public.cadence_enrollments e ON e.id = es.enrollment_id WHERE e.cadence_id = 'f8000000-0000-0000-0000-0000000000a1' AND es.scheduled_at IS NOT NULL), 1, 'Só o primeiro passo recebe data');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.proposta_aplicada' AND entity_type = 'cadence_enrollment'), 'Inscrição fica na auditoria');

-- Já inscrito: nova proposta é recusada.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000a1', 'cb000000-0000-0000-0000-000000000001', 'de novo', 'k-e-2')->>'erro' FROM tk), 'Este contato já está nesta cadência.', 'Contato já inscrito não é proposto de novo');

-- Só manual: não gasta, vira operação.
CREATE TEMP TABLE ep2 ON COMMIT DROP AS
SELECT public.agent_propose_enrollment(evolut, 'f8000000-0000-0000-0000-0000000000a2', 'cb000000-0000-0000-0000-000000000002', 'Contato frio', 'k-e-3') AS r FROM tk;
RESET ROLE;
SELECT results_eq(
  $$ SELECT category, approval_type, estimated_credits FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM ep2) $$,
  $$ VALUES ('operacao'::text, 'execucao'::text, 0) $$,
  'Cadência só manual não gasta: é operação');

-- 7. Agente pausado não propõe nada.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET LOCAL ROLE authenticated;
SELECT public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', true);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_propose_task((SELECT evolut FROM tk), 'x', NULL, 'd0000000-0000-0000-0000-000000000004', 1, NULL, 'x', 'k-pausa') $$, '55000', NULL, 'Agente pausado não propõe tarefa');
SELECT throws_ok($$ SELECT public.agent_list_tasks((SELECT evolut FROM tk)) $$, '55000', NULL, 'Agente pausado não lê tarefas');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
