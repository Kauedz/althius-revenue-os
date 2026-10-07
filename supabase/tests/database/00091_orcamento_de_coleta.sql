-- ==============================================================================
-- Test: 00091_orcamento_de_coleta.sql
-- ADR 0069. Além dos créditos do cliente, a coleta (Apify) tem TETO EM DÓLAR por cliente por mês (padrão US$ 50), para o custo
-- da Althius nunca passar do que o cliente paga. O banco confere ANTES de reservar: se não cabe, nada é reservado nem gasto.
-- Vale para sinais automáticos, enriquecimento, prospecção (estimar e fila) e teste de fonte. Dólar só no superadmin; o cliente
-- vê porcentagem e créditos que ainda cabem.
-- Seed: Evolut a0..01 (Rafael superadmin e..01, Camila estrategista d..02/e..02, Aline C-level d..03/e..03, Lucas BDR d..04);
--       Grão Norte b0..01 (CEO d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões
SELECT ok(NOT has_function_privilege('authenticated', 'internal.apify_gasto_usd(uuid)', 'EXECUTE'), 'O gasto em dólar não é lido pelo cliente');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.coleta_cabe(uuid, integer)', 'EXECUTE'), 'A conferência é interna');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.coleta_orcamento', 'SELECT'), 'O orçamento em dólar não é lido pelo cliente');
SELECT ok(has_function_privilege('authenticated', 'public.coleta_painel(uuid, uuid)', 'EXECUTE'), 'A tela lê o painel de coleta');
SELECT ok(NOT has_function_privilege('anon', 'public.coleta_painel(uuid, uuid)', 'EXECUTE'), 'Visitante não lê o painel');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_coleta_orcamento_set(uuid, numeric)', 'EXECUTE'), 'Visitante não ajusta orçamento');

-- ---- Cenário: Evolut sem nada, com créditos de sobra
UPDATE public.accounts SET status = 'arquivada' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
INSERT INTO public.accounts (id, workspace_id, name, domain, status, monitorar_sinais) VALUES
  ('ca910000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ORC-CONTA', 'orc-conta.test', 'ativa', true);
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 100000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 100000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';
UPDATE public.workspace_settings SET credit_mode = 'auto', approval_threshold = 100000, monthly_credit_limit = 1000000 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM internal.signal_runs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM internal.account_enrichments WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM public.prospect_searches WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM internal.signal_agent_tests WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM internal.coleta_orcamento;

CREATE TEMP TABLE ctx ON COMMIT DROP AS SELECT (SELECT id FROM public.signal_definitions WHERE code = 'vagas_cargo') AS sig_vagas;
DELETE FROM public.workspace_signal_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE internal.signal_recipes SET enabled = true WHERE signal_id = (SELECT sig_vagas FROM ctx);
UPDATE internal.signal_recipes SET enabled = false WHERE signal_id <> (SELECT sig_vagas FROM ctx);

CREATE OR REPLACE FUNCTION pg_temp.orc(p_usd NUMERIC) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO internal.coleta_orcamento (workspace_id, orcamento_usd) VALUES ('a0000000-0000-0000-0000-000000000001', p_usd)
  ON CONFLICT (workspace_id) DO UPDATE SET orcamento_usd = EXCLUDED.orcamento_usd;
$$;
CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;

-- ---- 1. Padrão e conta do gasto
SELECT is(internal.apify_orcamento_usd('a0000000-0000-0000-0000-000000000001'), 50::numeric, 'Orçamento padrão: US$ 50 por cliente por mês');
SELECT is(internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001'), 0::numeric, 'Sem coleta, sem gasto');

-- Custo real quando já fechou; teto do crédito quando não fechou; em andamento vale o teto reservado; mês passado não conta.
INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, custo_usd, finished_at)
  SELECT 'a0000000-0000-0000-0000-000000000001', sig_vagas, 'ca910000-0000-0000-0000-000000000001', 'p-real', 'ok', 1.5, now() FROM ctx;
INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, reserved_credits)
  SELECT 'a0000000-0000-0000-0000-000000000001', sig_vagas, 'ca910000-0000-0000-0000-000000000001', 'p-andamento', 'reservada', 100 FROM ctx;
INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, custo_usd, finished_at, created_at)
  SELECT 'a0000000-0000-0000-0000-000000000001', sig_vagas, 'ca910000-0000-0000-0000-000000000001', 'p-passado', 'ok', 10, now() - interval '40 days', now() - interval '40 days' FROM ctx;
INSERT INTO internal.account_enrichments (workspace_id, account_id, etapa, estado, creditos, custo_usd, finished_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'ca910000-0000-0000-0000-000000000001', 'empresa', 'ok', 5, 2.25, now());
INSERT INTO public.prospect_searches (id, workspace_id, agent_code, source_code, titulo, max_empresas, creditos_estimados, estado, creditos_cobrados, finished_at)
  VALUES ('d9100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'comercial', 'google_maps', 'ORC busca', 50, 50, 'concluida', 50, now());
INSERT INTO internal.prospect_search_costs (search_id, workspace_id, custo_usd) VALUES ('d9100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 3);
SELECT is(internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001'), round(1.5 + internal.credito_em_usd(100) + 2.25 + 3, 6),
  'Gasto do mês = custo real (1,50 + 2,25 + 3,00) + teto do que está em andamento; o mês passado não entra');
SELECT is(internal.apify_gasto_usd('b0000000-0000-0000-0000-000000000001'), 0::numeric, 'ISOLAMENTO: o gasto de um cliente não entra na conta do outro');
-- Sem custo real (o fornecedor ainda não fechou a conta): vale o teto do crédito cobrado.
INSERT INTO internal.account_enrichments (workspace_id, account_id, etapa, estado, creditos, custo_usd, finished_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'ca910000-0000-0000-0000-000000000001', 'pessoas', 'ok', 10, NULL, now());
SELECT is(internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001'), round(1.5 + internal.credito_em_usd(100) + 2.25 + 3 + internal.credito_em_usd(10), 6),
  'Custo ainda sem valor conta pelo teto do crédito (nunca pelo zero)');
DELETE FROM internal.account_enrichments WHERE etapa = 'pessoas' AND workspace_id = 'a0000000-0000-0000-0000-000000000001';

-- ---- 2. Cabe ou não cabe (com a folga de 25% da reserva)
SELECT pg_temp.orc(ceil((internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001') + internal.credito_em_usd(125)) * 100) / 100);
SELECT ok(internal.coleta_cabe('a0000000-0000-0000-0000-000000000001', 100), 'Cabe: 100 créditos (125 com a folga) quando o orçamento chega ao centavo seguinte');
SELECT pg_temp.orc(floor((internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001') + internal.credito_em_usd(125)) * 100) / 100 - 0.01);
SELECT ok(NOT internal.coleta_cabe('a0000000-0000-0000-0000-000000000001', 100), 'Um centavo a menos: não cabe');
SELECT ok(internal.coleta_cabe('a0000000-0000-0000-0000-000000000001', 0), 'Job que não gasta crédito sempre cabe');
SELECT ok(internal.coleta_restante_creditos('a0000000-0000-0000-0000-000000000001') BETWEEN 90 AND 100, 'Restam cerca de 96 créditos de coleta (o que o cliente vê no lugar do dólar)');

-- ---- 3. Sinais automáticos: sem orçamento nada é reservado
SELECT pg_temp.orc(0);
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Orçamento zerado: nenhuma coleta de sinal começa');
SELECT is((SELECT count(*)::int FROM internal.signal_runs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND periodo NOT LIKE 'p-%'), 0, 'E nada fica reservado');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nenhum crédito do cliente foi tocado');
SELECT pg_temp.orc(50);
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 1, 'Com orçamento, a coleta começa normalmente');

-- ---- 4. Enriquecimento: espera o limite, sem reservar; volta sozinho depois
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT ok((public.account_enrichment_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', ARRAY['ca910000-0000-0000-0000-000000000001']::uuid[])) >= 1, 'Pedido de enriquecimento aceito');
RESET ROLE;
SELECT pg_temp.orc(0);
SELECT is(jsonb_array_length(public.enrichment_next(10)), 0, 'Orçamento zerado: o enriquecimento não começa');
SELECT is((SELECT estado FROM internal.account_enrichments WHERE account_id = 'ca910000-0000-0000-0000-000000000001' AND etapa = 'empresa'), 'sem_saldo', 'Fica esperando (sem_saldo)');
SELECT ok((SELECT mensagem FROM internal.account_enrichments WHERE account_id = 'ca910000-0000-0000-0000-000000000001' AND etapa = 'empresa') ~ 'Limite de coleta', 'Com a mensagem do limite');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT sum(reserved_credits)::int FROM internal.signal_runs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND periodo NOT LIKE 'p-%'), 'Só a coleta de sinal do passo 3 segura crédito (nada do enriquecimento)');
SELECT pg_temp.orc(50);
UPDATE internal.account_enrichments SET updated_at = now() - interval '2 hours' WHERE account_id = 'ca910000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.enrichment_next(10)), 1, 'Passada a espera e com limite, o enriquecimento volta sozinho');

-- ---- 5. Prospecção: estimar já avisa; a fila confere de novo
CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS zoe;
GRANT SELECT ON tk TO anon, authenticated;
SELECT pg_temp.orc(0);
SET LOCAL ROLE anon;
SELECT ok((public.agent_prospect_estimate((SELECT zoe FROM tk), 'google_maps', '{"busca":"clínicas","local":"Campinas, SP, Brasil"}'::jsonb, 20)->>'erro') ~ 'limite de coleta',
  'Estimar com o limite do mês esgotado: a Zoe recebe o aviso (e não gasta nada)');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.prospect_searches WHERE titulo <> 'ORC busca'), 0, 'E nenhuma busca é criada');
SELECT pg_temp.orc(50);
SET LOCAL ROLE anon;
SELECT is((public.agent_prospect_estimate((SELECT zoe FROM tk), 'google_maps', '{"busca":"clínicas","local":"Campinas, SP, Brasil"}'::jsonb, 20)->>'ok'), 'true', 'Com orçamento, estima normalmente');
RESET ROLE;
-- A fila: busca pedida que já não cabe vira "erro" com o motivo, sem reservar nada.
INSERT INTO public.prospect_searches (id, workspace_id, requested_by_member_id, agent_code, source_code, titulo, parametros, max_empresas, creditos_estimados, estado)
  VALUES ('d9100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'comercial', 'google_maps', 'ORC fila', '{"busca":"x"}', 20, 20, 'pendente');
SELECT pg_temp.orc(0);
SELECT is(jsonb_array_length(public.prospect_next(5)), 0, 'Orçamento zerado: a busca da fila não começa');
SELECT is((SELECT estado FROM public.prospect_searches WHERE id = 'd9100000-0000-0000-0000-000000000002'), 'erro', 'A busca fica com erro explicado');
SELECT ok((SELECT mensagem FROM public.prospect_searches WHERE id = 'd9100000-0000-0000-0000-000000000002') ~ 'Limite de coleta do mês', 'Com a mensagem do limite (e "nada foi gasto")');

-- ---- 6. O que o cliente vê: porcentagem e créditos; nunca dólar
SELECT pg_temp.orc((internal.apify_gasto_usd('a0000000-0000-0000-0000-000000000001') * 2)::numeric);
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pn ON COMMIT DROP AS SELECT public.coleta_painel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002') AS p;
GRANT SELECT ON pn TO authenticated;
SELECT is((SELECT p->>'coleta_percentual' FROM pn), '50', 'Painel: metade do orçamento usado = 50%');
SELECT is((SELECT p->>'coleta_atingida' FROM pn), 'false', 'Painel: limite ainda não atingido');
SELECT is((SELECT p->>'pode_editar_teto' FROM pn), 'false', 'Estrategista vê, mas não muda o teto de sinais (regra de créditos)');
SELECT is((SELECT p->>'sinais_teto' FROM pn), '2000', 'Painel: teto de sinais do cliente');
SELECT ok(NOT (SELECT p::text ~* 'usd|dólar|dolar|US\$' FROM pn), 'O painel do cliente nunca traz dólar');
SELECT throws_ok($$ SELECT public.coleta_painel('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002') $$, NULL, NULL, 'ISOLAMENTO: não lê o painel de outro cliente');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((public.coleta_painel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003')->>'pode_editar_teto'), 'true', 'C-level pode mudar o teto de sinais');
RESET ROLE;

-- ---- 7. Superadmin ajusta o orçamento (dólar só aqui)
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.admin_coleta_orcamento_set('a0000000-0000-0000-0000-000000000001', 80) $$, '42501', NULL, 'Estrategista não ajusta o orçamento em dólar');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((public.admin_coleta_orcamento_set('a0000000-0000-0000-0000-000000000001', 80)->>'orcamento_usd'), '80.00', 'Superadmin ajusta para US$ 80');
SELECT throws_ok($$ SELECT public.admin_coleta_orcamento_set('a0000000-0000-0000-0000-000000000001', -1) $$, '22023', NULL, 'Orçamento negativo é recusado');
SELECT is((SELECT (u->>'coleta_orcamento_usd')::numeric FROM jsonb_array_elements(public.admin_usage()) u WHERE u->>'id' = 'a0000000-0000-0000-0000-000000000001'), 80::numeric, 'Uso global mostra o orçamento do cliente');
SELECT ok((SELECT (u->>'coleta_usd')::numeric FROM jsonb_array_elements(public.admin_usage()) u WHERE u->>'id' = 'a0000000-0000-0000-0000-000000000001') > 0, 'E o gasto real do mês');
RESET ROLE;
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'coleta.orcamento_ajustado'), 'O ajuste fica na auditoria');

SELECT * FROM finish();
ROLLBACK;
