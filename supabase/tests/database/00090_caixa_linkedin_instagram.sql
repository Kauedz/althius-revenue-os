-- ==============================================================================
-- Test: 00090_caixa_linkedin_instagram.sql
-- ADR 0069. A Caixa responde também pelo LinkedIn e pelo Instagram, de um jeito diferente do e-mail e do WhatsApp: DENTRO da
-- conversa que já existe (o serviço recebe o id do chat). Mesma política, mesma reserva (4 créditos). Só quem conectou a conta
-- responde; limite de 50 por dia nesses canais; isolamento entre clientes.
-- Seed: Evolut a0..01 — Lucas BDR d..04/e..04 (conta LinkedIn ca5..02, chat demo-chat-1, conversa c5..01);
--       Bruna BDR d..06; Aline C-level d..03/e..03.
-- ==============================================================================

BEGIN;
SELECT no_plan();

INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';
UPDATE public.workspace_settings SET credit_mode = 'auto', approval_threshold = 500, monthly_credit_limit = 5000 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM public.inbox_replies;

CREATE OR REPLACE FUNCTION pg_temp.como(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true); END;
$$;

-- Uma conversa de Instagram do Lucas (o seed só traz LinkedIn, e-mail e WhatsApp)
INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, display_name)
  VALUES ('ca590000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'instagram', 'demo-lucas-instagram', '@lucas.evolut');
INSERT INTO public.conversations (id, workspace_id, contact_id, account_id, messaging_account_id, channel, external_chat_id, intent, unread)
  VALUES ('c5900000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
          'ca590000-0000-0000-0000-000000000001', 'instagram', 'ig-chat-77', 'neutra', true);

SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rl ON COMMIT DROP AS SELECT public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000001', 'Fechado, retomamos no mês que vem.', NULL, 'k-li-1') AS r;
CREATE TEMP TABLE ri ON COMMIT DROP AS SELECT public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5900000-0000-0000-0000-000000000001', 'Obrigado pelo retorno!', NULL, 'k-ig-1') AS r;
GRANT SELECT ON rl, ri TO PUBLIC;
SELECT is((SELECT r->>'ok' FROM rl), 'true', 'LinkedIn: resposta pedida');
SELECT is((SELECT r->>'ok' FROM ri), 'true', 'Instagram: resposta pedida');
SELECT is((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5000000-0000-0000-0000-000000000001', 'Fechado, retomamos no mês que vem.', NULL, 'k-li-1')->>'id'), (SELECT r->>'id' FROM rl), 'Mesma chave: a mesma resposta (não duplica)');
RESET ROLE;

-- Passou pela política e reservou como qualquer envio (4 créditos + folga)
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 10, 'Reservou 2 respostas (4 + folga cada)');

-- O serviço recebe o id do chat da conversa e a conta de quem conectou
CREATE TEMP TABLE cl ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.inbox_reply_claim(10)) x;
SELECT is((SELECT count(*)::int FROM cl), 2, 'Duas respostas para enviar');
SELECT is((SELECT x->>'chat_id' FROM cl WHERE x->>'channel' = 'linkedin'), 'demo-chat-1', 'LinkedIn: vai para o chat que já existe');
SELECT is((SELECT x->>'recipient' FROM cl WHERE x->>'channel' = 'linkedin'), 'demo-chat-1', 'LinkedIn: o destino é o chat (não e-mail nem telefone)');
SELECT is((SELECT x->>'unipile_account_id' FROM cl WHERE x->>'channel' = 'linkedin'), 'demo-lucas-linkedin', 'LinkedIn: pela conta do Lucas');
SELECT is((SELECT x->>'chat_id' FROM cl WHERE x->>'channel' = 'instagram'), 'ig-chat-77', 'Instagram: vai para o chat que já existe');
SELECT is((SELECT x->>'unipile_account_id' FROM cl WHERE x->>'channel' = 'instagram'), 'demo-lucas-instagram', 'Instagram: pela conta do Lucas');
SELECT is(jsonb_array_length(public.inbox_reply_claim(10)), 0, 'Não pega duas vezes');

-- Enviada: cobra e entra na conversa
SELECT is(public.inbox_reply_finish((SELECT (r->>'id')::uuid FROM rl), true, 'li-msg-1', NULL, 'demo-chat-1')->>'acao', 'enviada', 'LinkedIn enviada');
SELECT is((SELECT direction || '/' || sent_by FROM public.messages WHERE conversation_id = 'c5000000-0000-0000-0000-000000000001' AND text = 'Fechado, retomamos no mês que vem.'),
  'out/member', 'A resposta aparece na conversa do LinkedIn');
-- Recusada pelo canal: devolve tudo
SELECT is(public.inbox_reply_finish((SELECT (r->>'id')::uuid FROM ri), false, NULL, 'HTTP 400', NULL)->>'acao', 'falhou', 'Instagram recusado: falhou');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Reserva liberada');
SELECT is((SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 4, 'Cobrou só a que saiu (4 créditos)');

-- Só quem conectou responde
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;
SELECT ok((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
  'c5000000-0000-0000-0000-000000000001', 'Oi', NULL, 'k-aline-li')->>'erro') ~ 'Só quem conectou', 'C-level lê, mas não responde pela conta do LinkedIn do BDR');
RESET ROLE;

-- Isolamento
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000007');
SET LOCAL ROLE authenticated;
SELECT is((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'c5900000-0000-0000-0000-000000000001', 'Oi', NULL, 'k-grao-ig')->>'erro'),
  'Conversa não encontrada.', 'ISOLAMENTO: membro da Grão não responde no Instagram da Evolut');
RESET ROLE;

-- Limite de 50 por dia nesses dois canais
INSERT INTO public.inbox_replies (workspace_id, member_id, conversation_id, texto, estado, chave)
SELECT 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'c5900000-0000-0000-0000-000000000001', 'x' || g, 'enviada', 'lim-' || g FROM generate_series(1, 50) g;
SELECT pg_temp.como('e0000000-0000-0000-0000-000000000004');
SET LOCAL ROLE authenticated;
SELECT ok((public.inbox_reply('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  'c5900000-0000-0000-0000-000000000001', 'mais uma', NULL, 'k-lim')->>'erro') ~ '50 respostas', 'Limite de 50 respostas por dia no LinkedIn e no Instagram');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
