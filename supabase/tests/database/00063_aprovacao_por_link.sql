-- ==============================================================================
-- Test: 00063_aprovacao_por_link.sql
-- Aprovação por link de uso único (PR 13). Aceite: link usado duas vezes, vencido, com conteúdo alterado e de outro
-- workspace são recusados. O banco guarda só o hash; gasto só o C-level decide; a decisão aplica os efeitos de sempre.
-- Seed: Evolut a0..01 (Camila estrategista d..02/e..02, Aline C-level d..03/e..03, Lucas BDR d..04);
--       Grão Norte b0..01 (C-level d..09).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Fixtures: uma campanha com verba na Evolut e duas aprovações de gasto (verba) pendentes, mais uma na Grão Norte.
INSERT INTO public.campaigns (id, workspace_id, name, channel_type, status, budget_brl, created_by) VALUES
  ('fb000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'Campanha do link', 'linkedin_ads', 'ativa', 1000, 'd0000000-0000-0000-0000-000000000002'),
  ('fb000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Campanha Grão Norte', 'meta_ads', 'ativa', 500, 'd0000000-0000-0000-0000-000000000008');

CREATE FUNCTION pg_temp.nova_aprovacao(p_id UUID, p_ws UUID, p_pedinte UUID, p_camp UUID, p_de INT, p_para INT, p_cat TEXT DEFAULT 'gasto') RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_p JSONB := jsonb_build_object('acao', 'verba_campanha', 'campaign_id', p_camp, 'campanha', 'x', 'canal', 'linkedin_ads', 'de', p_de, 'para', p_para);
BEGIN
  INSERT INTO public.approvals (id, workspace_id, category, approval_type, title, reason, impact, preview, requested_by_member_id, status, payload_json, payload_hash, estimated_credits)
  VALUES (p_id, p_ws, p_cat, CASE WHEN p_cat = 'gasto' THEN 'orcamento' ELSE 'execucao' END, 'Verba de mídia: teste', 'CPL abaixo da meta', 'Verba sobe', 'R$ 1.000 → R$ 5.000', p_pedinte, 'pendente', v_p,
          encode(extensions.digest(v_p::text, 'sha256'), 'hex'), 0);
END $$;
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 5000);
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 6000);
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 7000);
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 8000);
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 9000);
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a6', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 1000, 9500, 'operacao');
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000008', 'fb000000-0000-0000-0000-0000000000b1', 500, 900);

-- 1. Segurança: tabela fechada; emitir e revogar só do sistema; ver e decidir aceitam o token.
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.approval_links'::regclass), 'Links têm RLS ligada');
SELECT ok(NOT has_table_privilege('authenticated', 'public.approval_links', 'SELECT'), 'Usuário logado não lê os links');
SELECT ok(NOT has_table_privilege('anon', 'public.approval_links', 'SELECT'), 'Visitante não lê os links');
SELECT ok(NOT has_function_privilege('anon', 'public.approval_link_issue(uuid, uuid, integer)', 'EXECUTE'), 'Visitante não emite link');
SELECT ok(NOT has_function_privilege('authenticated', 'public.approval_link_issue(uuid, uuid, integer)', 'EXECUTE'), 'Usuário logado não emite link');
SELECT ok(NOT has_function_privilege('authenticated', 'public.approval_link_revoke(uuid)', 'EXECUTE'), 'Usuário logado não revoga link');
SELECT ok(has_function_privilege('service_role', 'public.approval_link_issue(uuid, uuid, integer)', 'EXECUTE'), 'Sistema emite link');
SELECT ok(has_function_privilege('anon', 'public.approval_link_decide(text, text, text)', 'EXECUTE'), 'Quem tem o token decide (exceção documentada)');
SELECT ok(NOT has_function_privilege('anon', 'internal.link_conferir(text, boolean)', 'EXECUTE'), 'A conferência interna é fechada');

-- 2. Emissão: recusas.
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000002')->>'status', 'decisor_invalido', 'Estrategista não recebe link de GASTO');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000004')->>'status', 'decisor_invalido', 'BDR não recebe link');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000009')->>'status', 'decisor_invalido', 'C-level de OUTRO workspace não recebe link');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000003')->>'status', 'decisor_invalido', 'C-level da Evolut não recebe link de aprovação da Grão Norte');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 1)->>'status', 'prazo_invalido', 'Prazo menor que 5 minutos é recusado');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 1441)->>'status', 'prazo_invalido', 'Prazo maior que 24 horas é recusado');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-00000000dead', 'd0000000-0000-0000-0000-000000000003')->>'status', 'aprovacao_inexistente', 'Aprovação inexistente é recusada');
SELECT is((SELECT count(*)::int FROM public.approval_links), 0, 'Recusas não criam link');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a6', 'd0000000-0000-0000-0000-000000000002')->>'ok', 'true', 'Operação: a estrategista pode receber link');

-- 3. Emissão válida: o banco guarda só o hash.
CREATE TEMP TABLE e1 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 60) AS r;
GRANT SELECT ON e1 TO anon, authenticated;
SELECT is((SELECT r->>'ok' FROM e1), 'true', 'C-level recebe o link');
SELECT ok((SELECT r->>'token' LIKE 'alt_aprov_%' AND length(r->>'token') >= 60 FROM e1), 'Token tem prefixo reconhecível e é longo');
SELECT is((SELECT count(*)::int FROM public.approval_links WHERE token_hash = encode(extensions.digest((SELECT r->>'token' FROM e1), 'sha256'), 'hex')), 1, 'O banco guarda o hash do token');
SELECT is((SELECT count(*)::int FROM public.approval_links WHERE to_jsonb(approval_links)::text LIKE '%' || (SELECT r->>'token' FROM e1) || '%'), 0, 'O token em texto não está em nenhuma coluna');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'approval.link_issued' AND entity_id = 'fc000000-0000-0000-0000-0000000000a1'), 'Emissão fica na auditoria (sem o token)');
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE to_jsonb(audit_logs)::text LIKE '%' || (SELECT r->>'token' FROM e1) || '%'), 0, 'O token não vai para a auditoria');

-- 4. Ver pelo link (sem login): só o necessário; nada vaza.
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_preview(r->>'token')->>'titulo' FROM e1), 'Verba de mídia: teste', 'Quem tem o link vê o pedido');
SELECT ok((SELECT NOT (public.approval_link_preview(r->>'token') ?| ARRAY['payload_json', 'workspace_id', 'id', 'approval_id', 'decider_member_id']) FROM e1), 'A visão não traz ids nem o conteúdo bruto');
SELECT is(public.approval_link_preview('alt_aprov_inventado_inventado_inventado')->>'status', 'invalid', 'Token inventado: inválido');
SELECT is(public.approval_link_preview('')->>'status', 'invalid', 'Token vazio: inválido');
SELECT is(public.approval_link_preview(NULL)->>'status', 'invalid', 'Token nulo: inválido');
SELECT is(public.approval_link_decide('alt_aprov_inventado_inventado_inventado', 'aprovado')->>'status', 'invalid', 'Decidir com token inventado: inválido');
SELECT is((SELECT public.approval_link_decide(r->>'token', 'talvez')->>'status' FROM e1), 'invalid_decision', 'Decisão inválida é recusada');
SELECT is((SELECT public.approval_link_preview(r->>'token')->>'ok' FROM e1), 'true', 'Decisão inválida não gasta o link');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a1'), 'pendente', 'Ver o link não muda a aprovação');
SET LOCAL ROLE anon;

-- 5. Decidir: aprovar aplica o efeito de sempre (verba), uma vez só.
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado', 'Pelo celular')->>'ok' FROM e1), 'true', 'C-level aprova pelo link, sem login');
RESET ROLE;
SELECT results_eq($$ SELECT status, decided_by_member_id::text FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a1' $$,
  $$ VALUES ('aprovado'::text, 'd0000000-0000-0000-0000-000000000003'::text) $$, 'A aprovação fica decidida pelo C-level do link');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fb000000-0000-0000-0000-0000000000a1'), 5000, 'O efeito é aplicado (verba da campanha)');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'approval.link_used' AND entity_id = 'fc000000-0000-0000-0000-0000000000a1'), 'Uso do link fica na auditoria');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'approval.decided' AND entity_id = 'fc000000-0000-0000-0000-0000000000a1'), 'E a decisão também (mesma função da tela)');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications WHERE entity_id = 'fc000000-0000-0000-0000-0000000000a1' AND type = 'approval_granted'), 'Quem pediu é avisado');
SELECT results_eq($$ SELECT decision, used_at IS NOT NULL FROM public.approval_links WHERE id = (SELECT (r->>'link_id')::uuid FROM e1) $$, $$ VALUES ('aprovado'::text, true) $$, 'O link fica marcado como usado');

-- 6. ACEITE: usado duas vezes.
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e1), 'used', 'Link usado duas vezes: recusado');
SELECT is((SELECT public.approval_link_decide(r->>'token', 'rejeitado')->>'status' FROM e1), 'used', 'Mesmo trocando a decisão: recusado');
SELECT is((SELECT public.approval_link_preview(r->>'token')->>'status' FROM e1), 'used', 'E a visão também diz que já foi usado');
RESET ROLE;
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fb000000-0000-0000-0000-0000000000a1'), 5000, 'A segunda tentativa não muda nada');

-- 7. ACEITE: vencido.
CREATE TEMP TABLE e2 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000003', 10) AS r;
GRANT SELECT ON e2 TO anon;
UPDATE public.approval_links SET expires_at = now() - interval '1 second' WHERE id = (SELECT (r->>'link_id')::uuid FROM e2);
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e2), 'expired', 'Link vencido: recusado');
SELECT is((SELECT public.approval_link_preview(r->>'token')->>'status' FROM e2), 'expired', 'E a visão também');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a2'), 'pendente', 'Vencido: a aprovação segue pendente');

-- 8. ACEITE: conteúdo alterado depois da emissão.
CREATE TEMP TABLE e3 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e3 TO anon;
UPDATE public.approvals SET payload_json = jsonb_set(payload_json, '{para}', '99999') WHERE id = 'fc000000-0000-0000-0000-0000000000a3';
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e3), 'content_changed', 'Conteúdo alterado: link recusado');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a3'), 'pendente', 'Conteúdo alterado: nada é aprovado');
SELECT is((SELECT revoked_reason FROM public.approval_links WHERE id = (SELECT (r->>'link_id')::uuid FROM e3)), 'conteudo_alterado', 'O link morre por conteúdo alterado');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'approval.link_content_changed' AND entity_id = 'fc000000-0000-0000-0000-0000000000a3'), 'A tentativa fica na auditoria');
-- Mesmo que o hash da aprovação seja refeito com o conteúdo novo, o link guarda o hash da emissão.
CREATE TEMP TABLE e3b ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a4', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e3b TO anon;
UPDATE public.approvals SET payload_json = jsonb_set(payload_json, '{para}', '77777'),
  payload_hash = encode(extensions.digest(jsonb_set(payload_json, '{para}', '77777')::text, 'sha256'), 'hex') WHERE id = 'fc000000-0000-0000-0000-0000000000a4';
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e3b), 'content_changed', 'Conteúdo e hash refeitos depois do link: o link emitido antes não vale');
RESET ROLE;
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fb000000-0000-0000-0000-0000000000a1'), 5000, 'A verba continua a aprovada antes');

-- 9. ACEITE: outro workspace. O link é de UMA aprovação; usar o da Evolut não toca a da Grão Norte.
CREATE TEMP TABLE e4 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a5', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e4 TO anon;
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'ok' FROM e4), 'true', 'Link da Evolut decide a aprovação da Evolut');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000b1'), 'pendente', 'A aprovação da Grão Norte não é tocada');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fb000000-0000-0000-0000-0000000000b1'), 500, 'CANÁRIO: a campanha da Grão Norte não muda');
-- Decisor que mudou de workspace/papel depois da emissão.
CREATE TEMP TABLE e5 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000009') AS r;
GRANT SELECT ON e5 TO anon;
UPDATE public.workspace_members SET status = 'suspended' WHERE id = 'd0000000-0000-0000-0000-000000000009';
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e5), 'decider_invalid', 'Decisor suspenso depois da emissão: link recusado');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000b1'), 'pendente', 'Decisor suspenso: nada é aprovado');
UPDATE public.workspace_members SET status = 'active' WHERE id = 'd0000000-0000-0000-0000-000000000009';

-- 10. Decidida por outro caminho (tela): os links que sobram morrem.
CREATE TEMP TABLE e6 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000009') AS r;
GRANT SELECT ON e6 TO anon;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(public.approval_decide('fc000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000009', 'rejeitado',
  (SELECT payload_json FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000b1'))->>'success', 'true', 'C-level decide pela tela');
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e6), 'revoked', 'O link de uma aprovação já decidida pela tela está revogado');
RESET ROLE;

-- Quem está logado com OUTRA conta no navegador também decide só pelo token (o link vale pelo token, não pelo login).
SELECT pg_temp.nova_aprovacao('fc000000-0000-0000-0000-0000000000a7', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-0000000000a1', 5000, 5500);
CREATE TEMP TABLE e9 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a7', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e9 TO authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET LOCAL ROLE authenticated;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'ok' FROM e9), 'true', 'Logado com outra conta: o link decide pelo token, sem erro');
SELECT ok(current_setting('request.jwt.claims', true) LIKE '%e0000000-0000-0000-0000-000000000002%', 'O login do navegador é devolvido como estava');
RESET ROLE;
SELECT is((SELECT decided_by_member_id::text FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a7'), 'd0000000-0000-0000-0000-000000000003', 'Quem decidiu foi o C-level do link, não quem estava logado');

-- 11. Rejeitar pelo link; limite de links ativos; revogar pelo sistema.
CREATE TEMP TABLE e7 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a6', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e7 TO anon;
SELECT is(public.approval_link_revoke('fc000000-0000-0000-0000-0000000000a6'), 2, 'Sistema revoga os links ativos da aprovação');
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'aprovado')->>'status' FROM e7), 'revoked', 'Link revogado: recusado');
RESET ROLE;
CREATE TEMP TABLE e8 ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a6', 'd0000000-0000-0000-0000-000000000003') AS r;
GRANT SELECT ON e8 TO anon;
SET LOCAL ROLE anon;
SELECT is((SELECT public.approval_link_decide(r->>'token', 'rejeitado', 'Não agora')->>'ok' FROM e8), 'true', 'Rejeitar pelo link também vale');
RESET ROLE;
SELECT is((SELECT status FROM public.approvals WHERE id = 'fc000000-0000-0000-0000-0000000000a6'), 'rejeitado', 'Aprovação rejeitada');
SELECT is((SELECT budget_brl::int FROM public.campaigns WHERE id = 'fb000000-0000-0000-0000-0000000000a1'), 5500, 'Rejeitada: a verba não muda (fica a da última aprovada)');

-- Limite de 5 links ativos por aprovação.
CREATE TEMP TABLE lim ON COMMIT DROP AS SELECT public.approval_link_issue('fc000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000003') AS r FROM generate_series(1, 5);
SELECT is((SELECT count(*)::int FROM lim WHERE r->>'ok' = 'true'), 5, 'Cinco links ativos cabem');
SELECT is(public.approval_link_issue('fc000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000003')->>'status', 'links_demais', 'O sexto é recusado');

SELECT * FROM finish();
ROLLBACK;
