-- ==============================================================================
-- Test: 00095_contato_pelo_telefone_e_perfil.sql
-- ADR 0070. A mensagem recebida acha o contato do CRM mesmo quando o número vem com o 55 e o CRM guarda sem (ou o contato está
-- como "phone"), e o endereço de perfil do Instagram e do LinkedIn vira o usuário que o CRM guarda. Quem não é do CRM continua
-- descartado. Seed: Evolut a0..01 — Lucas BDR (conta WhatsApp ca5..03 = demo-lucas-whatsapp, LinkedIn ca5..02); contato cb..01
-- (Aline Xavier) com phone (11) 90000-0001.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT is(internal.telefone_chave('5511988880000'), '11988880000', 'Telefone com 55: chave sem o 55');
SELECT is(internal.telefone_chave('11988880000'), '11988880000', 'Telefone sem 55: a mesma chave');
SELECT is(internal.telefone_chave('1188880000'), '1188880000', 'Número de 10 dígitos não perde nada');
SELECT is(internal.telefone_chave('(55) 11 98888-0000'), '11988880000', 'Máscara não atrapalha');
SELECT is(internal.telefone_chave(NULL), '', 'Nulo vira vazio');

SELECT is(public.normalize_channel_value('instagram', 'https://www.instagram.com/Maria.TESTE/'), 'maria.teste', 'Instagram: endereço do perfil vira o usuário');
SELECT is(public.normalize_channel_value('instagram', '@Maria.teste'), 'maria.teste', 'Instagram: @usuário continua valendo');
SELECT is(public.normalize_channel_value('instagram', 'https://instagram.com/maria.teste?igsh=abc'), 'maria.teste', 'Instagram: sem parâmetros');
SELECT is(public.normalize_channel_value('linkedin', 'https://www.linkedin.com/in/Maria-Silva/'), 'maria-silva', 'LinkedIn: sem barra no fim');
SELECT is(public.normalize_channel_value('linkedin', 'maria-silva'), 'maria-silva', 'LinkedIn: identificador puro igual');
SELECT is(public.normalize_channel_value('whatsapp', '+55 (11) 98888-0000'), '5511988880000', 'WhatsApp: só dígitos (como antes)');

-- O contato do seed está como "phone" sem 55: o aviso do WhatsApp traz com 55 e @s.whatsapp.net
SELECT is((public.unipile_ingest_message('demo-lucas-whatsapp', 'whatsapp', '5511900000001@s.whatsapp.net', 'wa-chat-x', 'wa-m1', 'Oi do zap', false, 'neutra')->>'action'),
  'persisted', 'WhatsApp com 55 acha o contato cadastrado como phone sem 55');
SELECT is((SELECT c.contact_id::text FROM public.conversations c WHERE c.external_chat_id = 'wa-chat-x'), 'cb000000-0000-0000-0000-000000000001', 'E cai no contato certo');

-- Contato cadastrado como WhatsApp COM 55 também casa com o aviso sem 55
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized, position)
VALUES ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'whatsapp', '+55 11 98888-0000', '', 3);
SELECT is((public.unipile_ingest_message('demo-lucas-whatsapp', 'whatsapp', '11988880000', 'wa-chat-y', 'wa-m2', 'Oi', false, 'neutra')->>'action'),
  'persisted', 'WhatsApp sem 55 acha o contato cadastrado com 55');

-- Quem não é do CRM continua descartado, sem gravar nada
SELECT is((public.unipile_ingest_message('demo-lucas-whatsapp', 'whatsapp', '5511999990000@s.whatsapp.net', 'wa-chat-z', 'wa-m3', 'Spam', false, 'neutra')->>'reason'),
  'non_crm_contact_privacy_filter', 'Número fora do CRM: descartado');
SELECT is((SELECT count(*)::int FROM public.messages WHERE external_message_id = 'wa-m3'), 0, 'E nada é gravado');

-- Instagram pelo endereço do perfil
INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, display_name)
VALUES ('ca950000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'instagram', 'demo-lucas-ig', '@lucas');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized, position)
VALUES ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000003', 'instagram', '@maria.teste', '', 3);
SELECT is((public.unipile_ingest_message('demo-lucas-ig', 'instagram', 'https://www.instagram.com/maria.teste', 'ig-chat-1', 'ig-m1', 'Oi do insta', false, 'neutra')->>'action'),
  'persisted', 'Instagram: o endereço do perfil acha o contato que o CRM guarda como @usuário');

SELECT * FROM finish();
ROLLBACK;
