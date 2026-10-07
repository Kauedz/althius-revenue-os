-- ==============================================================================
-- Test: 00086_papeis_dos_agentes.sql
-- Papéis dos agentes (spec .scratch/prospeccao-revenue, fatia 5; ADR 0067): a habilidade "Prospecção" é só da Zoe
-- (comercial) e a "ICP" só do Jax (marketing), em todo cliente e nos clientes novos. O cliente pode editar.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT is((SELECT count(*)::int FROM public.workspaces w WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_skills s WHERE s.workspace_id = w.id AND s.agent_id = 'comercial' AND s.slug = 'prospeccao')), 0, 'Todo cliente tem a habilidade Prospecção na Zoe');
SELECT is((SELECT count(*)::int FROM public.agent_skills WHERE slug = 'prospeccao' AND agent_id <> 'comercial'), 0, 'Só a Zoe tem a habilidade Prospecção');
SELECT is((SELECT count(*)::int FROM public.workspaces w WHERE NOT EXISTS (
  SELECT 1 FROM public.agent_skills s WHERE s.workspace_id = w.id AND s.agent_id = 'marketing' AND s.slug = 'icp')), 0, 'Todo cliente tem a habilidade ICP no Jax');
SELECT is((SELECT count(*)::int FROM public.agent_skills WHERE slug = 'icp' AND agent_id <> 'marketing'), 0, 'Só o Jax tem a habilidade ICP');

SELECT ok((SELECT content_markdown FROM public.agent_skills WHERE slug = 'prospeccao' LIMIT 1) ~ 'prospeccao_estimar', 'A habilidade manda estimar antes');
SELECT ok((SELECT content_markdown FROM public.agent_skills WHERE slug = 'prospeccao' LIMIT 1) ~ 'pode rodar', 'E esperar o "pode rodar"');
SELECT ok((SELECT content_markdown FROM public.agent_skills WHERE slug = 'icp' LIMIT 1) ~ 'propor_icp', 'A habilidade de ICP manda propor (não mudar)');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.agent_skills WHERE slug IN ('prospeccao', 'icp') AND content_markdown ~* 'us\$|dólar|dolar'), 'Sem dólar');

-- Cliente novo já nasce com as duas
INSERT INTO public.workspaces (id, name, slug) VALUES ('c8600000-0000-0000-0000-000000000001', 'Cliente Papéis', 'cliente-papeis');
SELECT is((SELECT array_agg(agent_id || ':' || slug ORDER BY slug) FROM public.agent_skills
            WHERE workspace_id = 'c8600000-0000-0000-0000-000000000001' AND slug IN ('prospeccao', 'icp')),
  ARRAY['marketing:icp', 'comercial:prospeccao'], 'Cliente novo nasce com Prospecção (Zoe) e ICP (Jax)');

-- Leitura pelo agente: a Zoe vê a dela; o Jax não vê a da Zoe
CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS zoe,
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'marketing', 'd0000000-0000-0000-0000-000000000002') AS jax;
SELECT ok((SELECT public.agent_list_skills(zoe) FROM tk)::text ~ 'prospeccao_estimar', 'A Zoe lê a habilidade de prospecção');
SELECT ok((SELECT public.agent_list_skills(jax) FROM tk)::text !~ 'prospeccao_estimar', 'O Jax não recebe a de prospecção');

SELECT * FROM finish();
ROLLBACK;
