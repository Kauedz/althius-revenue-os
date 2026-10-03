-- ==============================================================================
-- Test: 00036_inbox.sql
-- Seam: Caixa de entrada (conversations/messages + inbox_mark_read, inbox_opt_out, inbox_request_reply).
-- Regras: BDR vê só as conversas da própria conexão; C-level, estrategista e superadmin leem;
-- mensagem só é visível para quem vê a conversa; excluir contato do CRM é LGPD (apaga contato e conversas).
-- Seed Evolut: Lucas BDR d..04 (e..04) com 4 conversas; Bruna BDR d..06 (e..06) com 1; Aline C-level e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Isolamento de leitura.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.conversations), 4, 'Lucas vê só as 4 conversas da conexão dele');
SELECT is((SELECT count(*)::int FROM public.messages m JOIN (VALUES ('c5000000-0000-0000-0000-000000000002'::uuid)) v(id) ON m.conversation_id = v.id), 0,
  'Lucas não lê as mensagens da conversa da Bruna (correção de vazamento)');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.conversations), 1, 'Bruna vê só a conversa dela');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.conversations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'Aline (C-level) lê todas as conversas da Evolut');
SELECT ok((SELECT count(*) FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000002') > 0, 'Aline lê as mensagens');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.messages WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Grão Norte não lê mensagens da Evolut');

-- 2. Marcar como lida: só o dono da conexão muda; quem só lê não apaga o "não lida" do BDR.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.inbox_mark_read('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000001')->>'ok', 'true', 'C-level abre sem erro');
RESET ROLE;
SELECT is((SELECT unread FROM public.conversations WHERE id = 'c5000000-0000-0000-0000-000000000001'), true, '... mas a conversa continua não lida para o BDR');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.inbox_mark_read('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000001')->>'ok', 'true', 'Lucas abre a conversa dele');
SELECT is(public.inbox_mark_read('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000002')->>'erro',
  'Conversa não encontrada.', 'Lucas não mexe na conversa da Bruna');
RESET ROLE;
SELECT is((SELECT unread FROM public.conversations WHERE id = 'c5000000-0000-0000-0000-000000000001'), false, 'Aberta pelo dono, fica lida');

-- 3. Sugerir resposta: vira pedido ao Agente de Copy pela política Hermes (aparece em Execuções).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE pedido ON COMMIT DROP AS
SELECT public.inbox_request_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000001') AS r;
SELECT is((SELECT r->>'ok' FROM pedido), 'true', 'Lucas pede sugestão de resposta');
SELECT is(public.inbox_request_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000002')->>'erro',
  'Conversa não encontrada.', 'Lucas não pede resposta para conversa da Bruna');
RESET ROLE;
SELECT results_eq(
  $$ SELECT agent_code, title, requested_by_member_id::text FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM pedido) $$,
  $$ VALUES ('copy'::text, 'Sugerir resposta para Aline Xavier'::text, 'd0000000-0000-0000-0000-000000000004'::text) $$,
  'Pedido fica na fila do Agente de Copy, em nome de quem pediu');

-- 4. Excluir contato do CRM (LGPD): apaga contato, conversa e mensagens; fica na auditoria.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(public.inbox_opt_out('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'c5000000-0000-0000-0000-000000000004')->>'erro',
  'Conversa não encontrada.', 'Bruna não exclui contato de conversa do Lucas');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.inbox_opt_out('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000004')->>'ok',
  'true', 'Aline exclui o contato do CRM');
RESET ROLE;
SELECT ok(NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = 'cb000000-0000-0000-0000-000000000007'), 'Contato apagado');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = 'c5000000-0000-0000-0000-000000000004'), 'Conversa apagada junto');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000004'), 'Mensagens apagadas junto');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'lgpd.contato_excluido'), 'Exclusão registrada na auditoria (sem o conteúdo das mensagens)');

SELECT * FROM finish();
ROLLBACK;
