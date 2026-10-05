-- ==============================================================================
-- Test: 00049_home_summary_real.sql
-- A Início não pode mostrar número nem pessoa inventados: tudo vem do banco, por papel e por workspace.
-- get_home_summary devolve também: oportunidades abertas, campanhas e cadências ativas, agentes trabalhando,
-- próximas tarefas, últimas execuções e contas por estado (e as sem localização).
-- Seed: Aline C-level Evolut (user e..03, membro d..03); Lucas BDR Evolut (e..04, d..04, dono de MT e SP);
--       Eduardo C-level Grão Norte (e..07, d..09). Execuções ativas da Evolut: 3, todas do agente comercial.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Preparação (como dono do banco): dados da Evolut e da Grão Norte, para provar escopo e isolamento
INSERT INTO public.pipelines (id, workspace_id, motion, name) VALUES
  ('f4900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'slg', 'Funil teste Evolut'),
  ('f4900000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'slg', 'Funil teste Grão');
INSERT INTO public.accounts (id, workspace_id, name, domain, state_uf) VALUES
  ('f4900000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-000000000001', 'Conta Grão Norte', 'contagrao.test', 'RS');
INSERT INTO public.accounts (id, workspace_id, name, domain, state_uf, owner_member_id) VALUES
  ('f4900000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'Conta sem estado', 'semestado.test', NULL, NULL);

INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, title, status, owner_member_id)
SELECT 'a0000000-0000-0000-0000-000000000001', 'f4900000-0000-0000-0000-000000000001', a.id, t.titulo, t.status, t.dono::uuid
FROM (VALUES ('Op ativa do Lucas', 'ativa', 'd0000000-0000-0000-0000-000000000004'),
             ('Op ativa de outro', 'ativa', 'd0000000-0000-0000-0000-000000000006'),
             ('Op ganha do Lucas', 'ganho', 'd0000000-0000-0000-0000-000000000004')) AS t(titulo, status, dono),
     LATERAL (SELECT id FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' ORDER BY name LIMIT 1) a;
INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, title, status)
VALUES ('b0000000-0000-0000-0000-000000000001', 'f4900000-0000-0000-0000-000000000002', 'f4900000-0000-0000-0000-0000000000a1', 'Op Grão', 'ativa');

INSERT INTO public.campaigns (workspace_id, name, channel_type, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Camp ativa', 'linkedin_ads', 'ativa'),
  ('a0000000-0000-0000-0000-000000000001', 'Camp pausada', 'meta_ads', 'pausada'),
  ('a0000000-0000-0000-0000-000000000001', 'Camp rascunho', 'google_ads', 'rascunho'),
  ('b0000000-0000-0000-0000-000000000001', 'Camp Grão', 'organico', 'ativa');
INSERT INTO public.cadences (workspace_id, name, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Cad 1', 'ativa'), ('a0000000-0000-0000-0000-000000000001', 'Cad 2', 'ativa'),
  ('a0000000-0000-0000-0000-000000000001', 'Cad pausada', 'pausada'), ('b0000000-0000-0000-0000-000000000001', 'Cad Grão', 'ativa');
INSERT INTO public.tasks (workspace_id, title, assignee_member_id, due_at, status, source) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Ligar teste um', 'd0000000-0000-0000-0000-000000000004', now() + interval '1 day', 'pendente', 'manual'),
  ('a0000000-0000-0000-0000-000000000001', 'Rever ICP teste dois', 'd0000000-0000-0000-0000-000000000006', now() + interval '3 days', 'em_andamento', 'agente'),
  ('a0000000-0000-0000-0000-000000000001', 'Tarefa concluída', 'd0000000-0000-0000-0000-000000000004', now(), 'concluida', 'manual'),
  ('b0000000-0000-0000-0000-000000000001', 'Tarefa da Grão', 'd0000000-0000-0000-0000-000000000009', now() + interval '1 day', 'pendente', 'manual');

SET LOCAL ROLE authenticated;

-- 1. C-level da Evolut vê o workspace todo
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
CREATE TEMP TABLE aline ON COMMIT DROP AS
  SELECT public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON aline TO authenticated;

SELECT is((SELECT (r->>'oportunidades_abertas')::int FROM aline), 2, 'C-level: 2 oportunidades abertas (a ganha não conta)');
SELECT is((SELECT (r->>'campanhas_ativas')::int FROM aline), 1, 'C-level: só 1 campanha ativa (pausada e rascunho não contam)');
SELECT is((SELECT (r->>'cadencias_ativas')::int FROM aline), 2, 'C-level: 2 cadências ativas');
SELECT is((SELECT (r->>'agentes_trabalhando')::int FROM aline), 1, 'C-level: 1 agente trabalhando (as 3 execuções ativas são do mesmo agente)');
SELECT is((SELECT jsonb_array_length(r->'acoes') FROM aline), 2, 'C-level: 2 próximas ações (a concluída não entra)');
SELECT is((SELECT r->'acoes'->0->>'titulo' FROM aline), 'Ligar teste um', 'A mais próxima do prazo vem primeiro');
SELECT is((SELECT r->'acoes'->1->>'origem' FROM aline), 'agente', 'A origem vem da tarefa, não é inventada');
SELECT ok((SELECT r->'acoes'->0->>'responsavel' FROM aline) IS NOT NULL, 'O responsável é o nome do membro no banco');
SELECT is((SELECT jsonb_array_length(r->'timeline') FROM aline), 7, 'Linha do tempo: as 7 últimas execuções reais');
SELECT ok((SELECT bool_and(t->>'titulo' IN (SELECT title FROM public.executions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'))
             FROM aline, jsonb_array_elements(r->'timeline') t), 'Todo item da linha do tempo é uma execução da Evolut (nada inventado)');
SELECT is((SELECT r->'mapa' FROM aline), '{"AM": 1, "MG": 1, "MT": 1, "PR": 1, "SC": 1, "SP": 3}'::jsonb, 'Mapa: contas por estado do banco');
SELECT is((SELECT (r->>'contas_sem_localizacao')::int FROM aline), 1, 'Conta sem estado vira "sem localização" (não some e não é inventada)');

-- 2. BDR só vê o que é dele
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE lucas ON COMMIT DROP AS
  SELECT public.get_home_summary('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004') AS r;
GRANT SELECT ON lucas TO authenticated;
SELECT is((SELECT (r->>'oportunidades_abertas')::int FROM lucas), 1, 'BDR: só a oportunidade aberta dele');
SELECT is((SELECT jsonb_array_length(r->'acoes') FROM lucas), 1, 'BDR: só a tarefa dele');
SELECT is((SELECT r->'acoes'->0->>'titulo' FROM lucas), 'Ligar teste um', 'BDR: a tarefa certa');
SELECT is((SELECT r->'mapa' FROM lucas), '{"MT": 1, "SP": 3}'::jsonb, 'BDR: mapa só das contas dele');
SELECT is((SELECT jsonb_array_length(r->'timeline') FROM lucas), 0, 'BDR não vê execuções do workspace (matriz: Ver execuções = Não): linha do tempo vazia');

-- 3. Isolamento: a Grão Norte só enxerga o que é da Grão Norte
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
CREATE TEMP TABLE eduardo ON COMMIT DROP AS
  SELECT public.get_home_summary('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009') AS r;
GRANT SELECT ON eduardo TO authenticated;
SELECT is((SELECT (r->>'oportunidades_abertas')::int FROM eduardo), 1, 'Grão Norte: só a oportunidade dela');
SELECT is((SELECT (r->>'campanhas_ativas')::int FROM eduardo), 1, 'Grão Norte: só a campanha dela');
SELECT is((SELECT (r->>'cadencias_ativas')::int FROM eduardo), 1, 'Grão Norte: só a cadência dela');
SELECT is((SELECT (r->>'agentes_trabalhando')::int FROM eduardo), 0, 'Grão Norte: nenhum agente trabalhando (as execuções são da Evolut)');
SELECT is((SELECT r->'acoes'->0->>'titulo' FROM eduardo), 'Tarefa da Grão', 'Grão Norte: só a tarefa dela');
SELECT is((SELECT jsonb_array_length(r->'timeline') FROM eduardo), 0, 'Grão Norte: sem execuções, a linha do tempo fica vazia (não herda a da Evolut)');
SELECT is((SELECT r->'mapa' FROM eduardo), '{"RS": 1}'::jsonb, 'Grão Norte: mapa só com a conta dela');

SELECT * FROM finish();
ROLLBACK;
