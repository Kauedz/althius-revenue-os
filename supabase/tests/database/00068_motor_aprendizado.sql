-- ==============================================================================
-- Test: 00068_motor_aprendizado.sql
-- Motor do aprendizado compartilhado (ADR 0052): só lê quem aceitou, só publica padrões com contas suficientes, nunca
-- vaza dado de ninguém, sugere (não aplica) para contas parecidas, e respeita quem desliga.
-- Os clientes sintéticos (A..G) são criados aqui; o seed não é usado como fonte.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Apoio: monta n envios de cadência (com resposta e intenção) para um cliente, segmento, canal e passo.
CREATE OR REPLACE FUNCTION pg_temp.cliente(p_letra TEXT, p_seg TEXT, p_provider TEXT, p_membro UUID DEFAULT 'd0000000-0000-0000-0000-000000000003') RETURNS UUID AS $$
DECLARE v_ws UUID := gen_random_uuid(); v_cad UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.workspaces (id, name, slug) VALUES (v_ws, 'CANARIO-WS-' || p_letra, 'canario-' || lower(p_letra) || '-' || substr(v_ws::text, 1, 6));
  INSERT INTO public.accounts (workspace_id, name, domain, segment) VALUES (v_ws, 'CANARIO-EMPRESA-' || p_letra, 'canario-' || lower(p_letra) || '.test', p_seg);
  INSERT INTO public.messaging_accounts (workspace_id, member_id, provider, unipile_account_id)
    VALUES (v_ws, p_membro, p_provider, 'canario-' || v_ws);
  INSERT INTO public.cadences (id, workspace_id, name) VALUES (v_cad, v_ws, 'Cadência ' || p_letra);
  RETURN v_ws;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.envios(p_ws UUID, p_canal TEXT, p_passo INT, p_n INT, p_resp INT, p_pos INT, p_seg TEXT DEFAULT NULL) RETURNS VOID AS $$
DECLARE
  v_acc UUID; v_cad UUID; v_ma UUID; v_ct UUID; v_conv UUID; v_ex UUID; v_enr UUID; i INT;
BEGIN
  IF p_seg IS NULL THEN SELECT id INTO v_acc FROM public.accounts WHERE workspace_id = p_ws ORDER BY length(name) LIMIT 1;
  ELSE INSERT INTO public.accounts (workspace_id, name, domain, segment) VALUES (p_ws, 'CANARIO-EMPRESA-' || p_seg, gen_random_uuid() || '.test', p_seg) RETURNING id INTO v_acc; END IF;
  SELECT id INTO v_cad FROM public.cadences WHERE workspace_id = p_ws LIMIT 1;
  SELECT id INTO v_ma FROM public.messaging_accounts WHERE workspace_id = p_ws LIMIT 1;
  FOR i IN 1..p_n LOOP
    INSERT INTO public.contacts (workspace_id, account_id, name) VALUES (p_ws, v_acc, 'CANARIO-CONTATO-' || i) RETURNING id INTO v_ct;
    INSERT INTO public.conversations (workspace_id, contact_id, account_id, messaging_account_id, channel, external_chat_id, intent)
      VALUES (p_ws, v_ct, v_acc, v_ma, p_canal, 'chat-' || gen_random_uuid(), CASE WHEN i <= p_pos THEN 'positiva' ELSE 'neutra' END) RETURNING id INTO v_conv;
    INSERT INTO public.executions (workspace_id, capability_key, requested_by_member_id)
      VALUES (p_ws, 'cadencia.enviar', 'd0000000-0000-0000-0000-000000000003') RETURNING id INTO v_ex;
    INSERT INTO public.cadence_enrollments (workspace_id, cadence_id, contact_id) VALUES (p_ws, v_cad, v_ct) RETURNING id INTO v_enr;
    INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, execution_id, status) VALUES (v_enr, p_passo, v_ex, 'executado');
    INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by, cadence_step_execution_id, created_at)
      VALUES (p_ws, v_conv, 'out', 'm-' || gen_random_uuid(), 'CANARIO-TEXTO-ENVIADO', 'automation', v_ex, now() - interval '5 days');
    IF i <= p_resp THEN
      INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by, created_at)
        VALUES (p_ws, v_conv, 'in', 'm-' || gen_random_uuid(), 'CANARIO-TEXTO-RESPOSTA', 'member', now() - interval '4 days');
    END IF;
  END LOOP;
END; $$ LANGUAGE plpgsql;

-- Clientes: A,B,C,D,E,F,G em "Têxtil"; a Evolut não entra. Provedores diferentes porque (membro, provedor) é único.
CREATE TEMP TABLE c (letra TEXT PRIMARY KEY, ws UUID) ON COMMIT DROP;
INSERT INTO c VALUES ('A', pg_temp.cliente('A', 'Têxtil', 'linkedin')), ('B', pg_temp.cliente('B', 'Têxtil', 'whatsapp')),
  ('C', pg_temp.cliente('C', 'Têxtil', 'instagram')), ('D', pg_temp.cliente('D', 'Têxtil', 'google')),
  ('E', pg_temp.cliente('E', 'Têxtil', 'microsoft')), ('F', pg_temp.cliente('F', 'Cerâmica', 'imap')),
  ('G', pg_temp.cliente('G', 'Têxtil', 'linkedin', 'd0000000-0000-0000-0000-000000000002'));

-- Padrão BOM: e-mail, passo 2, Têxtil. A,B,C respondem 60%; D só 20%. (160 envios, 80 respostas = 50%)
SELECT pg_temp.envios(ws, 'email', 2, 40, 24, 8) FROM c WHERE letra IN ('A', 'B', 'C');
SELECT pg_temp.envios(ws, 'email', 2, 40, 8, 2) FROM c WHERE letra = 'D';
-- Padrão RUIM: WhatsApp, passo 1, Têxtil: 10% de resposta (160 envios, 16 respostas)
SELECT pg_temp.envios(ws, 'whatsapp', 1, 40, 4, 1) FROM c WHERE letra IN ('A', 'B', 'C', 'D');
-- E NÃO aceitou: muita resposta, não pode contribuir
SELECT pg_temp.envios(ws, 'email', 2, 100, 99, 50) FROM c WHERE letra = 'E';
-- Poucos clientes: Cerâmica só tem o F → menos de 3 clientes não publica
SELECT pg_temp.envios(ws, 'email', 3, 40, 10, 3) FROM c WHERE letra = 'F';
-- Dominância: "Vidro" com 3 clientes, mas um deles com 90% dos envios → não publica
SELECT pg_temp.envios((SELECT ws FROM c WHERE letra = 'B'), 'email', 4, 90, 10, 4, 'Vidro');
SELECT pg_temp.envios((SELECT ws FROM c WHERE letra = 'C'), 'email', 4, 5, 1, 0, 'Vidro');
SELECT pg_temp.envios((SELECT ws FROM c WHERE letra = 'D'), 'email', 4, 5, 1, 0, 'Vidro');

-- Consentimento: A,B,C,D,F,G aceitam; E não.
INSERT INTO public.learning_consent (workspace_id, aceito, popup_visto_em) SELECT ws, true, now() FROM c WHERE letra IN ('A', 'B', 'C', 'D', 'F', 'G');
INSERT INTO public.learning_consent (workspace_id, aceito, popup_visto_em) SELECT ws, false, now() FROM c WHERE letra = 'E';

-- ---- Permissões
SELECT ok(has_function_privilege('service_role', 'public.aprendizado_executar(integer, integer)', 'EXECUTE'), 'O sistema roda o motor');
SELECT ok(NOT has_function_privilege('authenticated', 'public.aprendizado_executar(integer, integer)', 'EXECUTE'), 'Usuário logado não roda o motor');
SELECT ok(NOT has_function_privilege('anon', 'public.aprendizado_executar(integer, integer)', 'EXECUTE'), 'Visitante não roda o motor');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.learning_agregados', 'SELECT'), 'Base agregada fechada para usuário');
SELECT ok(NOT has_table_privilege('anon', 'internal.learning_agregados', 'SELECT'), 'Base agregada fechada para visitante');
SELECT throws_ok($$SELECT public.aprendizado_executar(2, 30)$$, '22023', NULL, 'Mínimo de 3 clientes por padrão não pode ser baixado');
SELECT throws_ok($$SELECT public.aprendizado_executar(3, 5)$$, '22023', NULL, 'Mínimo de envios por padrão não pode ser baixado demais');

-- ---- Execução
CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT public.aprendizado_executar(3, 30) AS x;
SELECT is((SELECT count(*)::int FROM internal.learning_agregados), 2, 'Só 2 padrões passam (têxtil e-mail passo 2 e têxtil whatsapp passo 1); Cerâmica (1 cliente) e Vidro (um cliente domina) ficam de fora');
SELECT is((SELECT envios FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 160, 'Soma só quem aceitou (o cliente E, que não aceitou, não entra)');
SELECT is((SELECT respostas FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 80, 'Respostas somadas');
SELECT is((SELECT positivas FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 26, 'Respostas positivas somadas (8+8+8+2)');
SELECT is((SELECT workspaces FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 4, 'Quantos clientes estão por trás');
SELECT is((SELECT count(*)::int FROM internal.learning_agregados WHERE segmento IN ('cerâmica', 'vidro')), 0, 'Padrão com poucos clientes ou dominado por um não é publicado');

-- ---- Sugestões: só o padrão melhor que a média, só para quem aceitou, tem conta no segmento e não faz tão bem
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado'), 2, 'Duas sugestões: D (faz pior que o padrão) e G (nunca enviou esse passo)');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D')), 1, 'D recebe');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'G')), 1, 'G recebe');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id IN (SELECT ws FROM c WHERE letra IN ('A', 'B', 'C'))), 0, 'Quem já faz melhor que o padrão não recebe');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'E')), 0, 'Quem não aceitou não recebe');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'F')), 0, 'Quem não tem conta no segmento não recebe');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND (suggestion_text ILIKE '%whatsapp%' OR chave_padrao ILIKE '%whatsapp%')), 0, 'Padrão pior que a média nunca vira sugestão');
SELECT is((SELECT DISTINCT status FROM public.learning_entries WHERE origem = 'compartilhado'), 'sugerida', 'O motor só SUGERE: quem aplica é o estrategista');
SELECT is((SELECT DISTINCT agent_id FROM public.learning_entries WHERE origem = 'compartilhado'), 'comercial', 'Entra no agente comercial');
SELECT ok((SELECT suggestion_text FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D')) LIKE '%"têxtil"%passo 2%e-mail%50%', 'O texto fala de segmento, passo, canal e taxa');
SELECT ok((SELECT evidence FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D')) LIKE '%20%', 'Diz a taxa do próprio cliente (20%)');
SELECT ok((SELECT evidence FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'G')) LIKE '%ainda não%', 'Para quem nunca enviou, diz isso (sem inventar taxa)');
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE action = 'learning.shared_suggestion' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D')), 1, 'A sugestão fica na auditoria do cliente');

-- ---- Vazamento: nada que identifique ninguém (canários) nem o id de outro cliente
SELECT is((SELECT count(*)::int FROM internal.learning_agregados WHERE (to_jsonb(learning_agregados))::text ~* 'canario'), 0, 'Agregados sem nome de contato, empresa, texto nem cliente (canário)');
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND (suggestion_text || coalesce(evidence, '') || coalesce(proposed_change, '') || coalesce(impact, '') || chave_padrao) ~* 'canario'), 0, 'Sugestões sem canário');
SELECT is((SELECT count(*)::int FROM public.learning_entries e, c WHERE e.origem = 'compartilhado' AND e.workspace_id <> c.ws AND (e.suggestion_text || coalesce(e.evidence, '') || coalesce(e.proposed_change, '')) LIKE '%' || c.ws::text || '%'), 0, 'Nenhuma sugestão cita o id de outro cliente');
SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'internal' AND table_name = 'learning_agregados' AND column_name ILIKE '%workspace_id%'), 0, 'A base agregada nem tem coluna de cliente');

-- ---- Repetir não duplica; descartada não volta
SELECT public.aprendizado_executar(3, 30);
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado'), 2, 'Rodar de novo não duplica sugestão');
UPDATE public.learning_entries SET status = 'descartada' WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D');
SELECT public.aprendizado_executar(3, 30);
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND workspace_id = (SELECT ws FROM c WHERE letra = 'D')), 1, 'Sugestão descartada não é refeita');

-- ---- Quem desliga sai na hora: some das contas e perde a sugestão pendente
UPDATE public.learning_consent SET aceito = false WHERE workspace_id = (SELECT ws FROM c WHERE letra = 'G');
UPDATE public.learning_consent SET aceito = false WHERE workspace_id = (SELECT ws FROM c WHERE letra = 'D');
SELECT public.aprendizado_executar(3, 30);
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE origem = 'compartilhado' AND status = 'sugerida' AND workspace_id = (SELECT ws FROM c WHERE letra = 'G')), 0, 'Quem desligou perde a sugestão pendente');
SELECT is((SELECT envios FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 120, 'Os envios de quem desligou saem dos números (D tinha 40)');
SELECT is((SELECT workspaces FROM internal.learning_agregados WHERE segmento = 'têxtil' AND canal = 'email' AND passo = 2), 3, 'Agora 3 clientes (ainda no mínimo)');

-- Com menos de 3, o padrão some por completo
UPDATE public.learning_consent SET aceito = false WHERE workspace_id = (SELECT ws FROM c WHERE letra = 'C');
SELECT public.aprendizado_executar(3, 30);
SELECT is((SELECT count(*)::int FROM internal.learning_agregados), 0, 'Com 2 clientes, nada é publicado');

SELECT * FROM finish();
ROLLBACK;
