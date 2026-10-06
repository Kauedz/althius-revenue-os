-- ==============================================================================
-- Migration: 20261002000115_consentimento_aprendizado.sql
-- Consentimento do cliente para o aprendizado compartilhado entre contas (ADR 0052).
-- Começa DESLIGADO. Só o C-level do workspace decide (é dado da empresa dele). O aviso aparece uma vez só.
-- Esta migration só guarda o consentimento; o motor que aprende com as contas que aceitaram vem depois e só pode ler
-- quem está em internal.learning_workspaces_aceitos().
-- ==============================================================================

-- Fica em public (como agent_runtime_tokens) só para os testes de integração poderem restaurar o estado pela chave de
-- serviço; usuário e visitante não têm nenhum acesso direto (só pelas funções abaixo).
CREATE TABLE IF NOT EXISTS public.learning_consent (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  aceito BOOLEAN NOT NULL DEFAULT false,
  popup_visto_em TIMESTAMPTZ,
  decidido_por UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.learning_consent IS 'Consentimento do workspace para o aprendizado compartilhado entre contas (ADR 0052). Ausência de linha = não aceitou.';
ALTER TABLE public.learning_consent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_consent FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.learning_consent TO service_role;

-- Quem pode decidir: C-level ativo do próprio workspace.
CREATE OR REPLACE FUNCTION internal.pode_decidir_aprendizado(p_workspace_id UUID, p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m
                 WHERE m.id = p_member_id AND m.workspace_id = p_workspace_id AND m.status = 'active' AND m.role = 'clevel');
$$;

-- Confere que o membro é de quem está logado E pertence a este workspace (42501 caso contrário).
CREATE OR REPLACE FUNCTION internal.exigir_membro_do_workspace(p_workspace_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = p_member_id AND m.workspace_id = p_workspace_id AND m.status = 'active') THEN
    RAISE EXCEPTION 'Você não faz parte deste workspace.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_consent_get(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.learning_consent;
BEGIN
  PERFORM internal.exigir_membro_do_workspace(p_workspace_id, p_member_id);
  SELECT * INTO c FROM public.learning_consent WHERE workspace_id = p_workspace_id;
  RETURN jsonb_build_object(
    'aceito', COALESCE(c.aceito, false),
    'popup_visto', c.popup_visto_em IS NOT NULL,
    'pode_decidir', internal.pode_decidir_aprendizado(p_workspace_id, p_member_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.learning_consent_set(p_workspace_id UUID, p_member_id UUID, p_aceito BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_membro_do_workspace(p_workspace_id, p_member_id);
  IF NOT internal.pode_decidir_aprendizado(p_workspace_id, p_member_id) THEN
    RAISE EXCEPTION 'Só o C-level do workspace decide sobre o aprendizado compartilhado.' USING ERRCODE = '42501';
  END IF;
  IF p_aceito IS NULL THEN
    RAISE EXCEPTION 'Informe sim ou não.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.learning_consent (workspace_id, aceito, popup_visto_em, decidido_por, decidido_em)
  VALUES (p_workspace_id, p_aceito, now(), p_member_id, now())
  ON CONFLICT (workspace_id) DO UPDATE
    SET aceito = EXCLUDED.aceito, popup_visto_em = COALESCE(public.learning_consent.popup_visto_em, now()),
        decidido_por = EXCLUDED.decidido_por, decidido_em = EXCLUDED.decidido_em, atualizado_em = now();
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'learning.consent_set', 'workspace', p_workspace_id::text, jsonb_build_object('aceito', p_aceito));
  RETURN true;
END;
$$;

-- O aviso aparece uma vez só: devolve true na primeira vez que o C-level o vê e false depois. Quem não decide nunca gasta o aviso.
CREATE OR REPLACE FUNCTION public.learning_consent_popup_visto(p_workspace_id UUID, p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_primeira BOOLEAN;
BEGIN
  PERFORM internal.exigir_membro_do_workspace(p_workspace_id, p_member_id);
  IF NOT internal.pode_decidir_aprendizado(p_workspace_id, p_member_id) THEN RETURN false; END IF;
  INSERT INTO public.learning_consent (workspace_id, popup_visto_em) VALUES (p_workspace_id, now())
  ON CONFLICT (workspace_id) DO UPDATE SET popup_visto_em = now(), atualizado_em = now()
    WHERE public.learning_consent.popup_visto_em IS NULL
  RETURNING true INTO v_primeira;
  RETURN COALESCE(v_primeira, false);
END;
$$;

-- Só o motor de aprendizado (sistema) lê quem aceitou. Nunca o front.
CREATE OR REPLACE FUNCTION internal.learning_workspaces_aceitos()
RETURNS TABLE (workspace_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.workspace_id FROM public.learning_consent c
  JOIN public.workspaces w ON w.id = c.workspace_id AND w.status = 'active'
  WHERE c.aceito;
$$;

REVOKE ALL ON FUNCTION internal.pode_decidir_aprendizado(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.exigir_membro_do_workspace(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.learning_workspaces_aceitos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.learning_workspaces_aceitos() TO service_role;
REVOKE ALL ON FUNCTION public.learning_consent_get(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.learning_consent_set(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.learning_consent_popup_visto(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learning_consent_get(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.learning_consent_set(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.learning_consent_popup_visto(UUID, UUID) TO authenticated;
