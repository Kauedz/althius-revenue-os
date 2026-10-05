-- ==============================================================================
-- Test: 00050_unipile_webhook.sql
-- Funções que o receptor de webhook da Unipile chama (PR 04):
--   unipile_set_account_status  - conexão caiu / voltou (atualiza messaging_accounts e audita a mudança)
--   unipile_handle_new_relation - LinkedIn aceitou o convite (acha o workspace pela conta, nunca por parâmetro)
--   unipile_ingest_message      - já existia; aqui provamos o filtro só-CRM e o isolamento entre workspaces
-- Seed: contas de mensagem da Evolut (ca5..01 google, ..02 linkedin, ..03 whatsapp, do BDR Lucas).
--       Contatos da Evolut: Aline Xavier cb..01 (e-mail aline.xavier@serraazul.com.br).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Preparação (dono do banco): conta de mensagem e contato LinkedIn do Grão Norte, para provar isolamento
INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, display_name) VALUES
  ('f5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'linkedin', 'grao-linkedin', 'Eduardo');
INSERT INTO public.accounts (id, workspace_id, name, domain) VALUES
  ('f5000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-000000000001', 'Conta Grão', 'contagrao-wh.test');
INSERT INTO public.contacts (id, workspace_id, account_id, name, linkedin_status) VALUES
  ('f5000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-0000000000a1', 'Contato Grão', 'convite_enviado');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-0000000000c1', 'linkedin', 'https://www.linkedin.com/in/pessoa-teste', 'pessoa-teste');
-- Evolut: contato com convite enviado e canal LinkedIn
INSERT INTO public.contacts (id, workspace_id, account_id, name, linkedin_status) VALUES
  ('f5000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Contato Evolut', 'convite_enviado');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-0000000000c2', 'linkedin', 'https://www.linkedin.com/in/pessoa-teste', 'pessoa-teste');

-- 1. Quem pode chamar (ADR 0023): só o backend
SELECT ok(has_function_privilege('service_role', 'public.unipile_set_account_status(text,text)', 'EXECUTE'), 'Backend atualiza o status da conexão');
SELECT ok(NOT has_function_privilege('authenticated', 'public.unipile_set_account_status(text,text)', 'EXECUTE'), 'Quem está logado não chama');
SELECT ok(NOT has_function_privilege('anon', 'public.unipile_set_account_status(text,text)', 'EXECUTE'), 'Sem login não chama');
SELECT ok(has_function_privilege('service_role', 'public.unipile_handle_new_relation(text,text)', 'EXECUTE'), 'Backend registra nova relação do LinkedIn');
SELECT ok(NOT has_function_privilege('authenticated', 'public.unipile_handle_new_relation(text,text)', 'EXECUTE'), 'Quem está logado não registra relação');
SELECT ok(NOT has_function_privilege('anon', 'public.unipile_handle_new_relation(text,text)', 'EXECUTE'), 'Sem login não registra relação');
SELECT ok(NOT has_function_privilege('anon', 'public.unipile_ingest_message(text,text,text,text,text,text,boolean,text)', 'EXECUTE'), 'Sem login não ingere mensagem');
SELECT ok(NOT has_function_privilege('authenticated', 'public.unipile_ingest_message(text,text,text,text,text,text,boolean,text)', 'EXECUTE'), 'Quem está logado não ingere mensagem');

-- 2. Funções de sistema com caminho de busca fixo (hardening)
SELECT ok((SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = 'public.unipile_ingest_message(text,text,text,text,text,text,boolean,text)'::regprocedure),
  'unipile_ingest_message tem search_path fixo');
SELECT ok((SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = 'public.unipile_handle_linkedin_connected(uuid,text)'::regprocedure),
  'unipile_handle_linkedin_connected tem search_path fixo');

-- 3. Status da conexão
SELECT is(public.unipile_set_account_status('demo-lucas-google', 'attention')->>'action', 'updated', 'Conexão que pede atenção é atualizada');
SELECT is((SELECT status FROM public.messaging_accounts WHERE unipile_account_id = 'demo-lucas-google'), 'attention', 'Status gravado');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.status_changed' AND entity_id = 'ca500000-0000-0000-0000-000000000001'), 1::bigint, 'Mudança de status foi auditada');
SELECT is((SELECT workspace_id FROM public.audit_logs WHERE action = 'messaging_account.status_changed' AND entity_id = 'ca500000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid, 'Auditoria cai no workspace dono da conta');

-- Avisa o dono da conta (Lucas, d..04) uma vez, e só quando piora
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'conexao_atencao' AND entity_id = 'ca500000-0000-0000-0000-000000000001' AND recipient_member_id = 'd0000000-0000-0000-0000-000000000004'), 1::bigint,
  'Dono da conta foi avisado da conexão que pede atenção');

-- Repetir o mesmo aviso não muda nada nem audita de novo (idempotente)
SELECT is(public.unipile_set_account_status('demo-lucas-google', 'attention')->>'action', 'unchanged', 'Mesmo status de novo: sem mudança');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.status_changed' AND entity_id = 'ca500000-0000-0000-0000-000000000001'), 1::bigint, 'Sem auditoria duplicada');

SELECT is(public.unipile_set_account_status('demo-lucas-google', 'disconnected')->>'action', 'updated', 'Conexão cai de vez');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'conexao_atencao' AND entity_id = 'ca500000-0000-0000-0000-000000000001'), 2::bigint, 'Repetição não avisa de novo; a queda total avisa');
SELECT is(public.unipile_set_account_status('demo-lucas-google', 'connected')->>'action', 'updated', 'Conexão volta');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'conexao_atencao' AND entity_id = 'ca500000-0000-0000-0000-000000000001'), 2::bigint, 'Voltar ao normal não gera aviso');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.status_changed' AND entity_id = 'ca500000-0000-0000-0000-000000000001'), 3::bigint, 'Cada mudança real gera uma linha');

SELECT is(public.unipile_set_account_status('conta-que-nao-existe', 'attention')->>'reason', 'messaging_account_not_found', 'Conta desconhecida é ignorada sem erro');
SELECT throws_ok($$ SELECT public.unipile_set_account_status('demo-lucas-google', 'qualquer') $$, '22023', NULL, 'Status inválido é recusado');
SELECT is((SELECT status FROM public.messaging_accounts WHERE unipile_account_id = 'demo-bruna-google'), 'connected', 'Outra conta não foi tocada');

-- 4. Nova relação do LinkedIn: o workspace vem da conta, nunca de fora
SELECT is(public.unipile_handle_new_relation('demo-lucas-linkedin', 'https://www.linkedin.com/in/pessoa-teste')->>'action', 'connected', 'Convite aceito marca o contato como conectado');
SELECT is((SELECT linkedin_status FROM public.contacts WHERE id = 'f5000000-0000-0000-0000-0000000000c2'), 'conectado', 'Contato da Evolut ficou conectado');
SELECT is((SELECT linkedin_status FROM public.contacts WHERE id = 'f5000000-0000-0000-0000-0000000000c1'), 'convite_enviado', 'O mesmo perfil no Grão Norte NÃO foi tocado (isolamento)');
SELECT is(public.unipile_handle_new_relation('demo-lucas-linkedin', 'perfil-fora-do-crm')->>'action', 'ignored', 'Quem não é do CRM é ignorado');
SELECT is(public.unipile_handle_new_relation('conta-que-nao-existe', 'pessoa-teste')->>'reason', 'messaging_account_not_found', 'Conta desconhecida é ignorada');
SELECT is(public.unipile_handle_new_relation('grao-linkedin', 'pessoa-teste')->>'action', 'connected', 'Pela conta do Grão Norte, quem muda é o contato do Grão Norte');
SELECT is((SELECT linkedin_status FROM public.contacts WHERE id = 'f5000000-0000-0000-0000-0000000000c1'), 'conectado', 'Contato do Grão Norte ficou conectado');

-- 5. Mensagem: filtro só-CRM e isolamento
SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'desconhecido@spam.com', 'chat-x1', 'msg-x1', 'oi', false, 'neutra')->>'reason',
  'non_crm_contact_privacy_filter', 'Quem não é do CRM é descartado');
SELECT is((SELECT count(*) FROM public.messages WHERE external_message_id = 'msg-x1'), 0::bigint, 'Descartada: nenhuma mensagem gravada');
SELECT is((SELECT count(*) FROM public.conversations WHERE external_chat_id = 'chat-x1'), 0::bigint, 'Descartada: nenhuma conversa gravada');
SELECT is((SELECT count(*) FROM public.notifications WHERE body = 'oi'), 0::bigint, 'Descartada: nenhuma notificação com o texto');

SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'aline.xavier@serraazul.com.br', 'chat-g1', 'msg-g1', 'grupo', true, 'neutra')->>'reason',
  'group_chat_forbidden', 'Grupo é sempre descartado, mesmo de contato do CRM');
SELECT is((SELECT count(*) FROM public.messages WHERE external_message_id = 'msg-g1'), 0::bigint, 'Grupo: nenhuma mensagem gravada');

SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'Aline.Xavier@SerraAzul.com.br', 'chat-ok1', 'msg-ok1', 'Pode ser terça?', false, 'adiar')->>'action',
  'persisted', 'Contato do CRM (e-mail com maiúsculas) é gravado');
SELECT is((SELECT workspace_id FROM public.messages WHERE external_message_id = 'msg-ok1'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'Mensagem fica no workspace da conta');
SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'aline.xavier@serraazul.com.br', 'chat-ok1', 'msg-ok1', 'Pode ser terça?', false, 'adiar')->>'idempotent_replay',
  'true', 'Mesma mensagem de novo: replay idempotente');
SELECT is((SELECT count(*) FROM public.messages WHERE external_message_id = 'msg-ok1'), 1::bigint, 'Replay não duplica a mensagem');

-- O e-mail da Aline é da Evolut: pela conta do Grão Norte não casa com ninguém (isolamento)
SELECT is(public.unipile_ingest_message('grao-linkedin', 'email', 'aline.xavier@serraazul.com.br', 'chat-iso', 'msg-iso', 'teste', false, 'neutra')->>'reason',
  'non_crm_contact_privacy_filter', 'Contato de outro cliente não é reconhecido');

SELECT * FROM finish();
ROLLBACK;
