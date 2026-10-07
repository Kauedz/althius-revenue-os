-- ==============================================================================
-- Test: 00077_sinais_pelo_agente.sql
-- Sinais pelo agente (ADR 0060): o agente vê o catálogo, testa uma fonte numa conta do PRÓPRIO cliente (crédito reservado,
-- cobrado se deu certo e devolvido se falhou), propõe a receita só depois de um teste bom, uma pessoa aprova e a coleta
-- passa a usar a receita do cliente, só naquele cliente. Nada de dólar para o agente; isolamento entre clientes.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03); Grão Norte b0..01 (estrategista d..08).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões
SELECT ok(has_function_privilege('anon', 'public.agent_signal_catalog(text)', 'EXECUTE'), 'Porta do agente: catálogo só com o token (ADR 0024)');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_signal_recipe(text, text, jsonb, text, text)', 'EXECUTE'), 'Porta do agente: proposta só com o token');
SELECT ok(NOT has_function_privilege('anon', 'public.signal_agent_test_start(text, text, uuid, text)', 'EXECUTE'), 'Visitante não começa teste (gasta crédito)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_agent_test_start(text, text, uuid, text)', 'EXECUTE'), 'Nem usuário logado');
SELECT ok(has_function_privilege('service_role', 'public.signal_agent_test_start(text, text, uuid, text)', 'EXECUTE'), 'Só o serviço começa o teste');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_agent_test_finish(uuid, boolean, integer, numeric, text)', 'EXECUTE'), 'Usuário logado não termina teste');
SELECT ok(has_function_privilege('service_role', 'public.signal_agent_test_finish(uuid, boolean, integer, numeric, text)', 'EXECUTE'), 'Só o serviço termina o teste');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.signal_recipes_workspace', 'SELECT'), 'Receitas de cliente não são lidas direto');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.signal_agent_tests', 'SELECT'), 'Testes (com custo real) não são lidos direto');

-- ---- Cenário
CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'copy', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'copy', 'd0000000-0000-0000-0000-000000000008') AS grao;
INSERT INTO public.accounts (id, workspace_id, name, domain, status) VALUES
  ('c7700000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-SA-E1', 'canario-e1.test', 'ativa'),
  ('c7700000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-SA-E2', 'canario-e2.test', 'arquivada'),
  ('c7700000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'CANARIO-SA-G1', 'canario-g1.test', 'ativa');
-- Spec prospeccao-revenue (ADR 0066): a coleta automática só roda nas contas monitoradas; as de teste são marcadas.
UPDATE public.accounts SET monitorar_sinais = true WHERE name LIKE 'CANARIO-%';
UPDATE public.accounts SET status = 'arquivada' WHERE name NOT LIKE 'CANARIO-SA-%';
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days'),
         ('b0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';

-- ---- Catálogo
SELECT throws_ok($$ SELECT public.agent_signal_catalog('alt_agente_inventado') $$, '28000', NULL, 'Token inventado não vê o catálogo');
CREATE TEMP TABLE cat ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.agent_signal_catalog((SELECT evolut FROM tk))) x;
SELECT is((SELECT x->>'tipo' FROM cat WHERE x->>'codigo' = 'noticias_empresa'), 'empresa', 'Notícias é sinal de empresa (o agente pode montar)');
SELECT is((SELECT x->>'tipo' FROM cat WHERE x->>'codigo' = 'troca_cargo'), 'pessoas', 'Troca de cargo é de pessoas (fica com a equipe)');
SELECT is((SELECT x->>'tipo' FROM cat WHERE x->>'codigo' = 'negocio_parado'), 'interno', 'Negócio parado é interno');
SELECT is((SELECT x->>'coleta' FROM cat WHERE x->>'codigo' = 'noticias_empresa'), 'sem_coleta', 'Notícias ainda não coleta');
SELECT ok(NOT EXISTS (SELECT 1 FROM cat WHERE x::text ~* 'usd|dólar|dolar|teto'), 'O catálogo do agente não fala em dólar nem teto');
SELECT ok(NOT EXISTS (SELECT 1 FROM cat WHERE x->>'codigo' = 'vagas_cargo' AND x ? 'atores_do_cliente' AND x->'atores_do_cliente' <> 'null'::jsonb), 'Os atores da receita da equipe não aparecem para o agente');

-- ---- Testar: precisa de uma pessoa pedindo
SELECT is((SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000001', 'dono/ator-noticias')->>'ok'), 'false', 'Sem pessoa pedindo, o teste não roda (gasta crédito)');

INSERT INTO public.chat_channels (id, workspace_id, slug, name) VALUES ('cc770000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'teste-sinais', 'Teste sinais') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (id, workspace_id, channel_id, sender_type, sender_member_id, content) VALUES
  ('cd770000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cc770000-0000-0000-0000-000000000001', 'member', 'd0000000-0000-0000-0000-000000000003', 'Lia, ache uma fonte de notícias');
INSERT INTO public.agent_channel_runs (id, workspace_id, channel_id, agent_id, status, deadline_at) VALUES
  ('ce770000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cc770000-0000-0000-0000-000000000001', 'copy', 'in_flight', now() + interval '5 minutes');
INSERT INTO public.agent_channel_queue (workspace_id, channel_id, agent_id, message_id, status, run_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'cc770000-0000-0000-0000-000000000001', 'copy', 'cd770000-0000-0000-0000-000000000001', 'in_flight', 'ce770000-0000-0000-0000-000000000001');

SELECT is((SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000003', 'dono/ator-noticias')->>'ok'), 'false', 'CANÁRIO: conta de outro cliente não é testada');
SELECT is((SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000002', 'dono/ator-noticias')->>'ok'), 'false', 'Conta arquivada não é testada');
SELECT is((SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'troca_cargo', 'c7700000-0000-0000-0000-000000000001', 'dono/ator')->>'ok'), 'false', 'Sinal de pessoas não é testado pelo agente');
SELECT is((SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000001', 'sem barra')->>'ok'), 'false', 'Ator em formato estranho é recusado');

CREATE TEMP TABLE t1 ON COMMIT DROP AS SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000001', 'dono/ator-noticias') AS r;
SELECT is((SELECT r->>'ok' FROM t1), 'true', 'Com a Aline pedindo, o teste começa');
SELECT is((SELECT (r->>'creditos')::int FROM t1), 3, 'Custa os créditos de uma coleta do sinal (3)');
SELECT is((SELECT r->'conta'->>'dominio' FROM t1), 'canario-e1.test', 'O serviço recebe o que precisa da conta');
SELECT is((SELECT (r->>'teto_usd')::numeric FROM t1), round(3 * 0.0529 / 5.5, 4), 'O teto é o que o cliente paga: a coleta nunca custa mais do que cobra');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') > 0, true, 'O crédito fica reservado');
SELECT is((SELECT requested_by_member_id::text FROM public.executions WHERE id = (SELECT execution_id FROM internal.signal_agent_tests WHERE id = (SELECT (r->>'teste_id')::uuid FROM t1))), 'd0000000-0000-0000-0000-000000000003', 'A execução fica em nome de quem pediu');

-- Proposta antes de testar com sucesso: recusada
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}","vinculo":"entrada"}}]', 'achei', 'k-sa-0')->>'ok'),
  'false', 'Sem teste bom, não dá para propor');

-- Teste termina bem: cobra
SELECT is((SELECT public.signal_agent_test_finish((SELECT (r->>'teste_id')::uuid FROM t1), true, 7, 0.0123, 'ok')->>'acao'), 'cobrado', 'Deu certo: cobra');
SELECT is((SELECT public.signal_agent_test_finish((SELECT (r->>'teste_id')::uuid FROM t1), false, 0, NULL, 'de novo')->>'acao'), 'ignorado', 'Terminar de novo não muda nada');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'A reserva foi baixada');
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'agente_testou_fonte_de_sinal'), 1, 'O teste fica na auditoria');

-- Teste que falha: devolve
CREATE TEMP TABLE t2 ON COMMIT DROP AS SELECT public.signal_agent_test_start((SELECT evolut FROM tk), 'noticias_empresa', 'c7700000-0000-0000-0000-000000000001', 'outro/ator-ruim') AS r;
SELECT is((SELECT public.signal_agent_test_finish((SELECT (r->>'teste_id')::uuid FROM t2), false, 0, NULL, 'Apify recusou')->>'acao'), 'devolvido', 'Falhou: devolve o crédito');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nada fica preso');

-- ---- Proposta
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}"}}]', 'achei', 'k-sa-1')->>'ok'),
  'false', 'Sem vínculo (como o item prova que é da conta), recusado');
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}","vinculo":"empresa"}}]', 'achei', 'k-sa-2')->>'ok'),
  'false', 'Vínculo por empresa sem dizer o campo, recusado');
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}","vinculo":"entrada"}},{"ator":"outro/ator-ruim","entrada":{},"mapeamento":{"texto":"x","chave":"y","vinculo":"entrada"}}]', 'achei', 'k-sa-3')->>'ok'),
  'false', 'Fonte de reserva sem teste bom, recusada');
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}","vinculo":"entrada"}}]', '   ', 'k-sa-4')->>'ok'),
  'false', 'Sem motivo, recusada');

CREATE TEMP TABLE prop ON COMMIT DROP AS SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"Notícia: {{title}}","chave":"{{url}}","link":"url","vinculo":"entrada"},"max_itens":10,"descricao":"Google News"}]',
  'O teste trouxe 7 notícias da conta', 'k-sa-5') AS r;
SELECT is((SELECT r->>'status' FROM prop), 'aguardando_aprovacao', 'Com teste bom, a proposta vira aprovação');
SELECT is((SELECT category || '/' || approval_type FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'operacao/execucao', 'É aprovação de operação (C-level ou estrategista)');
SELECT ok((SELECT preview LIKE '%Google News%' AND impact LIKE '%3 créditos por conta%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'A aprovação diz a fonte e o custo em créditos');
SELECT ok((SELECT (payload_json->'fontes'->0->>'teto_usd')::numeric = round(3 * 0.0529 / 5.5, 4) FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)), 'O teto é calculado pelo banco, nunca pelo agente');
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT evolut FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"Notícia: {{title}}","chave":"{{url}}","link":"url","vinculo":"entrada"},"max_itens":10,"descricao":"Google News"}]',
  'O teste trouxe 7 notícias da conta', 'k-sa-5')->>'approval_id'), (SELECT r->>'approval_id' FROM prop), 'A mesma proposta não duplica');

-- Isolamento: o teste da Evolut não vale para a Grão Norte
SELECT is((SELECT public.agent_propose_signal_recipe((SELECT grao FROM tk), 'noticias_empresa',
  '[{"ator":"dono/ator-noticias","entrada":{"q":"{{empresa}}"},"mapeamento":{"texto":"{{title}}","chave":"{{url}}","vinculo":"entrada"}}]', 'achei', 'k-sa-g')->>'ok'),
  'false', 'CANÁRIO: o teste de um cliente não libera proposta do outro');

-- Antes de aprovar, nada coleta
SELECT is((SELECT count(*)::int FROM internal.signal_recipes_workspace), 0, 'Pendente: nenhuma receita de cliente');

-- Aprovada: a receita entra e a coleta da Evolut passa a pedir notícias (a Grão Norte, não)
UPDATE public.approvals SET status = 'aprovado', decided_by_member_id = 'd0000000-0000-0000-0000-000000000003', decided_at = now() WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop);
SELECT is((SELECT count(*)::int FROM internal.signal_recipes_workspace WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND enabled), 1, 'Aprovada: a receita do cliente entra');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT ok('noticias_empresa' = ANY (public.signal_codes_com_coleta()), 'A tela do cliente passa a saber que notícias coleta');
RESET ROLE;

CREATE TEMP TABLE prox ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.signal_collect_next(50)) x;
SELECT is((SELECT count(*)::int FROM prox WHERE x->>'signal_code' = 'noticias_empresa' AND x->>'workspace_id' = 'a0000000-0000-0000-0000-000000000001'), 1, 'A coleta da Evolut pede notícias da conta ativa');
SELECT is((SELECT x->'fontes'->0->>'ator' FROM prox WHERE x->>'signal_code' = 'noticias_empresa'), 'dono/ator-noticias', 'Com a fonte aprovada');
SELECT is((SELECT count(*)::int FROM prox WHERE x->>'signal_code' = 'noticias_empresa' AND x->>'workspace_id' = 'b0000000-0000-0000-0000-000000000001'), 0, 'CANÁRIO: a Grão Norte não coleta com a receita da Evolut');

-- Habilidade semeada
SELECT is((SELECT count(*)::int FROM public.agent_skills WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND slug = 'fontes-de-sinais'), 4, 'Os 4 agentes do cliente têm a habilidade de fontes de sinais');

SELECT * FROM finish();
ROLLBACK;
