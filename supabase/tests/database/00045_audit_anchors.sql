-- ==============================================================================
-- Test: 00045_audit_anchors.sql
-- Âncora do topo da corrente de auditoria (ADR 0038, continuação da 0091).
-- Sem âncora, apagar as ÚLTIMAS linhas não é detectado (não há linha seguinte para acusar).
-- Com âncora (posição + hash do topo), audit_verify_chain acusa 'topo_apagado' e
-- 'ancora_divergente' (corrente reescrita com hashes recalculados).
-- Seed: Rafael superadmin e..01; Aline C-level e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Estrutura e permissões
SELECT has_table('public', 'audit_anchors', 'Existe a tabela de âncoras');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_anchors'::regclass), 'Âncoras têm RLS ligada');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_anchors', 'SELECT'), 'Quem está logado não lê âncoras direto');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_anchors', 'SELECT'), 'Sem login não lê âncoras');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_anchors', 'INSERT'), 'Quem está logado não grava âncora');
SELECT ok(NOT has_function_privilege('anon', 'public.audit_anchor_snapshot()', 'EXECUTE'), 'Sem login não tira foto do topo');
SELECT ok(NOT has_function_privilege('authenticated', 'public.audit_anchor_snapshot()', 'EXECUTE'), 'Quem está logado não tira foto do topo (função de sistema)');
SELECT ok(has_function_privilege('service_role', 'public.audit_anchor_snapshot()', 'EXECUTE'), 'Backend (service_role) tira a foto do topo');

-- 2. Cenário: quatro workspaces com corrente íntegra
INSERT INTO public.workspaces (id, name, slug) VALUES
  ('c5000000-0000-0000-0000-0000000000a1', 'Âncora A', 'ancora-a'),
  ('c5000000-0000-0000-0000-0000000000c1', 'Âncora C', 'ancora-c'),
  ('c5000000-0000-0000-0000-0000000000d1', 'Âncora D', 'ancora-d'),
  ('c5000000-0000-0000-0000-0000000000f1', 'Âncora F', 'ancora-f');

INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type) VALUES
  ('c5000000-0000-0000-0000-0000000000a2', 'c5000000-0000-0000-0000-0000000000a1', 'system', 'a.um', 't'),
  ('c5000000-0000-0000-0000-0000000000a3', 'c5000000-0000-0000-0000-0000000000a1', 'system', 'a.dois', 't'),
  ('c5000000-0000-0000-0000-0000000000a4', 'c5000000-0000-0000-0000-0000000000a1', 'system', 'a.tres', 't'),
  ('c5000000-0000-0000-0000-0000000000c2', 'c5000000-0000-0000-0000-0000000000c1', 'system', 'c.um', 't'),
  ('c5000000-0000-0000-0000-0000000000c3', 'c5000000-0000-0000-0000-0000000000c1', 'system', 'c.dois', 't'),
  ('c5000000-0000-0000-0000-0000000000d2', 'c5000000-0000-0000-0000-0000000000d1', 'system', 'd.um', 't'),
  ('c5000000-0000-0000-0000-0000000000d3', 'c5000000-0000-0000-0000-0000000000d1', 'system', 'd.dois', 't'),
  ('c5000000-0000-0000-0000-0000000000f2', 'c5000000-0000-0000-0000-0000000000f1', 'system', 'f.um', 't');

-- 3. Foto do topo: A (3 linhas), C (2), D (2) e F (1) ganham âncora.
SELECT lives_ok($$ SELECT public.audit_anchor_snapshot() $$, 'Foto do topo roda sem erro');

SELECT is((SELECT seq FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1'), 3::bigint, 'Âncora de A guarda a posição do topo (3)');
SELECT is((SELECT hash FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1'),
          (SELECT hash FROM public.audit_logs WHERE id = 'c5000000-0000-0000-0000-0000000000a4'), 'Âncora de A guarda o hash da linha do topo');

SELECT public.audit_anchor_snapshot();
SELECT is((SELECT count(*) FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1'), 1::bigint,
  'Tirar a foto duas vezes sem linha nova não duplica a âncora (idempotente)');

SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a1'),
  '{"integra": true, "linhas": 3, "primeira_quebra": null, "motivo": null}'::jsonb, 'Corrente com âncora e sem adulteração continua íntegra');

-- Linha nova depois da âncora: segue íntegra; nova foto cria segunda âncora
INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type)
VALUES ('c5000000-0000-0000-0000-0000000000a5', 'c5000000-0000-0000-0000-0000000000a1', 'system', 'a.quatro', 't');
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a1')->>'integra', 'true', 'Linha nova depois da âncora não quebra a corrente');
SELECT public.audit_anchor_snapshot();
SELECT is((SELECT count(*) FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1'), 2::bigint, 'Linha nova gera nova âncora (posição 4)');

-- 4. Âncoras são imutáveis (mesma regra do audit_logs)
SELECT throws_ok($$ UPDATE public.audit_anchors SET seq = 99 WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1' $$, 'P0001', NULL, 'Âncora não pode ser alterada');
SELECT throws_ok($$ DELETE FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1' $$, 'P0001', NULL, 'Âncora não pode ser apagada');

-- 5. Contraste: workspace G nasce DEPOIS da foto, então não tem âncora. Apagar a última linha dele passa batido (limite conhecido).
INSERT INTO public.workspaces (id, name, slug) VALUES ('c5000000-0000-0000-0000-0000000000a9', 'Sem âncora', 'sem-ancora');
INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type) VALUES
  ('c5000000-0000-0000-0000-0000000000b2', 'c5000000-0000-0000-0000-0000000000a9', 'system', 'g.um', 't'),
  ('c5000000-0000-0000-0000-0000000000b3', 'c5000000-0000-0000-0000-0000000000a9', 'system', 'g.dois', 't');
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
DELETE FROM public.audit_logs WHERE id = 'c5000000-0000-0000-0000-0000000000b3';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a9')->>'integra', 'true',
  'Sem âncora, apagar a última linha NÃO é detectado (limite conhecido que a âncora resolve)');

-- 6. Com âncora: apagar a última linha de A (posição 4) é detectado
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
DELETE FROM public.audit_logs WHERE id = 'c5000000-0000-0000-0000-0000000000a5';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a1')->>'integra', 'false', 'Apagar a última linha ancorada quebra a verificação');
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a1')->>'motivo', 'topo_apagado', 'Motivo: topo apagado');
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000a1')->>'primeira_quebra', '4', 'Aponta a primeira posição que sumiu (4)');

-- A foto nunca ancora corrente quebrada
SELECT is((public.audit_anchor_snapshot())->>'puladas', '1', 'Foto pula a corrente quebrada de A (e só ela)');
SELECT is((SELECT count(*) FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000a1'), 2::bigint, 'Corrente quebrada não ganha âncora nova');

-- 7. Corrente reescrita com hashes recalculados (quem conhece o algoritmo): só a âncora acusa
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
UPDATE public.audit_logs SET action = 'd.reescrito' WHERE id = 'c5000000-0000-0000-0000-0000000000d3';
UPDATE public.audit_logs l SET hash = internal.audit_calcular_hash(l) WHERE l.id = 'c5000000-0000-0000-0000-0000000000d3';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000d1')->>'motivo', 'ancora_divergente', 'Corrente reescrita com hash recalculado é acusada pela âncora');
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000d1')->>'primeira_quebra', '2', 'Aponta a posição ancorada que divergiu (2)');

-- 8. Todas as linhas apagadas: a âncora ainda acusa
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
DELETE FROM public.audit_logs WHERE id = 'c5000000-0000-0000-0000-0000000000f2';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000f1')->>'motivo', 'topo_apagado', 'Corrente inteira apagada: âncora acusa topo apagado');
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000f1')->>'primeira_quebra', '1', 'Aponta a posição 1');

-- 9. Isolamento: C (sem adulteração) segue íntegro
SELECT is(public.audit_verify_chain('c5000000-0000-0000-0000-0000000000c1')->>'integra', 'true', 'Adulteração em outros workspaces não afeta C');

-- 9b. Remover o workspace inteiro leva as âncoras junto (é a limpeza que os testes de integração fazem)
INSERT INTO public.workspaces (id, name, slug) VALUES ('c5000000-0000-0000-0000-0000000000e1', 'Âncora E', 'ancora-e');
INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type) VALUES ('c5000000-0000-0000-0000-0000000000e1', 'system', 'e.um', 't');
SELECT public.audit_anchor_snapshot();
SELECT is((SELECT count(*) FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000e1'), 1::bigint, 'E tem âncora antes de ser removido');
SET LOCAL session_replication_role = replica;
DELETE FROM public.audit_logs WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000e1';
SET LOCAL session_replication_role = origin;
UPDATE public.chat_channels SET is_general = false WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000e1';
DELETE FROM public.workspace_members WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000e1';
SELECT lives_ok($$ DELETE FROM public.workspaces WHERE id = 'c5000000-0000-0000-0000-0000000000e1' $$, 'Remover o workspace com âncora funciona');
SELECT is((SELECT count(*) FROM public.audit_anchors WHERE workspace_id = 'c5000000-0000-0000-0000-0000000000e1'), 0::bigint, 'As âncoras saem junto com o workspace');

-- 10. Saúde: A, D e F quebrados (F só aparece porque a Saúde olha também os workspaces que têm âncora)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT h->>'detalhe' FROM jsonb_array_elements(public.admin_health()) h WHERE h->>'nome' = 'Auditoria íntegra'),
  '3 clientes com auditoria adulterada', 'Saúde conta A, D e F (inclusive F, sem nenhuma linha restante)');

SELECT * FROM finish();
ROLLBACK;
