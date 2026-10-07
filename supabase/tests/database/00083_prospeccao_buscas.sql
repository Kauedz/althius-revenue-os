-- ==============================================================================
-- Test: 00083_prospeccao_buscas.sql
-- Prospecção (spec .scratch/prospeccao-revenue, fatia 2; ADR 0067): a Zoe ESTIMA (não gasta nada), a pessoa pede e a
-- busca roda; o crédito máximo é reservado, cobra-se só por empresa NOVA e o resto volta; falha devolve tudo. O que a
-- fonte traz vira CANDIDATA; a pessoa inclui (vira conta e entra no enriquecimento) ou exclui (o crédito não volta).
-- Só a Zoe prospecta; BDR não roda nem decide; isolamento entre clientes; nenhuma chamada à Apify (o serviço é falso).
-- Seed: Evolut a0..01 (Camila estrategista d..02/e..02, Aline C-level d..03/e..03, BDR d..04/e..04);
--       Grão Norte b0..01 (estrategista d..08, CEO d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões
SELECT ok(has_function_privilege('anon', 'public.agent_prospect_sources(text)', 'EXECUTE'), 'Porta do agente: fontes (só com token)');
SELECT ok(has_function_privilege('anon', 'public.agent_prospect_estimate(text, text, jsonb, integer)', 'EXECUTE'), 'Porta do agente: estimar');
SELECT ok(has_function_privilege('anon', 'public.agent_prospect_run(text, uuid)', 'EXECUTE'), 'Porta do agente: rodar');
SELECT ok(has_function_privilege('anon', 'public.agent_prospect_searches(text)', 'EXECUTE'), 'Porta do agente: ler as buscas');
SELECT ok(NOT has_function_privilege('anon', 'public.prospect_next(integer)', 'EXECUTE'), 'Visitante não pega busca');
SELECT ok(NOT has_function_privilege('authenticated', 'public.prospect_next(integer)', 'EXECUTE'), 'Usuário logado não pega busca (reserva crédito)');
SELECT ok(has_function_privilege('service_role', 'public.prospect_next(integer)', 'EXECUTE'), 'Só o serviço pega busca');
SELECT ok(NOT has_function_privilege('authenticated', 'public.prospect_finish(uuid, jsonb, numeric)', 'EXECUTE'), 'Usuário logado não entrega resultado');
SELECT ok(has_function_privilege('service_role', 'public.prospect_finish(uuid, jsonb, numeric)', 'EXECUTE'), 'Só o serviço entrega resultado');
SELECT ok(NOT has_function_privilege('authenticated', 'public.prospect_fail(uuid, text)', 'EXECUTE'), 'Usuário logado não marca falha');
SELECT ok(has_function_privilege('authenticated', 'public.prospect_candidates_decide(uuid, uuid, uuid[], text, jsonb)', 'EXECUTE'), 'Tela decide candidatas');
SELECT ok(NOT has_function_privilege('anon', 'public.prospect_candidates_decide(uuid, uuid, uuid[], text, jsonb)', 'EXECUTE'), 'Visitante não decide candidatas');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.prospect_sources', 'SELECT'), 'Fontes (com o ator) não são lidas direto');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.prospect_search_costs', 'SELECT'), 'Custo real (dólar) não é lido pelo cliente');
SELECT ok(NOT has_table_privilege('authenticated', 'public.prospect_searches', 'INSERT'), 'Ninguém grava busca direto');
SELECT ok(NOT has_table_privilege('authenticated', 'public.prospect_candidates', 'UPDATE'), 'Ninguém muda candidata direto');
SELECT ok(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('prospect_searches', 'prospect_candidates') AND column_name ~* 'usd'),
  'Nenhuma coluna em dólar nas tabelas que o cliente lê');

-- ---- Cenário
-- O teste não depende do preço comercial (que o superadmin muda): fixa em 1 crédito por empresa.
UPDATE internal.prospect_sources SET creditos_por_empresa = 1;
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days'),
         ('b0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';
UPDATE public.workspace_settings SET credit_mode = 'auto', approval_threshold = 500, monthly_credit_limit = 5000
 WHERE workspace_id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
DELETE FROM public.prospect_candidates;
DELETE FROM public.prospect_searches;
INSERT INTO public.accounts (id, workspace_id, name, domain, cnpj, status) VALUES
  ('c8300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-PR-JA', 'canario-pr-ja.test', '11222333000181', 'ativa');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS zoe,
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000002') AS jax,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS zoe_grao;
GRANT SELECT ON tk TO anon, authenticated;

-- Quem pede é a pessoa da rodada em andamento do agente (ADR 0058). Aqui: a Camila, estrategista.
CREATE OR REPLACE FUNCTION pg_temp.pedir(p_ws UUID, p_agente TEXT, p_membro UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_canal UUID := gen_random_uuid(); v_msg UUID := gen_random_uuid(); v_run UUID := gen_random_uuid();
BEGIN
  UPDATE public.agent_channel_runs SET status = 'done' WHERE workspace_id = p_ws AND agent_id = p_agente AND status = 'in_flight';
  INSERT INTO public.chat_channels (id, workspace_id, slug, name) VALUES (v_canal, p_ws, 'pr-' || left(v_canal::text, 8), 'Teste prospecção');
  INSERT INTO public.chat_messages (id, workspace_id, channel_id, sender_type, sender_member_id, content) VALUES (v_msg, p_ws, v_canal, 'member', p_membro, 'Zoe, pode rodar');
  INSERT INTO public.agent_channel_runs (id, workspace_id, channel_id, agent_id, status, deadline_at) VALUES (v_run, p_ws, v_canal, p_agente, 'in_flight', now() + interval '5 minutes');
  INSERT INTO public.agent_channel_queue (workspace_id, channel_id, agent_id, message_id, status, run_id) VALUES (p_ws, v_canal, p_agente, v_msg, 'in_flight', v_run);
END;
$$;

-- Decide como uma pessoa, pela mesma função da tela.
CREATE OR REPLACE FUNCTION pg_temp.decidir(p_id UUID, p_user UUID, p_membro UUID, p_decisao TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := public.approval_decide(p_id, p_membro, p_decisao, (SELECT payload_json FROM public.approvals WHERE id = p_id));
  RESET ROLE;
  RETURN r;
END;
$$;

-- ---- Fontes (dado, não código)
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_prospect_sources('alt_agente_x') $$, '28000', NULL, 'Token inventado é recusado');
CREATE TEMP TABLE fontes ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.agent_prospect_sources((SELECT zoe FROM tk))) x;
SELECT ok(EXISTS (SELECT 1 FROM fontes WHERE x->>'codigo' = 'google_maps'), 'Google Maps é uma fonte');
SELECT ok(EXISTS (SELECT 1 FROM fontes WHERE x->>'codigo' = 'receita_cnae'), 'Receita Federal por CNAE é uma fonte');
SELECT is((SELECT (x->>'creditos_por_empresa')::int FROM fontes WHERE x->>'codigo' = 'google_maps'), 1, 'Preço provisório: 1 crédito por empresa');
SELECT is((SELECT (x->>'max_por_busca')::int FROM fontes WHERE x->>'codigo' = 'google_maps'), 200, 'Até 200 empresas por busca');
SELECT ok(NOT EXISTS (SELECT 1 FROM fontes WHERE x::text ~* 'usd|dólar|dolar|compass/'), 'O agente não vê dólar nem o ator da fonte');

-- ---- Estimar: só a Zoe, valida, não gasta nada
SELECT is((SELECT public.agent_prospect_estimate(jax, 'google_maps', '{"busca":"clínica","local":"Campinas, SP, Brasil"}', 10) FROM tk)->>'erro',
  'Só a Zoe prospecta. Peça à Zoe (agente comercial).', 'Só a Zoe estima');
SELECT is((SELECT public.agent_prospect_estimate(zoe, 'fonte_que_nao_existe', '{}', 10) FROM tk)->>'ok', 'false', 'Fonte desconhecida é recusada');
SELECT is((SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"local":"Campinas, SP, Brasil"}', 10) FROM tk)->>'ok', 'false', 'Falta parâmetro obrigatório (busca)');
SELECT is((SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"clínica","local":"Campinas","inventado":"x"}', 10) FROM tk)->>'ok', 'false', 'Parâmetro que a fonte não tem é recusado');
SELECT is((SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"clínica","local":"Campinas"}', 201) FROM tk)->>'ok', 'false', 'Acima do máximo da fonte é recusado');
SELECT is((SELECT public.agent_prospect_estimate(zoe, 'receita_cnae', '{"cnae":"8630504","uf":"São Paulo"}', 10) FROM tk)->>'ok', 'false', 'UF precisa ser a sigla');
CREATE TEMP TABLE e1 ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"clínica odontológica","local":"Campinas, SP, Brasil"}', 50) AS r FROM tk;
GRANT SELECT ON e1 TO anon, authenticated;
SELECT is((SELECT r->>'ok' FROM e1), 'true', 'Estimativa feita');
SELECT is((SELECT (r->>'creditos')::int FROM e1), 50, 'Custa até 50 créditos (50 empresas × 1)');
SELECT ok((SELECT r->>'aviso' FROM e1) ~ '50 créditos', 'O aviso diz o custo em créditos');
RESET ROLE;
SELECT is((SELECT estado FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 'estimada', 'A busca fica estimada');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'ESTIMAR NÃO GASTA: nada reservado');
SELECT is((SELECT count(*)::int FROM public.executions WHERE metadata_json ? 'prospeccao_id'), 0, 'Estimar não cria execução');

-- ---- Rodar: precisa de estimativa válida e de uma pessoa pedindo
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'ok', 'false', 'Sem pessoa pedindo, não roda');
RESET ROLE;
SELECT pg_temp.pedir('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_prospect_run(zoe, gen_random_uuid()) FROM tk)->>'ok', 'false', 'RODAR SEM ESTIMATIVA é recusado');
SELECT is((SELECT public.agent_prospect_run(jax, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'erro', 'Só a Zoe prospecta. Peça à Zoe (agente comercial).', 'Só a Zoe roda');
SELECT is((SELECT public.agent_prospect_run(zoe_grao, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'ok', 'false', 'CANÁRIO: a Zoe de outro cliente não roda esta busca');
RESET ROLE;
UPDATE public.prospect_searches SET created_at = now() - interval '31 minutes' WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1);
SET LOCAL ROLE anon;
SELECT ok((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'erro' ~ 'venceu', 'Estimativa vencida (30 min) não roda');
RESET ROLE;
UPDATE public.prospect_searches SET created_at = now() WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1);
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'estado', 'pendente', 'Pedida, dentro do teto: vai para a fila');
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e1)) FROM tk)->>'ok', 'false', 'A mesma busca não roda duas vezes');
RESET ROLE;
SELECT is((SELECT requested_by_member_id FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 'd0000000-0000-0000-0000-000000000002'::uuid, 'Fica registrado quem pediu');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Na fila ainda não reserva (o serviço reserva)');

-- BDR não roda
SELECT pg_temp.pedir('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE anon;
CREATE TEMP TABLE e_bdr ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"academia","local":"Campinas"}', 10) AS r FROM tk;
SELECT ok((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e_bdr)) FROM tk)->>'erro' ~ 'BDR', 'BDR não roda prospecção');
RESET ROLE;

-- Acima do teto: vai para aprovação do C-level; aprovada entra na fila, recusada é cancelada.
SELECT pg_temp.pedir('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002');
UPDATE public.workspace_settings SET credit_mode = 'approval', approval_threshold = 100 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE anon;
CREATE TEMP TABLE e2 ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"padaria","local":"Campinas"}', 150) AS r FROM tk;
CREATE TEMP TABLE e3 ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"pet shop","local":"Campinas"}', 150) AS r FROM tk;
GRANT SELECT ON e2, e3 TO anon, authenticated;
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e2)) FROM tk)->>'estado', 'aprovacao', 'Acima do teto: vai para aprovação');
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e3)) FROM tk)->>'estado', 'aprovacao', 'Outra acima do teto');
RESET ROLE;
SELECT is((SELECT a.category FROM public.approvals a JOIN public.prospect_searches s ON s.approval_id = a.id WHERE s.id = (SELECT (r->>'estimativa_id')::uuid FROM e2)), 'gasto', 'É aprovação de gasto (quem paga decide)');
SELECT is(pg_temp.decidir((SELECT approval_id FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e2)),
  'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'aprovado')->>'success', 'false', 'Estrategista não aprova gasto');
SELECT is(pg_temp.decidir((SELECT approval_id FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e2)),
  'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'aprovado')->>'success', 'true', 'C-level aprova');
SELECT is((SELECT estado FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e2)), 'pendente', 'Aprovada: entra na fila');
SELECT is(pg_temp.decidir((SELECT approval_id FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e3)),
  'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'rejeitado')->>'success', 'true', 'C-level recusa');
SELECT is((SELECT estado FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e3)), 'cancelada', 'Recusada: cancelada');
UPDATE public.workspace_settings SET credit_mode = 'auto', approval_threshold = 500 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

-- Receita Federal com filtro de porte (aplicado depois, nos itens) e uma busca da Grão.
SET LOCAL ROLE anon;
CREATE TEMP TABLE e4 ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'receita_cnae', '{"cnae":"8630-5/04","uf":"sp","porte":"MICRO,EPP"}', 20) AS r FROM tk;
GRANT SELECT ON e4 TO anon, authenticated;
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e4)) FROM tk)->>'estado', 'pendente', 'Receita na fila');
RESET ROLE;
SELECT is((SELECT parametros->>'cnae' FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e4)), '8630504', 'CNAE guardado só com números');
SELECT is((SELECT parametros->>'uf' FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e4)), 'SP', 'UF em maiúsculas');
-- tira da fila a de 150 aprovada (fica para o teste de falha)
UPDATE public.prospect_searches SET estado = 'cancelada' WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e_bdr);

-- ---- O serviço pega: reserva o máximo e cria a execução
CREATE TEMP TABLE n1 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.prospect_next(10)) x;
SELECT is((SELECT count(*)::int FROM n1), 3, 'Pega as 3 buscas na fila (Maps 50, Maps 150 aprovada, Receita 20)');
SELECT is((SELECT x->'fonte'->>'ator' FROM n1 WHERE x->>'search_id' = (SELECT r->>'estimativa_id' FROM e1)), 'compass/crawler-google-places', 'O serviço recebe o ator');
SELECT is((SELECT x->'parametros'->>'busca' FROM n1 WHERE x->>'search_id' = (SELECT r->>'estimativa_id' FROM e1)), 'clínica odontológica', 'O serviço recebe os parâmetros');
SELECT is((SELECT (x->>'max_empresas')::int FROM n1 WHERE x->>'search_id' = (SELECT r->>'estimativa_id' FROM e1)), 50, 'E o máximo de empresas');
SELECT is((SELECT (x->>'teto_usd')::numeric FROM n1 WHERE x->>'search_id' = (SELECT r->>'estimativa_id' FROM e1)), round(50 * 0.0529 / 5.5, 4), 'Teto do fornecedor = o que o cliente paga');
SELECT is((SELECT reserved_credits FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 63, 'Reserva o máximo (50, com a folga de 25% do cofre)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 63 + 188 + 25, 'Carteira reservou as três');
SELECT is((SELECT e.execution_type || '/' || e.agent_code || '/' || e.status FROM public.executions e JOIN public.prospect_searches s ON s.execution_id = e.id
            WHERE s.id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 'Lista/comercial/running', 'Vira execução "Lista" da Zoe (Prospecção e Execuções)');
SELECT is(jsonb_array_length(public.prospect_next(10)), 0, 'Nada pego duas vezes');

-- ---- Entrega: candidatas, repetidas não cobram, cobra por nova, devolve o resto
CREATE TEMP TABLE f1 ON COMMIT DROP AS SELECT public.prospect_finish((SELECT (r->>'estimativa_id')::uuid FROM e1), '[
  {"chave":"gmaps:A1","nome":"Clínica Sorriso","site":"https://www.clinicasorriso.com.br/contato","telefone":"(19) 3333-1111","endereco":"Rua A, 10","cidade":"Campinas","uf":"SP","categoria":"Dentista","lat":-22.9,"lng":-47.06,"dados":{"totalScore":4.8}},
  {"chave":"gmaps:A2","nome":"Odonto Insta","site":"https://instagram.com/odontoinsta","cidade":"Campinas","uf":"SP"},
  {"chave":"gmaps:A3","nome":"Dente Feliz","site":"dentefeliz.com.br","cidade":"Campinas","uf":"SP"},
  {"chave":"gmaps:A1","nome":"Clínica Sorriso (de novo)","site":"clinicasorriso.com.br"},
  {"chave":"gmaps:A4","nome":"Já é conta","site":"canario-pr-ja.test"},
  {"nome":"Sem chave"}
]'::jsonb, 0.02) AS r;
SELECT is((SELECT (r->>'novas')::int FROM f1), 3, '3 empresas novas');
SELECT is((SELECT (r->>'repetidas')::int FROM f1), 2, '2 repetidas (na mesma lista e já conta)');
SELECT is((SELECT (r->>'creditos')::int FROM f1), 3, 'COBRA SÓ AS NOVAS: 3 × 1 crédito');
SELECT is((SELECT estado || '/' || creditos_cobrados || '/' || encontradas || '/' || repetidas FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 'concluida/3/3/2', 'Busca concluída com os números');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 188 + 25, 'O resto da reserva voltou');
SELECT is((SELECT count(*)::int FROM public.prospect_candidates WHERE search_id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 3, '3 candidatas');
SELECT is((SELECT dominio FROM public.prospect_candidates WHERE chave = 'gmaps:A1'), 'clinicasorriso.com.br', 'Site normalizado');
SELECT is((SELECT dominio FROM public.prospect_candidates WHERE chave = 'gmaps:A2'), NULL, 'Rede social não é site da empresa: fica sem site (nunca inventado)');
SELECT is((SELECT estado FROM public.prospect_candidates WHERE chave = 'gmaps:A1'), 'candidata', 'Entra como candidata');
SELECT is((SELECT count(*)::int FROM internal.account_enrichments e JOIN public.accounts a ON a.id = e.account_id WHERE a.domain = 'clinicasorriso.com.br'), 0, 'CANDIDATA NÃO É ENRIQUECIDA');
SELECT is((SELECT custo_usd FROM internal.prospect_search_costs WHERE search_id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 0.02::numeric, 'Custo real fica só no interno');
SELECT is((SELECT e.status || '/' || e.valid_count || '/' || e.processed_count || '/' || e.actual_credits FROM public.executions e JOIN public.prospect_searches s ON s.execution_id = e.id
            WHERE s.id = (SELECT (r->>'estimativa_id')::uuid FROM e1)), 'completed/3/6/3', 'Execução concluída com os números');
SELECT is(public.prospect_finish((SELECT (r->>'estimativa_id')::uuid FROM e1), '[]', 0)->>'acao', 'ignorado', 'Entregar de novo não faz nada');

-- Receita: filtro de porte e CNPJ que já é conta
CREATE TEMP TABLE f4 ON COMMIT DROP AS SELECT public.prospect_finish((SELECT (r->>'estimativa_id')::uuid FROM e4), '[
  {"chave":"cnpj:22333444000190","nome":"Clínica Micro","cnpj":"22.333.444/0001-90","porte":"MICRO","cidade":"Sorocaba","uf":"SP","telefone":"1533334444"},
  {"chave":"cnpj:33444555000101","nome":"Rede Grande","cnpj":"33444555000101","porte":"DEMAIS","uf":"SP"},
  {"chave":"cnpj:11222333000181","nome":"Já é conta pelo CNPJ","cnpj":"11222333000181","porte":"EPP","uf":"SP"}
]'::jsonb, 0.001) AS r;
SELECT is((SELECT (r->>'novas')::int FROM f4), 1, 'Receita: 1 nova');
SELECT is((SELECT (r->>'fora_do_filtro')::int FROM f4), 1, 'Porte fora do ICP não entra nem cobra');
SELECT is((SELECT (r->>'repetidas')::int FROM f4), 1, 'CNPJ que já é conta é repetida');
SELECT is((SELECT cnpj FROM public.prospect_candidates WHERE chave = 'cnpj:22333444000190'), '22333444000190', 'CNPJ só com números');

-- Falha devolve tudo
SELECT is(public.prospect_fail((SELECT (r->>'estimativa_id')::uuid FROM e2), 'A fonte demorou demais')->>'acao', 'falhou', 'Falha registrada');
SELECT is((SELECT estado || '/' || mensagem FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e2)), 'erro/A fonte demorou demais', 'Estado erro com a mensagem');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'FALHA DEVOLVE TUDO: nada reservado');
SELECT is((SELECT creditos_cobrados FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e2)), 0, 'Falha não cobra');

-- Nada achado: devolve tudo
SET LOCAL ROLE anon;
CREATE TEMP TABLE e5 ON COMMIT DROP AS SELECT public.agent_prospect_estimate(zoe, 'google_maps', '{"busca":"nada","local":"Campinas"}', 10) AS r FROM tk;
GRANT SELECT ON e5 TO anon, authenticated;
SELECT is((SELECT public.agent_prospect_run(zoe, (SELECT (r->>'estimativa_id')::uuid FROM e5)) FROM tk)->>'estado', 'pendente', 'Mais uma na fila');
RESET ROLE;
SELECT is(jsonb_array_length(public.prospect_next(10)), 1, 'Pega');
SELECT is((public.prospect_finish((SELECT (r->>'estimativa_id')::uuid FROM e5), '[{"chave":"gmaps:A1","nome":"Clínica Sorriso"}]', 0.001)->>'creditos')::int, 0, 'Só repetidas: cobra 0');
SELECT is((SELECT estado FROM public.prospect_searches WHERE id = (SELECT (r->>'estimativa_id')::uuid FROM e5)), 'sem_resultado', 'Sem nada novo: sem resultado');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'E a reserva volta inteira');
CREATE TEMP TABLE saldo ON COMMIT DROP AS SELECT allowance_balance + topup_balance AS antes FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
GRANT SELECT ON saldo TO authenticated;

-- ---- Decidir candidatas (tela)
-- BDR não decide
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(format($$ SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', ARRAY['%s']::uuid[], 'incluir', '{}') $$,
  (SELECT id FROM public.prospect_candidates WHERE chave = 'gmaps:A1')), '42501', NULL, 'BDR não decide candidatas');
SELECT is((SELECT count(*)::int FROM public.prospect_candidates), 4, 'BDR lê as candidatas do próprio cliente');
RESET ROLE;

-- Grão não vê nem decide as da Evolut
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.prospect_candidates), 0, 'ISOLAMENTO: outro cliente não vê as candidatas');
SELECT is((SELECT count(*)::int FROM public.prospect_searches), 0, 'ISOLAMENTO: outro cliente não vê as buscas');
SELECT is((SELECT public.prospect_candidates_decide('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009',
  ARRAY(SELECT id FROM public.prospect_candidates), 'incluir', '{}')->>'incluidas')::int, 0, 'ISOLAMENTO: não decide candidata de outro cliente');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.prospect_candidates WHERE estado = 'candidata'), 4, 'Nada mudou');
SELECT throws_ok($$ SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{}', 'incluir', '{}') $$,
  NULL, NULL, 'Sem login, não decide (assert_caller_is_member)');

-- Camila inclui: com site vira conta; sem site fica esperando o site; com o site digitado vira conta.
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE d1 ON COMMIT DROP AS SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
  ARRAY(SELECT id FROM public.prospect_candidates WHERE chave IN ('gmaps:A1', 'gmaps:A2')), 'incluir', '{}') AS r;
RESET ROLE;
SELECT is((SELECT (r->>'incluidas')::int FROM d1), 1, 'Com site: vira conta');
SELECT is((SELECT (r->>'sem_site')::int FROM d1), 1, 'Sem site: não vira conta (nunca inventa domínio)');
SELECT is((SELECT estado FROM public.prospect_candidates WHERE chave = 'gmaps:A2'), 'candidata', 'A sem site continua candidata');
SELECT is((SELECT a.name || '/' || a.telefone || '/' || a.city || '/' || a.state_uf FROM public.accounts a JOIN public.prospect_candidates c ON c.account_id = a.id WHERE c.chave = 'gmaps:A1'),
  'Clínica Sorriso/(19) 3333-1111/Campinas/SP', 'A conta nasce com os dados da fonte');
SELECT is((SELECT a.fontes->'telefone'->>'fonte' FROM public.accounts a JOIN public.prospect_candidates c ON c.account_id = a.id WHERE c.chave = 'gmaps:A1'), 'Google Maps', 'Cada dado diz a fonte');
SELECT ok((SELECT NOT ('telefone' = ANY (a.campos_manuais)) AND NOT ('lat' = ANY (a.campos_manuais)) FROM public.accounts a JOIN public.prospect_candidates c ON c.account_id = a.id WHERE c.chave = 'gmaps:A1'),
  'Dado da fonte não vira "manual"');
SELECT is((SELECT a.localizacao_precisao FROM public.accounts a JOIN public.prospect_candidates c ON c.account_id = a.id WHERE c.chave = 'gmaps:A1'), 'endereco', 'Pin exato do Google Maps');
SELECT is((SELECT count(*)::int FROM internal.account_enrichments e JOIN public.prospect_candidates c ON c.account_id = e.account_id WHERE c.chave = 'gmaps:A1'), 2,
  'INCLUÍDA ENTRA SOZINHA NO ENRIQUECIMENTO (empresa e pessoas)');

SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE d2 ON COMMIT DROP AS SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
  ARRAY(SELECT id FROM public.prospect_candidates WHERE chave = 'gmaps:A2'), 'incluir',
  jsonb_build_object((SELECT id FROM public.prospect_candidates WHERE chave = 'gmaps:A2')::text, 'https://odontoinsta.com.br')) AS r;
RESET ROLE;
SELECT is((SELECT (r->>'incluidas')::int FROM d2), 1, 'Com o site digitado: vira conta');
SELECT ok((SELECT 'domain' = ANY (a.campos_manuais) FROM public.accounts a WHERE a.domain = 'odontoinsta.com.br'), 'O site digitado por uma pessoa é manual');

-- Domínio que já é conta: só liga
INSERT INTO public.accounts (workspace_id, name, domain, status) VALUES ('a0000000-0000-0000-0000-000000000001', 'Dente Feliz Já', 'dentefeliz.com.br', 'ativa');
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE d3 ON COMMIT DROP AS SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
  ARRAY(SELECT id FROM public.prospect_candidates WHERE chave = 'gmaps:A3'), 'incluir', '{}') AS r;
-- Excluir não devolve crédito
CREATE TEMP TABLE d4 ON COMMIT DROP AS SELECT public.prospect_candidates_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
  ARRAY(SELECT id FROM public.prospect_candidates WHERE chave = 'cnpj:22333444000190'), 'excluir', '{}') AS r;
RESET ROLE;
SELECT is((SELECT (r->>'ligadas')::int FROM d3), 1, 'Site que já é conta: só liga, não duplica');
SELECT is((SELECT count(*)::int FROM public.accounts WHERE domain = 'dentefeliz.com.br'), 1, 'Uma conta só');
SELECT is((SELECT (r->>'excluidas')::int FROM d4), 1, 'Excluída');
SELECT is((SELECT estado FROM public.prospect_candidates WHERE chave = 'cnpj:22333444000190'), 'excluida', 'Fica marcada como excluída');
SELECT is((SELECT allowance_balance + topup_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT antes FROM saldo),
  'EXCLUIR NÃO DEVOLVE CRÉDITO (o saldo não muda)');

SELECT * FROM finish();
ROLLBACK;
