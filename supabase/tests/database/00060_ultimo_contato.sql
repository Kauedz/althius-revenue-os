-- ==============================================================================
-- Test: 00060_ultimo_contato.sql
-- "Último contato" por conta, das nossas mensagens. BDR vê só o das próprias conversas; outro workspace nunca.
-- Seed: Evolut a0..01 (Aline C-level d..03/e..03, Lucas BDR d..04/e..04, Bruna BDR d..06/e..06), conta Serra Azul c0..01,
--       contas de mensagem de Lucas ca5..01 (e-mail) e de Bruna ca5..04; Grão Norte b0..01 (C-level d..09/e..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Conta de teste só com mensagens de Lucas e de Bruna, com datas conhecidas.
INSERT INTO public.accounts (id, workspace_id, name, domain, status)
VALUES ('ca000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-000000000001', 'Conta Último Contato', 'ultimo.com.br', 'ativa');
INSERT INTO public.contacts (id, workspace_id, account_id, name)
VALUES ('cc000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000c1', 'Pessoa de Teste');
INSERT INTO public.conversations (id, workspace_id, contact_id, account_id, messaging_account_id, channel, external_chat_id, last_message_at) VALUES
  ('c5000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c1', 'ca500000-0000-0000-0000-000000000001', 'email', 'uc-chat-lucas', now()),
  ('c5000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c1', 'ca500000-0000-0000-0000-000000000004', 'email', 'uc-chat-bruna', now());
INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-0000000000c1', 'out', 'uc-m1', 'Olá', 'automation', '2026-09-01 10:00:00+00'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-0000000000c1', 'in',  'uc-m2', 'Oi, pode ser', 'member',    '2026-09-03 10:00:00+00'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-0000000000c2', 'out', 'uc-m3', 'Bom dia', 'member',    '2026-09-10 10:00:00+00');

-- 1. Permissões e segurança da visão.
SELECT ok(has_table_privilege('authenticated', 'public.account_last_contact', 'SELECT'), 'Usuário logado consulta a visão');
SELECT ok(NOT has_table_privilege('anon', 'public.account_last_contact', 'SELECT'), 'Visitante não consulta a visão');
SELECT ok((SELECT reloptions::text LIKE '%security_invoker=true%' FROM pg_class WHERE oid = 'public.account_last_contact'::regclass), 'A visão respeita a RLS de quem consulta (security_invoker)');

-- 2. C-level vê o workspace todo: a última mensagem de qualquer conversa, nos dois sentidos.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT last_contact_at::text, last_inbound_at::text, last_outbound_at::text, last_direction, last_channel
     FROM public.account_last_contact WHERE account_id = 'ca000000-0000-0000-0000-0000000000c1' $$,
  $$ VALUES ('2026-09-10 10:00:00+00'::text, '2026-09-03 10:00:00+00'::text, '2026-09-10 10:00:00+00'::text, 'out'::text, 'email'::text) $$,
  'C-level: último contato é a mensagem mais nova, com o último recebido e o último enviado');
SELECT ok(EXISTS (SELECT 1 FROM public.account_last_contact WHERE account_id = 'c0000000-0000-0000-0000-000000000001'), 'C-level também vê as contas do seed');
SELECT is((SELECT count(*)::int FROM public.account_last_contact WHERE account_id = 'c0000000-0000-0000-0000-0000000000ff'), 0, 'Conta sem mensagem não aparece (nada é inventado)');

-- 3. BDR vê só o das próprias conversas (as de Lucas), nunca as de Bruna.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT last_contact_at::text, last_direction FROM public.account_last_contact WHERE account_id = 'ca000000-0000-0000-0000-0000000000c1' $$,
  $$ VALUES ('2026-09-03 10:00:00+00'::text, 'in'::text) $$,
  'BDR Lucas: só as mensagens das próprias conversas (a de Bruna, mais nova, não conta)');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT last_contact_at::text, last_direction, last_inbound_at::text FROM public.account_last_contact WHERE account_id = 'ca000000-0000-0000-0000-0000000000c1' $$,
  $$ VALUES ('2026-09-10 10:00:00+00'::text, 'out'::text, NULL::text) $$,
  'BDR Bruna: só o dela, e sem resposta recebida');

-- 4. Outro workspace nunca vê.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000009", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.account_last_contact WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'CANÁRIO: Grão Norte não vê nenhum último contato da Evolut');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
