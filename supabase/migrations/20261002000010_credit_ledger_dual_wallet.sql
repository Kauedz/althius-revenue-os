-- ==============================================================================
-- Migration: 20261002000010_credit_ledger_dual_wallet.sql
-- Ticket 03: Créditos: Carteiras (Franquia Mensal + Recarga), Reserva e Liquidação
-- ==============================================================================

-- 1. Create workspace_settings table (Governance, consumption mode, thresholds and limits)
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credit_mode TEXT NOT NULL CHECK (credit_mode IN ('auto', 'approval')) DEFAULT 'auto',
  approval_threshold INTEGER NOT NULL DEFAULT 500,
  monthly_credit_limit INTEGER NOT NULL DEFAULT 5000,
  auto_topup_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_topup_below INTEGER NOT NULL DEFAULT 1000,
  auto_topup_amount INTEGER NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_settings IS 'Políticas de consumo, teto de aprovação e recarga automática do workspace.';

CREATE TRIGGER set_workspace_settings_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create credit_wallets table (Dual wallet: monthly allowance + 90-day topup)
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  allowance_balance INTEGER NOT NULL DEFAULT 10000 CHECK (allowance_balance >= 0),
  allowance_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  topup_balance INTEGER NOT NULL DEFAULT 0 CHECK (topup_balance >= 0),
  topup_expires_at TIMESTAMPTZ,
  reserved_balance INTEGER NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
  monthly_consumed INTEGER NOT NULL DEFAULT 0,
  cycle_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_wallets IS 'Saldos de créditos divididos entre franquia mensal e recargas com controle de reservas.';

CREATE TRIGGER set_credit_wallets_updated_at
  BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Create credit_transactions table (Immutable transaction ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('grant', 'reserve', 'consume', 'release', 'topup', 'expiration')),
  amount INTEGER NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('allowance', 'topup', 'both')),
  description TEXT NOT NULL,
  agent_code TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_transactions IS 'Extrato e ledger imutável de todas as movimentações e reservas financeiras.';

CREATE INDEX IF NOT EXISTS idx_credit_transactions_ws_created 
  ON public.credit_transactions (workspace_id, created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see workspace settings"
  ON public.workspace_settings FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Admins manage workspace settings"
  ON public.workspace_settings FOR UPDATE TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['clevel'])
  )
  WITH CHECK (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['clevel'])
  );

CREATE POLICY "Members see credit wallet"
  ON public.credit_wallets FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Members see credit transactions"
  ON public.credit_transactions FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

-- 5. Stored Procedure: credit_reserve (Holds +25% buffer with FEFO and auto-topup check)
CREATE OR REPLACE FUNCTION public.credit_reserve(
  p_workspace_id UUID,
  p_execution_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_settings RECORD;
  v_reserve_amount INTEGER;
  v_available INTEGER;
  v_auto_topup_triggered BOOLEAN := false;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE idempotency_key = p_idempotency_key) THEN
      SELECT amount INTO v_reserve_amount 
      FROM public.credit_transactions 
      WHERE idempotency_key = p_idempotency_key;
      
      RETURN jsonb_build_object(
        'success', true,
        'reserved_amount', v_reserve_amount,
        'idempotent_replay', true,
        'auto_topup_triggered', false
      );
    END IF;
  END IF;

  -- Apply +25% buffer
  v_reserve_amount := ceil(p_amount * 1.25);

  -- Lock wallet
  SELECT * INTO v_wallet 
  FROM public.credit_wallets 
  WHERE workspace_id = p_workspace_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Initialize if absent
    INSERT INTO public.credit_wallets (workspace_id) 
    VALUES (p_workspace_id) 
    RETURNING * INTO v_wallet;
  END IF;

  -- Fetch settings
  SELECT * INTO v_settings 
  FROM public.workspace_settings 
  WHERE workspace_id = p_workspace_id;

  v_available := (v_wallet.allowance_balance + v_wallet.topup_balance) - v_wallet.reserved_balance;

  -- Check if Auto-Topup should be triggered
  IF v_settings.auto_topup_enabled IS TRUE AND v_available < v_settings.auto_topup_below THEN
    UPDATE public.credit_wallets
    SET topup_balance = topup_balance + v_settings.auto_topup_amount,
        topup_expires_at = COALESCE(topup_expires_at, now()) + INTERVAL '90 days'
    WHERE workspace_id = p_workspace_id
    RETURNING * INTO v_wallet;

    INSERT INTO public.credit_transactions (
      workspace_id,
      type,
      amount,
      wallet_type,
      description
    ) VALUES (
      p_workspace_id,
      'topup',
      v_settings.auto_topup_amount,
      'topup',
      format('Recarga automática de %s créditos (saldo abaixo de %s)', v_settings.auto_topup_amount, v_settings.auto_topup_below)
    );

    v_auto_topup_triggered := true;
    v_available := (v_wallet.allowance_balance + v_wallet.topup_balance) - v_wallet.reserved_balance;
  END IF;

  -- Check available balance against reserve amount
  IF v_available < v_reserve_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'insufficient_funds',
      'available', v_available,
      'required', v_reserve_amount
    );
  END IF;

  -- Increment reserved_balance
  UPDATE public.credit_wallets
  SET reserved_balance = reserved_balance + v_reserve_amount
  WHERE workspace_id = p_workspace_id;

  -- Insert transaction
  INSERT INTO public.credit_transactions (
    workspace_id,
    execution_id,
    type,
    amount,
    wallet_type,
    description,
    idempotency_key
  ) VALUES (
    p_workspace_id,
    p_execution_id,
    'reserve',
    v_reserve_amount,
    'both',
    p_description,
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'success', true,
    'reserved_amount', v_reserve_amount,
    'auto_topup_triggered', v_auto_topup_triggered
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Stored Procedure: credit_consume (Settles real usage, applies FEFO deduction and releases leftover hold)
CREATE OR REPLACE FUNCTION public.credit_consume(
  p_workspace_id UUID,
  p_execution_id UUID,
  p_actual_amount INTEGER,
  p_reserved_amount INTEGER,
  p_description TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_to_deduct INTEGER := p_actual_amount;
  v_from_allowance INTEGER := 0;
  v_from_topup INTEGER := 0;
  v_leftover INTEGER := 0;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.credit_transactions WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object(
        'success', true,
        'consumed_amount', p_actual_amount,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet 
  FROM public.credit_wallets 
  WHERE workspace_id = p_workspace_id 
  FOR UPDATE;

  -- Release the reserve hold
  UPDATE public.credit_wallets
  SET reserved_balance = GREATEST(0, reserved_balance - p_reserved_amount)
  WHERE workspace_id = p_workspace_id;

  -- FEFO: Determine which wallet expires earlier
  -- Allowance expires in <= 30 days, so typically allowance is deducted first
  IF v_wallet.allowance_expires_at <= COALESCE(v_wallet.topup_expires_at, now() + INTERVAL '100 years') THEN
    IF v_wallet.allowance_balance >= v_to_deduct THEN
      v_from_allowance := v_to_deduct;
      v_to_deduct := 0;
    ELSE
      v_from_allowance := v_wallet.allowance_balance;
      v_to_deduct := v_to_deduct - v_from_allowance;
      v_from_topup := v_to_deduct;
    END IF;
  ELSE
    IF v_wallet.topup_balance >= v_to_deduct THEN
      v_from_topup := v_to_deduct;
      v_to_deduct := 0;
    ELSE
      v_from_topup := v_wallet.topup_balance;
      v_to_deduct := v_to_deduct - v_from_topup;
      v_from_allowance := v_to_deduct;
    END IF;
  END IF;

  -- Apply actual deduction and update consumption
  UPDATE public.credit_wallets
  SET allowance_balance = GREATEST(0, allowance_balance - v_from_allowance),
      topup_balance = GREATEST(0, topup_balance - v_from_topup),
      monthly_consumed = monthly_consumed + p_actual_amount
  WHERE workspace_id = p_workspace_id;

  -- Record consumption transaction
  INSERT INTO public.credit_transactions (
    workspace_id,
    execution_id,
    type,
    amount,
    wallet_type,
    description,
    idempotency_key
  ) VALUES (
    p_workspace_id,
    p_execution_id,
    'consume',
    p_actual_amount,
    CASE 
      WHEN v_from_allowance > 0 AND v_from_topup > 0 THEN 'both'
      WHEN v_from_allowance > 0 THEN 'allowance'
      ELSE 'topup'
    END,
    p_description,
    p_idempotency_key
  );

  -- Record leftover release transaction if any
  v_leftover := p_reserved_amount - p_actual_amount;
  IF v_leftover > 0 THEN
    INSERT INTO public.credit_transactions (
      workspace_id,
      execution_id,
      type,
      amount,
      wallet_type,
      description
    ) VALUES (
      p_workspace_id,
      p_execution_id,
      'release',
      v_leftover,
      'both',
      format('Liberação de sobra de reserva (+25%%) de %s créditos', v_leftover)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'consumed_amount', p_actual_amount,
    'released_amount', v_leftover
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
