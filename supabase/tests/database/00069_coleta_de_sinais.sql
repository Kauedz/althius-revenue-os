-- ==============================================================================
-- Test: 00069_coleta_de_sinais.sql
-- Coleta de sinais (spec .scratch/coleta-de-sinais, ticket 01): o coletor pede trabalho ao banco, que reserva crédito, não
-- repete o mesmo período, só coleta onde o sinal está ligado e a receita está ativa, grava eventos sem repetir o mesmo
-- acontecimento, devolve o crédito se a coleta falha e nunca mistura clientes.
-- Seed: Evolut a0..01 (Aline C-level d..03/e..03; Camila estrategista d..02); Grão Norte b0..01 (C-level d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões (ADR 0023): só o sistema coleta; o usuário só descobre quais sinais já coletam.
SELECT ok(has_function_privilege('service_role', 'public.signal_collect_next(integer)', 'EXECUTE'), 'Sistema pede trabalho de coleta');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_collect_next(integer)', 'EXECUTE'), 'Usuário logado não pede trabalho de coleta');
SELECT ok(NOT has_function_privilege('anon', 'public.signal_collect_next(integer)', 'EXECUTE'), 'Visitante não pede trabalho de coleta');
SELECT ok(has_function_privilege('service_role', 'public.signal_collect_finish(uuid, jsonb, integer, numeric)', 'EXECUTE'), 'Sistema entrega o resultado');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_collect_finish(uuid, jsonb, integer, numeric)', 'EXECUTE'), 'Usuário logado não entrega resultado');
SELECT ok(has_function_privilege('service_role', 'public.signal_collect_fail(uuid, text)', 'EXECUTE'), 'Sistema registra a falha');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_collect_fail(uuid, text)', 'EXECUTE'), 'Usuário logado não registra falha');
SELECT ok(has_function_privilege('authenticated', 'public.signal_codes_com_coleta()', 'EXECUTE'), 'Usuário logado vê quais sinais já coletam');
SELECT ok(NOT has_function_privilege('anon', 'public.signal_codes_com_coleta()', 'EXECUTE'), 'Visitante não vê');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.signal_recipes', 'SELECT'), 'Receitas (atores e custos) não são lidas por usuário');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.signal_runs', 'SELECT'), 'Execuções não são lidas por usuário');

-- ---- Cenário: Evolut (E) e Grão Norte (G), cada um com 2 contas ativas e 1 arquivada, com saldo.
CREATE TEMP TABLE ctx ON COMMIT DROP AS SELECT
  (SELECT id FROM public.signal_definitions WHERE code = 'vagas_cargo') AS sig_vagas,
  (SELECT id FROM public.signal_definitions WHERE code = 'noticias_empresa') AS sig_noticias;

INSERT INTO public.accounts (workspace_id, name, domain, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'CANARIO-E1', 'canario-e1.test', 'ativa'),
  ('a0000000-0000-0000-0000-000000000001', 'CANARIO-E2', 'canario-e2.test', 'ativa'),
  ('a0000000-0000-0000-0000-000000000001', 'CANARIO-E3', 'canario-e3.test', 'arquivada'),
  ('b0000000-0000-0000-0000-000000000001', 'CANARIO-G1', 'canario-g1.test', 'ativa'),
  ('b0000000-0000-0000-0000-000000000001', 'CANARIO-G2', 'canario-g2.test', 'ativa');
-- Spec prospeccao-revenue (ADR 0066): a coleta automática só roda nas contas monitoradas; as de teste são marcadas.
UPDATE public.accounts SET monitorar_sinais = true WHERE name LIKE 'CANARIO-%';
-- Só as contas de teste entram na conta: as do seed ficam arquivadas durante o teste para o resultado ser exato.
UPDATE public.accounts SET status = 'arquivada' WHERE name NOT LIKE 'CANARIO-%';
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days'),
         ('b0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';

-- ---- Receita desligada (padrão): nada é pedido.
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Sem receita ativa, nenhuma coleta é pedida');

-- A receita de vagas já nasce cadastrada e desligada; só o superadmin liga, e só por esta função.
SELECT is((SELECT enabled FROM internal.signal_recipes WHERE signal_id = (SELECT sig_vagas FROM ctx)), false, 'A receita de vagas nasce desligada');
SELECT ok(has_function_privilege('authenticated', 'public.admin_signal_recipe_set(text, boolean)', 'EXECUTE'), 'A tela do superadmin pode chamar o interruptor');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_signal_recipe_set(text, boolean)', 'EXECUTE'), 'Visitante não');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.admin_signal_recipe_set('vagas_cargo', true)$$, '42501', NULL, 'C-level de cliente não liga a coleta');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok($$SELECT public.admin_signal_recipe_set('vagas_cargo', true)$$, 'Superadmin liga a coleta de vagas');
SELECT throws_ok($$SELECT public.admin_signal_recipe_set('nao_existe', true)$$, '22023', NULL, 'Sinal sem receita é recusado');
RESET ROLE;
SELECT is((SELECT signal_codes_com_coleta())::text, '{vagas_cargo}', 'A tela passa a saber que vagas já coleta');

-- Grão Norte desliga o sinal de vagas.
INSERT INTO public.workspace_signal_settings (workspace_id, signal_id, enabled)
  SELECT 'b0000000-0000-0000-0000-000000000001', sig_vagas, false FROM ctx;

CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT public.signal_collect_next(50) AS x;
SELECT is(jsonb_array_length((SELECT x FROM r1)), 2, 'Só as 2 contas ativas da Evolut; arquivada e cliente com sinal desligado ficam de fora');
SELECT ok((SELECT bool_and(j->>'workspace_id' = 'a0000000-0000-0000-0000-000000000001') FROM r1, jsonb_array_elements(x) j), 'Nenhum pedido é do cliente que desligou');
SELECT ok((SELECT bool_and(j->>'signal_code' = 'vagas_cargo' AND (j->>'credits')::int = 5 AND j->'fontes' IS NOT NULL) FROM r1, jsonb_array_elements(x) j), 'Cada pedido traz o sinal, o custo em créditos e as fontes');
SELECT ok((SELECT bool_and(j->>'frequencia' = 'semanal' AND j->>'periodo' ~ '^[0-9]{4}-W[0-9]{2}$') FROM r1, jsonb_array_elements(x) j), 'O pedido diz a frequência e o período (semana)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 14, 'Reservou 5 créditos +25% (7) por conta: 14');
SELECT is((SELECT count(*)::int FROM internal.signal_runs WHERE estado = 'reservada'), 2, 'Duas execuções reservadas');

-- Idempotência: no mesmo período, não pede de novo.
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'No mesmo período, a mesma conta não é pedida de novo');

-- ---- Entrega com resultado: 3 eventos, 2 do mesmo acontecimento.
CREATE TEMP TABLE alvo ON COMMIT DROP AS
  SELECT (j->>'run_id')::uuid AS run_id, (j->>'account_id')::uuid AS account_id FROM r1, jsonb_array_elements(x) j
   WHERE j->>'account_name' = 'CANARIO-E1';
SELECT is((public.signal_collect_finish((SELECT run_id FROM alvo), jsonb_build_array(
  jsonb_build_object('chave', 'vaga|e1|analista|2026', 'texto', 'Abriu vaga de Analista', 'evidencia', 'https://exemplo.test/1', 'fonte', 'LinkedIn', 'quando', now()),
  jsonb_build_object('chave', 'vaga|e1|analista|2026', 'texto', 'Abriu vaga de Analista (repetida)', 'evidencia', 'https://exemplo.test/1', 'fonte', 'LinkedIn', 'quando', now()),
  jsonb_build_object('chave', 'vaga|e1|gerente|2026', 'texto', 'Abriu vaga de Gerente', 'evidencia', 'https://exemplo.test/2', 'fonte', 'LinkedIn', 'quando', now())
), 12, 0.0123))->>'eventos_novos', '2', 'Dois acontecimentos novos (a repetição não conta)');
SELECT is((SELECT count(*)::int FROM public.signal_events WHERE account_id = (SELECT account_id FROM alvo)), 2, 'Dois eventos gravados');
SELECT is((SELECT payload->>'texto' FROM public.signal_events WHERE account_id = (SELECT account_id FROM alvo) AND event_key = 'vaga|e1|analista|2026'), 'Abriu vaga de Analista', 'O texto do evento vai no payload que a tela lê');
SELECT is((SELECT temperature FROM public.accounts WHERE id = (SELECT account_id FROM alvo)), 2, 'A conta esquentou um nível, não um por evento');
SELECT is((SELECT estado FROM internal.signal_runs WHERE id = (SELECT run_id FROM alvo)), 'ok', 'Execução concluída');
SELECT is((SELECT custo_usd FROM internal.signal_runs WHERE id = (SELECT run_id FROM alvo)), 0.0123::numeric, 'O custo real fica só na execução interna');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'Cobrou os 5 créditos do sinal');
-- Entregar de novo o mesmo resultado não duplica nem cobra duas vezes.
SELECT is((public.signal_collect_finish((SELECT run_id FROM alvo), '[]'::jsonb, 0, 0))->>'acao', 'ignorado', 'Entrega repetida é ignorada');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'E não cobra de novo');

-- ---- Entrega sem novidade: a varredura foi feita, cobra, mas não inventa evento.
CREATE TEMP TABLE alvo2 ON COMMIT DROP AS
  SELECT (j->>'run_id')::uuid AS run_id, (j->>'account_id')::uuid AS account_id FROM r1, jsonb_array_elements(x) j
   WHERE j->>'account_name' = 'CANARIO-E2';
SELECT public.signal_collect_finish((SELECT run_id FROM alvo2), '[]'::jsonb, 0, 0.001);
SELECT is((SELECT estado FROM internal.signal_runs WHERE id = (SELECT run_id FROM alvo2)), 'sem_novidade', 'Sem acontecimento novo, a execução diz isso');
SELECT is((SELECT count(*)::int FROM public.signal_events WHERE account_id = (SELECT account_id FROM alvo2)), 0, 'Nenhum evento inventado');
SELECT is((SELECT temperature FROM public.accounts WHERE id = (SELECT account_id FROM alvo2)), 1, 'A conta não esquenta sem sinal');

-- ---- Falha: devolve o crédito, não grava evento, e só tenta de novo depois de um tempo (e no máximo 3 vezes).
UPDATE public.credit_wallets SET reserved_balance = 0, monthly_consumed = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
-- Uma conta nova da Evolut para a falha (a E1 já tem a coleta deste período concluída).
INSERT INTO public.accounts (workspace_id, name, domain, status, monitorar_sinais) VALUES ('a0000000-0000-0000-0000-000000000001', 'CANARIO-E4', 'canario-e4.test', 'ativa', true);
CREATE TEMP TABLE r2 ON COMMIT DROP AS SELECT public.signal_collect_next(50) AS x;
SELECT is(jsonb_array_length((SELECT x FROM r2)), 1, 'Só a conta nova é pedida (as outras já têm coleta neste período)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 7, 'Reservou 7');
SELECT is((public.signal_collect_fail((SELECT (x->0->>'run_id')::uuid FROM r2), 'A Apify recusou a chave'))->>'acao', 'falhou', 'Falha registrada');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'A reserva foi devolvida');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nada foi cobrado');
SELECT is((SELECT estado FROM internal.signal_runs WHERE id = (SELECT (x->0->>'run_id')::uuid FROM r2)), 'erro', 'Execução marcada como erro');
SELECT is((SELECT mensagem FROM internal.signal_runs WHERE id = (SELECT (x->0->>'run_id')::uuid FROM r2)), 'A Apify recusou a chave', 'Com o motivo claro');
SELECT is((SELECT count(*)::int FROM public.signal_events WHERE account_id = (SELECT (x->0->>'account_id')::uuid FROM r2)), 0, 'Erro de coleta nunca vira evento');
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Logo depois do erro, não tenta de novo (espera um tempo)');
UPDATE internal.signal_runs SET updated_at = now() - interval '2 hours' WHERE estado = 'erro';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 1, 'Passado o tempo, tenta de novo');
UPDATE internal.signal_runs SET tentativas = 3, updated_at = now() - interval '2 hours', estado = 'erro' WHERE estado IN ('erro', 'reservada') AND workspace_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.credit_wallets SET reserved_balance = 0 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Depois de 3 tentativas, desiste do período');

-- ---- Sem saldo: não reserva, não executa, avisa na execução e tenta de novo depois.
UPDATE public.credit_wallets SET allowance_balance = 1, topup_balance = 0, reserved_balance = 0 WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001';
DELETE FROM public.workspace_signal_settings WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(jsonb_array_length(public.signal_collect_next(50)), 0, 'Sem saldo para a reserva, nada é pedido ao coletor');
SELECT is((SELECT count(*)::int FROM internal.signal_runs WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND estado = 'sem_saldo'), 2, 'As 2 contas ficam marcadas sem saldo');

-- ---- Isolamento: o cliente B nunca enxerga eventos nem a execução do cliente A.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.signal_events WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Grão Norte não vê eventos da Evolut');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.signal_events WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'Evolut não vê eventos do Grão Norte');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
