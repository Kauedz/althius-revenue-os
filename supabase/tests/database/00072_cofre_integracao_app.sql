-- ==============================================================================
-- Test: 00072_cofre_integracao_app.sql
-- O cofre também guarda o app que a Althius registra em cada fornecedor (ex.: o MCP Auth App do HubSpot): o ID do
-- cliente fica na configuração e o segredo só cifrado. Continua só o sistema lendo o texto cifrado.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT lives_ok($$SELECT public.cofre_guardar('integracao_app', 'hubspot', 'v1:aaa:bbb:ccc', 'wxyz', '{"client_id":"1b69203f-e24e-4bce-990e-c9471504ed73"}'::jsonb)$$, 'Guarda o app do HubSpot');
SELECT is((SELECT config->>'client_id' FROM internal.cofre_segredos WHERE provedor = 'integracao_app' AND rotulo = 'hubspot'), '1b69203f-e24e-4bce-990e-c9471504ed73', 'O ID do cliente fica na configuração');
SELECT is((SELECT final FROM internal.cofre_segredos WHERE provedor = 'integracao_app' AND rotulo = 'hubspot'), 'wxyz', 'Só os 4 últimos caracteres do segredo ficam à mostra');
SELECT is((SELECT (public.cofre_ler('integracao_app'))->0->>'rotulo'), 'hubspot', 'O sistema lê o app pelo nome da integração');
SELECT is((SELECT (public.cofre_ler('integracao_app'))->0->>'cifrado'), 'v1:aaa:bbb:ccc', 'E o segredo só sai cifrado');
SELECT lives_ok($$SELECT public.cofre_guardar('integracao_app', 'hubspot', 'v1:novo:bbb:ccc', 'abcd', '{"client_id":"novo-id"}'::jsonb)$$, 'Trocar o segredo do mesmo app não duplica');
SELECT is((SELECT count(*)::int FROM internal.cofre_segredos WHERE provedor = 'integracao_app'), 1, 'Continua um só');
SELECT throws_ok($$SELECT public.cofre_guardar('integracao_inventada', 'x', 'v1:a:b:c', '1234', '{}'::jsonb)$$, '22023', NULL, 'Tipo desconhecido segue recusado');
SELECT throws_ok($$SELECT public.cofre_guardar('integracao_app', 'hubspot', 'texto-puro', '1234', '{}'::jsonb)$$, '22023', NULL, 'Texto puro nunca entra');

-- A tela de Fornecedores mostra o app com o nome certo (não como "segredo do webhook") e sem segredo
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT e->>'tipo' FROM jsonb_array_elements(public.admin_providers()) e WHERE e->>'nome' = 'hubspot'), 'App de integração', 'Fornecedores mostra o app com o tipo certo');
SELECT ok((SELECT NOT (public.admin_providers()::text LIKE '%v1:%')), 'E nunca mostra o segredo cifrado');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
