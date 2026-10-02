-- ==============================================================================
-- Migration: 20261002000019_code_review_refinements.sql
-- Code Review Refinements (Spec & Standards Alignment):
-- 1. Agent Configuration: agent_skills, agent_playbooks, learning_entries
-- 2. Pipeline Board Deletion Reassignment (Preserves deals across same motion)
-- 3. View Pipeline Analytics: Includes won deals (status IN ('ativa', 'ganho'))
-- 4. Superadmin Inbox Read Access Audit Logging (ADR 0006)
-- 5. Strict Messages RLS: Scopes message access through conversations RLS
-- 6. Role Hierarchy Enforcement on Workspace Member invitations
-- ==============================================================================

-- 1. Agent Configuration Tables
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_skill_slug UNIQUE (workspace_id, agent_id, slug)
);

COMMENT ON TABLE public.agent_skills IS 'Habilidades específicas de execução modular dos 4 agentes de IA.';

CREATE TABLE IF NOT EXISTS public.agent_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  version TEXT NOT NULL,
  author_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  content_markdown TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_playbooks IS 'Versões de playbooks de cada agente (missão, tom, regras e processos).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_playbook_published 
  ON public.agent_playbooks (workspace_id, agent_id) WHERE is_published = true;

CREATE TABLE IF NOT EXISTS public.learning_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  suggestion_text TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'sugerida' CHECK (status IN ('sugerida', 'aplicada', 'descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.learning_entries IS 'Sugestões de melhoria contínua aprendidas pelos agentes e submetidas para aprovação.';

-- RLS for Agent Configuration Tables
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see agent skills"
  ON public.agent_skills FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Strategist manages agent skills"
  ON public.agent_skills FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista'])
  );

CREATE POLICY "Members see agent playbooks"
  ON public.agent_playbooks FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Strategist manages agent playbooks"
  ON public.agent_playbooks FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista'])
  );

CREATE POLICY "Members see learning entries"
  ON public.learning_entries FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Authorized members manage learning entries"
  ON public.learning_entries FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
  );

-- 2. Pipeline Board Deletion Reassignment: Spec: "Excluir um quadro move os negócios dele para outro quadro da mesma motion. Nada some."
CREATE OR REPLACE FUNCTION public.handle_pipeline_deletion_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  v_target_pipeline_id UUID;
BEGIN
  -- Look for another pipeline within the same workspace and motion
  SELECT id INTO v_target_pipeline_id
  FROM public.pipelines
  WHERE workspace_id = OLD.workspace_id 
    AND motion = OLD.motion 
    AND id != OLD.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_target_pipeline_id IS NOT NULL THEN
    -- Migrate all deals to the surviving board
    UPDATE public.opportunities
    SET pipeline_id = v_target_pipeline_id
    WHERE pipeline_id = OLD.id;
  ELSE
    -- If there is only one board, create a new fallback board to receive deals
    INSERT INTO public.pipelines (workspace_id, motion, name)
    VALUES (OLD.workspace_id, OLD.motion, format('%s (Geral)', upper(OLD.motion)))
    RETURNING id INTO v_target_pipeline_id;

    UPDATE public.opportunities
    SET pipeline_id = v_target_pipeline_id
    WHERE pipeline_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_deletion_reassign
  BEFORE DELETE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pipeline_deletion_reassignment();

-- 3. Refine view_pipeline_analytics to include won deals (status IN ('ativa', 'ganho'))
CREATE OR REPLACE VIEW public.view_pipeline_analytics AS
SELECT 
  o.workspace_id,
  p.motion,
  o.stage_key,
  sd.order_index,
  COUNT(o.id)::integer AS deals_count,
  COALESCE(SUM(o.amount), 0.00)::numeric(15, 2) AS total_amount,
  COALESCE(SUM(o.amount * o.win_probability / 100.0), 0.00)::numeric(15, 2) AS weighted_amount,
  ROUND(COALESCE(AVG(o.win_probability), 0), 1)::numeric(5, 1) AS avg_probability
FROM public.opportunities o
JOIN public.pipelines p ON p.id = o.pipeline_id
JOIN public.stage_definitions sd ON sd.stage_key = o.stage_key
WHERE o.status IN ('ativa', 'ganho')
GROUP BY o.workspace_id, p.motion, o.stage_key, sd.order_index;

-- 4. Superadmin Inbox Read Audit Logging (ADR 0006)
CREATE OR REPLACE FUNCTION public.log_superadmin_inbox_access(p_conversation_id UUID)
RETURNS VOID AS $$
DECLARE
  v_conv RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF public.is_superadmin() THEN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF FOUND THEN
      INSERT INTO public.audit_logs (
        workspace_id,
        user_id,
        action_type,
        resource_type,
        resource_id,
        diff_json
      ) VALUES (
        v_conv.workspace_id,
        v_user_id,
        'inbox.superadmin_read',
        'conversation',
        p_conversation_id,
        jsonb_build_object(
          'account_id', v_conv.account_id,
          'contact_id', v_conv.contact_id,
          'channel', v_conv.channel,
          'timestamp', now()
        )
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Tighten messages RLS to strictly inherit conversation RLS
DROP POLICY IF EXISTS "Members read workspace messages" ON public.messages;

CREATE POLICY "Members read accessible conversation messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
    )
  );

-- 6. Fix role hierarchy on workspace member invitations
DROP POLICY IF EXISTS "Members can invite members to workspace" ON public.workspace_members;

CREATE POLICY "Members can invite members with hierarchical limit"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin() OR
    (
      public.has_workspace_role(workspace_id, ARRAY['estrategista'])
      AND role IN ('clevel', 'bdr')
    ) OR
    (
      public.has_workspace_role(workspace_id, ARRAY['clevel'])
      AND role IN ('clevel', 'bdr')
    )
  );
