-- ==============================================================================
-- Migration: 20261002000086_admin_workspaces.sql
-- Superadmin → Workspaces: listar os clientes, criar cliente novo (documento de regras: "criação de
-- workspace pelo superadmin") e gerar/revogar as chaves dos agentes (porta do Hermes Agent, ADR 0024).
-- Tudo exige superadmin (erro 42501 para qualquer outro papel).
-- ==============================================================================

CREATE OR REPLACE FUNCTION internal.exigir_superadmin()
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Só o superadmin da Althius faz isso.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION internal.exigir_superadmin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_workspaces()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', w.id, 'nome', w.name, 'slug', w.slug, 'status', w.status,
      'momento', COALESCE(w.settings_json->>'momento', ''),
      'membros', (SELECT count(*) FROM public.workspace_members m WHERE m.workspace_id = w.id AND m.status = 'active'),
      'clevel', (SELECT p.name FROM public.workspace_members m JOIN public.profiles p ON p.id = m.user_id
                 WHERE m.workspace_id = w.id AND m.role = 'clevel' AND m.status = 'active' ORDER BY m.joined_at, m.id LIMIT 1),
      'convites', (SELECT count(*) FROM public.workspace_invites i WHERE i.workspace_id = w.id AND i.status = 'pending'),
      'saldo', (SELECT GREATEST(0, c.allowance_balance + c.topup_balance - c.reserved_balance) FROM public.credit_wallets c WHERE c.workspace_id = w.id),
      'criado_em', w.created_at
    ) ORDER BY w.created_at, w.name)
    FROM public.workspaces w
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_workspace(p_nome TEXT, p_slug TEXT, p_clevel_email TEXT, p_estrategista_email TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nome TEXT := btrim(COALESCE(p_nome, ''));
  v_slug TEXT := btrim(COALESCE(p_slug, ''));
  v_email TEXT := lower(btrim(COALESCE(p_clevel_email, '')));
  v_estr_email TEXT := NULLIF(lower(btrim(COALESCE(p_estrategista_email, ''))), '');
  v_estr_user UUID;
  v_ws UUID;
  v_sa_member UUID;
BEGIN
  PERFORM internal.exigir_superadmin();
  IF v_nome = '' OR length(v_nome) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Digite o nome do cliente.');
  END IF;
  IF v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Endereço curto: 3 a 40 letras minúsculas, números ou hífen.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_slug) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já existe um cliente com esse endereço.');
  END IF;
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'E-mail do C-level inválido.');
  END IF;
  IF v_estr_email IS NOT NULL THEN
    SELECT id INTO v_estr_user FROM public.profiles WHERE lower(email) = v_estr_email;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'O estrategista precisa ter conta na Althius.');
    END IF;
  END IF;

  INSERT INTO public.workspaces (name, slug) VALUES (v_nome, v_slug) RETURNING id INTO v_ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_ws, auth.uid(), 'superadmin', 'active') RETURNING id INTO v_sa_member;
  IF v_estr_user IS NOT NULL AND v_estr_user <> auth.uid() THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES (v_ws, v_estr_user, 'estrategista', 'active');
  END IF;
  INSERT INTO public.credit_wallets (workspace_id) VALUES (v_ws) ON CONFLICT (workspace_id) DO NOTHING;
  -- O envio do e-mail é do conector de e-mail (ADR 0025); aqui o convite fica registrado como pendente.
  INSERT INTO public.workspace_invites (workspace_id, email, role, invited_by_member_id, idempotency_key)
  VALUES (v_ws, v_email, 'clevel', v_sa_member, gen_random_uuid());
  PERFORM public.audit_write(v_ws, auth.uid(), 'workspace.criado', 'workspace', v_ws::text,
    jsonb_build_object('nome', v_nome, 'slug', v_slug));
  RETURN jsonb_build_object('ok', true, 'workspace_id', v_ws, 'slug', v_slug);
END;
$$;

-- Chaves dos agentes: o texto da chave aparece só nesta resposta (o banco guarda só o hash).
CREATE OR REPLACE FUNCTION public.admin_agent_tokens(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_resp UUID;
  v_chaves JSONB := '{}'::jsonb;
  v_agente TEXT;
BEGIN
  PERFORM internal.exigir_superadmin();
  FOREACH v_agente IN ARRAY ARRAY['comercial', 'marketing', 'copy', 'revops'] LOOP
    SELECT COALESCE(a.responsavel_member_id,
                    (SELECT m.id FROM public.workspace_members m WHERE m.workspace_id = p_workspace_id AND m.role = 'superadmin' AND m.status = 'active' LIMIT 1))
      INTO v_resp
    FROM public.workspace_agents a WHERE a.workspace_id = p_workspace_id AND a.agent_code = v_agente;
    IF v_resp IS NULL THEN
      RAISE EXCEPTION 'Workspace sem responsável pelos agentes.' USING ERRCODE = '22023';
    END IF;
    v_chaves := v_chaves || jsonb_build_object(v_agente, public.agent_runtime_token_create(p_workspace_id, v_agente, v_resp));
  END LOOP;
  RETURN v_chaves;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_agent_tokens(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM internal.exigir_superadmin();
  UPDATE public.agent_runtime_tokens SET revoked_at = now() WHERE workspace_id = p_workspace_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'agente.chaves_revogadas', 'workspace', p_workspace_id::text, jsonb_build_object('quantidade', v_n));
  RETURN jsonb_build_object('ok', true, 'revogadas', v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_workspaces() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_create_workspace(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_agent_tokens(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_agent_tokens(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_workspace(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_agent_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_agent_tokens(UUID) TO authenticated;
