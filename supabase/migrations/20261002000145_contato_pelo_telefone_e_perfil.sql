-- ==============================================================================
-- Migration: 20261002000145_contato_pelo_telefone_e_perfil.sql
-- ADR 0070. Achado ao ligar a Unipile de verdade: a mensagem recebida só entra se o remetente for um contato do CRM, e o
-- casamento tinha duas falhas:
--   - WhatsApp: o aviso traz o número com o 55 (5511988880000@s.whatsapp.net) e o CRM costuma guardar sem ele ((11) 98888-0000),
--     e o contato só era procurado como "whatsapp", não como "phone". Agora casa pelo número sem o 55, nos dois tipos;
--   - Instagram e LinkedIn: o endereço do perfil (instagram.com/usuario/, linkedin.com/in/pessoa/?...) é reduzido ao usuário,
--     sem barra no fim nem parâmetros, igual ao que o CRM guarda.
-- O que já estava gravado com a regra antiga é renormalizado (sem repetir valor).
-- ==============================================================================

-- O número sem o código do país (55) quando ele veio junto: a chave para comparar telefones.
CREATE OR REPLACE FUNCTION internal.telefone_chave(p_digitos TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN length(d) >= 12 AND d LIKE '55%' THEN substr(d, 3) ELSE d END
    FROM (SELECT regexp_replace(COALESCE(p_digitos, ''), '[^0-9]', '', 'g') AS d) x;
$$;
REVOKE ALL ON FUNCTION internal.telefone_chave(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_channel_value(p_type TEXT, p_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_type = 'email' THEN
    RETURN COALESCE(public.normalize_email(p_value), lower(trim(p_value)));
  ELSIF p_type IN ('phone', 'whatsapp') THEN
    RETURN regexp_replace(p_value, '[^0-9]', '', 'g');
  ELSIF p_type = 'instagram' THEN
    RETURN lower(regexp_replace(regexp_replace(regexp_replace(trim(p_value), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@', ''), '[/?#].*$', ''));
  ELSIF p_type = 'linkedin' THEN
    RETURN lower(regexp_replace(trim(regexp_replace(p_value, '^https?://(www\.)?linkedin\.com/in/', '', 'i')), '[/?#].*$', ''));
  ELSE
    RETURN lower(trim(p_value));
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Renormaliza o que já existe, sem criar repetido (o trigger de normalização recalcula no UPDATE).
UPDATE public.contact_channels c SET value = c.value
 WHERE c.type IN ('instagram', 'linkedin')
   AND c.value_normalized IS DISTINCT FROM public.normalize_channel_value(c.type, c.value)
   AND NOT EXISTS (SELECT 1 FROM public.contact_channels o
                    WHERE o.workspace_id = c.workspace_id AND o.type = c.type AND o.id <> c.id
                      AND o.value_normalized = public.normalize_channel_value(c.type, c.value));

-- A ingestão: mesma função de antes, com o casamento do WhatsApp pela chave do telefone.
CREATE OR REPLACE FUNCTION public.unipile_ingest_message(
  p_unipile_account_id TEXT,
  p_channel TEXT,
  p_sender_identifier TEXT,
  p_external_chat_id TEXT,
  p_external_message_id TEXT,
  p_text TEXT,
  p_is_group BOOLEAN DEFAULT false,
  p_intent TEXT DEFAULT 'neutra'
)
RETURNS JSONB AS $$
DECLARE
  v_messaging_account RECORD;
  v_normalized_sender TEXT;
  v_channel_record RECORD;
  v_conversation_id UUID;
  v_message_id UUID;
BEGIN
  -- Strict Privacy Rule 1: Group chats are always discarded
  IF p_is_group IS TRUE THEN
    RETURN jsonb_build_object(
      'action', 'discarded',
      'reason', 'group_chat_forbidden'
    );
  END IF;

  -- Look up target messaging account
  SELECT * INTO v_messaging_account
  FROM public.messaging_accounts
  WHERE unipile_account_id = p_unipile_account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'action', 'discarded',
      'reason', 'messaging_account_not_found'
    );
  END IF;

  -- Normalize sender identifier
  v_normalized_sender := public.normalize_channel_value(p_channel, p_sender_identifier);

  -- Strict Privacy Rule 2: Lookup sender in contact_channels of the same workspace
  SELECT cc.contact_id, c.account_id, c.name AS contact_name
  INTO v_channel_record
  FROM public.contact_channels cc
  INNER JOIN public.contacts c ON c.id = cc.contact_id
  WHERE cc.workspace_id = v_messaging_account.workspace_id
    AND CASE WHEN p_channel = 'whatsapp'
             -- WhatsApp: o contato pode estar cadastrado como WhatsApp ou como telefone, com ou sem o 55 (ADR 0070).
             THEN cc.type IN ('whatsapp', 'phone') AND internal.telefone_chave(cc.value_normalized) = internal.telefone_chave(v_normalized_sender)
             ELSE cc.type = p_channel AND cc.value_normalized = v_normalized_sender END
  LIMIT 1;

  -- If sender is NOT in CRM: Discard immediately with ZERO metadata or text persistence
  IF v_channel_record.contact_id IS NULL THEN
    RETURN jsonb_build_object(
      'action', 'discarded',
      'reason', 'non_crm_contact_privacy_filter'
    );
  END IF;

  -- Idempotency check: if external_message_id already exists, return existing
  IF EXISTS (SELECT 1 FROM public.messages WHERE external_message_id = p_external_message_id) THEN
    RETURN jsonb_build_object(
      'action', 'persisted',
      'idempotent_replay', true
    );
  END IF;

  -- Find or create conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE messaging_account_id = v_messaging_account.id
    AND external_chat_id = p_external_chat_id;

  -- Conversa de chat (LinkedIn, WhatsApp, Instagram) é UMA por contato e conta: se o provedor mudou o id do chat (troca de
  -- ponte, reconexão), a conversa e o histórico continuam os mesmos e só o id externo é atualizado (ADR 0070).
  -- E-mail não: cada assunto (thread) é uma conversa.
  IF v_conversation_id IS NULL AND p_channel <> 'email' THEN
    SELECT id INTO v_conversation_id FROM public.conversations
     WHERE messaging_account_id = v_messaging_account.id AND contact_id = v_channel_record.contact_id AND channel = p_channel
     ORDER BY last_message_at DESC LIMIT 1;
    IF v_conversation_id IS NOT NULL THEN
      UPDATE public.conversations SET external_chat_id = p_external_chat_id WHERE id = v_conversation_id;
    END IF;
  END IF;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      workspace_id,
      contact_id,
      account_id,
      messaging_account_id,
      channel,
      external_chat_id,
      intent,
      unread,
      last_message_at
    ) VALUES (
      v_messaging_account.workspace_id,
      v_channel_record.contact_id,
      v_channel_record.account_id,
      v_messaging_account.id,
      p_channel,
      p_external_chat_id,
      p_intent,
      true,
      now()
    ) RETURNING id INTO v_conversation_id;
  ELSE
    UPDATE public.conversations
    SET intent = p_intent,
        unread = true,
        last_message_at = now()
    WHERE id = v_conversation_id;
  END IF;

  -- Insert incoming message
  INSERT INTO public.messages (
    workspace_id,
    conversation_id,
    direction,
    external_message_id,
    text,
    sent_by
  ) VALUES (
    v_messaging_account.workspace_id,
    v_conversation_id,
    'in',
    p_external_message_id,
    p_text,
    'member'
  ) RETURNING id INTO v_message_id;

  -- Cadence Auto-Pause Rule: Pause any active cadence enrollment for this contact
  UPDATE public.cadence_enrollments
  SET status = 'pausada_resposta',
      paused_at = now()
  WHERE contact_id = v_channel_record.contact_id
    AND status = 'ativa';

  -- Notify account owner / BDR about incoming response
  INSERT INTO public.notifications (
    workspace_id,
    recipient_member_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  ) VALUES (
    v_messaging_account.workspace_id,
    v_messaging_account.member_id,
    'inbox_response',
    format('Mensagem recebida de %s no %s', v_channel_record.contact_name, upper(p_channel)),
    p_text,
    'conversation',
    v_conversation_id
  );

  RETURN jsonb_build_object(
    'action', 'persisted',
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'contact_id', v_channel_record.contact_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
