-- ==============================================================================
-- Test: 00038_admin_pages.sql
-- Seam: telas do Superadmin só leitura (admin_usage, admin_providers, admin_margins, admin_audit, admin_health).
-- Só o superadmin; fornecedores NUNCA devolvem chave, token, DSN ou segredo.
-- Seed: Rafael superadmin e..01; Aline C-level e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();
-- Guarda o valor de uma chave real (lido como dono do banco) para provar que ele não vaza.
CREATE TEMP TABLE segredo ON COMMIT DROP AS SELECT api_token FROM internal.apify_provider_accounts LIMIT 1;
GRANT SELECT ON segredo TO authenticated;
CREATE TEMP TABLE margens ON COMMIT DROP AS SELECT count(*)::int AS n FROM internal.pricing_multipliers;
GRANT SELECT ON margens TO authenticated;
-- Evento mais recente da auditoria (gravado pelo sistema).
INSERT INTO public.audit_logs (workspace_id, actor_role, action, entity_type, new_values, created_at)
VALUES ('a0000000-0000-0000-0000-000000000001', 'system', 'teste.auditoria', 'teste', '{}', now() + interval '1 second');
SET LOCAL ROLE authenticated;

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.admin_usage() $$, '42501', NULL, 'C-level não vê o uso global');
SELECT throws_ok($$ SELECT public.admin_providers() $$, '42501', NULL, 'C-level não vê fornecedores');
SELECT throws_ok($$ SELECT public.admin_margins() $$, '42501', NULL, 'C-level não vê margens');
SELECT throws_ok($$ SELECT public.admin_audit(50) $$, '42501', NULL, 'C-level não vê a auditoria global');
SELECT throws_ok($$ SELECT public.admin_health() $$, '42501', NULL, 'C-level não vê a saúde da plataforma');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Uso global: uma linha por cliente, com consumo do ciclo e execuções do mês.
SELECT is((SELECT count(*)::int FROM jsonb_array_elements(public.admin_usage()) x WHERE x->>'nome' IN ('Evolut Trading', 'Grão Norte Alimentos', 'Vértice Indústria')), 3, 'Uso global traz os 3 clientes do seed');
SELECT ok((SELECT u ?& ARRAY['nome', 'consumido', 'saldo', 'execucoes_mes', 'ultimo_uso'] FROM jsonb_array_elements(public.admin_usage()) u LIMIT 1),
  'Cada cliente traz consumo, saldo, execuções e último uso');

-- Fornecedores: sem segredo nenhum.
SELECT ok(jsonb_array_length(public.admin_providers()) >= 5, 'Fornecedores lista as contas do Apify e o modelo do Hermes');
SELECT ok(public.admin_providers()::text !~* '(api_token|api_key|dsn|webhook_secret|encrypted)', 'Nenhum campo secreto é devolvido');
SELECT ok(public.admin_providers()::text NOT LIKE '%' || (SELECT api_token FROM segredo) || '%', 'O valor da chave do Apify não aparece');

-- Margens.
SELECT is(jsonb_array_length(public.admin_margins()), (SELECT n FROM margens), 'Margens traz todas as capacidades precificadas');

-- Auditoria global: mais recente primeiro, com cliente e ação.
SELECT is((public.admin_audit(10)->0)->>'acao', 'teste.auditoria', 'Auditoria começa pelo evento mais recente');
SELECT is((public.admin_audit(10)->0)->>'cliente', 'Evolut Trading', 'Evento mostra o cliente');
SELECT ok(jsonb_array_length(public.admin_audit(2)) <= 2, 'Limite de linhas respeitado');

-- Saúde: lista de verificações com situação.
SELECT ok((SELECT bool_and(h->>'status' IN ('OK', 'Atenção', 'Falha')) FROM jsonb_array_elements(public.admin_health()) h), 'Cada verificação tem situação OK, Atenção ou Falha');
SELECT ok((SELECT count(*) FROM jsonb_array_elements(public.admin_health()) h WHERE h->>'nome' = 'Convites aguardando envio') = 1, 'Saúde mostra convites aguardando o conector de e-mail');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
