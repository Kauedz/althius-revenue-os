-- ==============================================================================
-- Migration: 20261002000114_llm_uso.sql
-- Gateway do modelo de IA (ADR 0050): registro do uso (tokens e, se o superadmin informou o preço, o custo real).
-- O cliente nunca vê isto: só créditos. O custo em dólar aparece só no Uso global do superadmin.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS internal.llm_uso (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quando TIMESTAMPTZ NOT NULL DEFAULT now(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agente TEXT NOT NULL,
  rotulo TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tokens_entrada INTEGER NOT NULL CHECK (tokens_entrada >= 0),
  tokens_saida INTEGER NOT NULL CHECK (tokens_saida >= 0),
  custo_usd NUMERIC(14, 6) CHECK (custo_usd IS NULL OR custo_usd >= 0)
);
CREATE INDEX IF NOT EXISTS idx_llm_uso_ws_quando ON internal.llm_uso (workspace_id, quando DESC);
COMMENT ON TABLE internal.llm_uso IS 'Uso do modelo de IA por cliente e agente (ADR 0050). custo_usd nulo = preço não informado (nunca estimado).';
ALTER TABLE internal.llm_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.llm_uso FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.llm_registrar_uso(
  p_workspace_id UUID, p_agente TEXT, p_rotulo TEXT, p_modelo TEXT, p_tokens_entrada INTEGER, p_tokens_saida INTEGER, p_custo_usd NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(p_tokens_entrada, -1) < 0 OR COALESCE(p_tokens_saida, -1) < 0 OR (p_custo_usd IS NOT NULL AND p_custo_usd < 0) THEN
    RAISE EXCEPTION 'Quantidade de uso inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_agente IS NULL OR p_agente NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN
    RAISE EXCEPTION 'Agente desconhecido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO internal.llm_uso (workspace_id, agente, rotulo, modelo, tokens_entrada, tokens_saida, custo_usd)
  VALUES (p_workspace_id, p_agente, left(COALESCE(p_rotulo, ''), 80), left(COALESCE(p_modelo, ''), 100), p_tokens_entrada, p_tokens_saida, p_custo_usd);
END;
$$;
REVOKE ALL ON FUNCTION public.llm_registrar_uso(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.llm_registrar_uso(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC) TO service_role;

-- Uso global do superadmin ganha tokens e custo real do modelo no mês.
CREATE OR REPLACE FUNCTION public.admin_usage()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', w.id, 'nome', w.name,
      'consumido', COALESCE(c.monthly_consumed, 0),
      'saldo', COALESCE(GREATEST(0, c.allowance_balance + c.topup_balance - c.reserved_balance), 0),
      'execucoes_mes', (SELECT count(*) FROM public.executions e WHERE e.workspace_id = w.id AND e.created_at >= date_trunc('month', now())),
      'ultimo_uso', (SELECT max(e.created_at) FROM public.executions e WHERE e.workspace_id = w.id),
      'tokens_mes', (SELECT COALESCE(sum(u.tokens_entrada + u.tokens_saida), 0) FROM internal.llm_uso u WHERE u.workspace_id = w.id AND u.quando >= date_trunc('month', now())),
      'custo_modelo_usd', (SELECT COALESCE(sum(u.custo_usd), 0) FROM internal.llm_uso u WHERE u.workspace_id = w.id AND u.quando >= date_trunc('month', now()))
    ) ORDER BY COALESCE(c.monthly_consumed, 0) DESC, w.name)
    FROM public.workspaces w LEFT JOIN public.credit_wallets c ON c.workspace_id = w.id
  ), '[]'::jsonb);
END;
$$;
