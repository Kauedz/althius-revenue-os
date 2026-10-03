-- ==============================================================================
-- Migration: 20261002000088_chat.sql
-- Canais no banco: criar, mudar, arquivar canal; enviar, editar e reagir a mensagem; chamar agente.
-- Documento de regras: "Gerencia quem criou o canal ou um gestor"; "Agente chamado no canal debitar
-- crédito e respeitar o papel de quem chamou". O agente NÃO responde aqui: o pedido vai para a fila
-- pela política Hermes e a resposta chega quando o motor de execução terminar (nada inventado).
-- Escrita só por funções; arquivar guarda as mensagens.
-- ==============================================================================

ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Correção: as políticas antigas faziam "member_id IN (SELECT id FROM current_workspace_member())", mas essa
-- função não tem coluna id; o Postgres usava o id da própria linha e a comparação nunca batia. Resultado:
-- BDR nunca via os canais privados de que participa (nem as mensagens deles).
CREATE OR REPLACE FUNCTION public.meus_canais()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cm.channel_id FROM public.chat_channel_members cm
  JOIN public.workspace_members wm ON wm.id = cm.member_id
  WHERE wm.user_id = auth.uid() AND wm.status = 'active';
$$;
-- Só devolve os canais da própria pessoa (auth.uid()).
REVOKE ALL ON FUNCTION public.meus_canais() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meus_canais() TO authenticated;

DROP POLICY IF EXISTS "Members see accessible channels" ON public.chat_channels;
CREATE POLICY "Members see accessible channels" ON public.chat_channels
  FOR SELECT TO authenticated
  USING (
    archived_at IS NULL
    AND workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (
      is_general IS TRUE
      OR id IN (SELECT public.meus_canais())
      OR public.has_workspace_role(workspace_id, ARRAY['superadmin', 'estrategista', 'clevel'])
    )
  );

DROP POLICY IF EXISTS "Members see messages in accessible channels" ON public.chat_messages;
CREATE POLICY "Members see messages in accessible channels" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id));

REVOKE INSERT, UPDATE, DELETE ON public.chat_channels, public.chat_channel_members, public.chat_channel_agents, public.chat_messages
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_channels, public.chat_channel_members, public.chat_channel_agents, public.chat_messages TO authenticated;

CREATE OR REPLACE FUNCTION internal.nome_agente(p_code TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_code WHEN 'comercial' THEN 'Agente Comercial' WHEN 'marketing' THEN 'Agente de Marketing'
                     WHEN 'copy' THEN 'Agente de Copy' WHEN 'revops' THEN 'Agente de RevOps' END;
$$;
REVOKE ALL ON FUNCTION internal.nome_agente(TEXT) FROM PUBLIC, anon, authenticated;

-- Canal ativo do workspace que o membro pode ver, e se ele participa / gerencia.
CREATE OR REPLACE FUNCTION internal.canal_do_membro(p_workspace_id UUID, p_member_id UUID, p_slug TEXT)
RETURNS TABLE (id UUID, slug TEXT, geral BOOLEAN, participa BOOLEAN, gerencia BOOLEAN, papel TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, c.slug, c.is_general,
         (c.is_general OR EXISTS (SELECT 1 FROM public.chat_channel_members cm WHERE cm.channel_id = c.id AND cm.member_id = wm.id)),
         (c.created_by = wm.id OR wm.role IN ('superadmin', 'estrategista', 'clevel')),
         wm.role
  FROM public.chat_channels c
  JOIN public.workspace_members wm ON wm.id = p_member_id AND wm.workspace_id = c.workspace_id AND wm.status = 'active'
  WHERE c.workspace_id = p_workspace_id AND c.slug = p_slug AND c.archived_at IS NULL
    AND (c.is_general OR wm.role IN ('superadmin', 'estrategista', 'clevel')
         OR EXISTS (SELECT 1 FROM public.chat_channel_members cm WHERE cm.channel_id = c.id AND cm.member_id = wm.id));
$$;
REVOKE ALL ON FUNCTION internal.canal_do_membro(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_create_channel(p_workspace_id UUID, p_member_id UUID, p_nome TEXT, p_descricao TEXT, p_pessoas UUID[], p_agentes TEXT[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_slug TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  v_slug := left(btrim(regexp_replace(translate(lower(COALESCE(p_nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '-', 'g'), '-'), 40);
  IF v_slug = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Dê um nome ao canal.'); END IF;
  IF EXISTS (SELECT 1 FROM public.chat_channels WHERE workspace_id = p_workspace_id AND slug = v_slug) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já existe um canal #' || v_slug || '.');
  END IF;
  IF COALESCE(array_length(p_pessoas, 1), 0) = 0 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Adicione pelo menos uma pessoa.'); END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_pessoas) p WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = p AND m.workspace_id = p_workspace_id AND m.status = 'active')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só pessoas deste workspace entram no canal.');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_agentes, ARRAY[]::text[])) a WHERE a NOT IN ('comercial', 'marketing', 'copy', 'revops')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Agente desconhecido.');
  END IF;
  INSERT INTO public.chat_channels (workspace_id, slug, name, description, created_by)
  VALUES (p_workspace_id, v_slug, v_slug, NULLIF(btrim(COALESCE(p_descricao, '')), ''), p_member_id) RETURNING id INTO v_id;
  INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id)
  SELECT DISTINCT p_workspace_id, v_id, x FROM unnest(array_append(p_pessoas, p_member_id)) x ON CONFLICT DO NOTHING;
  INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id)
  SELECT DISTINCT p_workspace_id, v_id, a FROM unnest(COALESCE(p_agentes, ARRAY[]::text[])) a ON CONFLICT DO NOTHING;
  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, sender_member_id, content)
  VALUES (p_workspace_id, v_id, 'member', p_member_id, 'Criei o canal #' || v_slug || '.');
  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_update_channel(p_workspace_id UUID, p_member_id UUID, p_slug TEXT, p_pessoas UUID[], p_agentes TEXT[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.canal_do_membro(p_workspace_id, p_member_id, p_slug);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Canal não encontrado.'); END IF;
  IF NOT v.gerencia THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só quem criou o canal ou um gestor muda o canal.'); END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_agentes, ARRAY[]::text[])) a WHERE a NOT IN ('comercial', 'marketing', 'copy', 'revops')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Agente desconhecido.');
  END IF;
  IF NOT v.geral THEN
    IF COALESCE(array_length(p_pessoas, 1), 0) = 0 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Adicione pelo menos uma pessoa.'); END IF;
    IF EXISTS (SELECT 1 FROM unnest(p_pessoas) p WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = p AND m.workspace_id = p_workspace_id AND m.status = 'active')) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Só pessoas deste workspace entram no canal.');
    END IF;
    DELETE FROM public.chat_channel_members WHERE channel_id = v.id AND NOT (member_id = ANY (p_pessoas));
    INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id)
    SELECT DISTINCT p_workspace_id, v.id, x FROM unnest(p_pessoas) x ON CONFLICT DO NOTHING;
  END IF;
  DELETE FROM public.chat_channel_agents WHERE channel_id = v.id AND NOT (agent_id = ANY (COALESCE(p_agentes, ARRAY[]::text[])));
  INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id)
  SELECT DISTINCT p_workspace_id, v.id, a FROM unnest(COALESCE(p_agentes, ARRAY[]::text[])) a ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_archive_channel(p_workspace_id UUID, p_member_id UUID, p_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.canal_do_membro(p_workspace_id, p_member_id, p_slug);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Canal não encontrado.'); END IF;
  IF v.geral THEN RETURN jsonb_build_object('ok', false, 'erro', 'O canal #geral não pode ser arquivado.'); END IF;
  IF NOT v.gerencia THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só quem criou o canal ou um gestor muda o canal.'); END IF;
  UPDATE public.chat_channels SET archived_at = now() WHERE id = v.id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'canal.arquivado', 'chat_channel', v.id::text, jsonb_build_object('canal', p_slug));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_send(p_workspace_id UUID, p_member_id UUID, p_slug TEXT, p_texto TEXT, p_resposta JSONB, p_agente TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_hermes JSONB;
  v_nome TEXT := internal.nome_agente(p_agente);
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.canal_do_membro(p_workspace_id, p_member_id, p_slug);
  IF NOT FOUND OR NOT v.participa THEN RETURN jsonb_build_object('ok', false, 'erro', 'Canal não encontrado.'); END IF;
  IF v_texto = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem.'); END IF;
  IF length(v_texto) > 4000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Mensagem longa demais (até 4.000 caracteres).'); END IF;
  IF p_agente IS NOT NULL THEN
    IF v_nome IS NULL OR NOT EXISTS (SELECT 1 FROM public.chat_channel_agents a WHERE a.channel_id = v.id AND a.agent_id = p_agente) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'O ' || COALESCE(v_nome, 'agente') || ' não participa de #' || p_slug || '.');
    END IF;
    IF v.papel = 'bdr' AND p_agente NOT IN ('comercial', 'copy') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'BDR conversa com o Agente Comercial e o Agente de Copy.');
    END IF;
  END IF;

  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, sender_member_id, content, metadata)
  VALUES (p_workspace_id, v.id, 'member', p_member_id, v_texto,
          CASE WHEN p_resposta IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('resp', p_resposta) END);

  IF p_agente IS NULL THEN
    IF position('@' IN v_texto) > 0 AND NOT EXISTS (SELECT 1 FROM public.chat_channel_agents a WHERE a.channel_id = v.id) THEN
      INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
      VALUES (p_workspace_id, v.id, 'system', 'Nenhum agente participa de #' || p_slug || '. Adicione um em Pessoas e agentes.');
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Agente chamado: mesmas 4 checagens de qualquer ação (papel, dono do dado, decisão, créditos).
  v_hermes := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'agents.chat', NULL, 2, false,
    'Pedido no #' || p_slug || ' para o ' || v_nome, jsonb_build_object('channel_id', v.id, 'agente', p_agente, 'mensagem', v_texto));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
    VALUES (p_workspace_id, v.id, 'system', 'O ' || v_nome || ' não foi chamado: ' || COALESCE(v_hermes->>'reason', 'pedido não autorizado.'));
    RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions SET agent_code = p_agente, title = 'Pedido no #' || p_slug || ': ' || left(v_texto, 80),
         execution_type = 'Conversa no canal', campaign_name = '#' || p_slug
  WHERE id = (v_hermes->>'execution_id')::uuid;
  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content, metadata)
  VALUES (p_workspace_id, v.id, 'system', 'Pedido enviado ao ' || v_nome || '. A resposta chega aqui quando ele terminar.',
          jsonb_build_object('execution_id', v_hermes->>'execution_id'));
  RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'execution_id', v_hermes->>'execution_id');
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_edit_message(p_workspace_id UUID, p_member_id UUID, p_message_id UUID, p_texto TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF v_texto = '' OR length(v_texto) > 4000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem.'); END IF;
  UPDATE public.chat_messages SET content = v_texto, metadata = metadata || '{"editada": true}'::jsonb
  WHERE id = p_message_id AND workspace_id = p_workspace_id AND sender_type = 'member' AND sender_member_id = p_member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só quem escreveu edita a mensagem.'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_react(p_workspace_id UUID, p_member_id UUID, p_message_id UUID, p_emoji TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_msg RECORD;
  v_slug TEXT;
  v_lista JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF p_emoji IS NULL OR p_emoji NOT IN ('👍', '❤️', '😆', '😮', '😢', '🙏', '🔥', '👏', '🎯', '✅', '👀', '🚀') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Reação desconhecida.');
  END IF;
  SELECT m.id, m.metadata, c.slug INTO v_msg FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id
  WHERE m.id = p_message_id AND m.workspace_id = p_workspace_id FOR UPDATE OF m;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM internal.canal_do_membro(p_workspace_id, p_member_id, v_msg.slug)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensagem não encontrada.');
  END IF;
  v_lista := COALESCE(v_msg.metadata->'reacoes'->p_emoji, '[]'::jsonb);
  IF v_lista ? p_member_id::text THEN
    v_lista := (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements_text(v_lista) x WHERE x <> p_member_id::text);
  ELSE
    v_lista := v_lista || to_jsonb(p_member_id::text);
  END IF;
  UPDATE public.chat_messages
  SET metadata = CASE WHEN jsonb_array_length(v_lista) = 0
                      THEN jsonb_set(metadata, '{reacoes}', COALESCE(metadata->'reacoes', '{}'::jsonb) - p_emoji)
                      ELSE jsonb_set(metadata, '{reacoes}', COALESCE(metadata->'reacoes', '{}'::jsonb) || jsonb_build_object(p_emoji, v_lista)) END
  WHERE id = p_message_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.chat_create_channel(UUID, UUID, TEXT, TEXT, UUID[], TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_update_channel(UUID, UUID, TEXT, UUID[], TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_archive_channel(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_send(UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_edit_message(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_react(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_create_channel(UUID, UUID, TEXT, TEXT, UUID[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_update_channel(UUID, UUID, TEXT, UUID[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_archive_channel(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_send(UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_edit_message(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_react(UUID, UUID, UUID, TEXT) TO authenticated;
