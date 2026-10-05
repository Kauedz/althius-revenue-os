-- ==============================================================================
-- Test: 00053_pipeline_tarefas.sql
-- PR 07: Pipeline e Tarefas ligados ao banco.
--   Quadros (pipeline.boards: só gestores), negócios (pipeline.deals: BDR só os dele), histórico de etapa com QUEM moveu,
--   tarefas (tasks.assign: BDR só para si). Tudo por função, com a pessoa logada conferida no banco.
-- Seed: Aline C-level Evolut (user e..03, membro d..03); Lucas BDR (e..04, d..04, dono das contas c..01 e c..02);
--       Bruna BDR (e..06, d..06, dona das contas c..03 e c..04); Camila estrategista (e..02, d..02);
--       Eduardo C-level do Grão Norte (e..07, d..09). Todo workspace nasce com os 3 quadros padrão (um por motion, "SLG (Geral)" etc.); o seed não tem negócios nem tarefas.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Quem pode chamar (ADR 0023): só quem está logado
SELECT is((SELECT count(*) FROM unnest(ARRAY[
  'public.pipeline_create(uuid,uuid,text,text)', 'public.pipeline_rename(uuid,uuid,uuid,text)', 'public.pipeline_delete(uuid,uuid,uuid)',
  'public.pipeline_reorder_stages(uuid,uuid,uuid,jsonb)', 'public.opportunity_create(uuid,uuid,uuid,uuid,numeric,date,integer,text,text,uuid)',
  'public.opportunity_update(uuid,uuid,uuid,numeric,date,integer,text,text,uuid)', 'public.opportunity_move(uuid,uuid,uuid,text,uuid)',
  'public.opportunity_archive(uuid,uuid,uuid)', 'public.task_create(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamptz,text,text)',
  'public.task_set_status(uuid,uuid,uuid,text)', 'public.task_postpone(uuid,uuid,uuid,integer)'
]) f WHERE has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')), 11::bigint,
  'As 11 funções são para quem está logado e não para quem não está');

-- 2. Quadros: só gestor (BDR não)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'slg', 'Quadro do BDR') $$,
  '42501', NULL, 'BDR não cria quadro');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
CREATE TEMP TABLE q AS SELECT
  (public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'slg', 'Quadro A')->>'id')::uuid AS a,
  (public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'slg', 'Quadro B')->>'id')::uuid AS b,
  (public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'mlg', 'Quadro MLG')->>'id')::uuid AS m;
GRANT ALL ON q TO PUBLIC;
SELECT is((SELECT count(*) FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'slg'), 3::bigint, 'Quadro padrão + os dois que o C-level criou');
SELECT throws_ok($$ SELECT public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'xyz', 'Motion que não existe') $$,
  '22023', NULL, 'Motion inválida é recusada');
SELECT lives_ok($$ SELECT public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'slg', 'Quadro C'); SELECT public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'slg', 'Quadro D') $$,
  'Chega a 5 quadros SLG');
SELECT throws_ok($$ SELECT public.pipeline_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'slg', 'Quadro E') $$,
  'P0001', NULL, 'O sexto quadro da mesma motion é recusado (máximo 5)');
SELECT is(public.pipeline_rename('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), 'Quadro Principal')->>'action', 'updated', 'Renomeia');
SELECT is((SELECT name FROM public.pipelines WHERE id = (SELECT a FROM q)), 'Quadro Principal', 'Nome gravado');
SELECT throws_ok($$ SELECT public.pipeline_rename('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), '   ') $$,
  '22023', NULL, 'Nome vazio é recusado');

-- Etapas: mesmas 6, "ganho" sempre por último
SELECT is(public.pipeline_reorder_stages('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q),
  '["entrada","descoberta","qualificacao","proposta","negociacao","ganho"]'::jsonb)->>'action', 'updated', 'Reordena as etapas');
SELECT is((SELECT stage_order->>1 FROM public.pipelines WHERE id = (SELECT a FROM q)), 'descoberta', 'Nova ordem gravada');
SELECT throws_ok($$ SELECT public.pipeline_reorder_stages('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), '["ganho","entrada","qualificacao","descoberta","proposta","negociacao"]'::jsonb) $$,
  '22023', NULL, '"Ganho" tem que ser a última etapa');
SELECT throws_ok($$ SELECT public.pipeline_reorder_stages('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), '["entrada","qualificacao","descoberta","proposta","ganho"]'::jsonb) $$,
  '22023', NULL, 'Faltando etapa é recusado (são 6 fixas)');
SELECT throws_ok($$ SELECT public.pipeline_reorder_stages('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), '["entrada","entrada","descoberta","proposta","negociacao","ganho"]'::jsonb) $$,
  '22023', NULL, 'Etapa repetida é recusada');

-- Isolamento: o C-level do Grão Norte não mexe em quadro da Evolut
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.pipeline_rename('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT a FROM q), 'Invadido') $$,
  '42501', NULL, 'Quadro de outro cliente não é encontrado (isolamento)');
SELECT throws_ok($$ SELECT public.pipeline_rename('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), 'Invadido') $$,
  '42501', NULL, 'Nem fingindo ser o membro da Evolut');
SELECT is((SELECT count(*) FROM public.pipelines), 3::bigint, 'O Grão Norte vê só os 3 quadros padrão dele (nenhum da Evolut)');

-- 3. Negócios
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE d1 AS SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT a FROM q),
  'c0000000-0000-0000-0000-000000000001', 50000, '2026-12-15', 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') AS r;
GRANT ALL ON d1 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM d1), 'created', 'Lucas cria negócio dele');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000003', 1000, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000006') $$,
  '42501', NULL, 'BDR não cria negócio para a Bruna');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000003', 1000, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000006') $$,
  '42501', NULL, 'BDR não cria negócio fingindo ser a Bruna');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', -5, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') $$,
  '22023', NULL, 'Valor negativo é recusado');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', 10, NULL, 10, 'etapa_x', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') $$,
  '22023', NULL, 'Etapa inexistente é recusada');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', 10, NULL, 10, 'entrada', 'meio_ruim', 'd0000000-0000-0000-0000-000000000004') $$,
  '22023', NULL, 'Situação inexistente é recusada');
RESET ROLE;
SELECT is((SELECT title FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 'Serra Azul Têxtil', 'Título do negócio é o nome da conta');
SELECT is((SELECT owner_member_id FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 'd0000000-0000-0000-0000-000000000004'::uuid, 'Dono é o Lucas');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
CREATE TEMP TABLE d2 AS SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q),
  'c0000000-0000-0000-0000-000000000003', 80000, NULL, 10, 'qualificacao', 'em_risco', 'd0000000-0000-0000-0000-000000000006') AS r;
GRANT ALL ON d2 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM d2), 'created', 'C-level cria negócio para a Bruna');
SELECT throws_ok($$ SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', 10, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000009') $$,
  '42501', NULL, 'Dono de outro workspace é recusado');
CREATE TEMP TABLE d3 AS SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q),
  'c0000000-0000-0000-0000-000000000001', 120000, NULL, 10, 'ganho', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') AS r;
GRANT ALL ON d3 TO PUBLIC;
RESET ROLE;
SELECT is((SELECT status FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d3)), 'ganho', 'Criado já em "ganho": status ganho');
SELECT is((SELECT win_probability FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d3)), 100, 'e chance 100%');

-- 4. Mover: grava o histórico com QUEM moveu
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.opportunity_move('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d1), 'proposta', NULL)->>'action', 'moved', 'Lucas move o próprio negócio');
SELECT throws_ok($$ SELECT public.opportunity_move('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d2), 'proposta', NULL) $$,
  '42501', NULL, 'BDR não move negócio da Bruna');
SELECT throws_ok($$ SELECT public.opportunity_move('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d1), 'etapa_x', NULL) $$,
  '22023', NULL, 'Etapa inexistente é recusada');
RESET ROLE;
SELECT is((SELECT stage_key FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 'proposta', 'Etapa gravada');
SELECT is((SELECT win_probability FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 55, 'Chance volta ao padrão da etapa (55%)');
SELECT is((SELECT count(*) FROM public.opportunity_stage_history WHERE opportunity_id = (SELECT (r->>'id')::uuid FROM d1) AND from_stage_key = 'entrada' AND to_stage_key = 'proposta'), 1::bigint, 'Histórico gravado');
SELECT is((SELECT moved_by_member_id FROM public.opportunity_stage_history WHERE opportunity_id = (SELECT (r->>'id')::uuid FROM d1) AND to_stage_key = 'proposta'), 'd0000000-0000-0000-0000-000000000004'::uuid, 'Histórico guarda quem moveu (Lucas)');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.opportunity_move('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM d2), 'ganho', NULL)->>'action', 'moved', 'C-level move negócio da Bruna');
RESET ROLE;
SELECT is((SELECT moved_by_member_id FROM public.opportunity_stage_history WHERE opportunity_id = (SELECT (r->>'id')::uuid FROM d2) AND to_stage_key = 'ganho'), 'd0000000-0000-0000-0000-000000000003'::uuid,
  'Histórico guarda quem moveu (a Aline), não o dono do negócio');
SELECT is((SELECT status FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d2)), 'ganho', 'Mover para "ganho" marca o negócio como ganho');
SELECT is((SELECT win_probability FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d2)), 100, 'Chance 100%');

-- Reordenar dentro da mesma coluna não gera histórico e respeita "antes de"
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
CREATE TEMP TABLE d4 AS SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', 1, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') AS r;
CREATE TEMP TABLE d5 AS SELECT public.opportunity_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q), 'c0000000-0000-0000-0000-000000000001', 2, NULL, 10, 'entrada', 'no_prazo', 'd0000000-0000-0000-0000-000000000004') AS r;
GRANT ALL ON d4, d5 TO PUBLIC;
RESET ROLE;
SELECT ok((SELECT (SELECT position FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d5)) < (SELECT position FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d4)) ), 'Negócio novo entra no topo da coluna');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.opportunity_move('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM d4), 'entrada', (SELECT (r->>'id')::uuid FROM d5))->>'action', 'moved', 'Reordena na mesma coluna');
RESET ROLE;
SELECT ok((SELECT (SELECT position FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d4)) < (SELECT position FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d5)) ), 'Ficou antes do outro');
SELECT is((SELECT count(*) FROM public.opportunity_stage_history WHERE opportunity_id = (SELECT (r->>'id')::uuid FROM d4)), 0::bigint, 'Mesma etapa: sem histórico');

-- Isolamento: Eduardo (Grão Norte) não move negócio da Evolut
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.opportunity_move('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT (r->>'id')::uuid FROM d1), 'negociacao', NULL) $$,
  '42501', NULL, 'Negócio de outro cliente não é encontrado (isolamento)');
SELECT is((SELECT count(*) FROM public.opportunities), 0::bigint, 'E o Grão Norte não enxerga nenhum negócio da Evolut');

-- 5. Editar e arquivar
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.opportunity_update('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d1), 65000, '2026-11-30', 60, 'proposta', 'em_risco', 'd0000000-0000-0000-0000-000000000004')->>'action', 'updated', 'Lucas edita o próprio negócio');
SELECT throws_ok($$ SELECT public.opportunity_update('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d1), 65000, NULL, 60, 'proposta', 'em_risco', 'd0000000-0000-0000-0000-000000000006') $$,
  '42501', NULL, 'BDR não passa o negócio para a Bruna');
SELECT throws_ok($$ SELECT public.opportunity_update('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d2), 1, NULL, 60, 'ganho', 'no_prazo', 'd0000000-0000-0000-0000-000000000006') $$,
  '42501', NULL, 'BDR não edita negócio da Bruna');
SELECT throws_ok($$ SELECT public.opportunity_archive('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d2)) $$,
  '42501', NULL, 'BDR não arquiva negócio da Bruna');
SELECT is(public.opportunity_archive('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM d1))->>'action', 'archived', 'Lucas arquiva o próprio negócio');
RESET ROLE;
SELECT is((SELECT status FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 'arquivada', 'Status arquivada');
SELECT is((SELECT amount FROM public.opportunities WHERE id = (SELECT (r->>'id')::uuid FROM d1)), 65000.00, 'Valor editado foi gravado');

-- Excluir quadro: negócios vão para outro quadro da mesma motion; o único quadro da motion não sai
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.pipeline_delete('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'plg')) $$,
  '22023', NULL, 'O único quadro de uma motion não pode ser excluído');
SELECT is(public.pipeline_delete('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT a FROM q))->>'action', 'deleted', 'Exclui um quadro SLG');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pipelines WHERE id = (SELECT a FROM q)), 0::bigint, 'Quadro saiu');
SELECT is((SELECT count(*) FROM public.opportunities WHERE id IN (SELECT (r->>'id')::uuid FROM d2 UNION ALL SELECT (r->>'id')::uuid FROM d3) AND pipeline_id <> (SELECT a FROM q)), 2::bigint, 'Os negócios foram para outro quadro, nenhum se perdeu');

-- 6. Tarefas
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE t1 AS SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Ligar para Aline', 'call',
  'c0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', NULL, now() + interval '1 day', 'pendente', 'Abrir pela vaga') AS r;
GRANT ALL ON t1 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM t1), 'created', 'Lucas cria tarefa para si');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Para a Bruna', 'call', NULL, NULL, 'd0000000-0000-0000-0000-000000000006', NULL, now(), 'pendente', NULL) $$,
  '42501', NULL, 'BDR não cria tarefa para outra pessoa');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'Fingindo ser a Bruna', 'call', NULL, NULL, 'd0000000-0000-0000-0000-000000000006', NULL, now(), 'pendente', NULL) $$,
  '42501', NULL, 'BDR não cria tarefa fingindo ser a Bruna');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '  ', 'call', NULL, NULL, 'd0000000-0000-0000-0000-000000000004', NULL, now(), 'pendente', NULL) $$,
  '22023', NULL, 'Título vazio é recusado');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Canal ruim', 'pombo', NULL, NULL, 'd0000000-0000-0000-0000-000000000004', NULL, now(), 'pendente', NULL) $$,
  '22023', NULL, 'Canal inexistente é recusado');
SELECT lives_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Reunião de alinhamento', 'reuniao', NULL, NULL, 'd0000000-0000-0000-0000-000000000004', 'copy', now(), 'em_andamento', NULL) $$,
  'Canal "reunião" e agente marcado são aceitos');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Conta de outro cliente', 'call', 'ccc00000-0000-0000-0000-000000000000', NULL, 'd0000000-0000-0000-0000-000000000004', NULL, now(), 'pendente', NULL) $$,
  '42501', NULL, 'Conta que não é deste workspace é recusada');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Do C-level para o Lucas', 'email', NULL, NULL, 'd0000000-0000-0000-0000-000000000004', NULL, now(), 'pendente', NULL)->>'action', 'created', 'C-level cria tarefa para outra pessoa');
SELECT throws_ok($$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Para o Grão', 'email', NULL, NULL, 'd0000000-0000-0000-0000-000000000009', NULL, now(), 'pendente', NULL) $$,
  '42501', NULL, 'Responsável de outro workspace é recusado');

-- Status e adiar
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.task_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM t1), 'concluida')->>'action', 'updated', 'Dono conclui a tarefa');
SELECT ok((SELECT completed_at IS NOT NULL FROM public.tasks WHERE id = (SELECT (r->>'id')::uuid FROM t1)), 'Conclusão registra a hora');
SELECT is(public.task_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM t1), 'pendente')->>'action', 'updated', 'Reabre a tarefa');
SELECT ok((SELECT completed_at IS NULL FROM public.tasks WHERE id = (SELECT (r->>'id')::uuid FROM t1)), 'Reabrir limpa a hora de conclusão');
SELECT throws_ok($$ SELECT public.task_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM t1), 'feito_talvez') $$,
  '22023', NULL, 'Status inválido é recusado');
SELECT is(public.task_postpone('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM t1), 1)->>'action', 'updated', 'Adia 1 dia');
RESET ROLE;
SELECT ok((SELECT due_at > now() + interval '1 day 23 hours' FROM public.tasks WHERE id = (SELECT (r->>'id')::uuid FROM t1)), 'Prazo andou 1 dia');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.task_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', (SELECT (r->>'id')::uuid FROM t1), 'concluida') $$,
  '42501', NULL, 'BDR não mexe na tarefa do Lucas');
SELECT throws_ok($$ SELECT public.task_postpone('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', (SELECT (r->>'id')::uuid FROM t1), 1) $$,
  '42501', NULL, 'Nem adiar');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.task_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM t1), 'em_andamento')->>'action', 'updated', 'C-level mexe na tarefa de qualquer um');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.task_set_status('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT (r->>'id')::uuid FROM t1), 'concluida') $$,
  '42501', NULL, 'Tarefa de outro cliente não é encontrada (isolamento)');
SELECT is((SELECT count(*) FROM public.tasks), 0::bigint, 'O Grão Norte não enxerga tarefa da Evolut');

RESET ROLE;
-- 7. Apagar um workspace com quadros funciona (a regra de quadro de reserva não recria quadro para workspace que sumiu)
INSERT INTO public.workspaces (id, name, slug) VALUES ('f5300000-0000-0000-0000-000000000001', 'Workspace descartável', 'descartavel-0053');
SELECT is((SELECT count(*) FROM public.pipelines WHERE workspace_id = 'f5300000-0000-0000-0000-000000000001'), 3::bigint, 'Workspace novo nasce com os 3 quadros padrão');
UPDATE public.chat_channels SET is_general = false WHERE workspace_id = 'f5300000-0000-0000-0000-000000000001';  -- o #geral protege contra remoção direta
SELECT lives_ok($$ DELETE FROM public.workspaces WHERE id = 'f5300000-0000-0000-0000-000000000001' $$, 'Apagar o workspace com quadros funciona');
SELECT is((SELECT count(*) FROM public.pipelines WHERE workspace_id = 'f5300000-0000-0000-0000-000000000001'), 0::bigint, 'Nenhum quadro sobrou para o workspace apagado');

SELECT * FROM finish();
ROLLBACK;
