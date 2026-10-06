-- ==============================================================================
-- Migration: 20261002000119_integracoes.sql
-- Integrações do catálogo (spec .scratch/conexoes-funcionais, ticket 01, ADR 0056): o mecanismo genérico de conexão.
-- Cada pessoa com a capacidade `integrations.connect` conecta a PRÓPRIA conta de um app (OAuth no servidor MCP oficial).
-- - o acesso (tokens cifrados no servidor Node com a chave mestra do cofre) é da pessoa: nenhuma função devolve o de outra;
-- - a tentativa de conexão vale uma vez e tem prazo (o `state` só é guardado como resumo);
-- - o primeiro acesso fixa o "portal" do workspace (ex.: o portal do HubSpot); conta de outro portal é recusada;
-- - retirar a integração apaga os acessos e NÃO apaga conta, contato, vínculo nem interação.
-- Funções de sistema só para service_role (ADR 0023); a tela só chama `integration_conferir` e `integration_estado`.
-- ==============================================================================

-- 1. Integração habilitada no workspace (o primeiro acesso a cria e fixa o portal). Leitura para os membros.
CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL CHECK (integration_id ~ '^[a-z0-9_]{2,40}$'),
  portal TEXT,
  enabled_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, integration_id)
);
COMMENT ON TABLE public.workspace_integrations IS 'Integrações em uso no workspace. O primeiro acesso fixa o portal do app. Só funções do sistema escrevem.';
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_integrations TO authenticated;
CREATE POLICY "Members see the integrations of their workspace"
  ON public.workspace_integrations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- 2. Acesso de UMA pessoa a UMA integração. Tokens cifrados. Nunca lido por usuário.
CREATE TABLE IF NOT EXISTS internal.integration_accesses (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'conectado' CHECK (estado IN ('conectado', 'precisa_reconectar')),
  conta TEXT,
  access_cifrado TEXT NOT NULL,
  refresh_cifrado TEXT,
  expira_em TIMESTAMPTZ,
  client_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  escopo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, member_id, integration_id)
);
COMMENT ON TABLE internal.integration_accesses IS 'Acesso de uma pessoa a uma integração (tokens cifrados com a chave mestra do cofre). Só sistema.';
ALTER TABLE internal.integration_accesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.integration_accesses FROM PUBLIC, anon, authenticated;

-- 3. Tentativa de conexão: uso único, com prazo. O `state` só vira resumo (SHA-256).
CREATE TABLE IF NOT EXISTS internal.integration_attempts (
  state_hash TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,
  verifier_cifrado TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  client_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE internal.integration_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.integration_attempts FROM PUBLIC, anon, authenticated;

-- 4. Cliente OAuth obtido por registro automático (um por integração, emissor e endereço de retorno).
CREATE TABLE IF NOT EXISTS internal.integration_oauth_clients (
  integration_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_cifrado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, issuer, redirect_uri)
);
ALTER TABLE internal.integration_oauth_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.integration_oauth_clients FROM PUBLIC, anon, authenticated;

-- 5. A capacidade `integrations.connect`, avaliada para um membro (as funções de sistema não têm usuário logado).
CREATE OR REPLACE FUNCTION internal.integracao_pode_conectar(p_workspace_id UUID, p_member_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT rp.scope <> 'none'
      FROM public.workspace_members wm
      JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = 'integrations.connect'
     WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active'
  ), false);
$$;
REVOKE ALL ON FUNCTION internal.integracao_pode_conectar(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.integracao_exigir(p_workspace_id UUID, p_member_id UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT internal.integracao_pode_conectar(p_workspace_id, p_member_id) THEN
    RAISE EXCEPTION 'Seu papel não pode conectar integrações neste workspace.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION internal.integracao_exigir(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 6. Tela: confere (com o login da pessoa) que ela pode conectar e devolve o membro dela neste workspace.
CREATE OR REPLACE FUNCTION public.integration_conferir(p_workspace_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_membro UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501';
  END IF;
  SELECT wm.id INTO v_membro FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active';
  IF v_membro IS NULL OR NOT internal.integracao_pode_conectar(p_workspace_id, v_membro) THEN
    RAISE EXCEPTION 'Seu papel não pode conectar integrações neste workspace.' USING ERRCODE = '42501';
  END IF;
  RETURN v_membro;
END;
$$;
REVOKE ALL ON FUNCTION public.integration_conferir(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integration_conferir(UUID) TO authenticated;

-- 7. Tela: o estado (só o da própria pessoa e a contagem de quem conectou). Nunca conta, token nem dado de outro.
CREATE OR REPLACE FUNCTION public.integration_estado(p_workspace_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_membro UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501';
  END IF;
  SELECT wm.id INTO v_membro FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active';
  IF v_membro IS NULL THEN
    RAISE EXCEPTION 'Você não participa deste workspace.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'integracao', i.integration_id,
      'habilitada', true,
      'portal', i.portal,
      'meu_estado', (SELECT a.estado FROM internal.integration_accesses a WHERE a.workspace_id = i.workspace_id AND a.member_id = v_membro AND a.integration_id = i.integration_id),
      'minha_conta', (SELECT a.conta FROM internal.integration_accesses a WHERE a.workspace_id = i.workspace_id AND a.member_id = v_membro AND a.integration_id = i.integration_id),
      'conectados', (SELECT count(*) FROM internal.integration_accesses a JOIN public.workspace_members m ON m.id = a.member_id AND m.status = 'active'
                      WHERE a.workspace_id = i.workspace_id AND a.integration_id = i.integration_id AND a.estado = 'conectado')
    ) ORDER BY i.integration_id)
    FROM public.workspace_integrations i WHERE i.workspace_id = p_workspace_id
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.integration_estado(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.integration_estado(UUID) TO authenticated;

-- 8. Sistema: abre a tentativa (a capacidade é conferida de novo; o `state` vira resumo).
CREATE OR REPLACE FUNCTION public.integration_attempt_start(
  p_member_id UUID, p_workspace_id UUID, p_integration_id TEXT, p_state TEXT, p_verifier_cifrado TEXT,
  p_redirect_uri TEXT, p_client_id TEXT, p_issuer TEXT, p_ttl_seconds INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.integracao_exigir(p_workspace_id, p_member_id);
  IF COALESCE(length(p_state), 0) < 8 OR p_integration_id !~ '^[a-z0-9_]{2,40}$' THEN
    RAISE EXCEPTION 'Pedido de conexão inválido.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM internal.integration_attempts WHERE expires_at < now() - interval '1 day';
  INSERT INTO internal.integration_attempts (state_hash, workspace_id, member_id, integration_id, verifier_cifrado, redirect_uri, client_id, issuer, expires_at)
  VALUES (encode(extensions.digest(p_state, 'sha256'), 'hex'), p_workspace_id, p_member_id, p_integration_id, p_verifier_cifrado, p_redirect_uri, p_client_id, p_issuer,
          now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds, 600), 60), 1800)));
END;
$$;
REVOKE ALL ON FUNCTION public.integration_attempt_start(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_attempt_start(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- 9. Sistema: consome a tentativa do retorno. Vale uma vez, no prazo, e só se a pessoa ainda pode conectar.
CREATE OR REPLACE FUNCTION public.integration_attempt_consume(p_state TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v internal.integration_attempts;
BEGIN
  SELECT * INTO v FROM internal.integration_attempts WHERE state_hash = encode(extensions.digest(COALESCE(p_state, ''), 'sha256'), 'hex') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'motivo', 'invalida'); END IF;
  IF v.used_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'motivo', 'usada'); END IF;
  UPDATE internal.integration_attempts SET used_at = now() WHERE state_hash = v.state_hash;
  IF v.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'motivo', 'expirada'); END IF;
  IF NOT internal.integracao_pode_conectar(v.workspace_id, v.member_id) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'participacao_inativa');
  END IF;
  RETURN jsonb_build_object('ok', true, 'workspace_id', v.workspace_id, 'member_id', v.member_id, 'integration_id', v.integration_id,
    'verifier_cifrado', v.verifier_cifrado, 'redirect_uri', v.redirect_uri, 'client_id', v.client_id, 'issuer', v.issuer);
END;
$$;
REVOKE ALL ON FUNCTION public.integration_attempt_consume(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_attempt_consume(TEXT) TO service_role;

-- 10. Sistema: guarda o acesso. O primeiro fixa o portal; outro portal é recusado e nada é gravado.
CREATE OR REPLACE FUNCTION public.integration_access_save(
  p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT, p_conta TEXT, p_portal TEXT, p_access_cifrado TEXT,
  p_refresh_cifrado TEXT, p_expira_em TIMESTAMPTZ, p_client_id TEXT, p_issuer TEXT, p_escopo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fixado TEXT;
BEGIN
  PERFORM internal.integracao_exigir(p_workspace_id, p_member_id);
  INSERT INTO public.workspace_integrations (workspace_id, integration_id, portal, enabled_by)
  VALUES (p_workspace_id, p_integration_id, NULLIF(p_portal, ''), p_member_id)
  ON CONFLICT (workspace_id, integration_id) DO NOTHING;
  SELECT portal INTO v_fixado FROM public.workspace_integrations WHERE workspace_id = p_workspace_id AND integration_id = p_integration_id FOR UPDATE;
  IF v_fixado IS NULL AND NULLIF(p_portal, '') IS NOT NULL THEN
    UPDATE public.workspace_integrations SET portal = p_portal WHERE workspace_id = p_workspace_id AND integration_id = p_integration_id;
  ELSIF v_fixado IS NOT NULL AND v_fixado IS DISTINCT FROM NULLIF(p_portal, '') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'portal_diferente');
  END IF;
  INSERT INTO internal.integration_accesses (workspace_id, member_id, integration_id, estado, conta, access_cifrado, refresh_cifrado, expira_em, client_id, issuer, escopo)
  VALUES (p_workspace_id, p_member_id, p_integration_id, 'conectado', left(p_conta, 200), p_access_cifrado, p_refresh_cifrado, p_expira_em, p_client_id, p_issuer, left(p_escopo, 500))
  ON CONFLICT (workspace_id, member_id, integration_id) DO UPDATE
    SET estado = 'conectado', conta = EXCLUDED.conta, access_cifrado = EXCLUDED.access_cifrado, refresh_cifrado = EXCLUDED.refresh_cifrado,
        expira_em = EXCLUDED.expira_em, client_id = EXCLUDED.client_id, issuer = EXCLUDED.issuer, escopo = EXCLUDED.escopo, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.integration_access_save(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_access_save(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;

-- 11. Sistema: lê o acesso (cifrado) de UMA pessoa. Quem saiu do workspace não tem acesso usado.
CREATE OR REPLACE FUNCTION public.integration_access_get(p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('estado', a.estado, 'conta', a.conta, 'access_cifrado', a.access_cifrado, 'refresh_cifrado', a.refresh_cifrado,
           'expira_em', a.expira_em, 'client_id', a.client_id, 'issuer', a.issuer, 'escopo', a.escopo,
           'portal', (SELECT i.portal FROM public.workspace_integrations i WHERE i.workspace_id = a.workspace_id AND i.integration_id = a.integration_id))
    FROM internal.integration_accesses a
    JOIN public.workspace_members m ON m.id = a.member_id AND m.workspace_id = a.workspace_id AND m.status = 'active'
   WHERE a.workspace_id = p_workspace_id AND a.member_id = p_member_id AND a.integration_id = p_integration_id;
$$;
REVOKE ALL ON FUNCTION public.integration_access_get(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_access_get(UUID, UUID, TEXT) TO service_role;

-- 12. Sistema: grava o token renovado.
CREATE OR REPLACE FUNCTION public.integration_access_refresh(
  p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT, p_access_cifrado TEXT, p_refresh_cifrado TEXT, p_expira_em TIMESTAMPTZ)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE internal.integration_accesses
     SET access_cifrado = p_access_cifrado, refresh_cifrado = COALESCE(p_refresh_cifrado, refresh_cifrado), expira_em = p_expira_em, estado = 'conectado', updated_at = now()
   WHERE workspace_id = p_workspace_id AND member_id = p_member_id AND integration_id = p_integration_id;
$$;
REVOKE ALL ON FUNCTION public.integration_access_refresh(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_access_refresh(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- 13. Sistema: o app recusou o token (revogado ou vencido sem renovação): a pessoa precisa reconectar.
CREATE OR REPLACE FUNCTION public.integration_access_mark(p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT, p_estado TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_estado NOT IN ('conectado', 'precisa_reconectar') THEN
    RAISE EXCEPTION 'Estado inválido.' USING ERRCODE = '22023';
  END IF;
  UPDATE internal.integration_accesses SET estado = p_estado, updated_at = now()
   WHERE workspace_id = p_workspace_id AND member_id = p_member_id AND integration_id = p_integration_id;
END;
$$;
REVOKE ALL ON FUNCTION public.integration_access_mark(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_access_mark(UUID, UUID, TEXT, TEXT) TO service_role;

-- 14. Sistema: desconecta SÓ o acesso da própria pessoa (não mexe no dos outros nem nos dados já trazidos).
CREATE OR REPLACE FUNCTION public.integration_disconnect(p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM internal.integration_accesses WHERE workspace_id = p_workspace_id AND member_id = p_member_id AND integration_id = p_integration_id;
$$;
REVOKE ALL ON FUNCTION public.integration_disconnect(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_disconnect(UUID, UUID, TEXT) TO service_role;

-- 15. Sistema: retira a integração do workspace (quem pode conectar também pode retirar). Não apaga conta, contato nem vínculo.
CREATE OR REPLACE FUNCTION public.integration_withdraw(p_workspace_id UUID, p_member_id UUID, p_integration_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.integracao_exigir(p_workspace_id, p_member_id);
  DELETE FROM internal.integration_accesses WHERE workspace_id = p_workspace_id AND integration_id = p_integration_id;
  DELETE FROM internal.integration_attempts WHERE workspace_id = p_workspace_id AND integration_id = p_integration_id;
  DELETE FROM public.workspace_integrations WHERE workspace_id = p_workspace_id AND integration_id = p_integration_id;
END;
$$;
REVOKE ALL ON FUNCTION public.integration_withdraw(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_withdraw(UUID, UUID, TEXT) TO service_role;

-- 16. Sistema: cliente OAuth do registro automático. O primeiro a chegar vale (registrar de novo deixa órfãs as autorizações).
CREATE OR REPLACE FUNCTION public.integration_oauth_client_get(p_integration_id TEXT, p_issuer TEXT, p_redirect_uri TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('client_id', client_id, 'client_secret_cifrado', client_secret_cifrado)
    FROM internal.integration_oauth_clients WHERE integration_id = p_integration_id AND issuer = p_issuer AND redirect_uri = p_redirect_uri;
$$;
REVOKE ALL ON FUNCTION public.integration_oauth_client_get(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_oauth_client_get(TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.integration_oauth_client_save(p_integration_id TEXT, p_issuer TEXT, p_redirect_uri TEXT, p_client_id TEXT, p_client_secret_cifrado TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO internal.integration_oauth_clients (integration_id, issuer, redirect_uri, client_id, client_secret_cifrado)
  VALUES (p_integration_id, p_issuer, p_redirect_uri, p_client_id, p_client_secret_cifrado)
  ON CONFLICT (integration_id, issuer, redirect_uri) DO NOTHING;
  RETURN public.integration_oauth_client_get(p_integration_id, p_issuer, p_redirect_uri);
END;
$$;
REVOKE ALL ON FUNCTION public.integration_oauth_client_save(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_oauth_client_save(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
