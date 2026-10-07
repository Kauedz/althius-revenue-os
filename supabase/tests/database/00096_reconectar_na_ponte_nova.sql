-- ==============================================================================
-- Test: 00096_reconectar_na_ponte_nova.sql
-- ADR 0071. Troca de ponte: a conta que a ponte nova não conhece fica "desconectada" (e o dono é avisado); o botão Conectar então
-- pede uma conexão NOVA (não "reconectar" um id que a ponte nova nunca viu), e o registro e o histórico são os mesmos.
-- Seed: Evolut a0..01 — Lucas BDR d..04/e..04 (conta LinkedIn ca5..02 = demo-lucas-linkedin, conversa c5..01).
-- ==============================================================================

BEGIN;
SELECT no_plan();

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;
CREATE TEMP TABLE antes ON COMMIT DROP AS SELECT (SELECT count(*)::int FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001') AS msgs;

-- Conectada: "Conectar" de novo é reconexão (a ponte conhece o id)
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin')->>'type'), 'reconnect', 'Conta conectada: o pedido é de reconexão');
SELECT is((public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin')->>'reconnect_account_id'), 'demo-lucas-linkedin', 'Com o id que a ponte conhece');
RESET ROLE;

-- A ponte nova não conhece a conta: a sincronia marca desconectada e o dono é avisado
SELECT is((public.unipile_set_account_status('demo-lucas-linkedin', 'disconnected')->>'action'), 'updated', 'A sincronia marca a conta como desconectada');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications WHERE recipient_member_id = 'd0000000-0000-0000-0000-000000000004' AND type = 'conexao_atencao'), 'O dono é avisado para reconectar');

-- Desconectada: o botão pede conexão NOVA (sem id antigo)
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE pedido ON COMMIT DROP AS SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin') AS p;
GRANT SELECT ON pedido TO PUBLIC;
SELECT is((SELECT p->>'type' FROM pedido), 'create', 'Conta desconectada: o pedido é de conexão nova');
SELECT ok((SELECT p->'reconnect_account_id' = 'null'::jsonb FROM pedido), 'Sem o id antigo (a ponte nova nunca o viu)');
RESET ROLE;

-- A ponte nova avisa a conta nova: o MESMO registro, o mesmo histórico, conectada de novo
SELECT is((public.unipile_complete_connection((SELECT (p->>'request_id')::uuid FROM pedido), 'conta-na-ponte-nova', NULL)->>'action'), 'connected', 'Conexão concluída com a conta da ponte nova');
SELECT is((SELECT unipile_account_id || '/' || status FROM public.messaging_accounts WHERE id = 'ca500000-0000-0000-0000-000000000002'), 'conta-na-ponte-nova/connected', 'O mesmo registro, agora na ponte nova e conectado');
SELECT is((SELECT count(*)::int FROM public.messaging_accounts WHERE member_id = 'd0000000-0000-0000-0000-000000000004' AND provider = 'linkedin'), 1, 'Nenhum registro duplicado');
SELECT is((SELECT count(*)::int FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001'), (SELECT msgs FROM antes), 'O histórico da conversa não mudou');
SELECT is((SELECT messaging_account_id::text FROM public.conversations WHERE id = 'c5000000-0000-0000-0000-000000000001'), 'ca500000-0000-0000-0000-000000000002', 'A conversa continua presa ao registro nosso');

-- Quem pede por outra pessoa continua barrado
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000006');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.messaging_connect_start('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin') $$, '42501', NULL, 'BDR não conecta em nome de outra pessoa');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
