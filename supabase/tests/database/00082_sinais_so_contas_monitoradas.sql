-- Spec .scratch/prospeccao-revenue, fatia 1 (ADR 0066): sinais automáticos só nas contas MONITORADAS e com teto mensal de
-- créditos por cliente. Monitorada = tem negócio ativo, está numa cadência ativa ou foi marcada à mão. Conta antiga parada
-- não gasta crédito sozinha, e sobra crédito para prospectar.
BEGIN;
SELECT no_plan();

CREATE TEMP TABLE ctx ON COMMIT DROP AS SELECT
  (SELECT id FROM public.signal_definitions WHERE code = 'vagas_cargo') AS sig_vagas,
  (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_slg;

INSERT INTO public.accounts (id, workspace_id, name, domain, status, monitorar_sinais) VALUES
  ('ca000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'MON-MANUAL', 'mon-manual.test', 'ativa', true),
  ('ca000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'MON-NEGOCIO', 'mon-negocio.test', 'ativa', false),
  ('ca000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001', 'MON-CADENCIA', 'mon-cadencia.test', 'ativa', false),
  ('ca000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-000000000001', 'MON-PARADA', 'mon-parada.test', 'ativa', false);
UPDATE public.accounts SET status = 'arquivada' WHERE name NOT LIKE 'MON-%';
INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, stage_key, title, amount, owner_member_id, status)
  SELECT 'a0000000-0000-0000-0000-000000000001', q_slg, 'ca000000-0000-0000-0000-0000000000a2', 'entrada', 'MON-NEGOCIO', 0, 'd0000000-0000-0000-0000-000000000002', 'ativa' FROM ctx;
INSERT INTO public.contacts (id, workspace_id, account_id, name) VALUES
  ('cb000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000a3', 'Contato em cadência');
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES ('cd000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001', 'Cadência MON', 'ativa');
INSERT INTO public.cadence_enrollments (workspace_id, cadence_id, contact_id, status)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-0000000000a3', 'cb000000-0000-0000-0000-0000000000a3', 'ativa');
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';
DELETE FROM public.workspace_signal_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE internal.signal_recipes SET enabled = true WHERE signal_id = (SELECT sig_vagas FROM ctx);
-- Só o sinal de vagas coleta neste teste (o resultado fica exato).
UPDATE internal.signal_recipes SET enabled = false WHERE signal_id <> (SELECT sig_vagas FROM ctx);

SELECT is((SELECT monitorar_sinais FROM public.accounts WHERE id = 'ca000000-0000-0000-0000-0000000000a4'), false, 'Conta nasce sem monitoramento manual');
SELECT is((SELECT teto_sinais_mes FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 2000, 'Teto padrão: 2.000 créditos de sinais por mês');

-- 1. Só as monitoradas: marcada à mão, com negócio ativo e com cadência ativa. A parada fica de fora.
CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT public.signal_collect_next(50) AS x;
SELECT is((SELECT array_agg(j->>'account_name' ORDER BY j->>'account_name') FROM r1, jsonb_array_elements(x) j),
  ARRAY['MON-CADENCIA', 'MON-MANUAL', 'MON-NEGOCIO'], 'Só as 3 contas monitoradas entram na coleta; a parada não gasta nada');

-- 2. Teto zero desliga os sinais automáticos do cliente (a conta parada, marcada agora, entraria; o teto segura).
UPDATE public.accounts SET monitorar_sinais = true WHERE id = 'ca000000-0000-0000-0000-0000000000a4';
UPDATE public.workspace_settings SET teto_sinais_mes = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Teto zero: nada coleta sozinho');

-- 3. Teto do mês: 3 coletas de 5 já usadas (15); com teto 17 a próxima (20) não cabe.
UPDATE public.workspace_settings SET teto_sinais_mes = 17 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Teto do mês atingido: a coleta automática para');

-- 4. Com folga no teto (22), entra só a que cabe: 15 + 5 = 20.
UPDATE public.workspace_settings SET teto_sinais_mes = 22 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 1, 'Só entra a coleta que cabe no teto');

-- 5. A tela só muda o monitoramento por função, com permissão de editar a conta; o teto, só gestor.
SELECT ok(has_function_privilege('authenticated', 'public.account_set_monitoring(uuid,uuid,uuid,boolean)', 'EXECUTE'), 'A tela marca o monitoramento');
SELECT ok(NOT has_function_privilege('anon', 'public.account_set_monitoring(uuid,uuid,uuid,boolean)', 'EXECUTE'), 'Visitante não');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.account_set_monitoring('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-0000000000a4', false)->>'monitorar', 'false', 'Estrategista desliga o monitoramento');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.account_set_monitoring('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-0000000000a4', true) $$,
  '42501', NULL, 'BDR não mexe em conta que não é dele');
SELECT throws_ok($$ SELECT public.signal_budget_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 500) $$, '42501', NULL, 'BDR não muda o teto');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((public.signal_budget_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 3000))->>'teto', '3000', 'C-level muda o teto de sinais');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
