-- ==============================================================================
-- Migration: 20261002000096_home_summary_real.sql
-- Início sem dado inventado. A 0060 já trazia contas, execuções, aprovações e créditos do banco; o resto da
-- tela (oportunidades, campanhas, cadências, agentes, ações, linha do tempo e mapa) estava escrito no código
-- do front com números e pessoas fictícios. Agora o banco devolve também:
--   oportunidades_abertas, campanhas_ativas, cadencias_ativas, agentes_trabalhando,
--   acoes (próximas tarefas), timeline (últimas execuções), mapa (contas por estado), contas_sem_localizacao.
-- Escopo por papel: BDR vê só o que é dele ("só o seu"); e NÃO vê execuções (matriz: Ver execuções = Não),
-- então a linha do tempo dele vem vazia. Tudo isolado por workspace. Mesmos privilégios da 0060 (ADR 0023).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_home_summary(
  p_workspace_id UUID,
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  v_oportunidades INT := 0;
  v_campanhas INT := 0;
  v_cadencias INT := 0;
  v_agentes INT := 0;
  v_acoes JSONB := '[]'::jsonb;
  v_timeline JSONB := '[]'::jsonb;
  v_mapa JSONB := '{}'::jsonb;
  v_sem_local INT := 0;
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
  SELECT count(*)::int INTO v_contas_count
  FROM public.accounts
  WHERE workspace_id = p_workspace_id
    AND status = 'ativa'
    AND (v_role <> 'bdr' OR owner_member_id = p_member_id);

  -- 2. Execuções: ativas e alertas/bloqueios
  SELECT
    count(*) FILTER (WHERE status IN ('running', 'queued', 'reserving_credits', 'scheduled'))::int,
    count(*) FILTER (WHERE status = 'failed')::int,
    count(DISTINCT agent_code) FILTER (WHERE status IN ('running', 'queued', 'reserving_credits', 'scheduled'))::int
  INTO v_execucoes_ativas, v_alertas_bloqueios, v_agentes
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

  -- 5. Oportunidades abertas (BDR: só as dele) e campanhas/cadências ativas
  SELECT count(*)::int INTO v_oportunidades
  FROM public.opportunities
  WHERE workspace_id = p_workspace_id
    AND status = 'ativa'
    AND (v_role <> 'bdr' OR owner_member_id = p_member_id);

  SELECT count(*)::int INTO v_campanhas FROM public.campaigns WHERE workspace_id = p_workspace_id AND status = 'ativa';
  SELECT count(*)::int INTO v_cadencias FROM public.cadences WHERE workspace_id = p_workspace_id AND status = 'ativa';

  -- 6. Próximas ações: as 5 tarefas abertas mais próximas do prazo (BDR: só as dele)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'titulo', t.title,
           'responsavel', t.responsavel,
           'prazo', t.due_at,
           'origem', t.source,
           'agente', t.agent_id
         ) ORDER BY t.due_at NULLS LAST, t.created_at), '[]'::jsonb)
  INTO v_acoes
  FROM (
    SELECT k.title, k.due_at, k.source, k.agent_id, k.created_at,
           (SELECT pr.name FROM public.workspace_members m JOIN public.profiles pr ON pr.id = m.user_id WHERE m.id = k.assignee_member_id) AS responsavel
    FROM public.tasks k
    WHERE k.workspace_id = p_workspace_id
      AND k.status IN ('pendente', 'em_andamento')
      AND (v_role <> 'bdr' OR k.assignee_member_id = p_member_id)
    ORDER BY k.due_at NULLS LAST, k.created_at
    LIMIT 5
  ) t;

  -- 7. Linha do tempo: as 7 últimas execuções. BDR não vê execuções (matriz): vem vazia.
  IF v_role <> 'bdr' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', e.id, 'titulo', e.title, 'tipo', e.execution_type, 'status', e.status, 'quando', e.updated_at
           ) ORDER BY e.updated_at DESC, e.created_at DESC), '[]'::jsonb)
    INTO v_timeline
    FROM (
      SELECT x.id, x.title, x.execution_type, x.status, x.updated_at, x.created_at
      FROM public.executions x
      WHERE x.workspace_id = p_workspace_id
      ORDER BY x.updated_at DESC, x.created_at DESC
      LIMIT 7
    ) e;
  END IF;

  -- 8. Mapa: contas ativas por estado (BDR: só as dele) e quantas ficaram sem estado informado
  SELECT COALESCE(jsonb_object_agg(m.uf, m.n), '{}'::jsonb) INTO v_mapa
  FROM (
    SELECT upper(btrim(a.state_uf)) AS uf, count(*)::int AS n
    FROM public.accounts a
    WHERE a.workspace_id = p_workspace_id AND a.status = 'ativa'
      AND a.state_uf IS NOT NULL AND length(btrim(a.state_uf)) = 2
      AND (v_role <> 'bdr' OR a.owner_member_id = p_member_id)
    GROUP BY 1
  ) m;

  SELECT count(*)::int INTO v_sem_local
  FROM public.accounts a
  WHERE a.workspace_id = p_workspace_id AND a.status = 'ativa'
    AND (a.state_uf IS NULL OR length(btrim(a.state_uf)) <> 2)
    AND (v_role <> 'bdr' OR a.owner_member_id = p_member_id);

  RETURN jsonb_build_object(
    'contas_qualificadas', v_contas_count,
    'execucoes_ativas', COALESCE(v_execucoes_ativas, 0),
    'alertas_bloqueios', COALESCE(v_alertas_bloqueios, 0),
    'aprovacoes_pendentes', COALESCE(v_aprovacoes_pendentes, 0),
    'creditos_disponiveis', v_creditos_disponiveis,
    'creditos_limite', COALESCE(v_monthly_limit, 10000),
    'papel', v_role,
    'oportunidades_abertas', v_oportunidades,
    'campanhas_ativas', v_campanhas,
    'cadencias_ativas', v_cadencias,
    'agentes_trabalhando', COALESCE(v_agentes, 0),
    'acoes', v_acoes,
    'timeline', v_timeline,
    'mapa', v_mapa,
    'contas_sem_localizacao', v_sem_local
  );
END;
$$;
