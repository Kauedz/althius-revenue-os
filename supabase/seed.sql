-- ==============================================================================
-- Supabase Seed: seed.sql
-- Ticket 07: Seeds Mínimos de Teste para o Revenue OS (Althius)
-- ==============================================================================

-- 1. Seed Workspaces
INSERT INTO public.workspaces (id, name, slug, status, settings_json) VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Empresa Alfa Ltda', 'empresa-alfa', 'active', '{"theme": "dark", "locale": "pt-BR"}'),
  ('b0000000-0000-0000-0000-000000000001', 'Empresa Beta Corp', 'empresa-beta', 'active', '{"theme": "light", "locale": "pt-BR"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Workspace Memberships with the 4 core archetypes
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status, job_title) VALUES 
  -- Workspace Alfa memberships
  ('m0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'superadmin', 'active', 'Plataforma Althius Admin'),
  ('m0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002', 'strategist', 'active', 'Estrategista de Receita Althius'),
  ('m0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000003', 'client_admin', 'active', 'Diretor Comercial Alfa'),
  ('m0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000004', 'bdr', 'active', 'SDR Outbound Alfa'),

  -- Workspace Beta memberships (demonstrates strategist multi-tenancy)
  ('m0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'superadmin', 'active', 'Plataforma Althius Admin'),
  ('m0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000002', 'strategist', 'active', 'Estrategista de Receita Althius')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed confidential pricing multipliers in schema internal
INSERT INTO internal.pricing_multipliers (capability_code, base_credit_unit, margin_percent, risk_multiplier, is_active) VALUES 
  ('maps_business_search', 800, 40.00, 1.25, true),
  ('company_enrichment', 50, 40.00, 1.25, true),
  ('person_enrichment', 80, 40.00, 1.25, true),
  ('email_discovery', 120, 40.00, 1.25, true),
  ('job_signal_monitor', 100, 40.00, 1.25, true)
ON CONFLICT (capability_code) DO NOTHING;
