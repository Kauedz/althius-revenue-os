-- ==============================================================================
-- Test: 00088_caixa_em_conversa.sql
-- Caixa de entrada em conversa (spec .scratch/prospeccao-revenue, fatia 7; ADR 0068): responder escolhendo a pessoa e o
-- canal, pelo CAMINHO DE ENVIO QUE JÁ EXISTE (política Hermes, crédito reservado como no envio da cadência, o mesmo
-- serviço `cadencia` envia, a mensagem entra na conversa). Só quem conectou a conta responde por ela; LinkedIn e
-- Instagram ainda não enviam por aqui; isolamento entre clientes.
-- Seed: Evolut a0..01 — Lucas BDR d..04/e..04 (contas: e-mail ca5..01, LinkedIn ca5..02, WhatsApp ca5..03);
--       Bruna BDR d..06 (e-mail ca5..04); Aline C-level d..03/e..03. Conversas: c5..01 (Serra Azul, LinkedIn, Lucas),
--       c5..02 (Delta Saúde, e-mail, Bruna), c5..03 (Serra Azul, e-mail, Lucas), c5..05 (Campo Belo, WhatsApp, Lucas).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('authenticated', 'public.inbox_reply(uuid, uuid, uuid, text, text, text)', 'EXECUTE'), 'Tela responde');
SELECT ok(NOT has_function_privilege('anon', 'public.inbox_reply(uuid, uuid, uuid, text, text, text)', 'EXECUTE'), 'Visitante não responde');
SELECT ok(NOT has_function_privilege('authenticated', 'public.inbox_reply_claim(integer)', 'EXECUTE'), 'Usuário logado não pega envios');
SELECT ok(has_function_privilege('service_role', 'public.inbox_reply_claim(integer)', 'EXECUTE'), 'Só o serviço pega envios');
SELECT ok(NOT has_function_privilege('authenticated', 'public.inbox_reply_finish(uuid, boolean, text, text, text)', 'EXECUTE'), 'Usuário logado não conclui envio');
SELECT ok(NOT has_table_privilege('authenticated', 'public.inbox_replies', 'INSERT'), 'Ninguém grava resposta direto');

INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';
UPDATE public.workspace_settings SET credit_mode = 'auto', approval_threshold = 500, monthly_credit_limit = 5000 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM public.inbox_replies;

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;

-- Lucas responde por e-mail ao Jonas (Serra Azul)
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000003', 'Combinado, Jonas. Mando o convite agora.', 'Re: nossa conversa', 'k-resp-1') AS r;
SELECT is((SELECT r->>'ok' FROM r1), 'true', 'Resposta pedida');
SELECT is((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000003', 'Combinado, Jonas. Mando o convite agora.', 'Re: nossa conversa', 'k-resp-1')->>'id'), (SELECT r->>'id' FROM r1), 'Mesma chave: a mesma resposta (não duplica)');
SELECT ok((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000001', 'Oi', NULL, 'k-li')->>'erro') ~ 'LinkedIn', 'LinkedIn ainda não envia por aqui (diz isso)');
SELECT is((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000002', 'Oi', NULL, 'k-bruna')->>'erro'), 'Conversa não encontrada.', 'BDR não responde conversa de outra pessoa (nem vê)');
SELECT throws_ok($$ SELECT public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000003', '  ', NULL, 'k-vazia') $$,
  '22023', NULL, 'Resposta vazia é recusada');
SELECT is((SELECT count(*)::int FROM public.inbox_replies), 1, 'Lucas vê a própria resposta');
RESET ROLE;

SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
  'c5000000-0000-0000-0000-000000000003', 'Oi', NULL, 'k-aline')->>'erro') ~ 'Só quem conectou', 'C-level lê, mas não responde pela conta do BDR');
RESET ROLE;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000007');
SET LOCAL ROLE authenticated;
SELECT is((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'c5000000-0000-0000-0000-000000000003', 'Oi', NULL, 'k-grao')->>'erro'),
  'Conversa não encontrada.', 'ISOLAMENTO: membro da Grão não responde na Evolut');
SELECT is((SELECT count(*)::int FROM public.inbox_replies), 0, 'ISOLAMENTO: outro cliente não vê as respostas');
RESET ROLE;

-- Passou pela política e reservou como o envio da cadência (4 créditos, +25%)
SELECT is((SELECT estado FROM public.inbox_replies WHERE id = (SELECT (r->>'id')::uuid FROM r1)), 'reservada', 'Reservada para envio');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 5, 'Reservou 4 créditos (com a folga do cofre)');
SELECT is((SELECT e.execution_type || '/' || e.status FROM public.executions e JOIN public.inbox_replies x ON x.execution_id = e.id WHERE x.id = (SELECT (r->>'id')::uuid FROM r1)),
  'Mensagem manual/running', 'Vira execução visível');

-- O serviço de envio pega: destinatário, conta e chave de idempotência
CREATE TEMP TABLE c1 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.inbox_reply_claim(10)) x;
SELECT is((SELECT count(*)::int FROM c1), 1, 'Uma resposta para enviar');
SELECT is((SELECT x->>'recipient' FROM c1), 'jonas.ribeiro@serraazul.com.br', 'Para o e-mail do contato');
SELECT is((SELECT x->>'unipile_account_id' FROM c1), 'demo-lucas-google', 'Pela conta do Lucas');
SELECT is((SELECT x->>'channel' FROM c1), 'email', 'Pelo canal da conversa');
SELECT is((SELECT x->>'idempotency_key' FROM c1), 'resposta:' || (SELECT r->>'id' FROM r1), 'Com chave de idempotência');
SELECT is(jsonb_array_length(public.inbox_reply_claim(10)), 0, 'Não pega duas vezes');

-- Enviada: cobra, entra na conversa
SELECT is(public.inbox_reply_finish((SELECT (r->>'id')::uuid FROM r1), true, 'msg-ext-1', NULL, NULL)->>'acao', 'enviada', 'Enviada');
SELECT is((SELECT direction || '/' || sent_by FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000003' AND text = 'Combinado, Jonas. Mando o convite agora.'),
  'out/member', 'A resposta aparece na conversa, enviada pela pessoa');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Reserva liberada');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 4, 'Cobrou 4 créditos');
SELECT is(public.inbox_reply_finish((SELECT (r->>'id')::uuid FROM r1), true, 'msg-ext-1', NULL, NULL)->>'acao', 'ignorado', 'Concluir de novo não faz nada');

-- Falha: devolve e avisa
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r2 ON COMMIT DROP AS SELECT public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000005', 'Ligo amanhã às 10h, Marcelo.', NULL, 'k-resp-2') AS r;
RESET ROLE;
SELECT is((SELECT x->>'recipient' FROM jsonb_array_elements(public.inbox_reply_claim(10)) x), '11900000004', 'WhatsApp: o telefone do contato');
SELECT is(public.inbox_reply_finish((SELECT (r->>'id')::uuid FROM r2), false, NULL, 'HTTP 400', NULL)->>'acao', 'falhou', 'Falhou');
SELECT is((SELECT estado FROM public.inbox_replies WHERE id = (SELECT (r->>'id')::uuid FROM r2)), 'falhou', 'Fica marcada como falha');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Falha não cobra');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 4, 'Só a enviada foi cobrada');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications WHERE recipient_member_id = 'd0000000-0000-0000-0000-000000000004' AND title ~ 'não foi enviada'), 'Quem respondeu é avisado');

SELECT * FROM finish();
ROLLBACK;
