-- ==============================================================================
-- Migration: 20261002000029_accounts_screen.sql
-- Contas e leads: adiciona os campos segmento e fit exibidos na tela v18
-- ==============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS fit integer NOT NULL DEFAULT 0 CHECK (fit BETWEEN 0 AND 100);

COMMENT ON COLUMN public.accounts.segment IS 'Segmento de mercado ou indústria da conta no ICP.';
COMMENT ON COLUMN public.accounts.fit IS 'Pontuação de aderência ao ICP vigente (0 a 100).';

CREATE INDEX IF NOT EXISTS idx_accounts_workspace_fit
  ON public.accounts (workspace_id, fit DESC);
