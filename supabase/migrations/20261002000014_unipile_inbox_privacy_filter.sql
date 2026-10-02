-- ==============================================================================
-- Migration: 20261002000014_unipile_inbox_privacy_filter.sql
-- Ticket 07: Unipile: Contas de Mensagem, Webhook e Filtro Só-CRM
-- ==============================================================================

-- 1. Create messaging_accounts table (Personal communication accounts per member)
CREATE TABLE IF NOT EXISTS public.messaging_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('linkedin', 'whatsapp', 'instagram', 'google', 'microsoft', 'imap')),
  unipile_account_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'attention', 'disconnected')),
  reconnect_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_provider UNIQUE (member_id, provider)
);

COMMENT ON TABLE public.messaging_accounts IS 'Contas de mensageria pessoal de cada membro conectadas via Unipile (WhatsApp, LinkedIn, etc.).';

CREATE TRIGGER set_messaging_accounts_updated_at
  BEFORE UPDATE ON public.messaging_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create conversations table (CRM-only inbox conversations)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  messaging_account_id UUID NOT NULL REFERENCES public.messaging_accounts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'linkedin', 'instagram', 'email')),
  external_chat_id TEXT NOT NULL,
  intent TEXT CHECK (intent IN ('positiva', 'adiar', 'objecao', 'neutra', 'opt_out', 'automatica')) DEFAULT 'neutra',
  unread BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conversation_chat UNIQUE (messaging_account_id, external_chat_id)
);

COMMENT ON TABLE public.conversations IS 'Conversas da Caixa de entrada atreladas estritamente a um contato e conta do CRM.';

CREATE INDEX IF NOT EXISTS idx_conversations_contact 
  ON public.conversations (contact_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_msg 
  ON public.conversations (workspace_id, last_message_at DESC);

-- 3. Create messages table (Individual messages; cascaded on contact deletion)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  external_message_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  sent_by TEXT NOT NULL CHECK (sent_by IN ('member', 'agent', 'automation')),
  cadence_step_execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS 'Mensagens de texto trocadas nos canais de mensageria com contatos do CRM.';

CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON public.messages (conversation_id, created_at ASC);

-- 4. Enable RLS on messaging_accounts, conversations and messages
ALTER TABLE public.messaging_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see their own messaging accounts"
  ON public.messaging_accounts FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid()) OR
    public.is_superadmin()
  );

CREATE POLICY "Members manage their own messaging accounts"
  ON public.messaging_accounts FOR ALL TO authenticated
  USING (
    member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid()) OR
    public.is_superadmin()
  );

CREATE POLICY "Authorized members view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       messaging_account_id IN (SELECT id FROM public.messaging_accounts WHERE member_id IN (
         SELECT id FROM public.workspace_members WHERE user_id = auth.uid()
       )))
    ))
  );

CREATE POLICY "Authorized members view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

-- 5. Stored Procedure: unipile_ingest_message (Strict CRM-Only Privacy Filter)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unipile_ingest_message IS 
  'Ingestão de mensagens com filtro estrito de privacidade: descarta não-CRM e grupos sem gravar nada.';

-- 6. Stored Procedure: unipile_handle_linkedin_connected
CREATE OR REPLACE FUNCTION public.unipile_handle_linkedin_connected(
  p_workspace_id UUID,
  p_linkedin_identifier TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized TEXT;
  v_contact_id UUID;
BEGIN
  v_normalized := public.normalize_channel_value('linkedin', p_linkedin_identifier);

  SELECT contact_id INTO v_contact_id
  FROM public.contact_channels
  WHERE workspace_id = p_workspace_id
    AND type = 'linkedin'
    AND value_normalized = v_normalized
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET linkedin_status = 'conectado'
    WHERE id = v_contact_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
