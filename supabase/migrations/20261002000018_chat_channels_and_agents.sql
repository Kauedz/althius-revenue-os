-- ==============================================================================
-- Migration: 20261002000018_chat_channels_and_agents.sql
-- Ticket 11: Canais de Chat: #geral Obrigatório, Agentes por Canal e Cobrança de Créditos
-- ==============================================================================

-- 1. Create chat_channels table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_general BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_channel_slug UNIQUE (workspace_id, slug)
);

COMMENT ON TABLE public.chat_channels IS 'Canais de comunicação interna da equipe com os 4 agentes de IA da Althius.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_channel_workspace_general 
  ON public.chat_channels (workspace_id) WHERE is_general = true;

CREATE TRIGGER set_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create chat_channel_members table
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_channel_member UNIQUE (channel_id, member_id)
);

COMMENT ON TABLE public.chat_channel_members IS 'Membros participantes de cada canal. No canal #geral, todos os membros são inscritos automaticamente.';

-- 3. Create chat_channel_agents table
CREATE TABLE IF NOT EXISTS public.chat_channel_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_channel_agent UNIQUE (channel_id, agent_id)
);

COMMENT ON TABLE public.chat_channel_agents IS 'Atribuição dos 4 agentes de IA aos canais. Agentes só podem interagir nos canais em que estão adicionados.';

-- 4. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('member', 'agent', 'system')),
  sender_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  sender_agent_id TEXT CHECK (sender_agent_id IS NULL OR sender_agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS 'Mensagens trocadas dentro dos canais de equipe com registro de autoria e metadados.';

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created 
  ON public.chat_messages (channel_id, created_at);

-- 5. Business Rule Enforcement: Only assigned agents can post to a channel
CREATE OR REPLACE FUNCTION public.check_chat_message_sender()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type = 'agent' THEN
    IF NEW.sender_agent_id IS NULL THEN
      RAISE EXCEPTION 'Mensagem do tipo agente requer sender_agent_id.' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.chat_channel_agents
      WHERE channel_id = NEW.channel_id AND agent_id = NEW.sender_agent_id
    ) THEN
      RAISE EXCEPTION 'O agente "%" não está atribuído ao canal %.', NEW.sender_agent_id, NEW.channel_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_chat_message_sender
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_chat_message_sender();

-- 6. Business Rule Protection: #geral cannot be deleted or have members unlinked
CREATE OR REPLACE FUNCTION public.protect_general_channel()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_general IS TRUE THEN
      RAISE EXCEPTION 'O canal #geral é obrigatório e não pode ser excluído.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_general_channel
  BEFORE DELETE ON public.chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_general_channel();

CREATE OR REPLACE FUNCTION public.protect_general_channel_members()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.chat_channels 
      WHERE id = OLD.channel_id AND is_general = true
    ) THEN
      RAISE EXCEPTION 'Membros não podem ser desvinculados do canal #geral.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_general_channel_members
  BEFORE DELETE ON public.chat_channel_members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_general_channel_members();

-- 7. Automation: Auto-create #geral on new workspace with 4 canonical agents
CREATE OR REPLACE FUNCTION public.handle_workspace_chat_channels()
RETURNS TRIGGER AS $$
DECLARE
  v_general_id UUID;
BEGIN
  INSERT INTO public.chat_channels (
    workspace_id,
    slug,
    name,
    description,
    is_general
  ) VALUES (
    NEW.id,
    'geral',
    'Geral',
    'Canal geral com toda a equipe e agentes da Althius',
    true
  )
  ON CONFLICT (workspace_id, slug) DO UPDATE SET is_general = true
  RETURNING id INTO v_general_id;

  -- Add the 4 canonical agents to #geral
  INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id)
  VALUES 
    (NEW.id, v_general_id, 'comercial'),
    (NEW.id, v_general_id, 'marketing'),
    (NEW.id, v_general_id, 'copy'),
    (NEW.id, v_general_id, 'revops')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspace_auto_channel_geral
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_chat_channels();

-- 8. Automation: Auto-enroll any new workspace member into #geral
CREATE OR REPLACE FUNCTION public.handle_member_general_chat()
RETURNS TRIGGER AS $$
DECLARE
  v_general_id UUID;
BEGIN
  SELECT id INTO v_general_id 
  FROM public.chat_channels 
  WHERE workspace_id = NEW.workspace_id AND is_general = true;

  IF v_general_id IS NOT NULL THEN
    INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id)
    VALUES (NEW.workspace_id, v_general_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_auto_enroll_geral
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_member_general_chat();

-- 9. Stored Procedure: send_channel_agent_message (Checks role/agent fit and debits 2 credits)
CREATE OR REPLACE FUNCTION public.send_channel_agent_message(
  p_workspace_id UUID,
  p_caller_member_id UUID,
  p_channel_id UUID,
  p_agent_id TEXT,
  p_user_message TEXT,
  p_agent_response TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_channel RECORD;
  v_execution_id UUID;
  v_user_msg_id UUID := NULL;
  v_agent_msg_id UUID := NULL;
  v_eval JSONB;
BEGIN
  -- Validate member
  SELECT wm.user_id, wm.role INTO v_user_id, v_role
  FROM public.workspace_members wm
  WHERE wm.id = p_caller_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro do workspace inválido ou inativo.' USING ERRCODE = 'P0001';
  END IF;

  -- Validate channel
  SELECT * INTO v_channel 
  FROM public.chat_channels 
  WHERE id = p_channel_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canal não encontrado no workspace informado.' USING ERRCODE = 'P0001';
  END IF;

  -- Verify agent assignment to channel
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_channel_agents
    WHERE channel_id = p_channel_id AND agent_id = p_agent_id
  ) THEN
    RAISE EXCEPTION 'O agente "%" não está atribuído ao canal %.', p_agent_id, v_channel.name USING ERRCODE = 'P0001';
  END IF;

  -- Role boundary check: BDR can only interact with 'comercial' and 'copy'
  IF v_role = 'bdr' AND p_agent_id NOT IN ('comercial', 'copy') THEN
    RAISE EXCEPTION 'BDRs só possuem permissão para interagir com o Agente Comercial e Agente de Copy.' USING ERRCODE = 'P0001';
  END IF;

  -- Hermes policy evaluation for agents.chat (2 credits cost)
  v_eval := public.hermes_evaluate_action(
    p_workspace_id,
    p_caller_member_id,
    'agents.chat',
    v_user_id,
    2,
    false,
    format('Chat com Agente %s no canal #%s', p_agent_id, v_channel.slug),
    jsonb_build_object('channel_id', p_channel_id, 'agent_id', p_agent_id)
  );

  IF (v_eval->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Hermes negou a ação: %', (v_eval->>'reason') USING ERRCODE = 'P0001';
  END IF;

  v_execution_id := (v_eval->>'execution_id')::uuid;

  -- Debit 2 credits directly via credit_consume
  PERFORM public.credit_consume(
    p_workspace_id,
    v_execution_id,
    2,
    0,
    format('Conversa com %s no canal #%s', p_agent_id, v_channel.slug),
    p_idempotency_key
  );

  -- Insert user prompt message if provided
  IF p_user_message IS NOT NULL AND length(trim(p_user_message)) > 0 THEN
    INSERT INTO public.chat_messages (
      workspace_id,
      channel_id,
      sender_type,
      sender_member_id,
      content,
      metadata
    ) VALUES (
      p_workspace_id,
      p_channel_id,
      'member',
      p_caller_member_id,
      p_user_message,
      jsonb_build_object('execution_id', v_execution_id)
    ) RETURNING id INTO v_user_msg_id;
  END IF;

  -- Insert agent response message
  INSERT INTO public.chat_messages (
    workspace_id,
    channel_id,
    sender_type,
    sender_agent_id,
    content,
    metadata
  ) VALUES (
    p_workspace_id,
    p_channel_id,
    'agent',
    p_agent_id,
    p_agent_response,
    jsonb_build_object('execution_id', v_execution_id, 'credits_consumed', 2)
  ) RETURNING id INTO v_agent_msg_id;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', v_execution_id,
    'credits_consumed', 2,
    'user_message_id', v_user_msg_id,
    'agent_message_id', v_agent_msg_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_channels
CREATE POLICY "Members see accessible channels"
  ON public.chat_channels FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (
      is_general IS TRUE
      OR id IN (
        SELECT channel_id FROM public.chat_channel_members 
        WHERE member_id IN (SELECT id FROM public.current_workspace_member())
      )
      OR public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
    )
  );

CREATE POLICY "Authorized members create channels"
  ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (
      public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['bdr'])
        AND created_by IN (SELECT id FROM public.current_workspace_member())
      )
    )
  );

CREATE POLICY "Authorized members update channels"
  ON public.chat_channels FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (
      public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['bdr'])
        AND created_by IN (SELECT id FROM public.current_workspace_member())
      )
    )
  );

CREATE POLICY "Authorized members delete custom channels"
  ON public.chat_channels FOR DELETE TO authenticated
  USING (
    is_general IS FALSE
    AND workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (
      public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
      OR (
        public.has_workspace_role(workspace_id, ARRAY['bdr'])
        AND created_by IN (SELECT id FROM public.current_workspace_member())
      )
    )
  );

-- Policies for chat_channel_members
CREATE POLICY "Members see channel participants"
  ON public.chat_channel_members FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized members manage channel participants"
  ON public.chat_channel_members FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
  );

-- Policies for chat_channel_agents
CREATE POLICY "Members see channel agents"
  ON public.chat_channel_agents FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized members manage channel agents"
  ON public.chat_channel_agents FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
  );

-- Policies for chat_messages
CREATE POLICY "Members see messages in accessible channels"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND channel_id IN (
      SELECT id FROM public.chat_channels 
      WHERE workspace_id = chat_messages.workspace_id
        AND (
          is_general IS TRUE 
          OR id IN (
            SELECT channel_id FROM public.chat_channel_members 
            WHERE member_id IN (SELECT id FROM public.current_workspace_member())
          )
          OR public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
        )
    )
  );

CREATE POLICY "Members insert messages in accessible channels"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND channel_id IN (
      SELECT id FROM public.chat_channels 
      WHERE workspace_id = chat_messages.workspace_id
        AND (
          is_general IS TRUE 
          OR id IN (
            SELECT channel_id FROM public.chat_channel_members 
            WHERE member_id IN (SELECT id FROM public.current_workspace_member())
          )
        )
    )
  );

-- 11. Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 12. Backfill existing workspaces with #geral and members
DO $$
DECLARE
  ws RECORD;
  v_gen_id UUID;
  mem RECORD;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces LOOP
    INSERT INTO public.chat_channels (workspace_id, slug, name, description, is_general)
    VALUES (ws.id, 'geral', 'Geral', 'Canal geral com toda a equipe e agentes da Althius', true)
    ON CONFLICT (workspace_id, slug) DO UPDATE SET is_general = true
    RETURNING id INTO v_gen_id;

    IF v_gen_id IS NULL THEN
      SELECT id INTO v_gen_id FROM public.chat_channels WHERE workspace_id = ws.id AND slug = 'geral';
    END IF;

    -- Add the 4 canonical agents to #geral
    INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id)
    VALUES 
      (ws.id, v_gen_id, 'comercial'),
      (ws.id, v_gen_id, 'marketing'),
      (ws.id, v_gen_id, 'copy'),
      (ws.id, v_gen_id, 'revops')
    ON CONFLICT DO NOTHING;

    -- Enroll all existing workspace members into #geral
    FOR mem IN SELECT id FROM public.workspace_members WHERE workspace_id = ws.id LOOP
      INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id)
      VALUES (ws.id, v_gen_id, mem.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
