-- ==============================================================================
-- Test: 00062_canais_agentes_harness.sql
-- Harness de canal para os agentes (PR 12): fila por canal, um pedido por vez por agente, mensagens agrupadas,
-- batimento de vida, política de resposta (mention/owner/always), tentativas e isolamento entre workspaces.
-- Seed: Evolut a0..01 (Camila estrategista d..02/e..02, Aline C-level d..03/e..03, Lucas BDR d..04/e..04);
--       Grão Norte b0..01 (C-level d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Segurança: tabelas fechadas, executor só para o sistema.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agent_channel_queue'::regclass), 'Fila tem RLS ligada');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agent_channel_runs'::regclass), 'Lotes têm RLS ligada');
SELECT ok(NOT has_table_privilege('authenticated', 'public.agent_channel_queue', 'SELECT'), 'Usuário logado não lê a fila');
SELECT ok(NOT has_table_privilege('anon', 'public.agent_channel_runs', 'SELECT'), 'Visitante não lê os lotes');
SELECT ok(NOT has_function_privilege('authenticated', 'public.agent_harness_claim(integer, integer, integer, integer)', 'EXECUTE'), 'Usuário logado não pega lote');
SELECT ok(NOT has_function_privilege('anon', 'public.agent_harness_finish(uuid, boolean, text, text)', 'EXECUTE'), 'Visitante não termina lote');
SELECT ok(has_function_privilege('service_role', 'public.agent_harness_claim(integer, integer, integer, integer)', 'EXECUTE'), 'Sistema pega lote');
SELECT ok(has_function_privilege('service_role', 'public.agent_harness_reap(integer)', 'EXECUTE'), 'Sistema recolhe lotes parados');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.harness_falhar(uuid, text)', 'EXECUTE'), 'Peça interna fechada');
SELECT ok(has_function_privilege('authenticated', 'public.chat_set_agent_policy(uuid, uuid, text, text, text)', 'EXECUTE'), 'Gestor do canal muda a política (a função confere quem é)');

-- Canais: Evolut (Aline cria, com Camila e Lucas) e Grão Norte (Eduardo C-level).
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Harness teste', 'x',
  ARRAY['d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004']::uuid[], ARRAY['comercial', 'marketing'])->>'slug', 'harness-teste', 'Canal da Evolut criado');
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Harness dois', 'x',
  ARRAY['d0000000-0000-0000-0000-000000000002']::uuid[], ARRAY['comercial'])->>'slug', 'harness-dois', 'Segundo canal da Evolut criado');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(public.chat_create_channel('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'Harness grao', 'x',
  ARRAY['d0000000-0000-0000-0000-000000000009']::uuid[], ARRAY['comercial'])->>'slug', 'harness-grao', 'Canal da Grão Norte criado');

CREATE TEMP TABLE ch ON COMMIT DROP AS SELECT
  (SELECT id FROM public.chat_channels WHERE slug = 'harness-teste' AND workspace_id = 'a0000000-0000-0000-0000-000000000001') AS um,
  (SELECT id FROM public.chat_channels WHERE slug = 'harness-dois' AND workspace_id = 'a0000000-0000-0000-0000-000000000001') AS dois,
  (SELECT id FROM public.chat_channels WHERE slug = 'harness-grao' AND workspace_id = 'b0000000-0000-0000-0000-000000000001') AS grao;

-- 2. Política padrão "mention": só entra na fila quando o agente é chamado pelo nome.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'Bom dia, time', NULL, NULL)->>'ok', 'true', 'Mensagem comum enviada');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue), 0, 'Política mention: mensagem comum não chama ninguém');
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', '@Zoe, liste as contas quentes', NULL, 'comercial')->>'ok', 'true', 'Agente chamado pelo nome');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'comercial' AND channel_id = (SELECT um FROM ch)), 1, 'Chamado pelo nome entra na fila do canal');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT execution_id FROM public.agent_channel_queue LIMIT 1)), 'queued', 'O pedido passou pela política Hermes (execução criada)');

-- 3. Política "owner": só mensagem de quem criou o canal (Aline) chama o agente.
SELECT is(public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'marketing', 'owner')->>'ok', 'true', 'Quem criou o canal escolhe a política');
SELECT is(public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'marketing', 'sempre')->>'ok', 'false', 'Política inválida é recusada');
SELECT is(public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'revops', 'owner')->>'ok', 'false', 'Agente que não está no canal é recusado');
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'Quero um plano de campanha para setembro', NULL, NULL);
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 1, 'owner: mensagem de quem criou o canal chama o agente sem menção');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'harness-teste', 'Concordo com o plano', NULL, NULL);
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 1, 'owner: mensagem de outra pessoa não chama o agente');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'harness-teste', 'marketing', 'always')->>'ok', 'false', 'BDR não muda a política do canal');

-- 4. Política "always": toda mensagem de pessoa; agente nunca responde a agente nem ao sistema.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'comercial', 'always');
SELECT public.chat_set_agent_policy('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-teste', 'marketing', 'always');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'harness-teste', 'Qual o próximo passo?', NULL, NULL);
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'comercial'), 2, 'always: a mensagem de pessoa chama o Comercial');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 2, 'always: e o Marketing');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'harness-teste', 'Posso ajudar com a lista?', NULL, NULL);
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'comercial'), 3, 'always: BDR chama o Comercial');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 2, 'always: BDR não chama o Marketing (só Comercial e Copy)');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue q JOIN public.chat_messages m ON m.id = q.message_id WHERE m.sender_type <> 'member'), 0, 'Só mensagem de pessoa entra na fila (sem laço agente-agente)');

-- 5. Agrupar e um por vez. Nada "sossegou" ainda: com 1 hora de silêncio exigida, nada sai.
RESET ROLE;
SELECT is(jsonb_array_length(public.agent_harness_claim(3600, 3600, 300, 5)), 0, 'Canal que ainda não sossegou não sai');
UPDATE public.agent_channel_queue SET created_at = now() - interval '1 minute';
CREATE TEMP TABLE lotes ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5) AS l;
SELECT is((SELECT jsonb_array_length(l) FROM lotes), 2, 'Um lote por agente (Comercial e Marketing), cada um com as mensagens do canal juntas');
SELECT is((SELECT jsonb_array_length(x->'mensagens') FROM lotes, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), 3, 'Mensagens próximas agrupadas: 3 pedidos do Comercial viram 1 lote');
SELECT is((SELECT jsonb_array_length(x->'mensagens') FROM lotes, jsonb_array_elements(l) x WHERE x->>'agente' = 'marketing'), 2, 'Marketing: 2 mensagens no lote');
SELECT ok((SELECT bool_and(x->>'workspace_id' = 'a0000000-0000-0000-0000-000000000001' AND x->>'canal' = 'harness-teste') FROM lotes, jsonb_array_elements(l) x), 'O lote diz de qual workspace e canal veio');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE status = 'in_flight'), 5, 'Os pedidos do lote ficam em andamento');
SELECT is((SELECT reserved_credits FROM public.executions WHERE id = (SELECT execution_id FROM public.agent_channel_runs WHERE agent_id = 'comercial')), 3, 'Os créditos de UM pedido (2 + 25% de folga) ficam reservados para o lote');

-- Um por vez por agente: nova mensagem para o Comercial em outro canal espera.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'harness-dois', '@Zoe, e a outra lista?', NULL, 'comercial');
RESET ROLE;
UPDATE public.agent_channel_queue SET created_at = now() - interval '1 minute' WHERE status = 'pending';
SELECT is(jsonb_array_length(public.agent_harness_claim(3, 15, 300, 5)), 0, 'Um pedido por vez por agente: o Comercial ocupado não pega outro canal');

-- 6. Terminar com sucesso: resposta no canal, pedidos concluídos, créditos consumidos.
SELECT is(public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lotes, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), true, 'Aqui estão as contas quentes: ...', NULL)->>'action', 'answered', 'Resposta do agente gravada');
SELECT results_eq(
  $$ SELECT sender_type, sender_agent_id, channel_id::text FROM public.chat_messages WHERE content = 'Aqui estão as contas quentes: ...' $$,
  $$ VALUES ('agent'::text, 'comercial'::text, (SELECT um::text FROM ch)) $$,
  'A resposta aparece no canal certo, como mensagem do agente');
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue WHERE agent_id = 'comercial' AND channel_id = (SELECT um FROM ch) AND status = 'done'), 3, 'Os 3 pedidos do lote ficam concluídos');
SELECT is((SELECT actual_credits FROM public.executions WHERE id = (SELECT execution_id FROM public.agent_channel_runs WHERE agent_id = 'comercial' AND channel_id = (SELECT um FROM ch))), 2, 'Custo: 2 créditos pelo lote');
SELECT is((SELECT count(*)::int FROM public.executions e JOIN public.agent_channel_queue q ON q.execution_id = e.id WHERE q.channel_id = (SELECT um FROM ch) AND q.agent_id = 'comercial' AND e.status = 'completed'), 3, 'Todas as execuções do lote ficam concluídas');
SELECT is(public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lotes, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), true, 'de novo', NULL)->>'action', 'unchanged', 'Terminar de novo não duplica a resposta');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE sender_type = 'agent' AND channel_id = (SELECT um FROM ch) AND sender_agent_id = 'comercial'), 1, 'Uma resposta só');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.canal_respondeu' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'Resposta fica na auditoria');

-- Com o Comercial livre, o pedido do outro canal sai.
CREATE TEMP TABLE lotes2 ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5) AS l;
SELECT is((SELECT x->>'canal' FROM lotes2, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), 'harness-dois', 'Livre o agente, o pedido do segundo canal é pego');

-- 7. Falha e nova tentativa: espera de 5 s, 2ª tentativa só depois.
SELECT is(public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lotes2, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), false, NULL, 'Hermes fora do ar')->>'action', 'failed', 'Falha do executor é registrada');
SELECT results_eq(
  $$ SELECT status, attempts, (next_attempt_at > now() + interval '3 seconds' AND next_attempt_at < now() + interval '8 seconds') FROM public.agent_channel_queue WHERE channel_id = (SELECT dois FROM ch) $$,
  $$ VALUES ('pending'::text, 1, true) $$,
  'O pedido volta para a fila com espera de 5 s');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT execution_id FROM public.agent_channel_queue WHERE channel_id = (SELECT dois FROM ch))), 'queued', 'A execução volta a "na fila" para a nova tentativa');
UPDATE public.agent_channel_queue SET created_at = now() - interval '1 minute' WHERE channel_id = (SELECT dois FROM ch);
SELECT is((SELECT jsonb_array_length(x) FROM (SELECT public.agent_harness_claim(3, 15, 300, 5) AS x) s), 0, 'Antes do prazo de espera, o pedido não é pego de novo');
UPDATE public.agent_channel_queue SET next_attempt_at = now() WHERE channel_id = (SELECT dois FROM ch);
CREATE TEMP TABLE lotes3 ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5) AS l;
SELECT is((SELECT (x->>'tentativa')::int FROM lotes3, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), 2, 'Passado o prazo, sai de novo como 2ª tentativa');

-- 8. Batimento de vida: vivo enquanto avisa; sem aviso, o lote é recolhido e volta para a fila.
SELECT ok(public.agent_harness_heartbeat((SELECT (x->>'run_id')::uuid FROM lotes3, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial')), 'Batimento aceito enquanto o lote está em andamento');
SELECT is(public.agent_harness_reap(90), 0, 'Lote com batimento recente não é recolhido');
UPDATE public.agent_channel_runs SET heartbeat_at = now() - interval '5 minutes' WHERE status = 'in_flight' AND agent_id = 'comercial';
SELECT is(public.agent_harness_reap(90), 1, 'Lote sem batimento é recolhido');
SELECT ok(NOT public.agent_harness_heartbeat((SELECT (x->>'run_id')::uuid FROM lotes3, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial')), 'Depois de recolhido, o batimento é recusado (o executor deve parar)');
SELECT is((SELECT status FROM public.agent_channel_queue WHERE channel_id = (SELECT dois FROM ch)), 'pending', 'O pedido do lote recolhido voltou para a fila');
SELECT is(public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lotes3, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), true, 'resposta atrasada', NULL)->>'action', 'unchanged', 'Resposta de lote já recolhido é ignorada');

-- 9. Desistir na 10ª falha: pedido perdido e aviso no canal.
UPDATE public.agent_channel_queue SET attempts = 9, next_attempt_at = now() WHERE channel_id = (SELECT dois FROM ch);
CREATE TEMP TABLE lotes4 ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5) AS l;
SELECT public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lotes4, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), false, NULL, 'falhou de novo');
SELECT is((SELECT status FROM public.agent_channel_queue WHERE channel_id = (SELECT dois FROM ch)), 'dead', 'Na 10ª falha o pedido é dado como perdido');
SELECT ok(EXISTS (SELECT 1 FROM public.chat_messages WHERE channel_id = (SELECT dois FROM ch) AND sender_type = 'system' AND content LIKE '%não conseguiu responder%'), 'O canal é avisado');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.canal_pedido_perdido'), 'Pedido perdido fica na auditoria');

-- 10. Agente pausado pelo cliente não roda; sem saldo, o pedido é descartado com aviso.
UPDATE public.workspace_agents SET estado = 'pausado' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'marketing';
UPDATE public.agent_channel_runs SET status = 'failed', finished_at = now() WHERE status = 'in_flight';
UPDATE public.agent_channel_queue SET status = 'pending', run_id = NULL, next_attempt_at = now() WHERE agent_id = 'marketing';
SELECT is((SELECT count(*)::int FROM (SELECT x FROM jsonb_array_elements(public.agent_harness_claim(0, 0, 300, 5)) x WHERE x->>'agente' = 'marketing') s), 0, 'Agente pausado pelo cliente não roda (o pedido espera)');
UPDATE public.workspace_agents SET estado = 'ativo' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'marketing';
UPDATE public.agent_channel_queue SET attempts = attempts + 1 WHERE agent_id = 'marketing';  -- nova tentativa = nova chave de reserva
UPDATE public.workspace_settings SET auto_topup_enabled = false WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.credit_wallets SET allowance_balance = 0, topup_balance = 0, reserved_balance = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM (SELECT x FROM jsonb_array_elements(public.agent_harness_claim(0, 0, 300, 5)) x WHERE x->>'agente' = 'marketing') s), 0, 'Sem saldo, o lote não sai');
SELECT is((SELECT count(DISTINCT status)::int FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 1, 'Sem saldo, os pedidos do agente são descartados');
SELECT is((SELECT min(status) FROM public.agent_channel_queue WHERE agent_id = 'marketing'), 'dead', '... como perdidos');
SELECT ok(EXISTS (SELECT 1 FROM public.chat_messages WHERE channel_id = (SELECT um FROM ch) AND content LIKE '%saldo de créditos não cobre%'), 'O canal é avisado da falta de saldo');

-- 11. Isolamento entre workspaces: o pedido da Grão Norte volta para o canal da Grão Norte, nunca para a Evolut.
UPDATE public.credit_wallets SET allowance_balance = 5000 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT public.chat_send('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'harness-grao', '@Zoe, resuma o funil', NULL, 'comercial');
RESET ROLE;
UPDATE public.agent_channel_queue SET created_at = now() - interval '1 minute', next_attempt_at = now() WHERE channel_id = (SELECT grao FROM ch);
CREATE TEMP TABLE lg ON COMMIT DROP AS SELECT public.agent_harness_claim(3, 15, 300, 5) AS l;
SELECT ok((SELECT bool_and(x->>'workspace_id' = 'b0000000-0000-0000-0000-000000000001' AND (x->>'channel_id')::uuid = (SELECT grao FROM ch)) FROM lg, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), 'O lote da Grão Norte só traz o que é da Grão Norte');
SELECT ok(NOT (SELECT (l::text LIKE '%contas quentes%' OR l::text LIKE '%plano de campanha%') FROM lg), 'CANÁRIO: nada da Evolut aparece no lote da Grão Norte');
SELECT public.agent_harness_finish((SELECT (x->>'run_id')::uuid FROM lg, jsonb_array_elements(l) x WHERE x->>'agente' = 'comercial'), true, 'Funil da Grão Norte: ...', NULL);
SELECT is((SELECT workspace_id::text FROM public.chat_messages WHERE content = 'Funil da Grão Norte: ...'), 'b0000000-0000-0000-0000-000000000001', 'A resposta fica no workspace da Grão Norte');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE content = 'Funil da Grão Norte: ...' AND channel_id IN ((SELECT um FROM ch), (SELECT dois FROM ch))), 0, 'E nunca nos canais da Evolut');

SELECT * FROM finish();
ROLLBACK;
