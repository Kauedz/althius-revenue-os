-- ==============================================================================
-- Test: 00094_ponte_e_historico.sql
-- ADR 0070. A Unipile é só a PONTE: se a ponte mudar (outra API, outra conta, outro id de chat), contatos, conversas e
-- mensagens continuam no nosso banco, na mesma conversa. Também: o estado que o serviço de sincronia lê (pedidos abertos e
-- contas registradas), só para o serviço.
-- Seed: Evolut a0..01 — Lucas BDR d..04 (conta LinkedIn ca5..02 = demo-lucas-linkedin; conversa c5..01 com o contato cb..01).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões da sincronia
SELECT ok(has_function_privilege('service_role', 'public.messaging_sync_state()', 'EXECUTE'), 'Só o serviço lê o estado das contas');
SELECT ok(NOT has_function_privilege('authenticated', 'public.messaging_sync_state()', 'EXECUTE'), 'Usuário logado não lê');
SELECT ok(NOT has_function_privilege('anon', 'public.messaging_sync_state()', 'EXECUTE'), 'Visitante não lê');

-- ---- Cenário
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized, position)
VALUES ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'linkedin', 'aline-ponte', public.normalize_channel_value('linkedin', 'aline-ponte'), 3);

CREATE TEMP TABLE antes ON COMMIT DROP AS SELECT
  (SELECT count(*)::int FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001') AS msgs;

-- Mesmo chat de antes: mesma conversa
SELECT is((public.unipile_ingest_message('demo-lucas-linkedin', 'linkedin', 'aline-ponte', 'demo-chat-1', 'ponte-m1', 'Oi pela ponte velha', false, 'neutra')->>'conversation_id'),
  'c5000000-0000-0000-0000-000000000001', 'Mesmo id de chat: cai na conversa que já existe');

-- A ponte mudou o id do chat do MESMO contato: a conversa e o histórico continuam
SELECT is((public.unipile_ingest_message('demo-lucas-linkedin', 'linkedin', 'aline-ponte', 'chat-da-ponte-nova', 'ponte-m2', 'Oi pela ponte nova', false, 'neutra')->>'conversation_id'),
  'c5000000-0000-0000-0000-000000000001', 'Id de chat novo do mesmo contato: a MESMA conversa (não parte o histórico)');
SELECT is((SELECT external_chat_id FROM public.conversations WHERE id = 'c5000000-0000-0000-0000-000000000001'), 'chat-da-ponte-nova', 'Só o id externo é atualizado');
SELECT is((SELECT count(*)::int FROM public.conversations WHERE contact_id = 'cb000000-0000-0000-0000-000000000001' AND channel = 'linkedin' AND messaging_account_id = 'ca500000-0000-0000-0000-000000000002'), 1, 'Continua uma só conversa de LinkedIn deste contato');
SELECT is((SELECT count(*)::int FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001'), (SELECT msgs FROM antes) + 2, 'O histórico antigo segue lá e as novas mensagens entram');

-- E-mail é diferente: cada assunto (thread) é uma conversa
SELECT isnt((public.unipile_ingest_message('demo-lucas-google', 'email', 'aline.xavier@serraazul.com.br', 'thread-a', 'em-1', 'Assunto A', false, 'neutra')->>'conversation_id'),
            (public.unipile_ingest_message('demo-lucas-google', 'email', 'aline.xavier@serraazul.com.br', 'thread-b', 'em-2', 'Assunto B', false, 'neutra')->>'conversation_id'),
  'E-mail: assunto novo é conversa nova');

-- ---- Troca de conta na ponte (reconexão com outro id): o mesmo registro, o mesmo histórico
INSERT INTO public.messaging_connect_requests (id, workspace_id, member_id, provider, kind, reconnect_account_id)
VALUES ('f9400000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin', 'reconnect', 'demo-lucas-linkedin');

-- O estado que a sincronia lê
CREATE TEMP TABLE est ON COMMIT DROP AS SELECT public.messaging_sync_state() AS e;
SELECT ok((SELECT e->'pendentes' @> '[{"id": "f9400000-0000-0000-0000-000000000001", "provider": "linkedin"}]' FROM est), 'O pedido aberto aparece para a sincronia');
SELECT ok((SELECT e->'registradas' @> '[{"conta": "demo-lucas-linkedin", "provider": "linkedin"}]' FROM est), 'A conta registrada aparece com o estado');
SELECT ok(NOT (SELECT e::text ~* 'token|segredo|senha|secret' FROM est), 'Nada secreto no estado');

SELECT is((public.unipile_complete_connection('f9400000-0000-0000-0000-000000000001', 'conta-da-ponte-nova', NULL)->>'action'), 'connected', 'Reconexão concluída com a conta nova da ponte');
SELECT is((SELECT unipile_account_id FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000002'), 'conta-da-ponte-nova', 'O MESMO registro aponta para a conta nova');
SELECT is((SELECT count(*)::int FROM public.messaging_accounts WHERE member_id = 'd0000000-0000-0000-0000-000000000004' AND provider = 'linkedin'), 1, 'Nenhum registro duplicado');
SELECT is((SELECT count(*)::int FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001'), (SELECT msgs FROM antes) + 2, 'O histórico não mudou com a troca');
SELECT is((public.unipile_ingest_message('conta-da-ponte-nova', 'linkedin', 'aline-ponte', 'chat-ainda-mais-novo', 'ponte-m3', 'Oi pela conta nova', false, 'neutra')->>'conversation_id'),
  'c5000000-0000-0000-0000-000000000001', 'Mensagem pela conta nova cai na mesma conversa de sempre');

-- Isolamento: conta de outro cliente nunca recebe mensagem de contato desta Evolut
SELECT is((public.unipile_ingest_message('conta-que-nao-existe', 'linkedin', 'aline-ponte', 'x', 'ponte-m4', 'Oi', false, 'neutra')->>'reason'), 'messaging_account_not_found', 'Conta desconhecida da ponte: descartada');

SELECT * FROM finish();
ROLLBACK;
