-- ==============================================================================
-- Migration: 20261002000001_bootstrap_schemas.sql
-- ADR 0002: Dual-Schema Database Isolation (public vs internal)
-- ==============================================================================

-- 1. Create the isolated internal schema
CREATE SCHEMA IF NOT EXISTS internal;

COMMENT ON SCHEMA internal IS 
  'Schema isolado para credenciais de upstream (Apify, LLMs), tokens OAuth cifrados, custos reais em USD e regras de precificação/margem. NUNCA expor no PostgREST.';

COMMENT ON SCHEMA public IS 
  'Schema operacional do Revenue OS exposto ao cliente via PostgREST, com Row Level Security compulsório por workspace.';

-- 2. Revoke all permissions from public, anon, and authenticated on schema internal
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
REVOKE ALL ON SCHEMA internal FROM anon;
REVOKE ALL ON SCHEMA internal FROM authenticated;

-- Grant usage exclusively to service_role (privileged backend/Edge Functions) and postgres (superuser/migrations)
GRANT USAGE, CREATE ON SCHEMA internal TO service_role;
GRANT USAGE, CREATE ON SCHEMA internal TO postgres;

-- Set default privileges for any future objects created in schema internal
ALTER DEFAULT PRIVILEGES IN SCHEMA internal REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA internal GRANT ALL ON TABLES TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal GRANT ALL ON FUNCTIONS TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal GRANT ALL ON SEQUENCES TO service_role, postgres;

-- 3. Ensure public schema has standard PostgREST usage grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- 4. Initial Confidential Tables in schema internal
CREATE TABLE IF NOT EXISTS internal.master_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  encrypted_api_key BYTEA NOT NULL,
  monthly_budget_usd NUMERIC(10,2) DEFAULT 0.00,
  accumulated_cost_usd NUMERIC(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.master_provider_keys IS 
  'Chaves mestras da plataforma Althius (ex: conta mestre da Apify). Inacessível ao frontend.';

CREATE TABLE IF NOT EXISTS internal.connection_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  integration_code TEXT NOT NULL,
  encrypted_access_token BYTEA,
  encrypted_refresh_token BYTEA,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.connection_secrets IS 
  'Tokens OAuth e segredos de conexões dos workspaces cifrados em cofre. Inacessível ao frontend.';

CREATE TABLE IF NOT EXISTS internal.provider_cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  execution_id UUID,
  provider_code TEXT NOT NULL,
  provider_run_id TEXT,
  cost_usd NUMERIC(10,4) NOT NULL,
  fx_rate NUMERIC(6,4) NOT NULL DEFAULT 5.7500,
  margin_applied NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.provider_cost_events IS 
  'Registro confidencial de custos reais em USD cobrados pelos fornecedores (Apify, LLMs).';

CREATE TABLE IF NOT EXISTS internal.pricing_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_code TEXT NOT NULL UNIQUE,
  base_credit_unit INT NOT NULL,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  risk_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.25,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.pricing_multipliers IS 
  'Regras confidenciais de conversão de custos de fornecedor para créditos comerciais.';
