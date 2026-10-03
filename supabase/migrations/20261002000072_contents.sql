-- Conteudos do workspace: biblioteca, rascunho e publicacao.
-- Quem aprova copy (approvals.decide) cria e edita. Publicar chama o Hermes.
-- Se o Hermes pedir aprovacao, o status nao vira ativo.

CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('email', 'pdf', 'anuncio', 'roteiro', 'post')),
  persona TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_aprovacao', 'ativo')),
  updated_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_items IS 'Pecas de conteudo do workspace. Persona vazia nao e inventada.';

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros leem os conteudos do workspace"
  ON public.content_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = content_items.workspace_id
        AND wm.status = 'active'
    )
  );

REVOKE ALL ON public.content_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.content_items TO authenticated;

CREATE OR REPLACE FUNCTION public.content_list(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_itens JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'approvals.decide');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT c.id, c.name, c.format, c.persona, c.body, c.status, c.updated_at
    FROM public.content_items c
    WHERE c.workspace_id = p_workspace_id
  ) t;
  RETURN jsonb_build_object('ok', true, 'pode_editar', v_escopo IN ('all', 'assigned'), 'itens', v_itens);
END;
$$;

CREATE OR REPLACE FUNCTION public.content_save(
  p_workspace_id UUID, p_member_id UUID, p_id UUID, p_name TEXT, p_format TEXT, p_persona TEXT, p_body TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_id UUID;
  v_nome TEXT := btrim(COALESCE(p_name, ''));
  v_formato TEXT := btrim(COALESCE(p_format, ''));
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'approvals.decide');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não edita conteúdo.');
  END IF;
  IF v_formato NOT IN ('email', 'pdf', 'anuncio', 'roteiro', 'post') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Escolha o formato do conteúdo.');
  END IF;
  IF v_nome = '' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Dê um nome ao conteúdo.');
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.content_items (workspace_id, name, format, persona, body, status, updated_by)
    VALUES (p_workspace_id, v_nome, v_formato, btrim(COALESCE(p_persona, '')), btrim(COALESCE(p_body, '')), 'rascunho', p_member_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.content_items
    SET name = v_nome, format = v_formato, persona = btrim(COALESCE(p_persona, '')),
        body = btrim(COALESCE(p_body, '')), status = 'rascunho', updated_by = p_member_id, updated_at = now()
    WHERE id = p_id AND workspace_id = p_workspace_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Conteúdo não encontrado.');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- hermes_evaluate_action chama digest() sem esquema; search_path vazio escondia extensions.
CREATE OR REPLACE FUNCTION public.content_publish(p_workspace_id UUID, p_member_id UUID, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_escopo TEXT;
  v_nome TEXT;
  v_status TEXT;
  v_hermes JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'approvals.decide');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não edita conteúdo.');
  END IF;
  SELECT name, status INTO v_nome, v_status
  FROM public.content_items
  WHERE id = p_id AND workspace_id = p_workspace_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Conteúdo não encontrado.');
  END IF;
  IF v_status = 'ativo' THEN
    RETURN jsonb_build_object('ok', true, 'destino', 'publicado', 'mensagem', 'Este conteúdo já está publicado.');
  END IF;
  IF v_status = 'em_aprovacao' THEN
    RETURN jsonb_build_object('ok', true, 'destino', 'aprovacao', 'mensagem', 'A publicação já está em Aprovações. O conteúdo não foi publicado.');
  END IF;
  v_hermes := public.hermes_evaluate_action(
    p_workspace_id, p_member_id, 'approvals.decide', NULL, 0, false,
    'Publicar conteúdo: ' || left(v_nome, 60),
    jsonb_build_object('content_id', p_id)
  );
  IF v_hermes->>'status' = 'requires_approval' THEN
    UPDATE public.content_items SET status = 'em_aprovacao', updated_by = p_member_id, updated_at = now()
    WHERE id = p_id AND workspace_id = p_workspace_id;
    RETURN jsonb_build_object('ok', true, 'destino', 'aprovacao',
      'mensagem', 'A publicação foi para Aprovações. O conteúdo não foi publicado.');
  END IF;
  IF COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    UPDATE public.content_items SET status = 'ativo', updated_by = p_member_id, updated_at = now()
    WHERE id = p_id AND workspace_id = p_workspace_id;
    RETURN jsonb_build_object('ok', true, 'destino', 'publicado', 'mensagem', 'Conteúdo publicado.');
  END IF;
  RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_hermes->>'reason', 'A publicação não foi autorizada.'));
END;
$$;

REVOKE ALL ON FUNCTION public.content_list(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_save(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_publish(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_list(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_save(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_publish(UUID, UUID, UUID) TO authenticated;
