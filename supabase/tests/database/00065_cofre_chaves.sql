-- ==============================================================================
-- Test: 00065_cofre_chaves.sql
-- Cofre de chaves do superadmin: guarda só texto cifrado, lista só máscara, N chaves da Apify, ninguém além do
-- superadmin (ou do sistema) mexe. Seed: Rafael (superadmin) e0..01; Aline (C-level Evolut) e0..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Permissões (ADR 0023)
SELECT ok(has_function_privilege('service_role', 'public.cofre_guardar(text, text, text, text, jsonb, uuid)', 'EXECUTE'), 'Sistema guarda chave');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cofre_guardar(text, text, text, text, jsonb, uuid)', 'EXECUTE'), 'Usuário logado não guarda chave direto');
SELECT ok(NOT has_function_privilege('anon', 'public.cofre_guardar(text, text, text, text, jsonb, uuid)', 'EXECUTE'), 'Visitante não guarda chave');
SELECT ok(has_function_privilege('service_role', 'public.cofre_ler(text)', 'EXECUTE'), 'Sistema lê o texto cifrado');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cofre_ler(text)', 'EXECUTE'), 'Usuário logado NÃO lê o texto cifrado');
SELECT ok(NOT has_function_privilege('anon', 'public.cofre_ler(text)', 'EXECUTE'), 'Visitante não lê o texto cifrado');
SELECT ok(has_function_privilege('authenticated', 'public.cofre_listar()', 'EXECUTE'), 'Tela lista (só máscara)');
SELECT ok(NOT has_function_privilege('anon', 'public.cofre_listar()', 'EXECUTE'), 'Visitante não lista');
SELECT ok(has_function_privilege('authenticated', 'public.cofre_conferir_superadmin()', 'EXECUTE'), 'Backend confere superadmin com o login da pessoa');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.cofre_segredos', 'SELECT'), 'Tabela do cofre fechada para usuário');
SELECT ok(NOT has_table_privilege('anon', 'internal.cofre_segredos', 'SELECT'), 'Tabela do cofre fechada para visitante');

-- Sistema guarda: várias chaves da Apify (sem limite de 5) e uma da Unipile
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 1', 'v1:aaa:bbb:ccc', '1111', '{}'::jsonb)$$, 'Guarda Apify 1');
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 2', 'v1:aaa:bbb:ccc', '2222', '{}'::jsonb)$$, 'Guarda Apify 2');
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 3', 'v1:aaa:bbb:ccc', '3333', '{}'::jsonb)$$, 'Guarda Apify 3');
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 4', 'v1:aaa:bbb:ccc', '4444', '{}'::jsonb)$$, 'Guarda Apify 4');
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 5', 'v1:aaa:bbb:ccc', '5555', '{}'::jsonb)$$, 'Guarda Apify 5');
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 6', 'v1:aaa:bbb:ccc', '6666', '{}'::jsonb)$$, 'Guarda Apify 6 (sem teto de 5)');
SELECT lives_ok($$SELECT public.cofre_guardar('unipile', 'Principal', 'v1:aaa:bbb:ccc', '9999', '{"url":"https://api.unipile.com"}'::jsonb)$$, 'Guarda Unipile');
SELECT is((SELECT count(*)::int FROM internal.cofre_segredos WHERE provedor = 'apify'), 6, 'Seis chaves da Apify guardadas');

-- Rótulo igual substitui (trocar a chave sem duplicar)
SELECT lives_ok($$SELECT public.cofre_guardar('apify', 'Conta 1', 'v1:novo:bbb:ccc', '7777', '{}'::jsonb, 'e0000000-0000-0000-0000-000000000001')$$, 'Troca a chave da Conta 1');
SELECT is((SELECT quem FROM internal.cofre_eventos WHERE acao = 'guardou' ORDER BY id DESC LIMIT 1), 'e0000000-0000-0000-0000-000000000001'::uuid, 'O registro diz quem trocou');
SELECT is((SELECT count(*)::int FROM internal.cofre_segredos WHERE provedor = 'apify'), 6, 'Trocar não duplica');
SELECT is((SELECT final FROM internal.cofre_segredos WHERE provedor = 'apify' AND rotulo = 'Conta 1'), '7777', 'Máscara acompanha a chave nova');

-- Entradas inválidas
SELECT throws_ok($$SELECT public.cofre_guardar('outro', 'x', 'v1:a:b:c', '1234', '{}'::jsonb)$$, '22023', NULL, 'Provedor desconhecido é recusado');
SELECT throws_ok($$SELECT public.cofre_guardar('apify', '', 'v1:a:b:c', '1234', '{}'::jsonb)$$, '22023', NULL, 'Rótulo vazio é recusado');
SELECT throws_ok($$SELECT public.cofre_guardar('apify', 'Texto puro', 'minha-chave-em-texto', '1234', '{}'::jsonb)$$, '22023', NULL, 'Texto que não veio cifrado é recusado');

-- Sistema lê o cifrado das ativas
SELECT is(jsonb_array_length(public.cofre_ler('apify')), 6, 'Sistema lê as 6 chaves da Apify');
SELECT ok((SELECT bool_and(e ? 'cifrado' AND e ? 'id' AND e ? 'rotulo') FROM jsonb_array_elements(public.cofre_ler('apify')) e), 'Cada item traz id, rótulo e cifrado');

-- Superadmin lista (só máscara) e mexe
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(public.cofre_conferir_superadmin(), 'e0000000-0000-0000-0000-000000000001'::uuid, 'Superadmin confere e o banco devolve quem é');
SELECT is(jsonb_array_length(public.cofre_listar()), 7, 'Superadmin lista as 7 chaves');
SELECT ok((SELECT NOT (public.cofre_listar()::text LIKE '%v1:%')), 'A lista NUNCA traz o texto cifrado');
SELECT ok((SELECT NOT (public.cofre_listar()::text ~* 'cifrado')), 'Nem o nome do campo cifrado');
SELECT is((SELECT e->>'final' FROM jsonb_array_elements(public.cofre_listar()) e WHERE e->>'rotulo' = 'Conta 2'), '2222', 'Traz só os 4 últimos');
CREATE TEMP TABLE alvo ON COMMIT DROP AS SELECT (e->>'id')::uuid AS id FROM jsonb_array_elements(public.cofre_listar()) e WHERE e->>'rotulo' = 'Conta 3';
GRANT SELECT ON alvo TO authenticated;
SELECT lives_ok($$SELECT public.cofre_alternar((SELECT id FROM alvo), false)$$, 'Superadmin desativa a Conta 3');
RESET ROLE;
SELECT is(jsonb_array_length(public.cofre_ler('apify')), 5, 'Desativada some da leitura do sistema');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT lives_ok($$SELECT public.cofre_remover((SELECT id FROM alvo))$$, 'Superadmin remove a Conta 3');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM internal.cofre_segredos WHERE provedor = 'apify'), 5, 'Removida de verdade');
SELECT ok((SELECT count(*) FROM internal.cofre_eventos WHERE acao IN ('guardou', 'desativou', 'removeu')) >= 3, 'Cada mudança fica registrada');
SELECT ok((SELECT NOT (string_agg(detalhe::text, ' ') ~ 'v1:') FROM internal.cofre_eventos), 'O registro nunca guarda segredo');

-- Quem não é superadmin não vê nem mexe
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.cofre_listar()$$, '42501', NULL, 'C-level não lista');
SELECT throws_ok($$SELECT public.cofre_conferir_superadmin()$$, '42501', NULL, 'C-level não passa na conferência');
SELECT throws_ok($$SELECT public.cofre_alternar('00000000-0000-0000-0000-000000000000', false)$$, '42501', NULL, 'C-level não desativa');
SELECT throws_ok($$SELECT public.cofre_remover('00000000-0000-0000-0000-000000000000')$$, '42501', NULL, 'C-level não remove');
SELECT throws_ok($$SELECT public.admin_providers()$$, '42501', NULL, 'C-level não vê fornecedores');

-- Tela de fornecedores mostra as chaves do cofre, sem segredo
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT ok((SELECT count(*) FROM jsonb_array_elements(public.admin_providers()) e WHERE e->>'tipo' = 'Coleta (Apify)') >= 5, 'Fornecedores lista as chaves da Apify do cofre');
SELECT ok((SELECT NOT (public.admin_providers()::text LIKE '%v1:%')), 'Fornecedores nunca mostra cifrado');
SELECT ok((SELECT bool_and(e->>'id' IS NOT NULL) FROM jsonb_array_elements(public.admin_providers()) e WHERE e->>'tipo' = 'Coleta (Apify)'), 'Cada chave do cofre vem com o id (a tela age sobre ele)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
