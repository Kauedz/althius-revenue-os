BEGIN;
SELECT no_plan();
INSERT INTO public.workspaces (id, name, slug) VALUES ('f1000000-0000-0000-0000-000000000001', 'Creditos Teste', 'creditos-teste');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'clevel', 'active'),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'estrategista', 'active');
INSERT INTO public.workspace_settings (workspace_id, credit_mode, approval_threshold, monthly_credit_limit, auto_topup_enabled, auto_topup_amount)
VALUES ('f1000000-0000-0000-0000-000000000001', 'auto', 500, 5000, false, 10000);
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, monthly_consumed)
VALUES ('f1000000-0000-0000-0000-000000000001', 1000, 0);

SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,-1,false,'Negativo','{}'::jsonb))->>'status','insufficient_credits','Checagem 4 recusa estimativa negativa');
SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,600,false,'Gasto automatico','{}'::jsonb))->>'status','authorized','Modo automatico nao para no teto de 500');

UPDATE public.workspace_settings SET credit_mode = 'approval' WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,600,false,'Acima do teto','{}'::jsonb))->>'status','requires_approval','Acima do teto vira aprovacao');
SELECT ok((SELECT description LIKE '%teto%' FROM public.approvals WHERE title = 'Acima do teto'), 'Motivo da aprovacao cita o teto');
SELECT is((SELECT count(*)::integer FROM public.executions WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001' AND estimated_credits = 600), 1, 'Teto nao cria segunda execucao');

UPDATE public.workspace_settings SET credit_mode = 'auto' WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001';
UPDATE public.credit_wallets SET monthly_consumed = 4900 WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,200,false,'Estoura o mes','{}'::jsonb))->>'status','requires_approval','Acima do limite mensal pede aprovacao');
SELECT ok((SELECT description LIKE '%limite mensal%' FROM public.approvals WHERE title = 'Estoura o mes'), 'Motivo cita o limite mensal');

UPDATE public.credit_wallets SET allowance_balance = 10, monthly_consumed = 0 WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,100,false,'Sem saldo','{}'::jsonb))->>'status','requires_approval','Sem saldo pede aprovacao');
SELECT ok((SELECT description LIKE '%Saldo%' FROM public.approvals WHERE title = 'Sem saldo'), 'Motivo cita o saldo');

UPDATE public.workspace_settings SET auto_topup_enabled = true WHERE workspace_id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((public.hermes_evaluate_action('f1000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','pipeline.boards',NULL,100,false,'Com recarga','{}'::jsonb))->>'status','authorized','Recarga automatica cobre o saldo curto');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok($$ SELECT public.credit_policy_save('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002','approval',800,4000,true) $$, '42501', NULL, 'Estrategista nao muda a politica');
SELECT is(public.credit_purchase('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',10000)->>'status','requires_approval','Estrategista pede compra');
SELECT is((SELECT approval_type FROM public.approvals WHERE title = 'Compra de 10000 creditos' OR title LIKE 'Compra de 10000%' ORDER BY created_at DESC LIMIT 1),'creditos','Pedido e do tipo creditos');
SELECT is((SELECT category FROM public.approvals WHERE approval_type = 'creditos' AND requested_by_member_id = 'd0000000-0000-0000-0000-000000000002' LIMIT 1),'gasto','Pedido de creditos e gasto');
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),0,'Pedido nao credita sozinho');

SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT is(public.credit_purchase('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',10000)->>'status','credited','C-level compra');
SELECT is((SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),10000,'Compra entra na carteira de recarga');
SELECT is(public.credit_policy_save('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003','approval',800,4000,true)->>'success','true','C-level grava a politica');
SELECT is((SELECT approval_threshold FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),800,'Teto gravado');

SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}';
SELECT throws_ok($$ SELECT public.credit_purchase('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',10000) $$, '42501', NULL, 'BDR nao compra');

RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.credit_purchase(uuid,uuid,integer)','EXECUTE'),'anon nao compra');
SELECT ok(NOT has_function_privilege('anon','public.credit_policy_save(uuid,uuid,text,integer,integer,boolean)','EXECUTE'),'anon nao grava politica');
SELECT ok(NOT has_function_privilege('authenticated','public.hermes_credit_gate(uuid,uuid,text,integer,boolean,text,jsonb)','EXECUTE'),'tela nao chama o portao direto');
SELECT * FROM finish();
ROLLBACK;
