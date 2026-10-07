-- ADR 0065: o agente orquestra. Propostas novas (criar contas, pedir enriquecimento, levar contas ao Pipeline) e um PLANO:
-- várias propostas numa aprovação só. Nada roda sem uma pessoa aprovar; o passo de um plano não se decide sozinho.
-- Seed: Evolut a0..01 (Camila estrategista d..02/e..02, Aline C-level d..03/e..03); Grão Norte b0..01 (estrategista d..08).
BEGIN;
SELECT no_plan();

CREATE TEMP TABLE fx ON COMMIT DROP AS SELECT
  (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'mlg' ORDER BY created_at LIMIT 1) AS q_mlg,
  (SELECT id FROM public.pipelines WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001' AND motion = 'slg' ORDER BY created_at LIMIT 1) AS q_grao;
CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut;
GRANT SELECT ON fx, tk TO anon, authenticated;

-- Aprova ou recusa como a Aline (C-level), pela mesma função da tela.
CREATE OR REPLACE FUNCTION pg_temp.decidir(p_id UUID, p_decisao TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r JSONB;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  r := public.approval_decide(p_id, 'd0000000-0000-0000-0000-000000000003', p_decisao, (SELECT payload_json FROM public.approvals WHERE id = p_id));
  RESET ROLE;
  RETURN r;
END;
$$;

SELECT ok(has_function_privilege('anon', 'public.agent_propose_accounts(text, jsonb, text, text)', 'EXECUTE'), 'Porta do agente: propor contas (só com token)');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_enrichment(text, uuid[], text, text)', 'EXECUTE'), 'Porta do agente: propor enriquecimento');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_add_to_pipeline(text, uuid, uuid[], text, text)', 'EXECUTE'), 'Porta do agente: propor levar ao Pipeline');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_plan(text, text, jsonb, text, text)', 'EXECUTE'), 'Porta do agente: propor plano');
SELECT ok(NOT has_function_privilege('anon', 'public.approvals_aplicar_agente_orquestra()', 'EXECUTE'), 'Ninguém chama o aplicador direto');

SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_propose_accounts('alt_agente_x', '[]'::jsonb, 'x', 'k') $$, '28000', NULL, 'Token inventado é recusado');

-- 1. Criar contas: valida tudo antes; nada é criado até a aprovação.
SELECT is((SELECT public.agent_propose_accounts(evolut, '[]'::jsonb, 'Lista da feira', 'k-vazia') FROM tk)->>'ok', 'false', 'Lista vazia é recusada');
SELECT is((SELECT public.agent_propose_accounts(evolut, '[{"nome":"Sem Site","site":"isso não é site"}]'::jsonb, 'Lista da feira', 'k-ruim') FROM tk)->>'erro',
  'Site inválido para "Sem Site": use o domínio da empresa, como empresa.com.br.', 'Site inválido é recusado com o nome da conta');
SELECT is((SELECT public.agent_propose_accounts(evolut, '[{"nome":"Serra Azul Têxtil","site":"serraazul.com.br"}]'::jsonb, 'Lista da feira', 'k-ja') FROM tk)->>'erro',
  'Todas essas contas já estão na base.', 'Só conta repetida não vira proposta');
SELECT is((SELECT public.agent_propose_accounts(evolut,
  '[{"nome":"Nova do Agente","site":"https://www.novadoagente.com.br/","uf":"sp","cidade":"Campinas"},{"nome":"Serra Azul Têxtil","site":"serraazul.com.br"}]'::jsonb,
  'Empresas vistas na feira', 'k-contas') FROM tk)->>'ok', 'true', 'Proposta de contas registrada');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.accounts WHERE domain = 'novadoagente.com.br'), 0, 'Nada é criado antes da aprovação');
SELECT is((SELECT payload_json->'contas'->0->>'dominio' FROM public.approvals WHERE idempotency_key = 'k-contas'), 'novadoagente.com.br', 'O site já vai normalizado');
SELECT is((SELECT jsonb_array_length(payload_json->'contas') FROM public.approvals WHERE idempotency_key = 'k-contas'), 1, 'A conta que já existe fica de fora');
SELECT is((SELECT approval_type FROM public.approvals WHERE idempotency_key = 'k-contas'), 'lista', 'É uma aprovação de lista');
SELECT is(pg_temp.decidir((SELECT id FROM public.approvals WHERE idempotency_key = 'k-contas'), 'aprovado')->>'success', 'true', 'C-level aprova');
SELECT is((SELECT state_uf FROM public.accounts WHERE domain = 'novadoagente.com.br' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'SP', 'Aprovada, a conta nasce');
SELECT ok(EXISTS (SELECT 1 FROM internal.account_enrichments e JOIN public.accounts a ON a.id = e.account_id WHERE a.domain = 'novadoagente.com.br'),
  'A conta nova entra sozinha na fila de enriquecimento');

-- 2. Pedir enriquecimento de contas que já existem.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_enrichment(evolut, ARRAY['c0000000-0000-0000-0000-000000000003']::uuid[], 'Atualizar CNPJ', 'k-enriq') FROM tk)->>'ok', 'true', 'Proposta de enriquecimento registrada');
SELECT is((SELECT public.agent_propose_enrichment(evolut, ARRAY[gen_random_uuid()]::uuid[], 'x', 'k-enriq-ruim') FROM tk)->>'ok', 'false', 'Conta que não é do cliente é recusada');
RESET ROLE;
UPDATE internal.account_enrichments SET estado = 'ok' WHERE account_id = 'c0000000-0000-0000-0000-000000000003';
SELECT is(pg_temp.decidir((SELECT id FROM public.approvals WHERE idempotency_key = 'k-enriq'), 'aprovado')->>'success', 'true', 'C-level aprova o enriquecimento');
SELECT is((SELECT count(*)::int FROM internal.account_enrichments WHERE account_id = 'c0000000-0000-0000-0000-000000000003' AND estado = 'pendente'), 2,
  'Aprovado, a conta volta para a fila (empresa e pessoas)');

-- 3. Levar contas ao Pipeline.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_add_to_pipeline(evolut, q_grao, ARRAY['c0000000-0000-0000-0000-000000000002']::uuid[], 'x', 'k-q-ruim') FROM tk, fx)->>'ok', 'false', 'Quadro de outro cliente é recusado');
SELECT is((SELECT public.agent_propose_add_to_pipeline(evolut, q_mlg, ARRAY['c0000000-0000-0000-0000-000000000002']::uuid[], 'Lead quente para MLG', 'k-levar') FROM tk, fx)->>'ok', 'true', 'Proposta de levar ao Pipeline registrada');
RESET ROLE;
SELECT is(pg_temp.decidir((SELECT id FROM public.approvals WHERE idempotency_key = 'k-levar'), 'aprovado')->>'success', 'true', 'C-level aprova');
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE pipeline_id = (SELECT q_mlg FROM fx) AND account_id = 'c0000000-0000-0000-0000-000000000002' AND status = 'ativa'), 1,
  'Aprovado, o negócio entra no quadro MLG');

-- 4. Plano: várias propostas numa aprovação só.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_plan(evolut, 'Ativar a Metalúrgica Ipê', jsonb_build_array(
    jsonb_build_object('tipo', 'levar_contas', 'quadro_id', q_mlg, 'conta_ids', jsonb_build_array('c0000000-0000-0000-0000-000000000003')),
    jsonb_build_object('tipo', 'criar_tarefa', 'titulo', 'Ligar para a Metalúrgica Ipê', 'responsavel_id', 'd0000000-0000-0000-0000-000000000002', 'prazo_dias', 1)
  ), 'Conta quente sem negócio', 'k-plano') FROM tk, fx)->>'ok', 'true', 'Plano com 2 passos registrado');
SELECT is((SELECT public.agent_propose_plan(evolut, 'Plano ruim', jsonb_build_array(
    jsonb_build_object('tipo', 'criar_tarefa', 'titulo', 'Uma tarefa', 'responsavel_id', 'd0000000-0000-0000-0000-000000000002', 'prazo_dias', 1),
    jsonb_build_object('tipo', 'levar_contas', 'quadro_id', q_grao, 'conta_ids', jsonb_build_array('c0000000-0000-0000-0000-000000000003'))
  ), 'x', 'k-plano-ruim') FROM tk, fx)->>'erro', 'Passo 2: Quadro não encontrado neste workspace.', 'Passo inválido recusa o plano inteiro, dizendo qual');
SELECT is((SELECT public.agent_propose_plan(evolut, 'Um passo só', jsonb_build_array(
    jsonb_build_object('tipo', 'criar_tarefa', 'titulo', 'Uma tarefa', 'responsavel_id', 'd0000000-0000-0000-0000-000000000002', 'prazo_dias', 1)
  ), 'x', 'k-plano-um') FROM tk)->>'ok', 'false', 'Plano precisa de pelo menos 2 passos');
SELECT is((SELECT public.agent_propose_plan(evolut, 'Tipo estranho', '[{"tipo":"apagar_tudo"},{"tipo":"criar_tarefa"}]'::jsonb, 'x', 'k-plano-tipo') FROM tk)->>'erro',
  'Passo 1: tipo desconhecido (use criar_contas, enriquecer, levar_contas, criar_negocio, mover_negocio, criar_tarefa ou inscrever_cadencia).', 'Tipo desconhecido é recusado');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key LIKE 'k-plano-ruim%'), 0, 'Plano recusado não deixa nenhuma proposta pela metade');
SELECT is((SELECT count(*)::int FROM public.approvals WHERE parent_approval_id = (SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano')), 2, 'O plano agrupa os 2 passos');
SELECT ok((SELECT preview LIKE '1. %' FROM public.approvals WHERE idempotency_key = 'k-plano'), 'A prévia do plano lista os passos');

-- O passo não se decide sozinho: só o plano inteiro.
SELECT throws_ok(format($$ SELECT pg_temp.decidir(%L, 'aprovado') $$,
  (SELECT id FROM public.approvals WHERE parent_approval_id = (SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano') ORDER BY created_at LIMIT 1)),
  '42501', NULL, 'Um passo do plano não se aprova sozinho');
SELECT is(pg_temp.decidir((SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano'), 'aprovado')->>'success', 'true', 'C-level aprova o plano');
SELECT is((SELECT count(*)::int FROM public.approvals WHERE parent_approval_id = (SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano') AND status = 'aprovado'), 2,
  'Aprovado o plano, os 2 passos são aprovados');
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE pipeline_id = (SELECT q_mlg FROM fx) AND account_id = 'c0000000-0000-0000-0000-000000000003' AND status = 'ativa'), 1,
  'Passo 1 aplicado: a conta entrou no quadro');
SELECT is((SELECT count(*)::int FROM public.tasks WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND title = 'Ligar para a Metalúrgica Ipê'), 1, 'Passo 2 aplicado: a tarefa existe');

-- Plano recusado: nenhum passo é aplicado.
SET LOCAL ROLE anon;
SELECT is((SELECT public.agent_propose_plan(evolut, 'Plano recusado', jsonb_build_array(
    jsonb_build_object('tipo', 'criar_tarefa', 'titulo', 'Tarefa recusada A', 'responsavel_id', 'd0000000-0000-0000-0000-000000000002', 'prazo_dias', 1),
    jsonb_build_object('tipo', 'criar_tarefa', 'titulo', 'Tarefa recusada B', 'responsavel_id', 'd0000000-0000-0000-0000-000000000002', 'prazo_dias', 2)
  ), 'x', 'k-plano-nao') FROM tk)->>'ok', 'true', 'Outro plano registrado');
RESET ROLE;
SELECT is(pg_temp.decidir((SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano-nao'), 'rejeitado')->>'success', 'true', 'C-level recusa o plano');
SELECT is((SELECT count(*)::int FROM public.approvals WHERE parent_approval_id = (SELECT id FROM public.approvals WHERE idempotency_key = 'k-plano-nao') AND status = 'rejeitado'), 2,
  'Recusado o plano, os passos são recusados');
SELECT is((SELECT count(*)::int FROM public.tasks WHERE title LIKE 'Tarefa recusada%'), 0, 'Nenhuma tarefa do plano recusado foi criada');

SELECT * FROM finish();
ROLLBACK;
