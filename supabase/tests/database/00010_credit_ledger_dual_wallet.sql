-- ==============================================================================
-- Test: 00010_credit_ledger_dual_wallet.sql
-- Verifies Ticket 03 - Dual-Wallet Credit Ledger, +25% Reserve, FEFO and Auto-topup
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

-- Setup mock member
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Initialize wallet for workspace
INSERT INTO public.credit_wallets (
  workspace_id, 
  allowance_balance, 
  allowance_expires_at, 
  topup_balance, 
  topup_expires_at,
  reserved_balance
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  10000,
  now() + INTERVAL '15 days',
  2000,
  now() + INTERVAL '90 days',
  0
);

-- Initialize workspace settings
INSERT INTO public.workspace_settings (
  workspace_id,
  credit_mode,
  approval_threshold,
  monthly_credit_limit,
  auto_topup_enabled,
  auto_topup_below,
  auto_topup_amount
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'auto',
  500,
  5000,
  true,
  1000,
  10000
) ON CONFLICT (workspace_id) DO UPDATE SET
  auto_topup_enabled = true,
  auto_topup_below = 1000;

-- 2. Test Credit Reserve (+25% buffer)
-- Requesting reserve for 100 credits should hold 125 credits
SELECT is(
  (public.credit_reserve(
    '11111111-1111-1111-1111-111111111111'::uuid,
    NULL,
    100,
    'Enriquecimento de 10 contatos',
    'idem-reserve-001'
  )->>'reserved_amount')::integer,
  125,
  'Credit Reserve: Deve aplicar buffer preventivo de +25% (100 cr -> 125 cr)'
);

-- Verify wallet reserved_balance updated
SELECT is(
  (SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  125,
  'Credit Reserve: Saldo reservado na carteira deve ser exatamente 125'
);

-- 3. Test Idempotency on Reserve
SELECT is(
  (public.credit_reserve(
    '11111111-1111-1111-1111-111111111111'::uuid,
    NULL,
    100,
    'Enriquecimento de 10 contatos (Retry)',
    'idem-reserve-001'
  )->>'reserved_amount')::integer,
  125,
  'Idempotencia: Mesma chave de idempotencia deve retornar transacao existente sem duplicar reserva'
);

SELECT is(
  (SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  125,
  'Idempotencia: Saldo reservado nao pode ter sido duplicado'
);

-- 4. Test Credit Consume (Actual 80 credits consumed, 45 released)
SELECT is(
  (public.credit_consume(
    '11111111-1111-1111-1111-111111111111'::uuid,
    NULL,
    80,
    125, -- original reserved amount
    'Liquidação real do enriquecimento',
    'idem-consume-001'
  )->>'consumed_amount')::integer,
  80,
  'Credit Consume: Deve liquidar o consumo real de 80 creditos'
);

-- Verify FEFO and release:
-- allowance_balance was 10000, now 10000 - 80 = 9920.
-- reserved_balance was 125, now 125 - 125 = 0.
SELECT is(
  (SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  9920,
  'FEFO Consume: Deve debitar da franquia mensal que vence antes (10000 - 80 = 9920)'
);

SELECT is(
  (SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Leftover Release: Toda sobra da reserva deve ser liberada (saldo reservado = 0)'
);

-- 5. Test Auto-Topup when balance drops below threshold
-- Forcibly reduce allowance to 500 and topup to 200 (Total available = 700, below auto_topup_below of 1000)
UPDATE public.credit_wallets 
SET allowance_balance = 500, topup_balance = 200
WHERE workspace_id = '11111111-1111-1111-1111-111111111111';

SELECT is(
  (public.credit_reserve(
    '11111111-1111-1111-1111-111111111111'::uuid,
    NULL,
    200, -- requires 250 reserved
    'Ação pesada de coleta',
    'idem-reserve-autotopup'
  )->>'auto_topup_triggered')::boolean,
  false,
  'Auto-Topup desligado (ADR 0064): saldo baixo nao compra creditos sozinho'
);

-- Verify topup wallet received 10,000 credits
SELECT is(
  (SELECT topup_balance FROM public.credit_wallets WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  200,
  'Auto-Topup desligado (ADR 0064): a carteira de recarga nao ganha credito sem pedido a Althius'
);

SELECT * FROM finish();
ROLLBACK;