-- ==============================================================================
-- Test: 00052_motor_cadencia.sql
-- PR 06: motor de cadência. O worker chama, nesta ordem: cadence_claim_due -> cadence_prepare_step -> (envio) -> cadence_finish_step.
--   Passo automático: política Hermes, reserva de créditos, execução registrada, envio, consumo (ou liberação se falhar).
--   Passo manual: vira tarefa do responsável no dia. Resposta do contato pausa a cadência (unipile_ingest_message).
-- Seed: Lucas BDR (user e..04, membro d..04) é dono das contas c..01 e c..02; Bruna BDR (d..06) das c..03 e c..04.
--       Aline Xavier cb..01 (conta c..01) e Marcelo Antunes cb..04 (conta c..02) têm e-mail e telefone.
--       Contas de mensagem do Lucas: google ca5..01 (demo-lucas-google), whatsapp ca5..03 (demo-lucas-whatsapp).
--       Carteira da Evolut: 7950 de franquia, 0 reservado (consumo do mês do seed é lido como linha de base). Agente copy (Lia) ativo na Evolut.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Preparação (dono do banco)
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES
  ('f6100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cadência teste Evolut', 'ativa'),
  ('f6100000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Cadência teste Grão', 'ativa');
INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, subject, body, delay_days) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 1, 'email', 'auto', 'Oi', 'Texto do passo 1', 0),
  ('a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 2, 'linkedin', 'manual', NULL, 'Roteiro do passo 2', 2),
  ('a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 3, 'whatsapp', 'auto', NULL, 'Texto do passo 3', 1),
  ('b0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000002', 1, 'email', 'manual', NULL, 'x', 0);

CREATE TEMP TABLE t_base AS SELECT monthly_consumed AS c FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

-- 1. Permissões (ADR 0023): o worker é do sistema; a tela só inscreve e liga o automático
SELECT ok(has_function_privilege('service_role', 'public.cadence_claim_due(integer,boolean)', 'EXECUTE'), 'Backend busca os passos vencidos');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cadence_claim_due(integer,boolean)', 'EXECUTE'), 'Quem está logado não busca passos vencidos');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_claim_due(integer,boolean)', 'EXECUTE'), 'Sem login não busca');
SELECT ok(has_function_privilege('service_role', 'public.cadence_prepare_step(uuid,integer)', 'EXECUTE'), 'Backend prepara o passo');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cadence_prepare_step(uuid,integer)', 'EXECUTE'), 'Quem está logado não prepara passo');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_prepare_step(uuid,integer)', 'EXECUTE'), 'Sem login não prepara passo');
SELECT ok(has_function_privilege('service_role', 'public.cadence_finish_step(uuid,boolean,text,text,text)', 'EXECUTE'), 'Backend conclui o passo');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cadence_finish_step(uuid,boolean,text,text,text)', 'EXECUTE'), 'Quem está logado não conclui passo');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_finish_step(uuid,boolean,text,text,text)', 'EXECUTE'), 'Sem login não conclui passo');
SELECT ok(has_function_privilege('authenticated', 'public.cadence_enroll(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'Quem está logado inscreve contato');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_enroll(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'Sem login não inscreve');
SELECT ok(has_function_privilege('authenticated', 'public.cadence_set_auto(uuid,uuid,uuid,boolean)', 'EXECUTE'), 'Quem está logado liga o automático');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_set_auto(uuid,uuid,uuid,boolean)', 'EXECUTE'), 'Sem login não liga o automático');

-- 2. Inscrição pela tela (Lucas, BDR): só em contas dele
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE t_insc AS SELECT public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001') AS r;
GRANT ALL ON t_insc TO PUBLIC;
SELECT is((SELECT r->>'action' FROM t_insc), 'enrolled', 'Lucas inscreve um contato da própria conta');
SELECT is(public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001')->>'action', 'unchanged', 'Inscrever de novo não duplica');
SELECT throws_ok($$ SELECT public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007') $$,
  '42501', NULL, 'BDR não inscreve contato de conta da Bruna');
SELECT throws_ok($$ SELECT public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007') $$,
  '42501', NULL, 'BDR não inscreve em nome da Bruna');
SELECT throws_ok($$ SELECT public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000001') $$,
  '42501', NULL, 'Cadência de outro cliente não vale (isolamento)');
RESET ROLE;

SELECT is((SELECT owner_member_id FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 'd0000000-0000-0000-0000-000000000004'::uuid, 'Dono da inscrição é o dono da conta');
SELECT is((SELECT count(*) FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 3::bigint, 'Um passo por etapa da cadência');
SELECT ok((SELECT scheduled_at <= now() FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 1), 'Passo 1 vence já');
SELECT ok((SELECT scheduled_at IS NULL FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 2), 'Passo 2 só é agendado quando o 1 termina (espera relativa)');
SELECT is((SELECT auto_send FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), false, 'Envio automático nasce desligado');

-- 3. Sem o automático ligado, passo automático não envia sozinho: vira tarefa com o texto pronto
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(10, false)) x WHERE x->>'enrollment_id' = (SELECT r->>'enrollment_id' FROM t_insc)), 1::bigint,
  'Passo automático com envio desligado é tratado como manual (aparece mesmo sem provedor de envio)');

-- 4. Liga o automático: só nas próprias contas
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.cadence_set_auto('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'enrollment_id')::uuid FROM t_insc), true)->>'action', 'updated', 'Lucas liga o automático na própria inscrição');
RESET ROLE;
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id) VALUES
  ('f6200000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000006');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.cadence_set_auto('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000001', true) $$,
  '42501', NULL, 'BDR não liga o automático na inscrição da Bruna');
RESET ROLE;
DELETE FROM public.cadence_enrollments WHERE id = 'f6200000-0000-0000-0000-000000000001';

-- 5. Envio feito: prepara -> (envia) -> conclui
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(10, true)) x WHERE x->>'enrollment_id' = (SELECT r->>'enrollment_id' FROM t_insc) AND (x->>'step_number')::int = 1), 1::bigint, 'Passo 1 vencido aparece para o worker');

CREATE TEMP TABLE t_p1 AS SELECT public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 1) AS r;
SELECT is((SELECT r->>'action' FROM t_p1), 'send', 'Passo automático autorizado: pode enviar');
SELECT is((SELECT r->>'recipient' FROM t_p1), 'aline.xavier@serraazul.com.br', 'Destinatário é o e-mail do contato');
SELECT is((SELECT r->>'unipile_account_id' FROM t_p1), 'demo-lucas-google', 'Sai pela conta de e-mail do dono da inscrição');
SELECT is((SELECT r->>'body' FROM t_p1), 'Texto do passo 1', 'Texto do passo');
SELECT is((SELECT r->>'subject' FROM t_p1), 'Oi', 'Assunto do passo');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_p1)), 'running', 'Execução registrada e rodando');
SELECT is((SELECT agent_code FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_p1)), 'copy', 'Quem envia é a Lia (copy)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'Reserva de 4 créditos + 25% = 5');

-- Repetido: não duplica
CREATE TEMP TABLE t_p1b AS SELECT public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 1) AS r;
SELECT is((SELECT r->>'action' FROM t_p1b), 'in_flight', 'Preparar de novo enquanto o envio está em andamento não manda outro');
SELECT is((SELECT count(*) FROM public.executions WHERE metadata_json->>'cadence_key' = (SELECT (r->>'enrollment_id') FROM t_insc) || ':1'), 1::bigint, 'Uma execução por inscrição+passo');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'Reserva não dobrou');

SELECT is(public.cadence_finish_step((SELECT (r->>'execution_id')::uuid FROM t_p1), true, 'msg-ext-1', NULL, 'chat-ext-1')->>'action', 'sent', 'Envio concluído');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_p1)), 'completed', 'Execução concluída');
SELECT is((SELECT actual_credits FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_p1)), 4, 'Consumiu 4 créditos (não os 5 reservados)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Reserva liberada');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT c + 4 FROM t_base), 'Consumo do mês subiu 4');
SELECT is((SELECT count(*) FROM public.messages WHERE direction = 'out' AND sent_by = 'automation' AND text = 'Texto do passo 1' AND cadence_step_execution_id = (SELECT (r->>'execution_id')::uuid FROM t_p1)), 1::bigint, 'Mensagem enviada aparece na conversa');
SELECT is(public.cadence_finish_step((SELECT (r->>'execution_id')::uuid FROM t_p1), true, 'msg-ext-1', NULL, 'chat-ext-1')->>'action', 'unchanged', 'Concluir de novo não muda nada');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT c + 4 FROM t_base), 'Concluir de novo não cobra de novo');
SELECT is((SELECT status FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 1), 'executado', 'Passo 1 executado');
SELECT is((SELECT current_step_number FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 2, 'Inscrição avança para o passo 2');
SELECT ok((SELECT scheduled_at > now() + interval '1 day 23 hours' FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 2), 'Passo 2 agendado para daqui a 2 dias (espera)');
SELECT is(public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 1)->>'action', 'skip', 'Passo já executado não roda de novo');

-- 6. Passo manual vira tarefa do responsável, no dia
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(10, true)) x WHERE x->>'enrollment_id' = (SELECT r->>'enrollment_id' FROM t_insc)), 0::bigint, 'Passo 2 ainda não venceu: o worker não o vê');
UPDATE public.cadence_enrollment_steps SET scheduled_at = now() WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 2;
SELECT is(public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 2)->>'action', 'task_created', 'Passo manual gera tarefa');
SELECT is((SELECT count(*) FROM public.tasks WHERE source = 'cadencia' AND assignee_member_id = 'd0000000-0000-0000-0000-000000000004' AND channel = 'linkedin' AND contact_id = 'cb000000-0000-0000-0000-000000000001' AND note = 'Roteiro do passo 2'), 1::bigint, 'Tarefa do Lucas, no LinkedIn, com o roteiro');
SELECT is(public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 2)->>'action', 'skip', 'Preparar de novo não duplica a tarefa');
SELECT is((SELECT count(*) FROM public.tasks WHERE source = 'cadencia' AND contact_id = 'cb000000-0000-0000-0000-000000000001'), 1::bigint, 'Continua uma tarefa só');
SELECT is((SELECT current_step_number FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 3, 'Avançou para o passo 3');

-- 7. Agente pausado: não envia, avisa uma vez, e retoma sozinho
UPDATE public.cadence_enrollment_steps SET scheduled_at = now() WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3;
UPDATE public.workspace_agents SET estado = 'pausado' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'copy';
SELECT is(public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 3)->>'reason', 'agent_paused', 'Agente pausado: não envia');
SELECT is((SELECT count(*) FROM public.executions WHERE metadata_json->>'cadence_key' = (SELECT (r->>'enrollment_id') FROM t_insc) || ':3'), 0::bigint, 'Sem execução nem reserva');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_bloqueada' AND recipient_member_id = 'd0000000-0000-0000-0000-000000000004'), 1::bigint, 'Dono avisado');
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3;
SELECT is(public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 3)->>'reason', 'agent_paused', 'Segue bloqueado');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_bloqueada' AND recipient_member_id = 'd0000000-0000-0000-0000-000000000004'), 1::bigint, 'Sem aviso repetido');
SELECT ok((SELECT enrollment_id IS NOT NULL FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3 AND next_attempt_at > now()), 'Nova tentativa fica para mais tarde');

UPDATE public.workspace_agents SET estado = 'ativo' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'copy';
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3;
CREATE TEMP TABLE t_p3 AS SELECT public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 3) AS r;
SELECT is((SELECT r->>'action' FROM t_p3), 'send', 'Agente voltou: envia');
SELECT is((SELECT r->>'recipient' FROM t_p3), '11900000001', 'WhatsApp usa o telefone do contato');
SELECT is((SELECT r->>'unipile_account_id' FROM t_p3), 'demo-lucas-whatsapp', 'Sai pelo WhatsApp do dono');

-- 8. Falha no envio: libera a reserva, não cobra e tenta de novo depois
SELECT is(public.cadence_finish_step((SELECT (r->>'execution_id')::uuid FROM t_p3), false, NULL, 'provedor fora do ar', NULL)->>'action', 'failed', 'Falha registrada');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_p3)), 'failed', 'Execução marcada como falha');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Reserva liberada na falha');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT c + 4 FROM t_base), 'Falha não cobra');
SELECT is((SELECT status FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3), 'pendente', 'Passo segue pendente para nova tentativa');
SELECT is((SELECT attempts FROM public.cadence_enrollment_steps WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3), 1, 'Tentativa contada');
SELECT is((SELECT status FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 'ativa', 'Inscrição continua ativa');

-- Nova tentativa depois de uma falha usa outra execução (a anterior morreu), sem exceder 3 tentativas
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3;
CREATE TEMP TABLE t_p3b AS SELECT public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 3) AS r;
SELECT is((SELECT r->>'action' FROM t_p3b), 'send', 'Segunda tentativa prepara um novo envio');
SELECT isnt((SELECT r->>'execution_id' FROM t_p3b), (SELECT r->>'execution_id' FROM t_p3), 'Com execução nova');
SELECT is(public.cadence_finish_step((SELECT (r->>'execution_id')::uuid FROM t_p3b), false, NULL, 'de novo', NULL)->>'action', 'failed', 'Falha de novo');
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc) AND step_number = 3;
CREATE TEMP TABLE t_p3c AS SELECT public.cadence_prepare_step((SELECT (r->>'enrollment_id')::uuid FROM t_insc), 3) AS r;
SELECT is(public.cadence_finish_step((SELECT (r->>'execution_id')::uuid FROM t_p3c), false, NULL, 'terceira', NULL)->>'action', 'failed', 'Terceira falha');
SELECT is((SELECT status FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 'pausada', 'Três falhas pausam a inscrição (não fica tentando para sempre)');
SELECT is((SELECT pause_reason FROM public.cadence_enrollments WHERE id = (SELECT (r->>'enrollment_id')::uuid FROM t_insc)), 'falha_envio', 'Motivo da pausa registrado');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_pausada' AND recipient_member_id = 'd0000000-0000-0000-0000-000000000004'), 1::bigint, 'Dono avisado da pausa');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nenhuma reserva ficou presa');

-- 9. Falta de crédito: não envia e avisa
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f6200000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', true);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, scheduled_at) VALUES
  ('f6200000-0000-0000-0000-000000000002', 1, now()), ('f6200000-0000-0000-0000-000000000002', 2, NULL), ('f6200000-0000-0000-0000-000000000002', 3, NULL);
UPDATE public.credit_wallets SET allowance_balance = 2, topup_balance = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
CREATE TEMP TABLE t_p4 AS SELECT public.cadence_prepare_step('f6200000-0000-0000-0000-000000000002', 1) AS r;
SELECT is((SELECT r->>'action' FROM t_p4), 'blocked', 'Sem crédito: não envia');
SELECT is((SELECT count(*) FROM public.executions WHERE metadata_json->>'cadence_key' = 'f6200000-0000-0000-0000-000000000002:1'), 0::bigint, 'Sem execução autorizada');
SELECT is((SELECT status FROM public.cadence_enrollments WHERE id = 'f6200000-0000-0000-0000-000000000002'), 'pausada', 'Inscrição pausada');
SELECT ok((SELECT pause_reason IS NOT NULL FROM public.cadence_enrollments WHERE id = 'f6200000-0000-0000-0000-000000000002'), 'Motivo guardado');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_pausada' AND entity_id = 'f6200000-0000-0000-0000-000000000002'), 1::bigint, 'Dono avisado da falta de crédito');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nada reservado');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(50, true)) x WHERE x->>'enrollment_id' = 'f6200000-0000-0000-0000-000000000002'), 0::bigint, 'Inscrição pausada não é mais buscada');
UPDATE public.credit_wallets SET allowance_balance = 7950 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

-- 10. Resposta do contato pausa a cadência (unipile_ingest_message)
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f6200000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', true);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, scheduled_at) VALUES
  ('f6200000-0000-0000-0000-000000000003', 1, now()), ('f6200000-0000-0000-0000-000000000003', 2, NULL), ('f6200000-0000-0000-0000-000000000003', 3, NULL);
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(50, true)) x WHERE x->>'enrollment_id' = 'f6200000-0000-0000-0000-000000000003'), 1::bigint, 'Inscrição ativa é buscada');
SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'jonas.ribeiro@serraazul.com.br', 'chat-resp', 'msg-resp-1', 'Pode me ligar?', false, 'positiva')->>'action', 'persisted', 'Contato respondeu');
SELECT is((SELECT status FROM public.cadence_enrollments WHERE id = 'f6200000-0000-0000-0000-000000000003'), 'pausada_resposta', 'Resposta pausa a cadência');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.cadence_claim_due(50, true)) x WHERE x->>'enrollment_id' = 'f6200000-0000-0000-0000-000000000003'), 0::bigint, 'Pausada por resposta não é mais buscada');
SELECT is(public.cadence_prepare_step('f6200000-0000-0000-0000-000000000003', 1)->>'action', 'skip', 'Se a resposta chegar entre buscar e preparar, nada é enviado');
SELECT is((SELECT count(*) FROM public.executions WHERE metadata_json->>'cadence_key' = 'f6200000-0000-0000-0000-000000000003:1'), 0::bigint, 'Nenhuma execução para a inscrição pausada');

SELECT * FROM finish();
ROLLBACK;
