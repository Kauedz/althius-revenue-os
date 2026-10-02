-- ==============================================================================
-- Test: 00017_campaigns_and_analytics_views.sql
-- Verifies Ticket 10 - Campaigns by Channel and Aggregated Real-Data Reporting Views
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace, pipeline and accounts
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pipelines (id, workspace_id, motion, name) VALUES 
  ('f7661bb6-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'slg', 'SLG Principal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.accounts (id, workspace_id, name, domain) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Conta A', 'a.com'),
  ('acc00000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Conta B', 'b.com')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Campaigns
INSERT INTO public.campaigns (workspace_id, name, channel_type, budget_usd, leads_count) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Q4 Executivos LinkedIn', 'linkedin_ads', 2500.00, 48),
  ('11111111-1111-1111-1111-111111111111', 'Webinar Supply Chain', 'evento', 500.00, 120);

SELECT is(
  (SELECT sum(leads_count)::integer FROM public.campaigns WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  168,
  'Campanhas: Soma total de leads gerados pelas campanhas deve ser 168'
);

-- 3. Create Opportunities in 'proposta' stage
INSERT INTO public.opportunities (
  workspace_id, pipeline_id, account_id, stage_key, title, amount, win_probability
) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'f7661bb6-0000-0000-0000-000000000001', 'acc00000-0000-0000-0000-000000000001', 'proposta', 'Deal Alpha', 10000.00, 55),
  ('11111111-1111-1111-1111-111111111111', 'f7661bb6-0000-0000-0000-000000000001', 'acc00000-0000-0000-0000-000000000002', 'proposta', 'Deal Beta', 20000.00, 55);

-- Verify view_pipeline_analytics calculations
SELECT is(
  (SELECT total_amount FROM public.view_pipeline_analytics WHERE stage_key = 'proposta' AND workspace_id = '11111111-1111-1111-1111-111111111111'),
  30000.00::numeric,
  'View Pipeline: Total na etapa proposta deve ser exatamente R$ 30.000'
);

SELECT is(
  (SELECT weighted_amount FROM public.view_pipeline_analytics WHERE stage_key = 'proposta' AND workspace_id = '11111111-1111-1111-1111-111111111111'),
  16500.00::numeric,
  'View Pipeline: Valor ponderado pela probabilidade (55%) deve ser exatamente R$ 16.500'
);

-- 4. Test Cadence Performance View
INSERT INTO public.cadences (id, workspace_id, name) VALUES 
  ('cad00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cadência de Teste')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contacts (id, workspace_id, account_id, name) VALUES 
  ('76485a2b-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000001', 'Contato 1'),
  ('76485a2b-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000001', 'Contato 2'),
  ('76485a2b-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000002', 'Contato 3'),
  ('76485a2b-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000002', 'Contato 4')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cadence_enrollments (workspace_id, cadence_id, contact_id, status) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000001', 'pausada_resposta'),
  ('11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000002', 'pausada_resposta'),
  ('11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000003', 'ativa'),
  ('11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000004', 'ativa');

SELECT is(
  (SELECT response_rate_pct FROM public.view_cadence_performance WHERE cadence_id = 'cad00000-0000-0000-0000-000000000001'),
  50.0::numeric,
  'View Cadências: Taxa de resposta da cadência deve ser exatamente 50.0% (2 de 4)'
);

-- 5. Test Consolidated Revenue Funnel Summary Function
SELECT is(
  ((public.get_revenue_funnel_summary('11111111-1111-1111-1111-111111111111'::uuid))->>'total_active_pipeline_amount')::numeric,
  30000.00::numeric,
  'Funil Consolidado: Pipeline ativo total no workspace deve ser R$ 30.000'
);

SELECT * FROM finish();
ROLLBACK;