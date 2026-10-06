-- ==============================================================================
-- Migration: 20261002000113_cofre_chaves.sql
-- Cofre de chaves (ADR 0049): o superadmin cadastra pela tela as chaves da Apify (quantas quiser), da Unipile e do
-- modelo de IA do Hermes, em vez de editar `.env`. No banco só mora o texto CIFRADO (AES-256-GCM, feito no servidor
-- Node com a chave mestra que fica fora do banco). A tela só recebe os 4 últimos caracteres.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS internal.cofre_segredos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor TEXT NOT NULL CHECK (provedor IN ('apify', 'unipile', 'unipile_webhook', 'modelo_ia')),
  rotulo TEXT NOT NULL CHECK (length(btrim(rotulo)) BETWEEN 1 AND 80),
  cifrado TEXT NOT NULL,
  final TEXT NOT NULL CHECK (length(final) <= 4),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_uso_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provedor, rotulo)
);
COMMENT ON TABLE internal.cofre_segredos IS 'Chaves de fornecedores, só cifradas (ADR 0049). Nunca devolvida a tela nem a usuário.';
ALTER TABLE internal.cofre_segredos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.cofre_segredos FROM PUBLIC, anon, authenticated;

-- Registro de quem mexeu no cofre (a auditoria encadeada é por workspace; o cofre é da plataforma). Sem segredo.
CREATE TABLE IF NOT EXISTS internal.cofre_eventos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quando TIMESTAMPTZ NOT NULL DEFAULT now(),
  quem UUID,
  acao TEXT NOT NULL,
  provedor TEXT NOT NULL,
  rotulo TEXT NOT NULL,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE internal.cofre_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.cofre_eventos FROM PUBLIC, anon, authenticated;

-- O backend confere, com o login da pessoa, se ela é superadmin antes de cifrar e guardar.
CREATE OR REPLACE FUNCTION public.cofre_conferir_superadmin()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.cofre_listar()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'provedor', s.provedor, 'rotulo', s.rotulo, 'final', s.final, 'config', s.config, 'ativo', s.ativo,
      'ultimo_uso_em', s.ultimo_uso_em, 'ultimo_erro', s.ultimo_erro, 'criado_em', s.criado_em
    ) ORDER BY s.provedor, s.criado_em, s.rotulo)
    FROM internal.cofre_segredos s
  ), '[]'::jsonb);
END;
$$;

-- Guardar (ou trocar, se o rótulo já existe). Só o sistema, depois que o backend conferiu o superadmin e cifrou.
CREATE OR REPLACE FUNCTION public.cofre_guardar(p_provedor TEXT, p_rotulo TEXT, p_cifrado TEXT, p_final TEXT, p_config JSONB DEFAULT '{}'::jsonb, p_quem UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rotulo TEXT := btrim(COALESCE(p_rotulo, ''));
  v_id UUID;
BEGIN
  IF p_provedor IS NULL OR p_provedor NOT IN ('apify', 'unipile', 'unipile_webhook', 'modelo_ia') THEN
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

-- O sistema lê só as ativas, já cifradas (quem decifra é o servidor, com a chave mestra).
CREATE OR REPLACE FUNCTION public.cofre_ler(p_provedor TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'rotulo', s.rotulo, 'cifrado', s.cifrado, 'config', s.config)
    ORDER BY s.criado_em, s.rotulo), '[]'::jsonb)
  FROM internal.cofre_segredos s WHERE s.provedor = p_provedor AND s.ativo;
$$;

CREATE OR REPLACE FUNCTION public.cofre_alternar(p_id UUID, p_ativo BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s internal.cofre_segredos;
BEGIN
  PERFORM internal.exigir_superadmin();
  UPDATE internal.cofre_segredos SET ativo = p_ativo, atualizado_em = now() WHERE id = p_id RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave não encontrada.' USING ERRCODE = '22023'; END IF;
  INSERT INTO internal.cofre_eventos (quem, acao, provedor, rotulo)
  VALUES (auth.uid(), CASE WHEN p_ativo THEN 'ativou' ELSE 'desativou' END, s.provedor, s.rotulo);
END;
$$;

CREATE OR REPLACE FUNCTION public.cofre_remover(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s internal.cofre_segredos;
BEGIN
  PERFORM internal.exigir_superadmin();
  DELETE FROM internal.cofre_segredos WHERE id = p_id RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave não encontrada.' USING ERRCODE = '22023'; END IF;
  INSERT INTO internal.cofre_eventos (quem, acao, provedor, rotulo) VALUES (auth.uid(), 'removeu', s.provedor, s.rotulo);
END;
$$;

-- O sistema anota uso e erro (para a tela mostrar "último erro" e o rodízio pular chave ruim).
CREATE OR REPLACE FUNCTION public.cofre_marcar_uso(p_id UUID, p_erro TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE internal.cofre_segredos
     SET ultimo_uso_em = now(), ultimo_erro = left(NULLIF(btrim(COALESCE(p_erro, '')), ''), 200)
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.cofre_conferir_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cofre_listar() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cofre_guardar(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cofre_ler(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cofre_alternar(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cofre_remover(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cofre_marcar_uso(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_conferir_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_alternar(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_remover(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cofre_guardar(TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cofre_ler(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cofre_marcar_uso(UUID, TEXT) TO service_role;

-- Fornecedores passa a mostrar as chaves do cofre (sem segredo); a lista antiga da Apify só aparece enquanto o cofre
-- não tem chave dela.
CREATE OR REPLACE FUNCTION public.admin_providers()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(p ORDER BY p->>'tipo', p->>'nome') FROM (
      SELECT jsonb_build_object('id', s.id, 'ativo', s.ativo, 'nome', s.rotulo,
        'tipo', CASE s.provedor WHEN 'apify' THEN 'Coleta (Apify)' WHEN 'modelo_ia' THEN 'Modelo de IA (chave)'
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
