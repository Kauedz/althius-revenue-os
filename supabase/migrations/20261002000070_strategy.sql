-- Estrategia do workspace: ICP e proposta de valor.
-- Quem escreve segue agents.configure (estrategista e superadmin). C-level so le. BDR nao ve.
-- Escrita so por funcao.

CREATE TABLE public.strategy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('icp', 'oferta')),
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('ativo', 'rascunho', 'em_revisao')),
  body TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.strategy_items IS 'ICP e proposta de valor do workspace. Personas e regras nao entram aqui enquanto nao existirem no banco.';

ALTER TABLE public.strategy_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quem pode ler a estrategia ve os itens do workspace"
  ON public.strategy_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = 'agents.configure'
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = strategy_items.workspace_id
        AND wm.status = 'active'
        AND rp.scope IN ('all', 'read', 'assigned')
    )
  );

REVOKE ALL ON public.strategy_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.strategy_items TO authenticated;

CREATE OR REPLACE FUNCTION public.strategy_list(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_itens JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo = 'none' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não vê a estratégia.');
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT si.id, si.kind, si.name, si.version, si.status, si.body,
           COALESCE(NULLIF(pr.name, ''), '') AS resp, si.updated_at
    FROM public.strategy_items si
    LEFT JOIN public.workspace_members wm ON wm.id = si.updated_by
    LEFT JOIN public.profiles pr ON pr.id = wm.user_id
    WHERE si.workspace_id = p_workspace_id
  ) t;
  RETURN jsonb_build_object('ok', true, 'pode_editar', v_escopo IN ('all', 'assigned'), 'itens', v_itens);
END;
$$;

CREATE OR REPLACE FUNCTION public.strategy_save(
  p_workspace_id UUID, p_member_id UUID, p_id UUID, p_kind TEXT, p_name TEXT, p_version TEXT, p_body TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_id UUID;
  v_nome TEXT := btrim(COALESCE(p_name, ''));
  v_versao TEXT := NULLIF(btrim(COALESCE(p_version, '')), '');
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel só lê a estratégia.');
  END IF;
  IF p_kind NOT IN ('icp', 'oferta') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Escolha ICP ou proposta de valor.');
  END IF;
  IF v_nome = '' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Dê um nome ao item.');
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.strategy_items (workspace_id, kind, name, version, status, body, updated_by)
    VALUES (p_workspace_id, p_kind, v_nome, COALESCE(v_versao, 'v1'), 'rascunho', btrim(COALESCE(p_body, '')), p_member_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.strategy_items
    SET kind = p_kind, name = v_nome, version = COALESCE(v_versao, version), body = btrim(COALESCE(p_body, '')),
        updated_by = p_member_id, updated_at = now()
    WHERE id = p_id AND workspace_id = p_workspace_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Item não encontrado.');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.strategy_set_status(p_workspace_id UUID, p_member_id UUID, p_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel só lê a estratégia.');
  END IF;
  IF p_status NOT IN ('ativo', 'rascunho', 'em_revisao') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Situação desconhecida.');
  END IF;
  UPDATE public.strategy_items
  SET status = p_status, updated_by = p_member_id, updated_at = now()
  WHERE id = p_id AND workspace_id = p_workspace_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Item não encontrado.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.strategy_list(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.strategy_save(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.strategy_set_status(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.strategy_list(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.strategy_save(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.strategy_set_status(UUID, UUID, UUID, TEXT) TO authenticated;
