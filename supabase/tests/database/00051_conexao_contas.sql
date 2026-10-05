-- ==============================================================================
-- Test: 00051_conexao_contas.sql
-- PR 05: conexão das contas de mensagem pelo assistente hospedado. A conta é sempre da PESSOA (ADR 0017).
--   messaging_connect_start      - o membro logado abre um pedido de conexão (create ou reconnect)
--   unipile_complete_connection  - o backend conclui o pedido quando a conexão deu certo
--   messaging_disconnect         - a pessoa desliga a própria conexão
-- Seed: Lucas BDR (user e..04, membro d..04) tem linkedin, whatsapp e google conectados (ca5..02/03/01);
--       Bruna BDR (e..06, d..06) tem google (ca5..04); Aline C-level (e..03, d..03); Camila estrategista (e..02, d..02);
--       Eduardo C-level do Grão Norte (e..07, d..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Quem pode chamar (ADR 0023)
SELECT ok(has_function_privilege('authenticated', 'public.messaging_connect_start(uuid,uuid,text)', 'EXECUTE'), 'Quem está logado abre o pedido');
SELECT ok(NOT has_function_privilege('anon', 'public.messaging_connect_start(uuid,uuid,text)', 'EXECUTE'), 'Sem login não abre pedido');
SELECT ok(has_function_privilege('authenticated', 'public.messaging_disconnect(uuid,uuid,text)', 'EXECUTE'), 'Quem está logado desliga a própria conexão');
SELECT ok(NOT has_function_privilege('anon', 'public.messaging_disconnect(uuid,uuid,text)', 'EXECUTE'), 'Sem login não desliga');
SELECT ok(has_function_privilege('service_role', 'public.unipile_complete_connection(uuid,text,text)', 'EXECUTE'), 'Backend conclui a conexão');
SELECT ok(NOT has_function_privilege('authenticated', 'public.unipile_complete_connection(uuid,text,text)', 'EXECUTE'), 'Quem está logado não conclui conexão (só o backend)');
SELECT ok(NOT has_function_privilege('anon', 'public.unipile_complete_connection(uuid,text,text)', 'EXECUTE'), 'Sem login não conclui conexão');
SELECT ok(NOT has_table_privilege('authenticated', 'public.messaging_connect_requests', 'SELECT'), 'Pedidos de conexão não são lidos pela tela');
SELECT ok(NOT has_table_privilege('anon', 'public.messaging_connect_requests', 'SELECT'), 'Pedidos de conexão não são lidos sem login');

-- 2. Lucas (BDR) conecta a PRÓPRIA conta
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

CREATE TEMP TABLE r_lucas_novo AS SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'instagram') AS r;
GRANT ALL ON r_lucas_novo TO PUBLIC;
SELECT is((SELECT r->>'type' FROM r_lucas_novo), 'create', 'Instagram ainda não conectado: pedido de criação');
SELECT is((SELECT r->>'provider' FROM r_lucas_novo), 'instagram', 'Pedido devolve o provedor');
SELECT ok((SELECT (r->>'request_id') ~ '^[0-9a-f-]{36}$' FROM r_lucas_novo), 'Pedido tem um id');
SELECT is((SELECT r->>'reconnect_account_id' FROM r_lucas_novo), NULL, 'Criação não traz conta para reconectar');

CREATE TEMP TABLE r_lucas_rec AS SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin') AS r;
GRANT ALL ON r_lucas_rec TO PUBLIC;
SELECT is((SELECT r->>'type' FROM r_lucas_rec), 'reconnect', 'LinkedIn já existe: o pedido é de reconexão');
SELECT is((SELECT r->>'reconnect_account_id' FROM r_lucas_rec), 'demo-lucas-linkedin', 'Reconexão aponta a conta que já existe');

-- 3. Não conecta em nome de outra pessoa nem de outro cliente
SELECT throws_ok($$ SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'instagram') $$,
  '42501', NULL, 'BDR não conecta em nome da Bruna');
SELECT throws_ok($$ SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'instagram') $$,
  '42501', NULL, 'BDR não conecta em nome do C-level');
SELECT throws_ok($$ SELECT public.messaging_connect_start('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'instagram') $$,
  '42501', NULL, 'Membro da Evolut não conecta dentro do Grão Norte');
SELECT throws_ok($$ SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'telegram') $$,
  '22023', NULL, 'Provedor desconhecido é recusado');
SELECT throws_ok($$ SELECT public.messaging_disconnect('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'google') $$,
  '42501', NULL, 'BDR não desliga a conexão da Bruna');

-- Outros papéis conectam a própria conta (inbox.connect é "own" para todos)
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'google')->>'type', 'create', 'C-level conecta a própria conta');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'google')->>'type', 'create', 'Estrategista conecta a própria conta');

-- 4. O backend conclui (como dono do banco, que é o que o service_role pode)
RESET ROLE;
SELECT is(public.unipile_complete_connection((SELECT (r->>'request_id')::uuid FROM r_lucas_novo), 'ig-lucas-novo', 'lucas.vendas')->>'action', 'connected', 'Conexão concluída');
SELECT is((SELECT count(*) FROM public.messaging_accounts WHERE member_id = 'd0000000-0000-0000-0000-000000000004' AND provider = 'instagram' AND unipile_account_id = 'ig-lucas-novo' AND status = 'connected' AND display_name = 'lucas.vendas'), 1::bigint,
  'Conta ficou no membro que pediu (nunca no workspace), conectada');
SELECT is((SELECT workspace_id FROM public.messaging_accounts WHERE unipile_account_id = 'ig-lucas-novo'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'Conta no workspace do pedido');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.connected' AND new_values->>'unipile_account_id' = 'ig-lucas-novo'), 1::bigint, 'Conexão auditada');
SELECT is(public.unipile_complete_connection((SELECT (r->>'request_id')::uuid FROM r_lucas_novo), 'ig-lucas-novo', 'lucas.vendas')->>'action', 'unchanged', 'Mesmo aviso de novo: nada muda');
SELECT is((SELECT count(*) FROM public.messaging_accounts WHERE unipile_account_id = 'ig-lucas-novo'), 1::bigint, 'Sem conta duplicada');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.connected' AND new_values->>'unipile_account_id' = 'ig-lucas-novo'), 1::bigint, 'Sem auditoria duplicada');

-- Reconectar mantém o MESMO registro
UPDATE public.messaging_accounts SET status = 'attention' WHERE id = 'ca500000-0000-0000-0000-000000000002';
SELECT is(public.unipile_complete_connection((SELECT (r->>'request_id')::uuid FROM r_lucas_rec), 'demo-lucas-linkedin', NULL)->>'action', 'connected', 'Reconexão concluída');
SELECT is((SELECT status FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000002'), 'connected', 'Mesmo registro voltou a conectado');
SELECT is((SELECT count(*) FROM public.messaging_accounts WHERE member_id = 'd0000000-0000-0000-0000-000000000004' AND provider = 'linkedin'), 1::bigint, 'Reconexão não cria registro novo');
SELECT is((SELECT display_name FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000002'), 'Lucas Teixeira', 'Reconexão sem nome não apaga o nome que já existia');

-- Pedido desconhecido, vencido, ou conta que já é de outra pessoa
SELECT is(public.unipile_complete_connection('f5100000-0000-0000-0000-0000000000ff', 'x', NULL)->>'reason', 'request_not_found', 'Pedido desconhecido é ignorado');
INSERT INTO public.messaging_connect_requests (id, workspace_id, member_id, provider, kind, expires_at) VALUES
  ('f5100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'whatsapp', 'create', now() - interval '1 minute'),
  ('f5100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'linkedin', 'create', now() + interval '10 minutes');
SELECT is(public.unipile_complete_connection('f5100000-0000-0000-0000-000000000001', 'wa-bruna', NULL)->>'reason', 'request_expired', 'Pedido vencido é ignorado');
SELECT is((SELECT count(*) FROM public.messaging_accounts WHERE unipile_account_id = 'wa-bruna'), 0::bigint, 'Pedido vencido não cria conta');
SELECT is(public.unipile_complete_connection('f5100000-0000-0000-0000-000000000002', 'demo-lucas-whatsapp', NULL)->>'reason', 'account_already_linked', 'Conta que já é de outra pessoa não é roubada');
SELECT is((SELECT member_id FROM public.messaging_accounts WHERE unipile_account_id = 'demo-lucas-whatsapp'), 'd0000000-0000-0000-0000-000000000004'::uuid, 'Conta do Lucas continua do Lucas');

-- 5. Desligar a própria conexão
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.messaging_disconnect('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'whatsapp')->>'action', 'disconnected', 'Lucas desliga o próprio WhatsApp');
RESET ROLE;
SELECT is((SELECT status FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000003'), 'disconnected', 'Status gravado');
SELECT is((SELECT status FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000004'), 'connected', 'A conexão da Bruna não foi tocada');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'messaging_account.disconnected' AND entity_id = 'ca500000-0000-0000-0000-000000000003'), 1::bigint, 'Desligar foi auditado');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.messaging_disconnect('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'whatsapp')->>'action', 'unchanged', 'Desligar de novo não muda nada');
SELECT is(public.messaging_disconnect('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'imap')->>'reason', 'messaging_account_not_found', 'Desligar o que não existe não dá erro');

SELECT * FROM finish();
ROLLBACK;
