-- ==============================================================================
-- Test: 00071_integracoes.sql
-- Mecanismo genérico das integrações (spec .scratch/conexoes-funcionais, ticket 01): só quem tem `integrations.connect`
-- conecta; a tentativa de conexão vale uma vez e tem prazo; o acesso é da pessoa e nenhuma outra o lê; o primeiro acesso
-- fixa o portal; retirar a integração não apaga conta nem contato; nada vaza entre workspaces.
-- Seed: Evolut a0..01 (clevel d..03/e..03 e d..05/e..05, estrategista d..02/e..02, bdr d..04/e..04 e d..06/e..06);
--       Grão Norte b0..01 (clevel d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões (ADR 0023): funções de sistema só para service_role; as de tela, só para quem está logado.
SELECT ok(has_function_privilege('authenticated', 'public.integration_conferir(uuid)', 'EXECUTE'), 'Usuário logado confere se pode conectar');
SELECT ok(NOT has_function_privilege('anon', 'public.integration_conferir(uuid)', 'EXECUTE'), 'Visitante não');
SELECT ok(has_function_privilege('authenticated', 'public.integration_estado(uuid)', 'EXECUTE'), 'Usuário logado vê o estado das integrações');
SELECT ok(NOT has_function_privilege('anon', 'public.integration_estado(uuid)', 'EXECUTE'), 'Visitante não vê');
SELECT ok(has_function_privilege('service_role', 'public.integration_attempt_start(uuid, uuid, text, text, text, text, text, text, integer)', 'EXECUTE'), 'Sistema abre a tentativa');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_attempt_start(uuid, uuid, text, text, text, text, text, text, integer)', 'EXECUTE'), 'Usuário logado não abre tentativa direto');
SELECT ok(has_function_privilege('service_role', 'public.integration_attempt_consume(text)', 'EXECUTE'), 'Sistema consome a tentativa');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_attempt_consume(text)', 'EXECUTE'), 'Usuário logado não consome tentativa');
SELECT ok(has_function_privilege('service_role', 'public.integration_access_save(uuid, uuid, text, text, text, text, text, timestamptz, text, text, text)', 'EXECUTE'), 'Sistema guarda o acesso');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_access_save(uuid, uuid, text, text, text, text, text, timestamptz, text, text, text)', 'EXECUTE'), 'Usuário logado não guarda acesso');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_access_get(uuid, uuid, text)', 'EXECUTE'), 'Usuário logado não lê o acesso (token)');
SELECT ok(NOT has_function_privilege('anon', 'public.integration_access_get(uuid, uuid, text)', 'EXECUTE'), 'Visitante não lê o acesso');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_withdraw(uuid, uuid, text)', 'EXECUTE'), 'Usuário logado não retira direto');
SELECT ok(NOT has_function_privilege('authenticated', 'public.integration_oauth_client_save(text, text, text, text, text)', 'EXECUTE'), 'Usuário logado não grava cliente OAuth');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.integration_accesses', 'SELECT'), 'Acessos (tokens) não são lidos por usuário');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.integration_attempts', 'SELECT'), 'Tentativas não são lidas por usuário');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.integration_oauth_clients', 'SELECT'), 'Clientes OAuth não são lidos por usuário');
SELECT ok(NOT has_table_privilege('authenticated', 'public.workspace_integrations', 'INSERT'), 'Usuário logado não escreve direto nas integrações do workspace');

-- ---- Quem pode conectar: capacidade `integrations.connect` (superadmin, estrategista e C-level; BDR não).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.integration_conferir('a0000000-0000-0000-0000-000000000001'), 'd0000000-0000-0000-0000-000000000003'::uuid, 'C-level pode conectar e recebe o próprio membro');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.integration_conferir('a0000000-0000-0000-0000-000000000001'), 'd0000000-0000-0000-0000-000000000002'::uuid, 'Estrategista pode conectar');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.integration_conferir('a0000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'BDR não pode conectar');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.integration_conferir('a0000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'C-level de OUTRO cliente não conecta neste workspace');
RESET ROLE;

-- ---- Tentativa de conexão: uso único, com prazo, só enquanto a pessoa segue ativa.
SELECT public.integration_attempt_start('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'notion', 'estado-1', 'verificador-cifrado', 'https://app.test/retorno', 'cliente-1', 'https://emissor.test', 600);
SELECT is((public.integration_attempt_consume('estado-1'))->>'ok', 'true', 'O retorno com o estado certo é aceito');
SELECT is((public.integration_attempt_consume('estado-1'))->>'motivo', 'usada', 'Usar o mesmo retorno de novo é recusado');
SELECT is((public.integration_attempt_consume('estado-inventado'))->>'motivo', 'invalida', 'Retorno forjado (estado desconhecido) é recusado');
SELECT public.integration_attempt_start('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'notion', 'estado-2', 'v2', 'https://app.test/retorno', 'cliente-1', 'https://emissor.test', 600);
UPDATE internal.integration_attempts SET expires_at = now() - interval '1 minute' WHERE state_hash = encode(digest('estado-2', 'sha256'), 'hex');
SELECT is((public.integration_attempt_consume('estado-2'))->>'motivo', 'expirada', 'Retorno fora do prazo é recusado');
SELECT public.integration_attempt_start('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'notion', 'estado-3', 'v3', 'https://app.test/retorno', 'cliente-1', 'https://emissor.test', 600);
UPDATE public.workspace_members SET status = 'suspended' WHERE id = 'd0000000-0000-0000-0000-000000000003';
SELECT is((public.integration_attempt_consume('estado-3'))->>'motivo', 'participacao_inativa', 'Quem saiu do workspace não conclui a conexão');
UPDATE public.workspace_members SET status = 'active' WHERE id = 'd0000000-0000-0000-0000-000000000003';
SELECT throws_ok($$SELECT public.integration_attempt_start('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'notion', 'estado-bdr', 'v', 'https://app.test/retorno', 'c', 'https://e.test', 600)$$, '42501', NULL, 'BDR não abre tentativa nem pelo sistema (a capacidade é conferida de novo)');
SELECT ok((SELECT NOT EXISTS (SELECT 1 FROM internal.integration_attempts WHERE state_hash = 'estado-1')), 'O estado não é guardado em texto, só o resumo');

-- ---- Acesso: o primeiro fixa o portal; outro portal é recusado; o token só volta cifrado e só para o dono.
SELECT is((public.integration_access_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot', 'aline@evolut.test', 'portal-111', 'acesso-cifrado-A', 'refresh-cifrado-A', now() + interval '30 minutes', 'cliente-1', 'https://emissor.test', 'crm.read'))->>'ok', 'true', 'Primeiro acesso guardado');
SELECT is((SELECT portal FROM public.workspace_integrations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND integration_id = 'hubspot'), 'portal-111', 'O primeiro acesso fixou o portal do workspace');
SELECT is((public.integration_access_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'hubspot', 'camila@evolut.test', 'portal-111', 'acesso-cifrado-B', 'refresh-cifrado-B', now() + interval '30 minutes', 'cliente-1', 'https://emissor.test', 'crm.read'))->>'ok', 'true', 'Outro participante, mesmo portal: aceito');
SELECT is((public.integration_access_save('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'hubspot', 'outro@evolut.test', 'portal-999', 'acesso-cifrado-C', NULL, NULL, 'cliente-1', 'https://emissor.test', NULL))->>'motivo', 'portal_diferente', 'Conta de outro portal é recusada');
SELECT is((SELECT count(*)::int FROM internal.integration_accesses WHERE integration_id = 'hubspot'), 2, 'E o acesso recusado não foi guardado');
SELECT is((public.integration_access_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot'))->>'access_cifrado', 'acesso-cifrado-A', 'O dono lê o próprio acesso (cifrado)');
SELECT is((public.integration_access_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'hubspot')), NULL::jsonb, 'Quem não conectou não recebe o acesso de ninguém');
UPDATE public.workspace_members SET status = 'suspended' WHERE id = 'd0000000-0000-0000-0000-000000000002';
SELECT is((public.integration_access_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'hubspot')), NULL::jsonb, 'Quem saiu do workspace tem o acesso parado (nunca usado)');
UPDATE public.workspace_members SET status = 'active' WHERE id = 'd0000000-0000-0000-0000-000000000002';

-- Renovar e marcar.
SELECT public.integration_access_refresh('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot', 'acesso-novo', 'refresh-novo', now() + interval '1 hour');
SELECT is((public.integration_access_get('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot'))->>'refresh_cifrado', 'refresh-novo', 'O token renovado fica guardado');
SELECT public.integration_access_mark('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot', 'precisa_reconectar');
SELECT is((SELECT estado FROM internal.integration_accesses WHERE member_id = 'd0000000-0000-0000-0000-000000000003' AND integration_id = 'hubspot'), 'precisa_reconectar', 'Acesso recusado pelo app vira "precisa reconectar"');

-- ---- O que a tela vê: o próprio estado e quantos conectaram; nunca a conta nem o token de outro.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
CREATE TEMP TABLE estado ON COMMIT DROP AS SELECT public.integration_estado('a0000000-0000-0000-0000-000000000001') AS x;
SELECT is((SELECT e->>'meu_estado' FROM estado, jsonb_array_elements(x) e WHERE e->>'integracao' = 'hubspot'), 'conectado', 'A estrategista vê o próprio acesso como conectado');
SELECT is((SELECT e->>'minha_conta' FROM estado, jsonb_array_elements(x) e WHERE e->>'integracao' = 'hubspot'), 'camila@evolut.test', 'E a própria conta do app');
SELECT is((SELECT (e->>'conectados')::int FROM estado, jsonb_array_elements(x) e WHERE e->>'integracao' = 'hubspot'), 1, 'Conta só quem está conectado agora (o outro precisa reconectar)');
SELECT ok((SELECT NOT (x::text LIKE '%aline@evolut.test%' OR x::text LIKE '%cifrado%' OR x::text LIKE '%acesso-novo%') FROM estado), 'Nada do acesso de outra pessoa nem token aparece');
SELECT is((SELECT count(*)::int FROM public.workspace_integrations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'O membro vê que o HubSpot está habilitado no workspace');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT throws_ok($$SELECT public.integration_estado('a0000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'Outro cliente não vê as integrações da Evolut');
SELECT is((SELECT count(*)::int FROM public.workspace_integrations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'E a tabela também não aparece para ele (RLS)');
RESET ROLE;

-- ---- Cliente OAuth do registro automático: um por (integração, emissor, retorno); o primeiro que chega vale.
SELECT is((public.integration_oauth_client_save('notion', 'https://emissor.test', 'https://app.test/retorno', 'client-A', 'segredo-cifrado'))->>'client_id', 'client-A', 'Cliente OAuth guardado');
SELECT is((public.integration_oauth_client_save('notion', 'https://emissor.test', 'https://app.test/retorno', 'client-B', NULL))->>'client_id', 'client-A', 'Registro concorrente: vale o que já estava guardado');
SELECT is((public.integration_oauth_client_get('notion', 'https://emissor.test', 'https://app.test/retorno'))->>'client_secret_cifrado', 'segredo-cifrado', 'Lido de volta cifrado');
SELECT is((public.integration_oauth_client_get('notion', 'https://outro.test', 'https://app.test/retorno')), NULL::jsonb, 'Outro emissor não herda o cliente');

-- ---- Desconectar é só do próprio acesso; retirar a integração apaga os acessos e NÃO apaga conta nem contato.
INSERT INTO public.accounts (workspace_id, name, domain) VALUES ('a0000000-0000-0000-0000-000000000001', 'CANARIO-INTEGRACAO', 'canario-integracao.test');
SELECT public.integration_disconnect('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot');
SELECT is((SELECT count(*)::int FROM internal.integration_accesses WHERE integration_id = 'hubspot'), 1, 'Desconectar tirou só o acesso da própria pessoa');
SELECT throws_ok($$SELECT public.integration_withdraw('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'hubspot')$$, '42501', NULL, 'BDR não retira a integração');
SELECT public.integration_withdraw('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'hubspot');
SELECT is((SELECT count(*)::int FROM internal.integration_accesses WHERE integration_id = 'hubspot'), 0, 'Retirar apagou todos os acessos');
SELECT is((SELECT count(*)::int FROM public.workspace_integrations WHERE integration_id = 'hubspot'), 0, 'E o portal deixou de estar fixado');
SELECT is((SELECT count(*)::int FROM public.accounts WHERE name = 'CANARIO-INTEGRACAO'), 1, 'Nenhuma conta foi apagada ao retirar a integração');

SELECT * FROM finish();
ROLLBACK;
