-- ==============================================================================
-- Test: 00087_copiloto_assistente.sql
-- Copiloto como assistente separado (spec .scratch/prospeccao-revenue, fatia 6; ADR 0068): conversa privada por pessoa,
-- respostas com números lidos do banco e encaminhamento ao agente certo. Não é agente da equipe, não gasta crédito, não
-- cria execução nem proposta. Sem modelo disponível, a resposta diz a verdade.
-- Seed: Evolut a0..01 (Camila d..02/e..02, Aline d..03/e..03, Lucas BDR d..04/e..04); Grão b0..01 (CEO d..09/e..07).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('authenticated', 'public.copilot_ask(uuid, uuid, text, text)', 'EXECUTE'), 'Tela pergunta ao Copiloto');
SELECT ok(NOT has_function_privilege('anon', 'public.copilot_ask(uuid, uuid, text, text)', 'EXECUTE'), 'Visitante não pergunta');
SELECT ok(NOT has_function_privilege('authenticated', 'public.copilot_next(integer)', 'EXECUTE'), 'Usuário logado não pega perguntas');
SELECT ok(has_function_privilege('service_role', 'public.copilot_next(integer)', 'EXECUTE'), 'Só o serviço pega perguntas');
SELECT ok(NOT has_function_privilege('authenticated', 'public.copilot_answer(uuid, text, text)', 'EXECUTE'), 'Usuário logado não escreve resposta');
SELECT ok(NOT has_function_privilege('authenticated', 'public.copilot_fail(uuid, text)', 'EXECUTE'), 'Usuário logado não marca falha');
SELECT ok(NOT has_table_privilege('authenticated', 'public.copilot_messages', 'INSERT'), 'Ninguém grava mensagem direto');

DELETE FROM public.copilot_messages;
CREATE TEMP TABLE antes ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM public.executions) AS execucoes, (SELECT count(*) FROM public.approvals) AS aprovacoes,
  (SELECT allowance_balance + topup_balance - reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') AS saldo;

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;

-- Camila pergunta (duas vezes a mesma chave = uma pergunta só)
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p1 ON COMMIT DROP AS SELECT public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Quantas contas temos?', 'k-cop-1') AS r;
SELECT is((SELECT r->>'ok' FROM p1), 'true', 'Pergunta registrada');
SELECT is((public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Quantas contas temos?', 'k-cop-1')->>'id'), (SELECT r->>'id' FROM p1), 'Mesma chave: mesma pergunta (não duplica)');
SELECT throws_ok($$ SELECT public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '   ', 'k-vazia') $$, '22023', NULL, 'Pergunta vazia é recusada');
SELECT is((SELECT count(*)::int FROM public.copilot_messages), 1, 'A pessoa vê a própria conversa');
RESET ROLE;

-- Outra pessoa do mesmo cliente não vê; outro cliente também não
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.copilot_messages), 0, 'PRIVADA: a C-level não vê a conversa da Camila');
SELECT throws_ok($$ SELECT public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'oi', 'k-x') $$, NULL, NULL, 'Ninguém pergunta em nome de outra pessoa');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000007');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.copilot_messages), 0, 'ISOLAMENTO: outro cliente não vê');
SELECT throws_ok($$ SELECT public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'oi', 'k-y') $$, '42501', NULL, 'ISOLAMENTO: membro da Grão não pergunta na Evolut');
RESET ROLE;

-- O serviço pega com os números lidos do banco e o histórico da pessoa
CREATE TEMP TABLE n1 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.copilot_next(5)) x;
SELECT is((SELECT count(*)::int FROM n1), 1, 'Uma pergunta na fila');
SELECT is((SELECT x->>'pergunta' FROM n1), 'Quantas contas temos?', 'Com o texto');
SELECT is((SELECT (x->'numeros'->>'contas_ativas')::int FROM n1),
  (SELECT count(*)::int FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND status = 'ativa'), 'Números lidos do banco (contas ativas)');
SELECT ok((SELECT x->'numeros' ? 'saldo_creditos' FROM n1), 'Estrategista vê o saldo de créditos');
SELECT is((SELECT x->>'papel' FROM n1), 'estrategista', 'Com o papel da pessoa');
SELECT ok((SELECT x::text !~* 'usd|dólar|dolar' FROM n1), 'Sem dólar');
SELECT is(jsonb_array_length(public.copilot_next(5)), 0, 'Não pega duas vezes');

-- Resposta com encaminhamento
SELECT is(public.copilot_answer((SELECT (x->>'id')::uuid FROM n1), 'Vocês têm 9 contas ativas. Para buscar empresas novas, fale com a Zoe.', 'comercial')->>'acao', 'respondida', 'Resposta gravada');
SELECT is((SELECT estado FROM public.copilot_messages WHERE id = (SELECT (x->>'id')::uuid FROM n1)), 'respondida', 'A pergunta fica respondida');
SELECT is((SELECT encaminhar_para FROM public.copilot_messages WHERE autor = 'copiloto'), 'comercial', 'Encaminha para a Zoe');
SELECT throws_ok($$ SELECT public.copilot_answer(gen_random_uuid(), 'x', 'quinto_agente') $$, '22023', NULL, 'Não existe quinto agente');

-- BDR: sem saldo nos números; falha diz a verdade
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p2 ON COMMIT DROP AS SELECT public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Quanto crédito temos?', 'k-cop-2') AS r;
RESET ROLE;
CREATE TEMP TABLE n2 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.copilot_next(5)) x;
SELECT ok(NOT (SELECT x->'numeros' ? 'saldo_creditos' FROM n2), 'BDR não recebe o saldo de créditos');
SELECT is(public.copilot_fail((SELECT (x->>'id')::uuid FROM n2), 'o modelo de IA não está configurado')->>'acao', 'falhou', 'Falha registrada');
SELECT is((SELECT texto FROM public.copilot_messages WHERE autor = 'copiloto' AND member_id = 'd0000000-0000-0000-0000-000000000004'),
  'Não consegui responder agora: o modelo de IA não está configurado.', 'A tela diz a verdade, sem resposta inventada');

-- Não é agente: não gasta crédito, não cria execução nem aprovação
SELECT is((SELECT count(*) FROM public.executions), (SELECT execucoes FROM antes), 'Não cria execução');
SELECT is((SELECT count(*) FROM public.approvals), (SELECT aprovacoes FROM antes), 'Não cria proposta');
SELECT is((SELECT allowance_balance + topup_balance - reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  (SELECT saldo FROM antes), 'Não gasta crédito');

-- Limite diário por pessoa
INSERT INTO public.copilot_messages (workspace_id, member_id, autor, texto, estado, chave)
SELECT 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'pessoa', 'p' || g, 'respondida', 'lim-' || g FROM generate_series(1, 100) g;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok((public.copilot_ask('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'mais uma', 'k-lim')->>'erro') ~ '100', 'Limite de 100 perguntas por dia por pessoa');
RESET ROLE;

-- O uso do modelo pelo Copiloto é registrado com o rótulo "copiloto" (não é agente)
SELECT lives_ok($$ SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'copiloto', 'x', 'y', 10, 5, NULL) $$, 'Uso do modelo pelo Copiloto é registrado');
SELECT throws_ok($$ SELECT public.llm_registrar_uso('a0000000-0000-0000-0000-000000000001', 'quinto', 'x', 'y', 10, 5, NULL) $$, '22023', NULL, 'Outro rótulo continua recusado');

SELECT * FROM finish();
ROLLBACK;
