-- ==============================================================================
-- Migration: 20261002000143_conversa_sobrevive_a_troca_de_ponte.sql
-- ADR 0070. A Unipile é só a PONTE: contatos, conversas e mensagens moram no nosso banco. Se a ponte mudar (outra API,
-- outra conta, outro id de chat), o histórico não pode se partir. Para os canais de chat (LinkedIn, WhatsApp, Instagram) a
-- conversa passa a ser uma por contato e conta: chegou mensagem com um id de chat novo do mesmo contato, a conversa existente
-- continua e só o id externo é atualizado. (Mesmo texto da função de antes, com esse trecho a mais e o search_path fixo.)
-- ==============================================================================

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
    AND cc.type = p_channel
    AND cc.value_normalized = v_normalized_sender
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
