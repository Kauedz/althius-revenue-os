-- ==============================================================================
-- Migration: 20261002000060_home_summary.sql
-- Resumo do Início (Home) no banco de dados, respeitando papel e isolamento.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_home_summary(
  p_workspace_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_contas_count INT := 0;
  v_execucoes_ativas INT := 0;
  v_alertas_bloqueios INT := 0;
  v_aprovacoes_pendentes INT := 0;
  v_allowance INT := 0;
  v_topup INT := 0;
  v_reserved INT := 0;
  v_monthly_limit INT := 10000;
  v_creditos_disponiveis INT := 0;
BEGIN
  -- ADR 0023: Quem chama em nome de um membro precisa ser esse membro
  PERFORM public.assert_caller_is_member(p_member_id);

  -- Valida se o membro pertence e está ativo no workspace solicitado
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  INNER JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.id = p_member_id
    AND wm.workspace_id = p_workspace_id
    AND wm.status = 'active'
    AND w.status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado ou inativo no workspace.' USING ERRCODE = '42501';
  END IF;

  -- 1. Contas qualificadas: BDR vê somente as suas ("só o seu"), demais papéis vêem o total do workspace
  IF v_role = 'bdr' THEN
    SELECT count(*)::int INTO v_contas_count
    FROM public.accounts
    WHERE workspace_id = p_workspace_id
      AND status = 'ativa'
      AND owner_member_id = p_member_id;
  ELSE
    SELECT count(*)::int INTO v_contas_count
    FROM public.accounts
    WHERE workspace_id = p_workspace_id
      AND status = 'ativa';
  END IF;

  -- 2. Execuções: ativas e alertas/bloqueios
  SELECT
    count(*) FILTER (WHERE status IN ('running', 'queued', 'reserving_credits', 'scheduled'))::int,
    count(*) FILTER (WHERE status = 'failed')::int
  INTO v_execucoes_ativas, v_alertas_bloqueios
  FROM public.executions
  WHERE workspace_id = p_workspace_id;

  -- 3. Aprovações pendentes
  SELECT count(*)::int INTO v_aprovacoes_pendentes
  FROM public.approvals
  WHERE workspace_id = p_workspace_id
    AND status = 'pendente';

  -- 4. Créditos da carteira e limite do workspace
  SELECT
    cw.allowance_balance,
    cw.topup_balance,
    cw.reserved_balance,
    ws.monthly_credit_limit
  INTO v_allowance, v_topup, v_reserved, v_monthly_limit
  FROM public.credit_wallets cw
  LEFT JOIN public.workspace_settings ws ON ws.workspace_id = cw.workspace_id
  WHERE cw.workspace_id = p_workspace_id;

  v_creditos_disponiveis := GREATEST(0, COALESCE(v_allowance, 0) + COALESCE(v_topup, 0) - COALESCE(v_reserved, 0));

  RETURN jsonb_build_object(
    'contas_qualificadas', v_contas_count,
    'execucoes_ativas', COALESCE(v_execucoes_ativas, 0),
    'alertas_bloqueios', COALESCE(v_alertas_bloqueios, 0),
    'aprovacoes_pendentes', COALESCE(v_aprovacoes_pendentes, 0),
    'creditos_disponiveis', v_creditos_disponiveis,
    'creditos_limite', COALESCE(v_monthly_limit, 10000),
    'papel', v_role
  );
END;
$$;

-- ADR 0023: Fechada por padrão; liberada apenas para authenticated
REVOKE ALL ON FUNCTION public.get_home_summary(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_summary(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_home_summary(UUID, UUID) IS 'Resumo operacional do painel Início com respeito a papéis e isolamento.';