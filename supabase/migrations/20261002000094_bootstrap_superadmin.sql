-- ==============================================================================
-- Migration: 20261002000094_bootstrap_superadmin.sql
-- Primeiro superadmin em produção (ADR 0041).
--
-- Servidor novo não tem workspace nem superadmin, e superadmin é uma linha de
-- workspace_members (is_superadmin() olha lá). admin_create_workspace exige superadmin,
-- então o primeiro precisa nascer por outro caminho. Esta função de SISTEMA (só service_role)
-- cria, de uma vez só: o workspace interno "Althius", a linha de superadmin, a carteira e o
-- registro na auditoria. Recusa-se a rodar se já existir superadmin ativo.
-- Quem chama é o script `npm run criar-superadmin` (depois de criar o usuário no GoTrue).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_superadmin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ws UUID;
  v_email TEXT;
BEGIN
  -- Duas execuções ao mesmo tempo não criam dois "primeiros".
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('althius_bootstrap_superadmin', 0));

  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE role = 'superadmin' AND status = 'active') THEN
    RAISE EXCEPTION 'Já existe superadmin ativo. Esta operação só serve para o primeiro.';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  SELECT id INTO v_ws FROM public.workspaces WHERE slug = 'althius-interno';
  IF v_ws IS NULL THEN
    INSERT INTO public.workspaces (name, slug) VALUES ('Althius (interno)', 'althius-interno') RETURNING id INTO v_ws;
  ELSE
    UPDATE public.workspaces SET status = 'active' WHERE id = v_ws;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_ws, p_user_id, 'superadmin', 'active')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'superadmin', status = 'active';

  INSERT INTO public.credit_wallets (workspace_id) VALUES (v_ws) ON CONFLICT (workspace_id) DO NOTHING;

  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;
  -- Sem ator de tela: é operação de sistema feita por quem tem acesso ao servidor.
  PERFORM public.audit_write(v_ws, NULL, 'superadmin.bootstrap', 'user', p_user_id::text,
    jsonb_build_object('user_id', p_user_id, 'email', v_email, 'via', 'criar-superadmin'));

  RETURN jsonb_build_object('ok', true, 'workspace_id', v_ws);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_superadmin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_superadmin(UUID) TO service_role;

COMMENT ON FUNCTION public.bootstrap_superadmin(UUID) IS
  'Cria o primeiro superadmin (e o workspace interno). Só service_role. Recusa se já existir superadmin ativo.';
