-- ==============================================================================
-- Migration: 20261002000087_admin_pages.sql
-- Telas do Superadmin só leitura: Uso global, Fornecedores, Margens, Auditoria e Saúde.
-- Fornecedores nunca devolvem chave, token, DSN ou segredo (só nome, situação e uso).
-- ==============================================================================

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
      'ultimo_uso', (SELECT max(e.created_at) FROM public.executions e WHERE e.workspace_id = w.id)
    ) ORDER BY COALESCE(c.monthly_consumed, 0) DESC, w.name)
    FROM public.workspaces w LEFT JOIN public.credit_wallets c ON c.workspace_id = w.id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_providers()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(p ORDER BY p->>'tipo', p->>'nome') FROM (
      SELECT jsonb_build_object('nome', a.account_name, 'tipo', 'Coleta (Apify)',
        'status', CASE WHEN a.is_active THEN 'Ativo' ELSE 'Inativo' END,
        'uso', a.monthly_usage_usd, 'detalhe', a.active_runs || ' de ' || a.max_concurrent_runs || ' execuções em paralelo',
        'ultimo_uso', a.last_used_at) AS p
      FROM internal.apify_provider_accounts a
      UNION ALL
      SELECT jsonb_build_object('nome', h.model_name, 'tipo', 'Modelo de IA (Hermes)', 'status', 'Configurado',
        'uso', NULL, 'detalhe', 'Temperatura ' || h.temperature || ' · até ' || h.max_tokens || ' tokens', 'ultimo_uso', h.updated_at)
      FROM internal.hermes_model_config h
      UNION ALL
      SELECT jsonb_build_object('nome', 'Unipile', 'tipo', 'Mensagens (Unipile)',
        'status', CASE WHEN EXISTS (SELECT 1 FROM internal.unipile_settings) THEN 'Configurado' ELSE 'Não configurado' END,
        'uso', NULL, 'detalhe', 'Conexões pessoais de e-mail, LinkedIn, WhatsApp e Instagram', 'ultimo_uso', NULL)
      UNION ALL
      SELECT jsonb_build_object('nome', k.provider_name, 'tipo', 'Chave mestra',
        'status', CASE WHEN k.is_active THEN 'Ativo' ELSE 'Inativo' END,
        'uso', k.accumulated_cost_usd, 'detalhe', 'Orçamento mensal ' || k.monthly_budget_usd, 'ultimo_uso', k.updated_at)
      FROM internal.master_provider_keys k
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_margins()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('capacidade', m.capability_code, 'creditos_base', m.base_credit_unit,
      'margem', m.margin_percent, 'risco', m.risk_multiplier, 'ativo', m.is_active) ORDER BY m.capability_code)
    FROM internal.pricing_multipliers m
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_audit(p_limite INTEGER DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(x.linha ORDER BY x.criado DESC) FROM (
      SELECT l.created_at AS criado, jsonb_build_object(
        'id', l.id, 'quando', l.created_at, 'cliente', w.name,
        'quem', COALESCE(p.name, CASE WHEN l.actor_role = 'system' THEN 'Sistema' ELSE l.actor_role END),
        'papel', l.actor_role, 'acao', l.action, 'entidade', l.entity_type) AS linha
      FROM public.audit_logs l
      LEFT JOIN public.workspaces w ON w.id = l.workspace_id
      LEFT JOIN public.profiles p ON p.id = l.actor_user_id
      ORDER BY l.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limite, 200), 1), 1000)
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_health()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_falhas INTEGER; v_vencidas INTEGER; v_conexoes INTEGER; v_convites INTEGER; v_pausados INTEGER; v_chaves INTEGER;
BEGIN
  PERFORM internal.exigir_superadmin();
  SELECT count(*) INTO v_falhas FROM public.executions WHERE status = 'failed' AND updated_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_vencidas FROM public.approvals WHERE status = 'pendente' AND deadline_at < now();
  SELECT count(*) INTO v_conexoes FROM public.messaging_accounts WHERE status <> 'connected';
  SELECT count(*) INTO v_convites FROM public.workspace_invites WHERE status = 'pending' AND delivery_status <> 'sent';
  SELECT count(*) INTO v_pausados FROM public.workspace_agents WHERE estado = 'pausado';
  SELECT count(*) INTO v_chaves FROM public.agent_runtime_tokens WHERE revoked_at IS NULL;
  RETURN jsonb_build_array(
    jsonb_build_object('nome', 'Banco de dados', 'status', 'OK', 'detalhe', 'Respondendo'),
    jsonb_build_object('nome', 'Execuções com falha (24 h)', 'status', CASE WHEN v_falhas = 0 THEN 'OK' WHEN v_falhas < 5 THEN 'Atenção' ELSE 'Falha' END, 'detalhe', v_falhas || ' execuções'),
    jsonb_build_object('nome', 'Aprovações vencidas', 'status', CASE WHEN v_vencidas = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_vencidas || ' aguardando decisão'),
    jsonb_build_object('nome', 'Conexões que precisam reconectar', 'status', CASE WHEN v_conexoes = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_conexoes || ' conexões'),
    jsonb_build_object('nome', 'Convites aguardando envio', 'status', CASE WHEN v_convites = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_convites || ' convites (conector de e-mail pendente)'),
    jsonb_build_object('nome', 'Agentes pausados pelos clientes', 'status', CASE WHEN v_pausados = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_pausados || ' agentes'),
    jsonb_build_object('nome', 'Chaves de agente ativas', 'status', 'OK', 'detalhe', v_chaves || ' chaves')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_usage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_providers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_margins() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_audit(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_providers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_margins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_health() TO authenticated;
