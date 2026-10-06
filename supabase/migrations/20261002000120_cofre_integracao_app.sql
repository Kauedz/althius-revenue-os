-- ==============================================================================
-- Migration: 20261002000120_cofre_integracao_app.sql
-- Conexões, ticket 04 (ADR 0056): o cofre também guarda o app que a Althius registra em cada fornecedor que não aceita
-- registro automático (ex.: o MCP Auth App do HubSpot). O ID do cliente (que não é segredo) fica na configuração;
-- o segredo fica só cifrado, como todo o resto do cofre (ADR 0049). O rótulo é o código da integração (ex.: `hubspot`).
-- ==============================================================================

ALTER TABLE internal.cofre_segredos DROP CONSTRAINT IF EXISTS cofre_segredos_provedor_check;
ALTER TABLE internal.cofre_segredos
  ADD CONSTRAINT cofre_segredos_provedor_check CHECK (provedor IN ('apify', 'unipile', 'unipile_webhook', 'modelo_ia', 'integracao_app'));

-- Mesma função da migration 113, só com o tipo novo na lista aceita.
CREATE OR REPLACE FUNCTION public.cofre_guardar(p_provedor TEXT, p_rotulo TEXT, p_cifrado TEXT, p_final TEXT, p_config JSONB DEFAULT '{}'::jsonb, p_quem UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rotulo TEXT := btrim(COALESCE(p_rotulo, ''));
  v_id UUID;
BEGIN
  IF p_provedor IS NULL OR p_provedor NOT IN ('apify', 'unipile', 'unipile_webhook', 'modelo_ia', 'integracao_app') THEN
    RAISE EXCEPTION 'Fornecedor desconhecido.' USING ERRCODE = '22023';
  END IF;
  IF v_rotulo = '' OR length(v_rotulo) > 80 THEN
    RAISE EXCEPTION 'Dê um nome curto para a chave.' USING ERRCODE = '22023';
  END IF;
  -- Só aceita o formato do cofre (v1:iv:tag:texto). Texto puro nunca entra.
  IF p_cifrado IS NULL OR p_cifrado !~ '^v1:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+:[A-Za-z0-9+/=_-]+$' THEN
    RAISE EXCEPTION 'A chave precisa chegar cifrada.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO internal.cofre_segredos (provedor, rotulo, cifrado, final, config)
  VALUES (p_provedor, v_rotulo, p_cifrado, right(COALESCE(p_final, ''), 4), COALESCE(p_config, '{}'::jsonb))
  ON CONFLICT (provedor, rotulo) DO UPDATE
    SET cifrado = EXCLUDED.cifrado, final = EXCLUDED.final, config = EXCLUDED.config,
        ativo = true, ultimo_erro = NULL, atualizado_em = now()
  RETURNING id INTO v_id;
  INSERT INTO internal.cofre_eventos (quem, acao, provedor, rotulo) VALUES (p_quem, 'guardou', p_provedor, v_rotulo);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cofre_guardar(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_guardar(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

-- Fornecedores mostra o app de integração com o nome certo (o resto da lista é o da migration 113, sem mudança).
CREATE OR REPLACE FUNCTION public.admin_providers()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(p ORDER BY p->>'tipo', p->>'nome') FROM (
      SELECT jsonb_build_object('id', s.id, 'ativo', s.ativo, 'nome', s.rotulo,
        'tipo', CASE s.provedor WHEN 'apify' THEN 'Coleta (Apify)' WHEN 'modelo_ia' THEN 'Modelo de IA (chave)'
                                WHEN 'integracao_app' THEN 'App de integração'
                                WHEN 'unipile' THEN 'Mensagens (Unipile · chave)' ELSE 'Mensagens (Unipile · segredo do webhook)' END,
        'status', CASE WHEN NOT s.ativo THEN 'Inativo' WHEN s.ultimo_erro IS NOT NULL THEN 'Com erro' ELSE 'Ativo' END,
        'uso', NULL,
        'detalhe', '…' || s.final || COALESCE(' · ' || NULLIF(s.config->>'modelo', ''), '') || COALESCE(' · erro: ' || s.ultimo_erro, ''),
        'ultimo_uso', s.ultimo_uso_em) AS p
      FROM internal.cofre_segredos s
      UNION ALL
      -- Enquanto o cofre não tem nenhuma chave da Apify, segue valendo a lista antiga (contas fixas).
      SELECT jsonb_build_object('nome', a.account_name, 'tipo', 'Coleta (Apify)',
        'status', CASE WHEN a.is_active THEN 'Ativo' ELSE 'Inativo' END,
        'uso', a.monthly_usage_usd, 'detalhe', a.active_runs || ' de ' || a.max_concurrent_runs || ' execuções em paralelo',
        'ultimo_uso', a.last_used_at)
      FROM internal.apify_provider_accounts a
      WHERE NOT EXISTS (SELECT 1 FROM internal.cofre_segredos c WHERE c.provedor = 'apify')
      UNION ALL
      SELECT jsonb_build_object('nome', h.model_name, 'tipo', 'Modelo de IA (Hermes)', 'status', 'Configurado',
        'uso', NULL, 'detalhe', 'Temperatura ' || h.temperature || ' · até ' || h.max_tokens || ' tokens', 'ultimo_uso', h.updated_at)
      FROM internal.hermes_model_config h
      UNION ALL
      SELECT jsonb_build_object('nome', 'Unipile', 'tipo', 'Mensagens (Unipile)',
        'status', CASE WHEN EXISTS (SELECT 1 FROM internal.unipile_settings) OR EXISTS (SELECT 1 FROM internal.cofre_segredos WHERE provedor = 'unipile' AND ativo) THEN 'Configurado' ELSE 'Não configurado' END,
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
