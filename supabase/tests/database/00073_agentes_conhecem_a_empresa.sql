-- ==============================================================================
-- Test: 00073_agentes_conhecem_a_empresa.sql
-- Agentes conectados, ticket 02: o Playbook publicado vai em toda resposta (leitura do sistema) e o agente lê as
-- habilidades do próprio agente e os sinais recentes das contas. Só leitura; nada vaza entre workspaces.
-- Seed: Evolut a0..01 (Camila estrategista d..02), Grão Norte b0..01 (estrategista d..08).
-- ==============================================================================

BEGIN;
SELECT no_plan();

INSERT INTO public.accounts (id, workspace_id, name, domain, status) VALUES
  ('ca000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-000000000001', 'CANÁRIO conta EVOLUT-7711', 'canario7711.com.br', 'ativa'),
  ('ca000000-0000-0000-0000-0000000000c2', 'b0000000-0000-0000-0000-000000000001', 'Conta da Grão Norte', 'graonorte-conta.com.br', 'ativa');
INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'comercial', 'CANÁRIO habilidade EVOLUT-9921', 'canario-9921', '# Passo a passo da abordagem', true),
  ('a0000000-0000-0000-0000-000000000001', 'comercial', 'Habilidade desligada', 'desligada', '# não use', false),
  ('a0000000-0000-0000-0000-000000000001', 'copy', 'Habilidade de outro agente', 'da-copy', '# só da Lia', true),
  ('b0000000-0000-0000-0000-000000000001', 'comercial', 'Habilidade da Grão Norte', 'gn', '# só da Grão Norte', true);
INSERT INTO public.signal_events (workspace_id, signal_id, account_id, payload, temperature_bump) VALUES
  ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.signal_definitions ORDER BY code LIMIT 1), 'ca000000-0000-0000-0000-0000000000c1', '{"detalhe": "CANÁRIO sinal EVOLUT-5532"}', 2),
  ('b0000000-0000-0000-0000-000000000001', (SELECT id FROM public.signal_definitions ORDER BY code LIMIT 1), 'ca000000-0000-0000-0000-0000000000c2', '{"detalhe": "sinal da Grão Norte"}', 1);

-- Permissões: leitura do agente só com token; leitura do Playbook só do sistema.
SELECT ok(has_function_privilege('anon', 'public.agent_list_skills(text)', 'EXECUTE'), 'Porta do agente: habilidades aceitam só o token');
SELECT ok(has_function_privilege('anon', 'public.agent_list_signals(text, uuid, integer)', 'EXECUTE'), 'Porta do agente: sinais aceitam só o token');
SELECT ok(NOT has_function_privilege('anon', 'public.harness_playbook(uuid, text)', 'EXECUTE'), 'Visitante não lê o Playbook');
SELECT ok(NOT has_function_privilege('authenticated', 'public.harness_playbook(uuid, text)', 'EXECUTE'), 'Nem usuário logado: é função de sistema');
SELECT ok(has_function_privilege('service_role', 'public.harness_playbook(uuid, text)', 'EXECUTE'), 'O sistema lê o Playbook');

-- Playbook publicado (o sistema, não o agente)
SELECT is((SELECT public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'comercial')->>'versao'), '3.2', 'Devolve a versão publicada do Playbook');
SELECT ok((SELECT length(public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'comercial')->>'conteudo') > 100), 'E o texto dele');
SELECT is((SELECT public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'inventado')), NULL::jsonb, 'Agente que não existe: nada');
INSERT INTO public.agent_playbooks (workspace_id, agent_id, version, content_markdown, is_published)
VALUES ('a0000000-0000-0000-0000-000000000001', 'comercial', '9.9-rascunho', '# rascunho não publicado', false);
SELECT is((SELECT public.harness_playbook('a0000000-0000-0000-0000-000000000001', 'comercial')->>'versao'), '3.2', 'Rascunho nunca vale: só a versão publicada');
SELECT is((SELECT count(*)::int FROM public.agent_playbooks WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND agent_id = 'comercial' AND is_published), 0, 'Grão Norte não tem Playbook publicado (seed)');
SELECT is((SELECT public.harness_playbook('b0000000-0000-0000-0000-000000000001', 'comercial')), NULL::jsonb, 'Sem Playbook publicado: nada (o agente avisa que não tem)');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;
GRANT SELECT ON tk TO anon;

SET LOCAL ROLE anon;

SELECT throws_ok($$ SELECT public.agent_list_skills('alt_agente_x') $$, '28000', NULL, 'habilidades: token inventado recusado');
SELECT throws_ok($$ SELECT public.agent_list_signals('alt_agente_x') $$, '28000', NULL, 'sinais: token inventado recusado');

-- Habilidades: só as ligadas, só do próprio agente, só do próprio cliente.
SELECT ok((SELECT public.agent_list_skills(evolut)::text LIKE '%EVOLUT-9921%' FROM tk), 'A Zoe da Evolut lê a própria habilidade');
SELECT ok((SELECT public.agent_list_skills(evolut)::text NOT LIKE '%desligada%' FROM tk), 'Habilidade desligada não aparece');
SELECT ok((SELECT public.agent_list_skills(evolut)::text NOT LIKE '%só da Lia%' FROM tk), 'Habilidade de outro agente não aparece');
SELECT ok((SELECT public.agent_list_skills(grao)::text NOT LIKE '%EVOLUT-9921%' FROM tk), 'CANÁRIO: Grão Norte nunca lê habilidade da Evolut');
SELECT ok((SELECT public.agent_list_skills(evolut) @> '[{"slug": "canario-9921", "nome": "CANÁRIO habilidade EVOLUT-9921"}]'::jsonb FROM tk), 'Formato: slug, nome, versão e conteúdo');

-- Sinais
SELECT ok((SELECT public.agent_list_signals(evolut)::text LIKE '%EVOLUT-5532%' FROM tk), 'Sinais recentes da Evolut aparecem');
SELECT ok((SELECT public.agent_list_signals(grao)::text NOT LIKE '%EVOLUT-5532%' FROM tk), 'CANÁRIO: Grão Norte nunca lê sinal da Evolut');
SELECT ok((SELECT public.agent_list_signals(evolut, 'ca000000-0000-0000-0000-0000000000c1')::text LIKE '%EVOLUT-5532%' FROM tk), 'Filtra por conta');
SELECT is((SELECT jsonb_array_length(public.agent_list_signals(evolut, 'ca000000-0000-0000-0000-0000000000c2')) FROM tk), 0, 'Conta de outro cliente: lista vazia, sem erro que revele existência');
SELECT ok((SELECT public.agent_list_signals(evolut) @> '[{"conta": "CANÁRIO conta EVOLUT-7711", "aquecimento": 2}]'::jsonb FROM tk), 'Formato: conta, sinal, data e aquecimento');
SELECT ok((SELECT jsonb_array_length(public.agent_list_signals(evolut, NULL, 9999)) <= 50 FROM tk), 'Limite máximo de 50');
SELECT ok((SELECT public.agent_list_signals(evolut)::text NOT LIKE '%usd%' FROM tk), 'Nenhum dólar na resposta');

RESET ROLE;

-- Agente pausado pelo cliente não lê nada
SELECT lives_ok($$ UPDATE public.workspace_agents SET estado = 'pausado' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial' $$, 'Pausa a Zoe da Evolut');
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_list_skills((SELECT evolut FROM tk)) $$, '55000', NULL, 'Pausada: habilidades bloqueadas');
SELECT throws_ok($$ SELECT public.agent_list_signals((SELECT evolut FROM tk)) $$, '55000', NULL, 'Pausada: sinais bloqueados');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
