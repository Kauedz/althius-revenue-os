-- ==============================================================================
-- Migration: 20261002000124_conversa_direta_agente.sql
-- Conversa direta e PRIVADA de uma pessoa com um agente (várias conversas = threads). Reaproveita o canal, a fila, o harness
-- e o Hermes: é um canal de um tipo próprio (`direto`) com uma pessoa, um agente e resposta sempre ligada (ADR 0045).
--  - Fora da lista de Canais (o front filtra por tipo) e visível SÓ para a própria pessoa: nem estrategista, nem C-level,
--    nem superadmin leem (a política de leitura de canais exclui o tipo `direto` de quem não participa).
--  - BDR só conversa com Zoe e Lia (mesma regra do harness).
-- ==============================================================================

ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'canal';
ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_kind_check;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_kind_check CHECK (kind IN ('canal', 'direto'));

-- Quem enxerga o canal: o geral, os que participa e, para os papéis de gestão, os demais; conversa direta só quem participa.
DROP POLICY IF EXISTS "Members see accessible channels" ON public.chat_channels;
CREATE POLICY "Members see accessible channels" ON public.chat_channels FOR SELECT TO authenticated
  USING (
    archived_at IS NULL
    AND workspace_id IN (SELECT w.workspace_id FROM public.current_workspace_member() w)
    AND (
      id IN (SELECT public.meus_canais())
      OR (kind = 'canal' AND (is_general IS TRUE OR public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])))
    )
  );

CREATE OR REPLACE FUNCTION public.agent_direct_create(p_workspace_id UUID, p_member_id UUID, p_agente TEXT, p_titulo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_papel TEXT;
  v_titulo TEXT := left(COALESCE(NULLIF(btrim(p_titulo), ''), 'Nova conversa'), 80);
  v_slug TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT wm.role INTO v_papel FROM public.workspace_members wm WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';
  IF v_papel IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.'); END IF;
  IF p_agente IS NULL OR p_agente NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Agente desconhecido.'); END IF;
  IF v_papel = 'bdr' AND p_agente NOT IN ('comercial', 'copy') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel conversa só com a Zoe e a Lia.'); END IF;

  v_slug := 'dm-' || p_agente || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  INSERT INTO public.chat_channels (workspace_id, slug, name, description, created_by, kind)
  VALUES (p_workspace_id, v_slug, v_slug, v_titulo, p_member_id, 'direto') RETURNING id INTO v_id;
  INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id) VALUES (p_workspace_id, v_id, p_member_id);
  INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id, reply_policy) VALUES (p_workspace_id, v_id, p_agente, 'always');
  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
END;
$$;

-- As conversas diretas de UMA pessoa com UM agente, mais recentes primeiro.
CREATE OR REPLACE FUNCTION public.agent_direct_list(p_workspace_id UUID, p_member_id UUID, p_agente TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  RETURN COALESCE((
    SELECT jsonb_agg(x.linha ORDER BY x.ultimo DESC)
    FROM (
      SELECT COALESCE(max(m.created_at), c.created_at) AS ultimo,
             jsonb_build_object(
               'slug', c.slug, 'titulo', c.description, 'criada_em', c.created_at, 'atualizada_em', COALESCE(max(m.created_at), c.created_at),
               'ultima', (SELECT left(mm.content, 120) FROM public.chat_messages mm WHERE mm.channel_id = c.id ORDER BY mm.created_at DESC LIMIT 1),
               'aguardando', EXISTS (SELECT 1 FROM public.agent_channel_queue q WHERE q.channel_id = c.id AND q.status IN ('pending', 'in_flight'))
             ) AS linha
      FROM public.chat_channels c
      JOIN public.chat_channel_members cm ON cm.channel_id = c.id AND cm.member_id = p_member_id
      JOIN public.chat_channel_agents ca ON ca.channel_id = c.id AND ca.agent_id = p_agente
      LEFT JOIN public.chat_messages m ON m.channel_id = c.id
      WHERE c.workspace_id = p_workspace_id AND c.kind = 'direto' AND c.archived_at IS NULL
      GROUP BY c.id
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_direct_title(p_workspace_id UUID, p_member_id UUID, p_slug TEXT, p_titulo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_titulo TEXT := NULLIF(btrim(COALESCE(p_titulo, '')), '');
  v_n INTEGER;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF v_titulo IS NULL OR length(v_titulo) > 80 THEN RETURN jsonb_build_object('ok', false, 'erro', 'O título precisa ter de 1 a 80 caracteres.'); END IF;
  UPDATE public.chat_channels c SET description = v_titulo, updated_at = now()
   WHERE c.workspace_id = p_workspace_id AND c.slug = p_slug AND c.kind = 'direto'
     AND EXISTS (SELECT 1 FROM public.chat_channel_members cm WHERE cm.channel_id = c.id AND cm.member_id = p_member_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_direct_archive(p_workspace_id UUID, p_member_id UUID, p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  UPDATE public.chat_channels c SET archived_at = now(), updated_at = now()
   WHERE c.workspace_id = p_workspace_id AND c.slug = p_slug AND c.kind = 'direto' AND c.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.chat_channel_members cm WHERE cm.channel_id = c.id AND cm.member_id = p_member_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Ações de tela (ADR 0023): só quem está logado; cada função confere que o membro é quem está logado.
REVOKE ALL ON FUNCTION public.agent_direct_create(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_direct_list(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_direct_title(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_direct_archive(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_direct_create(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_direct_list(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_direct_title(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_direct_archive(UUID, UUID, TEXT) TO authenticated;
