-- ==============================================================================
-- Test: 00054_cadencias_campanhas.sql
-- PR 08: Cadências e Campanhas ligadas ao banco.
--   Cadências: BDR cria e edita só as dele (cadences.edit own); C-level só lê; passo automático só em e-mail/WhatsApp;
--              passos não mudam com contatos em andamento.
--   Campanhas: verba de mídia é GASTO. Estrategista pede, C-level aprova (approval_decide), C-level/superadmin aplicam direto.
--   Views de análise respeitam o workspace de quem consulta (antes vazavam entre clientes).
-- Seed: Camila estrategista (user e..02, membro d..02); Aline C-level (e..03, d..03); Lucas BDR (e..04, d..04, dono da conta c..01);
--       Bruna BDR (e..06, d..06); Eduardo C-level do Grão Norte (e..07, d..09). Rafael superadmin (e..01).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Quem pode chamar (ADR 0023): só quem está logado
SELECT is((SELECT count(*) FROM unnest(ARRAY[
  'public.cadence_save(uuid,uuid,uuid,text,text,text)', 'public.cadence_add_step(uuid,uuid,uuid,text,text,integer,text,text)',
  'public.cadence_remove_last_step(uuid,uuid,uuid)', 'public.campaign_create(uuid,uuid,text,text,numeric)',
  'public.campaign_set_budget(uuid,uuid,uuid,numeric)', 'public.campaign_set_status(uuid,uuid,uuid,text)'
]) f WHERE has_function_privilege('authenticated', f, 'EXECUTE') AND NOT has_function_privilege('anon', f, 'EXECUTE')), 6::bigint,
  'As 6 funções são para quem está logado e não para quem não está');

-- 2. Cadências
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
CREATE TEMP TABLE c1 AS SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', NULL, 'Cadência da Camila', 'Importadores', 'ativa') AS r;
GRANT ALL ON c1 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM c1), 'created', 'Estrategista cria cadência');
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', NULL, '   ', NULL, 'ativa') $$, '22023', NULL, 'Nome vazio é recusado');
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', NULL, 'X', NULL, 'rascunho_x') $$, '22023', NULL, 'Status inválido é recusado');
SELECT is(public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'Cadência da Camila v2', 'Importadores SP', 'pausada')->>'action', 'updated', 'Edita nome, descrição e status');

-- Passos
SELECT is(public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'email', 'auto', 0, 'Oi', 'Primeira mensagem')->>'step_number', '1', 'Primeiro passo é o 1');
SELECT is(public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'linkedin', 'manual', 2, NULL, 'Conectar com nota')->>'step_number', '2', 'Segundo passo é o 2');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'linkedin', 'auto', 1, NULL, 'x') $$, '22023', NULL, 'LinkedIn nunca é automático');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'email', 'auto', 1, 'Oi', '   ') $$, '22023', NULL, 'Passo automático precisa de texto');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'email', 'auto', -1, 'Oi', 'x') $$, '22023', NULL, 'Espera negativa é recusada');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'telegrama', 'manual', 1, NULL, 'x') $$, '22023', NULL, 'Canal inexistente é recusado');
SELECT is(public.cadence_remove_last_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1))->>'removed_step', '2', 'Remove o último passo (o 2)');
SELECT is(public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM c1), 'whatsapp', 'auto', 1, NULL, 'Segue o WhatsApp')->>'step_number', '2', 'O próximo passo reaproveita o número 2');

-- BDR: cria e edita só a dele
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
CREATE TEMP TABLE c2 AS SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', NULL, 'Cadência do Lucas', NULL, 'ativa') AS r;
GRANT ALL ON c2 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM c2), 'created', 'BDR cria cadência própria');
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c1), 'Invadida', NULL, 'ativa') $$, '42501', NULL, 'BDR não edita cadência de outra pessoa');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c1), 'email', 'manual', 0, NULL, 'x') $$, '42501', NULL, 'BDR não mexe nos passos da cadência da Camila');
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', NULL, 'Fingindo ser a Bruna', NULL, 'ativa') $$, '42501', NULL, 'BDR não cria fingindo ser outro');
SELECT is(public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c2), 'call', 'manual', 0, NULL, 'Roteiro da ligação')->>'step_number', '1', 'BDR monta os passos da própria cadência');

-- C-level só lê
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', NULL, 'Do C-level', NULL, 'ativa') $$, '42501', NULL, 'C-level não edita cadência (só lê)');
SELECT is((SELECT count(*) FROM public.cadences WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 2::bigint, 'C-level enxerga as duas cadências');

-- Passos não mudam com contatos em andamento
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.cadence_enroll('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c2), 'cb000000-0000-0000-0000-000000000001')->>'action', 'enrolled', 'Lucas inscreve um contato dele');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c2), 'email', 'manual', 1, NULL, 'x') $$, '22023', NULL, 'Com contato em andamento os passos não mudam');
SELECT throws_ok($$ SELECT public.cadence_remove_last_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', (SELECT (r->>'id')::uuid FROM c2)) $$, '22023', NULL, 'Nem remover passo');

-- 3. Isolamento: o Grão Norte não vê nem mexe
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.cadences), 0::bigint, 'Grão Norte não enxerga nenhuma cadência da Evolut');
SELECT is((SELECT count(*) FROM public.view_cadence_performance), 0::bigint, 'Nem pela view de desempenho (antes vazava)');
SELECT throws_ok($$ SELECT public.cadence_add_step('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT (r->>'id')::uuid FROM c1), 'email', 'manual', 0, NULL, 'x') $$, '42501', NULL, 'Cadência de outro cliente não é encontrada');
SELECT throws_ok($$ SELECT public.cadence_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', NULL, 'Invasão', NULL, 'ativa') $$, '42501', NULL, 'Nem fingindo ser membro da Evolut');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.view_cadence_performance), 2::bigint, 'A Evolut vê as próprias pela view');
RESET ROLE;

-- A view do pipeline também respeita o workspace
INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, title, amount, owner_member_id)
VALUES ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.pipelines WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND motion = 'slg'),
        'c0000000-0000-0000-0000-000000000001', 'Negócio da Evolut', 1000, 'd0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.view_pipeline_analytics), 0::bigint, 'Grão Norte não enxerga o pipeline da Evolut pela view');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.view_pipeline_analytics), 1::bigint, 'A Evolut enxerga o próprio');
RESET ROLE;

-- 4. Campanhas: BDR não cria
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Do BDR', 'meta_ads', 0) $$, '42501', NULL, 'BDR não cria campanha');

-- Estrategista pede a verba: a campanha nasce sem verba e o pedido vai ao C-level
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
CREATE TEMP TABLE k1 AS SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Importação sem risco', 'linkedin_ads', 5000) AS r;
GRANT ALL ON k1 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM k1), 'created', 'Estrategista cria a campanha');
SELECT ok((SELECT r->>'approval_id' IS NOT NULL FROM k1), 'e a verba vira pedido de aprovação');
SELECT throws_ok($$ SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'X', 'tiktok', 0) $$, '22023', NULL, 'Canal inexistente é recusado');
SELECT throws_ok($$ SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '  ', 'meta_ads', 0) $$, '22023', NULL, 'Nome vazio é recusado');
SELECT throws_ok($$ SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Verba negativa', 'meta_ads', -1) $$, '22023', NULL, 'Verba negativa é recusada');
RESET ROLE;
SELECT is((SELECT budget_brl FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k1)), 0.00, 'A verba só vale depois da aprovação');
SELECT is((SELECT status FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k1)), 'rascunho', 'Campanha nasce em rascunho');
SELECT is((SELECT category || '/' || approval_type || '/' || status FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM k1)), 'gasto/orcamento/pendente', 'Pedido é de gasto, tipo orçamento, pendente');
SELECT is((SELECT requested_by_member_id FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM k1)), 'd0000000-0000-0000-0000-000000000002'::uuid, 'Quem pediu foi a estrategista');
SELECT ok((SELECT count(*) >= 1 FROM public.notifications WHERE type = 'approval_required' AND entity_id = (SELECT (r->>'approval_id')::uuid FROM k1) AND recipient_member_id = 'd0000000-0000-0000-0000-000000000003'), 'O C-level é avisado');

-- Pedir de novo enquanto há um pedido pendente não duplica
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.campaign_set_budget('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM k1), 7000)->>'action', 'pending_exists', 'Pedido pendente não duplica');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.approvals WHERE payload_json->>'acao' = 'verba_campanha' AND payload_json->>'campaign_id' = (SELECT r->>'id' FROM k1) AND status = 'pendente'), 1::bigint, 'Continua um pedido só');

-- A estrategista não decide gasto; o C-level decide (quem decide é a pessoa logada)
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.approval_decide((SELECT (r->>'approval_id')::uuid FROM k1), 'd0000000-0000-0000-0000-000000000002', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM k1)), NULL)->>'status', 'unauthorized_decider_for_spend', 'Estrategista não aprova o próprio gasto');
SELECT is((SELECT budget_brl FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k1)), 0.00, 'Verba continua zerada');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.approval_decide((SELECT (r->>'approval_id')::uuid FROM k1), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM k1)), NULL)->>'status', 'aprovado', 'C-level aprova');
SELECT is((SELECT budget_brl FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k1)), 5000.00, 'Aprovado: a verba entra na campanha');
SELECT is((SELECT count(*) FROM public.audit_logs WHERE action = 'campaign.budget_applied' AND entity_id = (SELECT (r->>'id')::uuid FROM k1)), 1::bigint, 'Aplicação da verba auditada');

-- Rejeitado não aplica
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
CREATE TEMP TABLE k2 AS SELECT public.campaign_set_budget('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM k1), 9000) AS r;
GRANT ALL ON k2 TO PUBLIC;
SELECT is((SELECT r->>'action' FROM k2), 'requested', 'Aumentar a verba é um pedido');
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.approval_decide((SELECT (r->>'approval_id')::uuid FROM k2), 'd0000000-0000-0000-0000-000000000003', 'rejeitado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM k2)), 'Muito alto')->>'status', 'rejeitado', 'C-level rejeita');
SELECT is((SELECT budget_brl FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k1)), 5000.00, 'Rejeitado: a verba não muda');

-- Reduzir não é gasto: a estrategista faz direto. C-level aplica direto ("quem paga decide")
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.campaign_set_budget('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT (r->>'id')::uuid FROM k1), 3000)->>'action', 'updated', 'Reduzir a verba é direto');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.campaign_set_budget('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM k1), 12000)->>'action', 'updated', 'C-level aumenta direto');
CREATE TEMP TABLE k3 AS SELECT public.campaign_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Meta remarketing', 'meta_ads', 2000) AS r;
GRANT ALL ON k3 TO PUBLIC;
SELECT ok((SELECT r->>'approval_id' IS NULL FROM k3), 'C-level cria campanha com verba sem pedir a ninguém');
SELECT is(public.campaign_set_budget('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM k3), 2000)->>'action', 'unchanged', 'Mesmo valor: sem mudança');
SELECT is(public.campaign_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM k3), 'ativa')->>'action', 'updated', 'Ativa a campanha');
SELECT throws_ok($$ SELECT public.campaign_set_status('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT (r->>'id')::uuid FROM k3), 'voando') $$, '22023', NULL, 'Status inválido é recusado');
RESET ROLE;
SELECT is((SELECT budget_brl FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k3)), 2000.00, 'Verba do C-level gravada na hora');
SELECT is((SELECT status FROM public.campaigns WHERE id = (SELECT (r->>'id')::uuid FROM k3)), 'ativa', 'Status gravado');

-- Isolamento
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*) FROM public.campaigns), 0::bigint, 'Grão Norte não enxerga campanha da Evolut');
SELECT throws_ok($$ SELECT public.campaign_set_status('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT (r->>'id')::uuid FROM k3), 'pausada') $$, '42501', NULL, 'Campanha de outro cliente não é encontrada');
SELECT throws_ok($$ SELECT public.campaign_set_budget('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', (SELECT (r->>'id')::uuid FROM k3), 1) $$, '42501', NULL, 'Nem a verba');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
