-- ==============================================================================
-- Migration: 20261002000016_pipeline_motions_stages.sql
-- Ticket 09: Pipeline: 3 Motions, Quadros, 6 Etapas Fixas e Sincronização CRM
-- ==============================================================================

-- 1. Create stage_definitions table (The 6 canonical milestones global catalog)
CREATE TABLE IF NOT EXISTS public.stage_definitions (
  stage_key TEXT PRIMARY KEY CHECK (stage_key IN ('entrada', 'qualificacao', 'descoberta', 'proposta', 'negociacao', 'ganho')),
  order_index INTEGER NOT NULL UNIQUE,
  default_probability INTEGER NOT NULL CHECK (default_probability BETWEEN 0 AND 100),
  slg_label TEXT NOT NULL,
  mlg_label TEXT NOT NULL,
  plg_label TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE public.stage_definitions IS 'As 6 etapas canônicas e universais da plataforma Althius, comparáveis entre motions.';

-- Seed the 6 canonical stages
INSERT INTO public.stage_definitions (stage_key, order_index, default_probability, slg_label, mlg_label, plg_label, is_final) VALUES
  ('entrada', 1, 10, 'Prospecção', 'Lead captado', 'Cadastro', false),
  ('qualificacao', 2, 20, 'Qualificação', 'MQL', 'Ativado', false),
  ('descoberta', 3, 35, 'Reunião', 'SQL', 'PQL', false),
  ('proposta', 4, 55, 'Proposta', 'Proposta', 'Conversa comercial', false),
  ('negociacao', 5, 75, 'Negociação', 'Negociação', 'Upgrade', false),
  ('ganho', 6, 100, 'Ganho', 'Ganho', 'Ganho', true)
ON CONFLICT (stage_key) DO UPDATE SET
  default_probability = EXCLUDED.default_probability,
  slg_label = EXCLUDED.slg_label,
  mlg_label = EXCLUDED.mlg_label,
  plg_label = EXCLUDED.plg_label;

-- 2. Create pipelines table (Quadro: max 5 per motion)
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  motion TEXT NOT NULL CHECK (motion IN ('slg', 'mlg', 'plg')),
  name TEXT NOT NULL,
  description TEXT,
  stage_order JSONB NOT NULL DEFAULT '["entrada", "qualificacao", "descoberta", "proposta", "negociacao", "ganho"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pipelines IS 'Quadros de receita organizados por motion (máximo 5 quadros por motion no workspace).';

CREATE TRIGGER set_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enforce maximum 5 boards per motion ceiling per workspace
CREATE OR REPLACE FUNCTION public.check_pipeline_motion_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.pipelines
  WHERE workspace_id = NEW.workspace_id AND motion = NEW.motion;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Limite de quadros atingido: cada motion suporta no máximo 5 quadros no mesmo workspace.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_pipeline_limit
  BEFORE INSERT ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pipeline_motion_limit();

-- 3. Create opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL REFERENCES public.stage_definitions(stage_key) DEFAULT 'entrada',
  title TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  close_date DATE,
  win_probability INTEGER NOT NULL DEFAULT 10 CHECK (win_probability BETWEEN 0 AND 100),
  health TEXT NOT NULL DEFAULT 'no_prazo' CHECK (health IN ('no_prazo', 'em_risco', 'atrasado')),
  position INTEGER NOT NULL DEFAULT 0,
  owner_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  loss_reason TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'ganho', 'perdido', 'arquivada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.opportunities IS 'Negócios e oportunidades comerciais posicionadas no Kanban do Pipeline.';

CREATE TRIGGER set_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline_stage 
  ON public.opportunities (pipeline_id, stage_key, position);

CREATE INDEX IF NOT EXISTS idx_opportunities_owner 
  ON public.opportunities (workspace_id, owner_member_id);

-- 4. Create opportunity_stage_history table
CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage_key TEXT,
  to_stage_key TEXT NOT NULL,
  moved_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.opportunity_stage_history IS 'Histórico imutável de transição de etapas para previsibilidade e análise de conversão.';

-- 5. Trigger: Stage Transition & Probability Reset
CREATE OR REPLACE FUNCTION public.trg_opportunity_stage_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_default_prob INTEGER;
BEGIN
  -- If stage changed
  IF TG_OP = 'UPDATE' AND (OLD.stage_key IS DISTINCT FROM NEW.stage_key) THEN
    -- Fetch default probability
    SELECT default_probability INTO v_default_prob
    FROM public.stage_definitions
    WHERE stage_key = NEW.stage_key;

    NEW.win_probability := COALESCE(v_default_prob, NEW.win_probability);

    -- Special Ganho handling
    IF NEW.stage_key = 'ganho' THEN
      NEW.win_probability := 100;
      NEW.status := 'ganho';
    END IF;

    -- Record in history
    INSERT INTO public.opportunity_stage_history (
      workspace_id,
      opportunity_id,
      from_stage_key,
      to_stage_key,
      moved_by_member_id
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      OLD.stage_key,
      NEW.stage_key,
      NEW.owner_member_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_stage_history
  BEFORE UPDATE OF stage_key ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_opportunity_stage_transition();

-- 6. Enable RLS
ALTER TABLE public.stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view stage definitions"
  ON public.stage_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members see pipelines in their workspace"
  ON public.pipelines FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Managers manage pipelines"
  ON public.pipelines FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
  );

CREATE POLICY "Members see opportunities in their workspace"
  ON public.opportunities FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "BDR and Managers can update opportunities"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = opportunities.workspace_id))
    ))
  )
  WITH CHECK (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = opportunities.workspace_id))
    ))
  );

CREATE POLICY "Members see opportunity history"
  ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));
