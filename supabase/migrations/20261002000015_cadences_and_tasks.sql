-- ==============================================================================
-- Migration: 20261002000015_cadences_and_tasks.sql
-- Ticket 08: Cadências: Passos Automáticos e Manuais, Tarefas e Envio Unipile
-- ==============================================================================

-- 1. Create cadences table
CREATE TABLE IF NOT EXISTS public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'arquivada')),
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cadences IS 'Sequências de abordagem multicanal governadas por passos automáticos e manuais.';

CREATE TRIGGER set_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create cadence_steps table
CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call')),
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('auto', 'manual')),
  linkedin_action TEXT CHECK (linkedin_action IN ('connect', 'connect_note', 'message')),
  instagram_action TEXT CHECK (instagram_action IN ('follow', 'message')),
  subject TEXT,
  body TEXT,
  target_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cadence_step UNIQUE (cadence_id, step_number),
  CONSTRAINT chk_cadence_step_auto_channels CHECK (
    execution_mode = 'manual' OR (execution_mode = 'auto' AND channel IN ('email', 'whatsapp'))
  )
);

COMMENT ON TABLE public.cadence_steps IS 'Passos individuais de cadência. Modo automático permitido exclusivamente em e-mail e whatsapp.';

-- 3. Create cadence_enrollments table
CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'pausada_resposta', 'concluida', 'cancelada')),
  current_step_number INTEGER NOT NULL DEFAULT 1,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.cadence_enrollments IS 'Inscrição de um contato em uma cadência com controle de avanço e pausa por resposta.';

CREATE INDEX IF NOT EXISTS idx_enrollments_contact_status 
  ON public.cadence_enrollments (contact_id, status);

-- 4. Create cadence_enrollment_steps table (Personalização por contato)
CREATE TABLE IF NOT EXISTS public.cadence_enrollment_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.cadence_enrollments(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  custom_subject TEXT,
  custom_body TEXT,
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executado', 'ignorado')),
  CONSTRAINT uq_enrollment_step UNIQUE (enrollment_id, step_number)
);

COMMENT ON TABLE public.cadence_enrollment_steps IS 'Passos personalizados individualmente para um contato específico.';

-- 5. Create tasks table (Workbench diário do BDR)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call', 'outro')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  assignee_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  agent_id TEXT CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops') OR agent_id IS NULL),
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cadencia', 'agente')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.tasks IS 'Tarefas do Sales Workbench atribuídas a operadores comerciais.';

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status 
  ON public.tasks (assignee_member_id, status, due_at);

-- 6. Enable RLS
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see cadences"
  ON public.cadences FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Estrategista and Admins manage cadences"
  ON public.cadences FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
  );

CREATE POLICY "Members see cadence steps"
  ON public.cadence_steps FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Members see cadence enrollments"
  ON public.cadence_enrollments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Members see tasks in workspace"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      assignee_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid())
    ))
  );

CREATE POLICY "BDR and Managers can update their tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      assignee_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid())
    ))
  );

-- 7. Hook into unipile_ingest_message to automatically pause cadence on response
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Stored Procedure: task_send_now
CREATE OR REPLACE FUNCTION public.task_send_now(
  p_task_id UUID,
  p_member_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'task_not_found');
  END IF;

  UPDATE public.tasks
  SET status = 'concluida',
      completed_at = now()
  WHERE id = p_task_id;

  -- Record audit
  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    diff_json
  ) VALUES (
    v_task.workspace_id,
    (SELECT user_id FROM public.workspace_members WHERE id = p_member_id),
    'task.send_now',
    'task',
    p_task_id::text,
    jsonb_build_object('title', v_task.title, 'channel', v_task.channel)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'concluida',
    'task_id', p_task_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
