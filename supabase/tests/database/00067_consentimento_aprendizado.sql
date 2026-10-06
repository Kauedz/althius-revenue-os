-- ==============================================================================
-- Test: 00067_consentimento_aprendizado.sql
-- Consentimento do cliente para o aprendizado compartilhado entre contas (ADR 0052): começa DESLIGADO, só o C-level do
-- workspace decide, o aviso aparece uma vez, tudo fica na auditoria e um workspace nunca mexe no outro.
-- Seed: Evolut a0..01: Aline C-level (d..03/e..03), Camila estrategista (d..02/e..02), Lucas BDR (d..04/e..04).
--       Grão Norte b0..01: Eduardo C-level (d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('authenticated', 'public.learning_consent_get(uuid, uuid)', 'EXECUTE'), 'Tela lê o consentimento');
SELECT ok(has_function_privilege('authenticated', 'public.learning_consent_set(uuid, uuid, boolean)', 'EXECUTE'), 'Tela grava o consentimento');
SELECT ok(has_function_privilege('authenticated', 'public.learning_consent_popup_visto(uuid, uuid)', 'EXECUTE'), 'Tela marca o aviso como visto');
SELECT ok(NOT has_function_privilege('anon', 'public.learning_consent_get(uuid, uuid)', 'EXECUTE'), 'Visitante não lê');
SELECT ok(NOT has_function_privilege('anon', 'public.learning_consent_set(uuid, uuid, boolean)', 'EXECUTE'), 'Visitante não grava');
SELECT ok(NOT has_table_privilege('authenticated', 'public.learning_consent', 'SELECT'), 'Tabela fechada para usuário');
SELECT ok(NOT has_table_privilege('anon', 'public.learning_consent', 'SELECT'), 'Tabela fechada para visitante');
SELECT ok(has_function_privilege('service_role', 'internal.learning_workspaces_aceitos()', 'EXECUTE'), 'O motor de aprendizado (sistema) lê quem aceitou');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.learning_workspaces_aceitos()', 'EXECUTE'), 'Usuário não lista quem aceitou');

-- Aline (C-level da Evolut): começa desligado, pode decidir, aviso ainda não visto
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'),
  '{"aceito": false, "popup_visto": false, "pode_decidir": true}'::jsonb, 'Começa desligado, aviso por ver, C-level pode decidir');
SELECT is(public.learning_consent_popup_visto('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'), true, 'Primeira vez que o aviso é mostrado');
SELECT is(public.learning_consent_popup_visto('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'), false, 'Segunda vez: não é mais a primeira (o aviso aparece uma vez só)');
SELECT is((public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'))->>'aceito', 'false', 'Ver o aviso NÃO liga o compartilhamento');
SELECT is(public.learning_consent_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', true), true, 'C-level aceita');
SELECT is(public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'),
  '{"aceito": true, "popup_visto": true, "pode_decidir": true}'::jsonb, 'Aceito e aviso marcado como visto');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'learning.consent_set'), 1, 'A decisão fica na auditoria');
SELECT is((SELECT new_values->>'aceito' FROM public.audit_logs WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND action = 'learning.consent_set' ORDER BY seq DESC LIMIT 1), 'true', 'Auditoria diz o que foi decidido');
SELECT is((SELECT count(*)::int FROM internal.learning_workspaces_aceitos()), 1, 'O sistema vê um workspace que aceitou');
SELECT is((SELECT workspace_id FROM internal.learning_workspaces_aceitos()), 'a0000000-0000-0000-0000-000000000001'::uuid, 'O da Evolut');

-- Grão Norte não é afetado pela Evolut, e decide por conta própria
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((public.learning_consent_get('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009'))->>'aceito', 'false', 'Outro cliente segue desligado');
SELECT throws_ok($$SELECT public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009')$$, '42501', NULL, 'Eduardo não lê o da Evolut (workspace errado)');
SELECT throws_ok($$SELECT public.learning_consent_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', false)$$, '42501', NULL, 'Eduardo não muda o da Evolut');
SELECT throws_ok($$SELECT public.learning_consent_set('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', true)$$, '42501', NULL, 'Usar o membro de outra pessoa é recusado');

-- Estrategista e BDR leem, mas não decidem
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002'),
  '{"aceito": true, "popup_visto": true, "pode_decidir": false}'::jsonb, 'Estrategista vê o estado, mas não decide');
SELECT throws_ok($$SELECT public.learning_consent_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', false)$$, '42501', NULL, 'Estrategista não muda');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.learning_consent_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', false)$$, '42501', NULL, 'BDR não muda');
SELECT is(public.learning_consent_popup_visto('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004'), false, 'BDR nunca "gasta" o aviso do C-level');

-- C-level troca de ideia: desliga
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.learning_consent_set('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', false), true, 'C-level desliga');
SELECT is((public.learning_consent_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003'))->>'aceito', 'false', 'Desligado de verdade');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM internal.learning_workspaces_aceitos()), 0, 'Quem desligou sai da lista do motor na hora');

SELECT * FROM finish();
ROLLBACK;
