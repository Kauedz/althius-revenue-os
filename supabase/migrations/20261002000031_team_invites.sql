-- Equipe e convites: alterações atômicas e isoladas por workspace.
-- Não há criação de usuários Auth, nem envio externo nesta migration.
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  role text NOT NULL REFERENCES public.roles(id),
  invited_by_member_id uuid NOT NULL REFERENCES public.workspace_members(id),
  idempotency_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','canceled','expired')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE UNIQUE INDEX workspace_invites_pending_email ON public.workspace_invites(workspace_id,email) WHERE status='pending';
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
CREATE POLICY "Membros leem convites do próprio workspace" ON public.workspace_invites
FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

-- Nenhuma escrita direta pode contornar a hierarquia ou a proteção do C-level.
DROP POLICY "Authorized roles can manage workspace memberships" ON public.workspace_members;
REVOKE INSERT, UPDATE, DELETE ON public.workspace_members FROM PUBLIC, anon, authenticated;

CREATE FUNCTION internal.team_role_level(p_role text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE p_role WHEN 'superadmin' THEN 4 WHEN 'estrategista' THEN 3 WHEN 'clevel' THEN 2 WHEN 'bdr' THEN 1 END;
$$;
REVOKE ALL ON FUNCTION internal.team_role_level(text) FROM PUBLIC, anon, authenticated;

-- O bloqueio do workspace serializa convites e mudanças de papel/suspensão.
-- O autor é consultado DEPOIS do bloqueio: perder acesso invalida chamadas concorrentes.
CREATE FUNCTION internal.team_authorize(p_workspace_id uuid, p_member_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre novamente para gerenciar a equipe.' USING ERRCODE='42501';
  END IF;
  PERFORM public.assert_caller_is_member(p_member_id);
  PERFORM 1 FROM public.workspaces WHERE id=p_workspace_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_role FROM public.workspace_members
  WHERE id=p_member_id AND workspace_id=p_workspace_id AND user_id=auth.uid() AND status='active';
  IF v_role IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.role_permissions WHERE role_id=v_role AND capability_key='team.invite' AND scope IN ('all','assigned')
  ) THEN
    RAISE EXCEPTION 'Seu papel não pode gerenciar a equipe deste workspace.' USING ERRCODE='42501';
  END IF;
  RETURN v_role;
END;
$$;
REVOKE ALL ON FUNCTION internal.team_authorize(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.team_invite(p_workspace_id uuid, p_member_id uuid, p_email text, p_role text, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
  v_email text := lower(btrim(p_email));
  v_invite public.workspace_invites;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_role := internal.team_authorize(p_workspace_id,p_member_id);
  IF internal.team_role_level(p_role) IS NULL OR p_idempotency_key IS NULL OR v_email IS NULL
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Informe e-mail, papel e chave de convite válidos.' USING ERRCODE='22023';
  END IF;
  IF internal.team_role_level(p_role) > internal.team_role_level(v_role) THEN
    RAISE EXCEPTION 'Você não pode convidar alguém com papel acima do seu.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invite FROM public.workspace_invites WHERE workspace_id=p_workspace_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_invite.email<>v_email OR v_invite.role<>p_role OR v_invite.invited_by_member_id<>p_member_id THEN
      RAISE EXCEPTION 'Esta chave de convite já foi usada com outro conteúdo.' USING ERRCODE='22023';
    END IF;
    RETURN to_jsonb(v_invite);
  END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_members m JOIN public.profiles p ON p.id=m.user_id
    WHERE m.workspace_id=p_workspace_id AND lower(p.email)=v_email) THEN
    RAISE EXCEPTION 'Essa pessoa já faz parte do workspace.' USING ERRCODE='23505';
  END IF;
  UPDATE public.workspace_invites SET status='expired' WHERE workspace_id=p_workspace_id AND email=v_email AND status='pending' AND expires_at<=now();
  IF EXISTS (SELECT 1 FROM public.workspace_invites WHERE workspace_id=p_workspace_id AND email=v_email AND status='pending') THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este e-mail.' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.workspace_invites(workspace_id,email,role,invited_by_member_id,idempotency_key)
  VALUES(p_workspace_id,v_email,p_role,p_member_id,p_idempotency_key) RETURNING * INTO v_invite;
  PERFORM public.audit_write(p_workspace_id,auth.uid(),'membro.convidado','workspace_invites',v_invite.id::text,
    jsonb_build_object('email',v_email,'papel',p_role,'idempotency_key',p_idempotency_key,'envio','pendente'));
  RETURN to_jsonb(v_invite);
END;
$$;
REVOKE ALL ON FUNCTION public.team_invite(uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_invite(uuid,uuid,text,text,uuid) TO authenticated;

CREATE FUNCTION public.team_change_role(p_workspace_id uuid, p_member_id uuid, p_target_member_id uuid, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_target public.workspace_members;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_role := internal.team_authorize(p_workspace_id,p_member_id);
  IF internal.team_role_level(p_role) IS NULL THEN
    RAISE EXCEPTION 'Papel inválido.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_target FROM public.workspace_members WHERE id=p_target_member_id AND workspace_id=p_workspace_id;
  IF NOT FOUND OR p_target_member_id=p_member_id THEN
    RAISE EXCEPTION 'Você não pode mudar seu próprio papel ou um membro de outro workspace.' USING ERRCODE='42501';
  END IF;
  IF internal.team_role_level(v_target.role)>internal.team_role_level(v_role) OR internal.team_role_level(p_role)>internal.team_role_level(v_role) THEN
    RAISE EXCEPTION 'Você não pode alterar ou atribuir um papel acima do seu.' USING ERRCODE='42501';
  END IF;
  IF v_target.role=p_role THEN RETURN to_jsonb(v_target); END IF;
  IF v_target.role='clevel' AND v_target.status='active' AND p_role<>'clevel'
    AND NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_workspace_id AND role='clevel' AND status='active' AND id<>p_target_member_id) THEN
    RAISE EXCEPTION 'O workspace precisa manter pelo menos um C-level ativo.' USING ERRCODE='23514';
  END IF;
  UPDATE public.workspace_members SET role=p_role WHERE id=p_target_member_id;
  PERFORM public.audit_write(p_workspace_id,auth.uid(),'membro.papel_mudado','workspace_members',p_target_member_id::text,
    jsonb_build_object('papel_anterior',v_target.role,'papel_novo',p_role));
  RETURN to_jsonb(v_target) || jsonb_build_object('role',p_role);
END;
$$;
REVOKE ALL ON FUNCTION public.team_change_role(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_change_role(uuid,uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.team_suspend_member(p_workspace_id uuid, p_member_id uuid, p_target_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_target public.workspace_members;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_role := internal.team_authorize(p_workspace_id,p_member_id);
  SELECT * INTO v_target FROM public.workspace_members WHERE id=p_target_member_id AND workspace_id=p_workspace_id;
  IF NOT FOUND OR internal.team_role_level(v_target.role)>internal.team_role_level(v_role) THEN
    RAISE EXCEPTION 'Você não pode suspender este membro.' USING ERRCODE='42501';
  END IF;
  IF v_target.status='suspended' THEN RETURN to_jsonb(v_target); END IF;
  IF v_target.role='clevel' AND v_target.status='active'
    AND NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_workspace_id AND role='clevel' AND status='active' AND id<>p_target_member_id) THEN
    RAISE EXCEPTION 'O workspace precisa manter pelo menos um C-level ativo.' USING ERRCODE='23514';
  END IF;
  UPDATE public.workspace_members SET status='suspended' WHERE id=p_target_member_id;
  PERFORM public.audit_write(p_workspace_id,auth.uid(),'membro.suspenso','workspace_members',p_target_member_id::text,jsonb_build_object('status','suspended'));
  RETURN to_jsonb(v_target) || jsonb_build_object('status','suspended');
END;
$$;
REVOKE ALL ON FUNCTION public.team_suspend_member(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_suspend_member(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.team_cancel_invite(p_workspace_id uuid, p_member_id uuid, p_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_invite public.workspace_invites;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_role := internal.team_authorize(p_workspace_id,p_member_id);
  SELECT * INTO v_invite FROM public.workspace_invites WHERE id=p_invite_id AND workspace_id=p_workspace_id;
  IF NOT FOUND OR internal.team_role_level(v_invite.role)>internal.team_role_level(v_role) THEN
    RAISE EXCEPTION 'Você não pode cancelar este convite.' USING ERRCODE='42501';
  END IF;
  IF v_invite.status='canceled' THEN RETURN to_jsonb(v_invite); END IF;
  UPDATE public.workspace_invites SET status='canceled' WHERE id=p_invite_id;
  PERFORM public.audit_write(p_workspace_id,auth.uid(),'membro.convite_cancelado','workspace_invites',p_invite_id::text,jsonb_build_object('status','canceled'));
  RETURN to_jsonb(v_invite) || jsonb_build_object('status','canceled');
END;
$$;
REVOKE ALL ON FUNCTION public.team_cancel_invite(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_cancel_invite(uuid,uuid,uuid) TO authenticated;
