-- ==============================================================================
-- Migration: 20261002000017_campaigns_and_analytics_views.sql
-- Ticket 10: Campanhas por Canal e Relatórios de Dados Reais (Views Agregadas)
-- ==============================================================================

-- 1. Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('linkedin_ads', 'meta_ads', 'google_ads', 'organico', 'evento', 'seo_geo')),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('rascunho', 'ativa', 'pausada', 'concluida')),
  budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  leads_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaigns IS 'Campanhas de marketing e geração de demanda por canal.';

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Enable RLS on campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see campaigns in their workspace"
  ON public.campaigns FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Managers manage campaigns"
  ON public.campaigns FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
  );

-- 3. View: view_pipeline_analytics (Real-time aggregated pipeline metrics across motions & stages)
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
WHERE o.status = 'ativa'
GROUP BY o.workspace_id, p.motion, o.stage_key, sd.order_index;

COMMENT ON VIEW public.view_pipeline_analytics IS 
  'Visão agregada em tempo real de volume e valor ponderado por etapa e motion do Pipeline.';

-- 4. View: view_cadence_performance (Real-time cadence conversion and response metrics)
CREATE OR REPLACE VIEW public.view_cadence_performance AS
SELECT 
  c.workspace_id,
  c.id AS cadence_id,
  c.name AS cadence_name,
  COUNT(ce.id)::integer AS total_enrolled,
  COUNT(ce.id) FILTER (WHERE ce.status = 'ativa')::integer AS active_count,
  COUNT(ce.id) FILTER (WHERE ce.status = 'pausada_resposta')::integer AS responded_count,
  COUNT(ce.id) FILTER (WHERE ce.status = 'concluida')::integer AS completed_count,
  CASE 
    WHEN COUNT(ce.id) > 0 THEN 
      ROUND((COUNT(ce.id) FILTER (WHERE ce.status = 'pausada_resposta')::numeric / COUNT(ce.id)) * 100.0, 1)::numeric(5, 1)
    ELSE 0.0 
  END AS response_rate_pct
FROM public.cadences c
LEFT JOIN public.cadence_enrollments ce ON ce.cadence_id = c.id
GROUP BY c.workspace_id, c.id, c.name;

COMMENT ON VIEW public.view_cadence_performance IS 
  'Métricas consolidadas de engajamento e taxa de resposta por cadência.';

-- 5. Stored Procedure: get_revenue_funnel_summary
CREATE OR REPLACE FUNCTION public.get_revenue_funnel_summary(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_pipeline NUMERIC;
  v_weighted_pipeline NUMERIC;
  v_won_amount NUMERIC;
  v_total_leads INTEGER;
  v_stages_json JSONB;
BEGIN
  -- Sum active pipeline amount
  SELECT 
    COALESCE(SUM(amount), 0.00),
    COALESCE(SUM(amount * win_probability / 100.0), 0.00)
  INTO v_total_pipeline, v_weighted_pipeline
  FROM public.opportunities
  WHERE workspace_id = p_workspace_id AND status = 'ativa';

  -- Sum won amount
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_won_amount
  FROM public.opportunities
  WHERE workspace_id = p_workspace_id AND status = 'ganho';

  -- Sum leads count from campaigns
  SELECT COALESCE(SUM(leads_count), 0)
  INTO v_total_leads
  FROM public.campaigns
  WHERE workspace_id = p_workspace_id;

  -- Build stage totals
  SELECT jsonb_agg(
    jsonb_build_object(
      'stage_key', sd.stage_key,
      'label', sd.slg_label,
      'order_index', sd.order_index,
      'deals_count', COALESCE(counts.deals_count, 0),
      'total_amount', COALESCE(counts.total_amount, 0.00)
    ) ORDER BY sd.order_index
  )
  INTO v_stages_json
  FROM public.stage_definitions sd
  LEFT JOIN (
    SELECT stage_key, count(*) AS deals_count, sum(amount) AS total_amount
    FROM public.opportunities
    WHERE workspace_id = p_workspace_id AND status = 'ativa'
    GROUP BY stage_key
  ) counts ON counts.stage_key = sd.stage_key;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'total_active_pipeline_amount', v_total_pipeline,
    'weighted_pipeline_amount', v_weighted_pipeline,
    'won_revenue_amount', v_won_amount,
    'campaign_leads_count', v_total_leads,
    'stages', COALESCE(v_stages_json, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON public.view_pipeline_analytics TO authenticated;
GRANT SELECT ON public.view_cadence_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_funnel_summary(UUID) TO authenticated;
