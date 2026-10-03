-- ==============================================================================
-- Test: 00033_workspace_agents.sql
-- Seam: tabela workspace_agents + funções agent_set_paused, agent_set_caps e get_agents_overview,
-- e o efeito da pausa na porta do Hermes Agent (agent_list_contacts).
-- Seed Evolut a0..01: Rafael superadmin d..01, Camila estrategista d..02, Aline C-level d..03 (e..03),
-- Lucas BDR d..04 (e..04). Grão Norte b0..01: Camila d..08, Eduardo C-level d..09 (e..07).
-- Vértice c0..01: só o superadmin.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Os 4 agentes fixos existem em cada workspace, com o padrão do produto.
SELECT has_table('public', 'workspace_agents', 'Existe a situação dos agentes por workspace');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspace_agents'::regclass), 'workspace_agents tem RLS');
SELECT is((SELECT count(*)::int FROM public.workspace_agents), 12, '3 workspaces × 4 agentes');
SELECT results_eq(
  $$ SELECT agent_code, estado, autonomia, responsavel_member_id::text FROM public.workspace_agents
     WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' ORDER BY agent_code $$,
  $$ VALUES ('comercial'::text, 'ativo'::text, 'Assistido'::text, 'd0000000-0000-0000-0000-000000000002'::text),
            ('copy', 'ativo', 'Supervisionado', 'd0000000-0000-0000-0000-000000000002'),
            ('marketing', 'ativo', 'Assistido', 'd0000000-0000-0000-0000-000000000002'),
            ('revops', 'ativo', 'Supervisionado', 'd0000000-0000-0000-0000-000000000002') $$,
  'Evolut: agentes ativos, autonomia padrão e a estrategista como responsável');
SELECT is((SELECT count(*)::int FROM public.workspace_agents WHERE workspace_id = 'c0000000-0000-0000-0000-000000000001' AND responsavel_member_id IS NULL), 4,
  'Sem estrategista no workspace, o responsável fica em aberto (nada inventado)');
SELECT is((SELECT caps FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial'),
  '{"lerCrm": true, "escreverCrm": false, "pesquisar": true, "listas": true, "copy": false, "campanhas": false, "relatorios": true, "aprovacao": true}'::jsonb,
  'Capacidades padrão do Agente Comercial');

INSERT INTO public.workspaces (id, name, slug) VALUES ('a9000000-0000-0000-0000-000000000033', 'Workspace Novo', 'workspace-novo-33');
SELECT is((SELECT count(*)::int FROM public.workspace_agents WHERE workspace_id = 'a9000000-0000-0000-0000-000000000033'), 4,
  'Workspace novo já nasce com os 4 agentes');

-- 2. Só funções gravam; leitura por workspace.
SELECT ok(NOT has_table_privilege('authenticated', 'public.workspace_agents', 'UPDATE'), 'Ninguém altera agente direto na tabela');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 4, 'Aline lê os agentes da Evolut');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Eduardo (Grão Norte) não lê agentes da Evolut');
SELECT is(public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'comercial', true)->>'ok', 'false',
  'Eduardo não pausa agente de outro workspace');
SELECT throws_ok($$ SELECT public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', true) $$,
  '42501', NULL, 'Ninguém usa o id de membro de outra pessoa');

-- 3. Pausar: C-level sim (botão de emergência); BDR não.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'comercial', true)->>'erro',
  'Seu papel não pausa agentes.', 'BDR não pausa agente');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', true)->>'estado',
  'pausado', 'Aline pausa o Agente Comercial');
SELECT is(public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'vendas', true)->>'ok',
  'false', 'Agente que não existe é recusado');
RESET ROLE;
SELECT results_eq(
  $$ SELECT estado, paused_by_member_id::text FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial' $$,
  $$ VALUES ('pausado'::text, 'd0000000-0000-0000-0000-000000000003'::text) $$, 'Fica gravado quem pausou');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'agente.pausado' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'Pausa vai para a auditoria');

-- 4. Botão de emergência vale para o Hermes Agent: agente pausado não acessa dados.
CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'copy', 'd0000000-0000-0000-0000-000000000002') AS copy_evolut;
GRANT SELECT ON tk TO anon;
SET LOCAL ROLE anon;
SELECT throws_like($$ SELECT public.agent_list_contacts((SELECT evolut FROM tk)) $$, '%Agente pausado%', 'Agente pausado não lê contatos');
SELECT ok((SELECT jsonb_array_length(public.agent_list_contacts(copy_evolut)) > 0 FROM tk), 'Outro agente do mesmo cliente segue funcionando');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.agent_set_paused('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', false)->>'estado',
  'ativo', 'Aline retoma o agente');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT ok((SELECT jsonb_array_length(public.agent_list_contacts(evolut)) > 0 FROM tk), 'Retomado, o agente volta a ler');
RESET ROLE;

-- 5. Capacidades: quem configura agente (estrategista) muda; C-level só lê.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.agent_set_caps('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'copy', '{"escreverCrm": true}')->>'erro',
  'Seu papel não configura agentes.', 'C-level não muda capacidades');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.agent_set_caps('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'copy', '{"inventada": true}')->>'erro',
  'Capacidade desconhecida.', 'Capacidade fora da lista é recusada');
SELECT is(public.agent_set_caps('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'copy', '{"escreverCrm": true}')->>'ok',
  'true', 'Camila liga "Escrever no CRM" para o Agente de Copy');
RESET ROLE;
SELECT is((SELECT caps->>'escreverCrm' FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'copy'),
  'true', 'Capacidade gravada, as outras ficam como estavam');
SELECT is((SELECT caps->>'copy' FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'copy'),
  'true', 'Gerar copy continua ligada');

-- 6. Resumo da tela com números reais.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(jsonb_array_length(public.get_agents_overview('a0000000-0000-0000-0000-000000000001')), 4, 'Resumo traz os 4 agentes');
SELECT ok(public.get_agents_overview('a0000000-0000-0000-0000-000000000001')->0 ?& ARRAY['agent_code', 'estado', 'autonomia', 'responsavel', 'caps', 'exec_ciclo', 'ultima_em', 'sucesso', 'pendencias'],
  'Cada agente traz situação, responsável e números');
SELECT is(
  (SELECT (a->>'pendencias')::int FROM jsonb_array_elements(public.get_agents_overview('a0000000-0000-0000-0000-000000000001')) a WHERE a->>'agent_code' = 'comercial'),
  (SELECT count(*)::int FROM public.approvals WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial' AND status = 'pendente'),
  'Pendências = aprovações pendentes daquele agente');
SELECT is((SELECT a->>'responsavel' FROM jsonb_array_elements(public.get_agents_overview('a0000000-0000-0000-0000-000000000001')) a WHERE a->>'agent_code' = 'comercial'),
  'Camila Duarte', 'Responsável vem com o nome');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(jsonb_array_length(public.get_agents_overview('a0000000-0000-0000-0000-000000000001')), 0, 'Grão Norte não vê o resumo da Evolut');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
