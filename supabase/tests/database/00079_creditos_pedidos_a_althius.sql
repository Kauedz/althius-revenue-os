-- ADR 0064: créditos não se compram em 1 clique. O cliente PEDE à Althius (assinatura mensal, a Althius opera junto);
-- só o superadmin decide o pedido, e o crédito só entra no saldo quando ele aprova.
BEGIN;
SELECT no_plan();

-- Evolut (seed): superadmin d..01 (e..01), estrategista d..02 (e..02), C-level d..03 (e..03), BDR d..04 (e..04).
-- Outro cliente, para conferir o isolamento.
INSERT INTO public.workspaces (id, name, slug) VALUES ('f7000000-0000-0000-0000-000000000001', 'Outro Cliente Creditos', 'outro-creditos');
INSERT INTO public.credit_wallets (workspace_id, topup_balance) VALUES ('f7000000-0000-0000-0000-000000000001', 0)
  ON CONFLICT (workspace_id) DO UPDATE SET topup_balance = 0;
UPDATE public.credit_wallets SET topup_balance = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;

-- 1. C-level pede: vira pedido à Althius, nada entra no saldo.
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SELECT is(public.credit_purchase('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 10000)->>'status', 'requested',
  'C-level não compra direto: o pedido vai para a Althius');
RESET ROLE;
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'O pedido não soma saldo');
SELECT is((SELECT count(*)::int FROM public.credit_transactions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND type = 'topup'
  AND created_at >= now() - interval '1 minute'), 0, 'Nenhum movimento de recarga no pedido');
SELECT is((SELECT title FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND approval_type = 'creditos'
  AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1), 'Pedido de 10000 créditos à Althius', 'O pedido diz que é à Althius');
SELECT is((SELECT payload_json->>'para' FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND approval_type = 'creditos'
  AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1), 'althius', 'O pedido é endereçado à Althius');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications n JOIN public.approvals a ON a.id = n.entity_id
  WHERE a.approval_type = 'creditos' AND a.requested_by_member_id = 'd0000000-0000-0000-0000-000000000003'
    AND n.recipient_member_id = 'd0000000-0000-0000-0000-000000000001'), 'O superadmin (Althius) é avisado do pedido');

-- 2. O estrategista também pede (antes já era pedido); o BDR não pede.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is(public.credit_purchase('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 25000)->>'status', 'requested', 'Estrategista pede à Althius');
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.credit_purchase('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 10000) $$, '42501', NULL, 'BDR não pede créditos');
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SELECT is(public.credit_purchase('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 1234)->>'success', 'false', 'Pacote desconhecido é recusado');

-- 3. O C-level NÃO decide o próprio pedido de créditos (quem libera é a Althius).
SELECT throws_ok(format($$ SELECT public.approval_decide(%L, 'd0000000-0000-0000-0000-000000000003', 'aprovado', %L::jsonb) $$,
    (SELECT id FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1),
    (SELECT payload_json::text FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1)),
  '42501', NULL, 'C-level não aprova pedido de créditos');
RESET ROLE;
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Recusado, o saldo continua igual');
SELECT is((SELECT status FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003'
  ORDER BY created_at DESC LIMIT 1), 'pendente', 'O pedido continua esperando a Althius');

-- 4. O superadmin aprova: o crédito entra uma vez, com movimento no extrato.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is(public.approval_decide(
    (SELECT id FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1),
    'd0000000-0000-0000-0000-000000000001', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1))->>'success',
  'true', 'Superadmin libera o pedido');
RESET ROLE;
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 10000, 'Liberado, o crédito entra no saldo');
SELECT is((SELECT count(*)::int FROM public.credit_transactions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND type = 'topup'
  AND description = 'Créditos liberados pela Althius' AND amount = 10000), 1, 'O extrato mostra a liberação, uma vez');

-- 5. Aprovar de novo não credita de novo (uso único).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is(public.approval_decide(
    (SELECT id FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1),
    'd0000000-0000-0000-0000-000000000001', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000003' ORDER BY created_at DESC LIMIT 1))->>'success',
  'false', 'Pedido já decidido não decide de novo');

-- 6. Superadmin recusa o pedido do estrategista: nada entra.
SELECT is(public.approval_decide(
    (SELECT id FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000002' ORDER BY created_at DESC LIMIT 1),
    'd0000000-0000-0000-0000-000000000001', 'rejeitado',
    (SELECT payload_json FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000002' ORDER BY created_at DESC LIMIT 1))->>'success',
  'true', 'Superadmin recusa o pedido');
RESET ROLE;
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 10000, 'Pedido recusado não soma saldo');

-- 7. Isolamento: o outro cliente não ganhou nada.
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'f7000000-0000-0000-0000-000000000001'), 0, 'Outro cliente não recebe crédito');

-- 8. Recarga automática desligada: ninguém liga (nem o C-level), e saldo curto pede aprovação em vez de gastar além do saldo.
UPDATE public.workspace_settings SET auto_topup_enabled = true WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT auto_topup_enabled FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), false, 'Recarga automática não liga');
SELECT is((SELECT count(*)::int FROM public.workspace_settings WHERE auto_topup_enabled), 0, 'Nenhum workspace fica com recarga automática');

-- 9. Permissões (ADR 0023).
SELECT ok(NOT has_function_privilege('anon', 'public.credit_purchase(uuid,uuid,integer)', 'EXECUTE'), 'anon não pede créditos');
SELECT ok(NOT has_function_privilege('authenticated', 'public.approvals_creditos_da_althius()', 'EXECUTE'), 'A tela não chama o gatilho direto');
SELECT ok(NOT has_function_privilege('authenticated', 'public.workspace_settings_sem_recarga()', 'EXECUTE'), 'A tela não chama o gatilho da recarga');

SELECT * FROM finish();
ROLLBACK;
