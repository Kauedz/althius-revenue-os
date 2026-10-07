-- ==============================================================================
-- Test: 00089_sinal_que_gera_acao.sql
-- Sinal que gera ação (spec .scratch/prospeccao-revenue, fatia 8; ADR 0067): sinal FORTE numa conta de FIT ALTO vira
-- uma PROPOSTA de próximo passo da Zoe, usando as propostas que já existem (levar ao Pipeline ou criar tarefa). Nada
-- roda sem aprovação; o mesmo sinal (e a mesma conta, enquanto houver proposta pendente) não duplica; Zoe pausada não
-- propõe; isolamento entre clientes.
-- ==============================================================================

BEGIN;
SELECT no_plan();

UPDATE public.workspace_settings SET icp = '{"cnaes":["8630504"],"ufs":["SP"]}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.workspace_settings SET icp = '{"cnaes":["8630504"],"ufs":["SP"]}' WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE public.workspace_agents SET estado = 'ativo' WHERE agent_code = 'comercial' AND workspace_id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
SELECT set_config('althius.enriquecimento', 'on', true);
INSERT INTO public.accounts (id, workspace_id, name, domain, status, cnae, state_uf, city) VALUES
  ('c8900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'SINAL-ALTO', 'sinal-alto.test', 'ativa', '8630504 - Odonto', 'SP', 'Campinas'),
  ('c8900000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'SINAL-BAIXO', 'sinal-baixo.test', 'ativa', '1111111 - Outro', 'RJ', 'Rio'),
  ('c8900000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'SINAL-NEGOCIO', 'sinal-negocio.test', 'ativa', '8630504 - Odonto', 'SP', 'Campinas'),
  ('c8900000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'SINAL-GRAO', 'sinal-grao.test', 'ativa', '8630504 - Odonto', 'SP', 'Campinas');
SELECT set_config('althius.enriquecimento', 'off', true);
INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, stage_key, title, amount, status)
SELECT 'a0000000-0000-0000-0000-000000000001', p.id, 'c8900000-0000-0000-0000-000000000003', 'entrada', 'Negócio SINAL', 0, 'ativa'
  FROM public.pipelines p WHERE p.workspace_id = 'a0000000-0000-0000-0000-000000000001' ORDER BY p.created_at LIMIT 1;

CREATE TEMP TABLE sinal ON COMMIT DROP AS SELECT id FROM public.signal_definitions ORDER BY code LIMIT 1;
CREATE OR REPLACE FUNCTION pg_temp.sinal(p_conta UUID, p_ws UUID, p_forca INT) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v UUID;
BEGIN
  INSERT INTO public.signal_events (workspace_id, signal_id, account_id, temperature_bump, payload)
  VALUES (p_ws, (SELECT id FROM sinal), p_conta, p_forca, '{"texto":"Abriu vaga de comprador"}') RETURNING id INTO v;
  RETURN v;
END;
$$;
CREATE OR REPLACE FUNCTION pg_temp.propostas(p_conta UUID) RETURNS INT LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.approvals WHERE payload_json->>'origem' = 'sinal' AND payload_json->>'conta_do_sinal' = p_conta::text;
$$;

-- Sinal fraco não propõe
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1);
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000001'), 0, 'Sinal fraco não vira proposta');

-- Sinal forte em conta de fit alto, sem negócio: propõe levar ao Pipeline
CREATE TEMP TABLE e1 ON COMMIT DROP AS SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 2) AS id;
SELECT ok((SELECT fit FROM public.accounts WHERE id = 'c8900000-0000-0000-0000-000000000001') >= 70, 'A conta tem fit alto');
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000001'), 1, 'Sinal forte + fit alto: vira proposta');
SELECT is((SELECT agent_code || '/' || status || '/' || category FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000001'),
  'comercial/pendente/operacao', 'Proposta da Zoe, pendente, de operação');
SELECT is((SELECT payload_json->>'acao' FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000001'), 'levar_contas', 'Sem negócio: levar ao Pipeline');
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE account_id = 'c8900000-0000-0000-0000-000000000001'), 0, 'NADA RODA SEM APROVAÇÃO');
SELECT ok((SELECT reason FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000001') ~ 'fit', 'O motivo cita o sinal e o fit');

-- Outro sinal forte na mesma conta com a proposta pendente: não duplica
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 2);
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000001'), 1, 'Não duplica proposta para a mesma conta pendente');

-- Fit baixo não propõe
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2);
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000002'), 0, 'Fit baixo não vira proposta');

-- Conta que já tem negócio: propõe tarefa para o responsável
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 2);
SELECT is((SELECT payload_json->>'acao' FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000003'), 'criar_tarefa', 'Já no Pipeline: propõe tarefa');
SELECT ok((SELECT payload_json->>'titulo' FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000003') ~ 'SINAL-NEGOCIO', 'A tarefa cita a conta');

-- Isolamento: a proposta da Grão fica na Grão
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 2);
SELECT is((SELECT workspace_id FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000004'),
  'b0000000-0000-0000-0000-000000000001'::uuid, 'ISOLAMENTO: a proposta fica no cliente da conta');

-- Aprovada: o efeito é o das propostas que já existem (a conta entra no quadro)
SELECT set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.approval_decide((SELECT id FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000001'),
  'd0000000-0000-0000-0000-000000000003', 'aprovado', (SELECT payload_json FROM public.approvals WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000001'))->>'success',
  'true', 'C-level aprova');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.opportunities WHERE account_id = 'c8900000-0000-0000-0000-000000000001'), 1, 'Aprovada: a conta entra no Pipeline');

-- Depois de decidida, um sinal forte novo pode propor de novo (outro passo)
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 2);
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000001'), 2, 'Decidida a anterior, o sinal novo propõe o próximo passo (agora tarefa)');

-- Zoe pausada não propõe
UPDATE public.workspace_agents SET estado = 'pausado' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial';
SELECT is((SELECT estado FROM public.workspace_agents WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_code = 'comercial'), 'pausado', 'Zoe pausada pelo cliente');
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 2);
UPDATE public.approvals SET status = 'rejeitado' WHERE payload_json->>'conta_do_sinal' = 'c8900000-0000-0000-0000-000000000003';
SELECT pg_temp.sinal('c8900000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 2);
SELECT is(pg_temp.propostas('c8900000-0000-0000-0000-000000000003'), 1, 'Zoe pausada não propõe');

SELECT * FROM finish();
ROLLBACK;
