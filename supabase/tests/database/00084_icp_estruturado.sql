-- ==============================================================================
-- Test: 00084_icp_estruturado.sql
-- ICP estruturado (spec .scratch/prospeccao-revenue, fatia 3; ADR 0067): setores/CNAE, porte, funcionários,
-- faturamento, capital, estados e cidades por cliente. Nada de valor padrão inventado. Gestor edita na tela; o Jax
-- PROPÕE (aprovação). Os agentes leem o ICP (ferramenta e contexto do harness). Isolamento entre clientes.
-- Seed: Evolut a0..01 (Camila estrategista d..02/e..02, Aline C-level d..03/e..03, BDR d..04/e..04); Grão b0..01 (CEO d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('authenticated', 'public.workspace_icp_set(uuid, uuid, jsonb)', 'EXECUTE'), 'Tela edita o ICP');
SELECT ok(NOT has_function_privilege('anon', 'public.workspace_icp_set(uuid, uuid, jsonb)', 'EXECUTE'), 'Visitante não edita o ICP');
SELECT ok(has_function_privilege('anon', 'public.agent_icp(text)', 'EXECUTE'), 'Porta do agente: ler o ICP (só com token)');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_icp(text, jsonb, text, text)', 'EXECUTE'), 'Porta do agente: propor ICP');

UPDATE public.workspace_settings SET icp = '{}'::jsonb WHERE workspace_id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
SELECT is((SELECT icp FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), '{}'::jsonb, 'Sem ICP: vazio, nada inventado');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000002') AS jax,
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS zoe,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000008') AS jax_grao;
GRANT SELECT ON tk TO anon, authenticated;

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END;
$$;

-- BDR não edita
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '{"ufs":["SP"]}') $$, '42501', NULL, 'BDR não edita o ICP');
RESET ROLE;

-- Validação
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{"cnaes":["abc"]}') $$, '22023', NULL, 'CNAE inválido é recusado');
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{"ufs":["XX"]}') $$, '22023', NULL, 'UF inválida é recusada');
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{"funcionarios_min":50,"funcionarios_max":10}') $$, '22023', NULL, 'Mínimo maior que o máximo é recusado');
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{"inventado":"x"}') $$, '22023', NULL, 'Campo que o ICP não tem é recusado');
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '{"portes":["GRANDE"]}') $$, '22023', NULL, 'Porte fora de MICRO/EPP/DEMAIS é recusado');

-- Estrategista grava (normalizado)
SELECT is((public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
  '{"setores":["Clínicas odontológicas"," clínicas odontológicas ","Laboratórios"],"cnaes":["8630-5/04"],"portes":["micro","EPP"],
    "funcionarios_min":10,"funcionarios_max":20,"faturamento_min":1000000,"faturamento_max":5000000,"ufs":["sp","mg"],"cidades":["Campinas"],
    "observacoes":"Donos que já anunciam","capital_min":""}')->>'ok'), 'true', 'Estrategista grava o ICP');
RESET ROLE;
CREATE TEMP TABLE i1 ON COMMIT DROP AS SELECT icp FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
GRANT SELECT ON i1 TO anon, authenticated;
SELECT is((SELECT icp->'cnaes' FROM i1), '["8630504"]'::jsonb, 'CNAE só com números');
SELECT is((SELECT icp->'ufs' FROM i1), '["SP", "MG"]'::jsonb, 'UF em maiúsculas');
SELECT is((SELECT icp->'portes' FROM i1), '["MICRO", "EPP"]'::jsonb, 'Porte em maiúsculas');
SELECT is((SELECT jsonb_array_length(icp->'setores') FROM i1), 2, 'Setor repetido entra uma vez');
SELECT ok(NOT (SELECT icp ? 'capital_min' FROM i1), 'Campo vazio não vira valor');
SELECT is((SELECT icp->>'atualizado_por' FROM i1), 'd0000000-0000-0000-0000-000000000002', 'Guarda quem mudou');

-- Outro cliente não mexe
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000007');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.workspace_icp_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', '{"ufs":["RJ"]}') $$, '42501', NULL, 'ISOLAMENTO: C-level da Grão não edita o ICP da Evolut');
RESET ROLE;

-- Agentes leem; cada um o do próprio cliente
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_icp(zoe) FROM tk)->'icp'->'cnaes', '["8630504"]'::jsonb, 'A Zoe lê o ICP (para montar as buscas)');
SELECT is((SELECT public.agent_icp(jax_grao) FROM tk)->'icp', '{}'::jsonb, 'ISOLAMENTO: o Jax da Grão vê o ICP da Grão (vazio)');
SELECT ok((SELECT public.agent_icp(zoe) FROM tk) ? 'personas_alvo', 'Junto vêm os cargos alvo');

-- Só o Jax propõe; nada muda antes da aprovação
SELECT ok((SELECT public.agent_propose_icp(zoe, '{"ufs":["RJ"]}', 'x', 'k-icp-zoe') FROM tk)->>'erro' ~ 'Jax', 'Só o Jax propõe ICP');
SELECT is((SELECT public.agent_propose_icp(jax, '{"ufs":["XX"]}', 'x', 'k-icp-ruim') FROM tk)->>'ok', 'false', 'Proposta inválida é recusada');
SELECT is((SELECT public.agent_propose_icp(jax, '{"ufs":["SP","RJ"],"cnaes":["8630504"],"portes":["MICRO","EPP"]}', 'As vendas fechadas vieram de SP e RJ', 'k-icp') FROM tk)->>'ok', 'true', 'O Jax propõe');
RESET ROLE;
SELECT is((SELECT icp->'ufs' FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), '["SP", "MG"]'::jsonb, 'Nada muda antes da aprovação');
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is(public.approval_decide((SELECT id FROM public.approvals WHERE idempotency_key = 'k-icp'), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE idempotency_key = 'k-icp'))->>'success', 'true', 'C-level aprova');
RESET ROLE;
SELECT is((SELECT icp->'ufs' FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), '["SP", "RJ"]'::jsonb, 'Aprovada: o ICP muda');
SELECT is((SELECT icp->>'atualizado_por' FROM public.workspace_settings WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'agente:marketing', 'Fica dito que veio do Jax');

-- O harness coloca o ICP no contexto do agente
SELECT ok((public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'comercial')->>'conteudo') ~ 'ICP estruturado', 'O ICP vai no contexto do agente');
SELECT ok((public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'comercial')->>'conteudo') ~ '8630504', 'Com os CNAEs');

SELECT * FROM finish();
ROLLBACK;
