-- ==============================================================================
-- Test: 00093_preco_das_fontes.sql
-- ADR 0069. Preço da prospecção pelo retorno sobre o custo real: Google Maps 2 créditos por empresa (antes 1), Receita 1; o
-- superadmin muda o preço; a tela de Margens mostra a margem REAL medida por fonte (sem busca medida, diz isso).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(NOT has_function_privilege('anon', 'public.admin_prospect_source_price_set(text, integer)', 'EXECUTE'), 'Visitante não muda preço');
SELECT is((SELECT creditos_por_empresa FROM internal.prospect_sources WHERE code = 'google_maps'), 2, 'Google Maps: 2 créditos por empresa nova');
SELECT is((SELECT creditos_por_empresa FROM internal.prospect_sources WHERE code = 'receita_cnae'), 1, 'Receita por CNAE: 1 crédito');

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;

-- Só o superadmin muda o preço
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.admin_prospect_source_price_set('google_maps', 3) $$, '42501', NULL, 'Estrategista não muda o preço da fonte');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((public.admin_prospect_source_price_set('receita_cnae', 2)->>'creditos_por_empresa')::int, 2, 'Superadmin muda o preço');
SELECT throws_ok($$ SELECT public.admin_prospect_source_price_set('receita_cnae', 0) $$, '22023', NULL, 'Preço zero é recusado');
SELECT throws_ok($$ SELECT public.admin_prospect_source_price_set('receita_cnae', 51) $$, '22023', NULL, 'Preço acima de 50 é recusado');
SELECT throws_ok($$ SELECT public.admin_prospect_source_price_set('fonte_que_nao_existe', 2) $$, '22023', NULL, 'Fonte desconhecida é recusada');

-- Margens: sem busca medida diz isso; com busca, a margem real sobre o teto do crédito
SELECT is((SELECT m->>'margem' FROM jsonb_array_elements(public.admin_margins()) m WHERE m->>'codigo' = 'google_maps'), NULL, 'Sem busca medida: sem margem inventada');
SELECT is((SELECT (m->>'creditos_base')::int FROM jsonb_array_elements(public.admin_margins()) m WHERE m->>'codigo' = 'google_maps'), 2, 'A linha mostra o preço em créditos');
RESET ROLE;
INSERT INTO public.prospect_searches (id, workspace_id, agent_code, source_code, titulo, max_empresas, creditos_estimados, estado, creditos_cobrados, encontradas, finished_at)
  VALUES ('d9300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'comercial', 'google_maps', 'MARGEM', 10, 20, 'concluida', 20, 10, now());
INSERT INTO internal.prospect_search_costs (search_id, workspace_id, custo_usd) VALUES ('d9300000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 0.05);
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT (m->>'margem')::int FROM jsonb_array_elements(public.admin_margins()) m WHERE m->>'codigo' = 'google_maps'), 74,
  'Margem real: 10 empresas por US$ 0,05 (US$ 0,005 cada) contra o teto de 2 créditos (US$ 0,0192) = 74%');
SELECT is((SELECT (m->>'empresas_medidas')::int FROM jsonb_array_elements(public.admin_margins()) m WHERE m->>'codigo' = 'google_maps'), 10, 'E diz em quantas empresas se baseia');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.admin_margins() $$, '42501', NULL, 'Margens: só o superadmin');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
