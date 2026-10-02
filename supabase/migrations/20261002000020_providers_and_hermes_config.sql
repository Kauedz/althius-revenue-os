-- ==============================================================================
-- Migration: 20261002000020_providers_and_hermes_config.sql
-- Confidential Provider Configuration in schema internal:
-- 1. Unipile Transport Settings (Easy key swapping, data stays in our DB)
-- 2. Apify Multi-Account Provider Pool (5 accounts load-balanced)
-- 3. Hermes LLM Model Configuration (Default: codex-luna, swappable at runtime)
-- ==============================================================================

-- 1. Unipile Settings (Single source of truth for transport keys)
CREATE TABLE IF NOT EXISTS internal.unipile_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dsn TEXT NOT NULL DEFAULT 'https://api1.unipile.com:13262',
  api_key TEXT NOT NULL DEFAULT 'placeholder-unipile-key',
  webhook_secret TEXT DEFAULT 'placeholder-webhook-secret',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.unipile_settings IS 
  'Configuração de conexão do Unipile (apenas canal efêmero de mensageria). Todas as conversas e contatos pertencem à nossa base Supabase.';

-- Procedure to quickly swap Unipile keys
CREATE OR REPLACE FUNCTION internal.update_unipile_keys(
  p_dsn TEXT,
  p_api_key TEXT,
  p_webhook_secret TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO internal.unipile_settings (id, dsn, api_key, webhook_secret, updated_at)
  VALUES (1, p_dsn, p_api_key, p_webhook_secret, now())
  ON CONFLICT (id) DO UPDATE SET
    dsn = EXCLUDED.dsn,
    api_key = EXCLUDED.api_key,
    webhook_secret = COALESCE(EXCLUDED.webhook_secret, internal.unipile_settings.webhook_secret),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apify Multi-Account Provider Pool (5 accounts)
CREATE TABLE IF NOT EXISTS internal.apify_provider_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_index INTEGER NOT NULL CHECK (account_index BETWEEN 1 AND 5) UNIQUE,
  account_name TEXT NOT NULL,
  api_token TEXT NOT NULL,
  max_concurrent_runs INTEGER NOT NULL DEFAULT 10,
  active_runs INTEGER NOT NULL DEFAULT 0,
  monthly_usage_usd NUMERIC(10,2) DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.apify_provider_accounts IS 
  'Pool das 5 contas do Apify como provedores da Althius com balanceamento de carga e alternância automática.';

-- Seed the 5 Apify provider accounts with placeholders
INSERT INTO internal.apify_provider_accounts (account_index, account_name, api_token) VALUES
  (1, 'Apify Conta 01 (Principal)', 'apify_api_token_account_1_placeholder'),
  (2, 'Apify Conta 02 (Secundária)', 'apify_api_token_account_2_placeholder'),
  (3, 'Apify Conta 03 (Enriquecimento)', 'apify_api_token_account_3_placeholder'),
  (4, 'Apify Conta 04 (Scraping)', 'apify_api_token_account_4_placeholder'),
  (5, 'Apify Conta 05 (Reserva)', 'apify_api_token_account_5_placeholder')
ON CONFLICT (account_index) DO NOTHING;

-- Function to pick the least-loaded active Apify account from the 5 accounts
CREATE OR REPLACE FUNCTION internal.get_next_apify_account()
RETURNS TABLE (
  account_id UUID,
  account_index INTEGER,
  account_name TEXT,
  api_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE internal.apify_provider_accounts a
  SET active_runs = a.active_runs + 1,
      last_used_at = now()
  WHERE a.id = (
    SELECT id 
    FROM internal.apify_provider_accounts
    WHERE is_active = true AND active_runs < max_concurrent_runs
    ORDER BY active_runs ASC, COALESCE(last_used_at, '1970-01-01'::timestamptz) ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING a.id, a.account_index, a.account_name, a.api_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release an Apify run when finished
CREATE OR REPLACE FUNCTION internal.release_apify_run(p_account_id UUID, p_cost_usd NUMERIC DEFAULT 0.00)
RETURNS VOID AS $$
BEGIN
  UPDATE internal.apify_provider_accounts
  SET active_runs = GREATEST(0, active_runs - 1),
      monthly_usage_usd = monthly_usage_usd + p_cost_usd
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Hermes LLM Model Configuration (Default: codex-luna)
CREATE TABLE IF NOT EXISTS internal.hermes_model_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  model_name TEXT NOT NULL DEFAULT 'codex-luna',
  api_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  api_key TEXT DEFAULT 'placeholder-hermes-llm-key',
  temperature NUMERIC(3,2) DEFAULT 0.70,
  max_tokens INTEGER DEFAULT 4096,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE internal.hermes_model_config IS 
  'Configuração central do modelo LLM do Hermes (padrão: codex-luna). Permite alternar o modelo a qualquer momento.';

-- Seed default Hermes Model
INSERT INTO internal.hermes_model_config (id, model_name, api_base_url)
VALUES (1, 'codex-luna', 'https://api.openai.com/v1')
ON CONFLICT (id) DO UPDATE SET
  model_name = EXCLUDED.model_name;

-- Stored procedure to update Hermes Model at any time
CREATE OR REPLACE FUNCTION internal.update_hermes_model(
  p_model_name TEXT,
  p_api_base_url TEXT DEFAULT NULL,
  p_api_key TEXT DEFAULT NULL,
  p_temperature NUMERIC DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO internal.hermes_model_config (id, model_name, api_base_url, api_key, temperature, updated_at)
  VALUES (
    1, 
    p_model_name, 
    COALESCE(p_api_base_url, 'https://api.openai.com/v1'),
    p_api_key,
    COALESCE(p_temperature, 0.70),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    api_base_url = COALESCE(p_api_base_url, internal.hermes_model_config.api_base_url),
    api_key = COALESCE(p_api_key, internal.hermes_model_config.api_key),
    temperature = COALESCE(p_temperature, internal.hermes_model_config.temperature),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
