-- ==============================================================================
-- Test: 00035_learnings.sql
-- Seam: learning_entries + learning_decide e agent_playbook_publish (ADR 0024: o agente sugere; o estrategista
-- aplica no rascunho do playbook ou descarta, e publica uma versão nova). Aprendizado não é tela própria.
-- Seed Evolut: Camila estrategista d..02 (e..02), Aline C-level d..03 (e..03). Grão: Eduardo e..07, d..09.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT has_column('public', 'learning_entries', 'impact', 'Aprendizado tem impacto medido');
SELECT has_column('public', 'learning_entries', 'proposed_change', 'Aprendizado traz a mudança proposta no playbook');
SELECT ok((SELECT count(*) FROM public.agent_playbooks WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND is_published) = 4, 'Seed: Evolut tem um playbook publicado por agente');
SELECT ok(NOT has_table_privilege('authenticated', 'public.learning_entries', 'UPDATE'), 'Ninguém muda aprendizado direto na tabela');
SELECT ok(NOT has_table_privilege('authenticated', 'public.learning_entries', 'INSERT'), 'Pessoa não cria aprendizado direto (quem sugere é o agente)');
SELECT ok((SELECT count(*) FROM public.learning_entries WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') >= 5, 'Seed: Evolut tem aprendizados de exemplo');

INSERT INTO public.learning_entries (id, workspace_id, agent_id, suggestion_text, evidence, impact)
VALUES ('1e000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'copy', 'Teste: abrir pela vaga', 'Aprendido com 140 e-mails', '+3 p.p.'),
       ('1e000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'comercial', 'Teste: excluir microempresas', NULL, NULL);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT ok((SELECT count(*) FROM public.learning_entries WHERE id = '1e000000-0000-0000-0000-000000000001') = 1, 'C-level lê os aprendizados');
SELECT is(public.learning_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', '1e000000-0000-0000-0000-000000000001', 'aplicada')->>'erro',
  'Seu papel não aplica aprendizados.', 'C-level não aplica (quem escreve o playbook é o estrategista)');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.learning_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000001', 'aplicada')->>'status',
  'aplicada', 'Estrategista aplica');
SELECT is(public.learning_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000001', 'descartada')->>'erro',
  'Este aprendizado já foi decidido.', 'Decisão é de uso único');
SELECT is(public.learning_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000002', 'apagada')->>'erro',
  'Decisão inválida.', 'Só aplicar ou descartar');
SELECT is(public.learning_decide('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000002', 'descartada')->>'status',
  'descartada', 'Estrategista descarta');
-- Aprendizado de outro workspace com o workspace errado não é encontrado.
SELECT is(public.learning_decide('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', '1e000000-0000-0000-0000-000000000001', 'aplicada')->>'erro',
  'Aprendizado não encontrado.', 'Não decide aprendizado de outro workspace');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.learning_entries WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Grão Norte não lê aprendizados da Evolut');
RESET ROLE;

SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'aprendizado.aplicada'), 'Decisão vai para a auditoria');

-- Publicar playbook: nova versão publicada, a anterior vira histórico; só quem configura agente.
SELECT ok(NOT has_table_privilege('authenticated', 'public.agent_playbooks', 'INSERT'), 'Ninguém grava playbook direto na tabela');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.agent_playbook_publish('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'copy', '# Missão')->>'erro',
  'Seu papel não publica playbook.', 'C-level não publica playbook');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.agent_playbook_publish('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'copy', '   ')->>'erro',
  'O playbook não pode ficar vazio.', 'Playbook vazio é recusado');
SELECT is(public.agent_playbook_publish('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'copy', E'# Missão
Nova versão')->>'versao',
  '2.2', 'Camila publica: a versão sobe de 2.1 para 2.2');
RESET ROLE;
SELECT results_eq(
  $$ SELECT version, is_published, content_markdown FROM public.agent_playbooks
     WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'copy' ORDER BY created_at DESC, version DESC LIMIT 2 $$,
  $$ VALUES ('2.2'::text, true, E'# Missão
Nova versão'::text), ('2.1'::text, false, (SELECT content_markdown FROM public.agent_playbooks WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'copy' AND version = '2.1')) $$,
  'Só a versão nova fica publicada; a anterior vira histórico');

SELECT * FROM finish();
ROLLBACK;
