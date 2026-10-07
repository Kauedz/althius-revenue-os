-- ADR 0065: levar contas da base para um quadro do Pipeline (uma ou várias de uma vez), na motion do quadro.
-- Seed: Evolut a0..01 (Rafael superadmin d..01/e..01, Camila estrategista d..02/e..02, Aline C-level d..03/e..03,
-- Lucas BDR d..04/e..04); Grão Norte b0..01. Regras iguais às de criar negócio pela tela (pipeline.deals; BDR só para si).
BEGIN;
SELECT no_plan();

CREATE TEMP TABLE fx ON COMMIT DROP AS SELECT
  (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_slg,
  (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'mlg' ORDER BY created_at LIMIT 1) AS q_mlg,
  (SELECT id FROM public.pipelines WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_grao;
GRANT SELECT ON fx TO authenticated;
INSERT INTO public.accounts (id, workspace_id, name, domain, status, owner_member_id) VALUES
  ('ca000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-000000000001', 'Lead Um', 'leadum.com.br', 'ativa', 'd0000000-0000-0000-0000-000000000004'),
  ('ca000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-000000000001', 'Lead Dois', 'leaddois.com.br', 'ativa', NULL),
  ('ca000000-0000-0000-0000-0000000000e3', 'a0000000-0000-0000-0000-000000000001', 'Lead Três', 'leadtres.com.br', 'ativa', NULL),
  ('ca000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-000000000001', 'Lead do Outro Cliente', 'leadoutro.com.br', 'ativa', NULL);

SET LOCAL ROLE authenticated;

-- 1. Estrategista leva duas contas ao quadro SLG: entram na primeira etapa, valor 0, dono = dono da conta (ou quem pediu).
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is((public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT q_slg FROM fx),
  ARRAY['ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000e2']::uuid[]))->>'criados', '2', 'Duas contas entram no quadro');
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE pipeline_id = (SELECT q_slg FROM fx)
  AND account_id IN ('ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000e2') AND status = 'ativa'), 2, 'Os dois negócios existem e estão ativos');
SELECT is((SELECT stage_key FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e1' AND pipeline_id = (SELECT q_slg FROM fx)),
  (SELECT stage_order->>0 FROM public.pipelines WHERE id = (SELECT q_slg FROM fx)), 'Entra na primeira etapa do quadro');
SELECT is((SELECT amount FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e1' AND pipeline_id = (SELECT q_slg FROM fx)), 0::numeric, 'Valor começa em zero (nada inventado)');
SELECT is((SELECT owner_member_id FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e1' AND pipeline_id = (SELECT q_slg FROM fx)),
  'd0000000-0000-0000-0000-000000000004'::uuid, 'O responsável é o dono da conta');
SELECT is((SELECT owner_member_id FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e2' AND pipeline_id = (SELECT q_slg FROM fx)),
  'd0000000-0000-0000-0000-000000000002'::uuid, 'Conta sem dono: o responsável é quem levou');
SELECT is((SELECT title FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e2' AND pipeline_id = (SELECT q_slg FROM fx)), 'Lead Dois', 'O negócio leva o nome da conta');

-- 2. De novo: não duplica quem já está ativo no quadro.
SELECT is(public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT q_slg FROM fx),
  ARRAY['ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000e2', 'ca000000-0000-0000-0000-0000000000e3']::uuid[]) - 'ids',
  '{"criados": 1, "ja_estavam": 2, "ignoradas": 0}'::jsonb, 'Só a conta nova entra; as que já estavam não duplicam');

-- 3. A mesma conta pode estar em outra motion (outro quadro).
SELECT is((public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT q_mlg FROM fx),
  ARRAY['ca000000-0000-0000-0000-0000000000e1']::uuid[]))->>'criados', '1', 'A conta também entra no quadro MLG');

-- 4. Conta de outro cliente é ignorada; quadro de outro cliente é recusado.
SELECT is((public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT q_mlg FROM fx),
  ARRAY['ca000000-0000-0000-0000-0000000000f1']::uuid[]))->>'ignoradas', '1', 'Conta de outro cliente não entra');
SELECT throws_ok(format($$ SELECT public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', %L,
  ARRAY['ca000000-0000-0000-0000-0000000000e3']::uuid[]) $$, (SELECT q_grao FROM fx)), '42501', NULL, 'Quadro de outro cliente é recusado');

-- 5. BDR: o negócio é sempre dele (escopo "own").
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SELECT is((public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT q_mlg FROM fx),
  ARRAY['ca000000-0000-0000-0000-0000000000e3']::uuid[]))->>'criados', '1', 'BDR leva a conta ao quadro');
SELECT is((SELECT owner_member_id FROM public.opportunities WHERE account_id = 'ca000000-0000-0000-0000-0000000000e3' AND pipeline_id = (SELECT q_mlg FROM fx)),
  'd0000000-0000-0000-0000-000000000004'::uuid, 'O negócio do BDR é dele');

-- 6. Quem não é membro não usa; limite de 500 por vez.
SELECT throws_ok($$ SELECT public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', NULL, ARRAY[]::uuid[]) $$,
  '42501', NULL, 'Não usa o membro de outra pessoa');
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT throws_ok(format($$ SELECT public.opportunity_add_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', %L,
  (SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 501))) $$, (SELECT q_slg FROM fx)), '22023', NULL, 'No máximo 500 contas por vez');
RESET ROLE;

-- 7. Permissões (ADR 0023).
SELECT ok(NOT has_function_privilege('anon', 'public.opportunity_add_accounts(uuid,uuid,uuid,uuid[])', 'EXECUTE'), 'anon não usa');
SELECT ok(has_function_privilege('authenticated', 'public.opportunity_add_accounts(uuid,uuid,uuid,uuid[])', 'EXECUTE'), 'A tela usa');

SELECT * FROM finish();
ROLLBACK;
