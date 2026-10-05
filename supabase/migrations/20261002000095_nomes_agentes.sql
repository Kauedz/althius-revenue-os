-- ==============================================================================
-- Migration: 20261002000095_nomes_agentes.sql
-- Nomes de exibição dos agentes no banco: Zoe, Jax, Lia e Neo (decisão do dono). Só a exibição muda:
-- os códigos (comercial, marketing, copy, revops) seguem iguais no banco, no Hermes e nas permissões.
--
-- As frases do canal não usam artigo ("ao Zoe", "O Lia" ficariam erradas em português):
--   "Pedido enviado para Zoe. A resposta chega aqui quando terminar."
--   "Neo não participa de #canal."
-- ==============================================================================

-- 1. O nome que o banco usa para cada agente (única fonte no banco).
CREATE OR REPLACE FUNCTION internal.nome_agente(p_code TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_code WHEN 'comercial' THEN 'Zoe' WHEN 'marketing' THEN 'Jax'
                     WHEN 'copy' THEN 'Lia' WHEN 'revops' THEN 'Neo' END;
$$;

-- 2. Chat: mesma função da 0088, só com as frases acima e o nome vindo de internal.nome_agente.
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
      RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_nome, 'O agente') || ' não participa de #' || p_slug || '.');
    END IF;
    IF v.papel = 'bdr' AND p_agente NOT IN ('comercial', 'copy') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'BDR conversa com ' || internal.nome_agente('comercial') || ' e ' || internal.nome_agente('copy') || '.');
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
    'Pedido no #' || p_slug || ' para ' || v_nome, jsonb_build_object('channel_id', v.id, 'agente', p_agente, 'mensagem', v_texto));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
    VALUES (p_workspace_id, v.id, 'system', 'O pedido para ' || v_nome || ' não foi enviado: ' || COALESCE(v_hermes->>'reason', 'pedido não autorizado.'));
    RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions SET agent_code = p_agente, title = 'Pedido no #' || p_slug || ': ' || left(v_texto, 80),
         execution_type = 'Conversa no canal', campaign_name = '#' || p_slug
  WHERE id = (v_hermes->>'execution_id')::uuid;
  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content, metadata)
  VALUES (p_workspace_id, v.id, 'system', 'Pedido enviado para ' || v_nome || '. A resposta chega aqui quando terminar.',
          jsonb_build_object('execution_id', v_hermes->>'execution_id'));
  RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'execution_id', v_hermes->>'execution_id');
END;
$$;

-- 3. Aviso de proposta de agente: "Zoe pede aprovação: ..." (mesma função da 0081, nome vindo de nome_agente).
CREATE OR REPLACE FUNCTION public.approvals_avisar_proposta_agente()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_agente TEXT := internal.nome_agente(NEW.agent_code);
BEGIN
  INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
  SELECT NEW.workspace_id, wm.id, 'approval_required',
         v_agente || ' pede aprovação: ' || NEW.title,
         COALESCE(NEW.preview, NEW.reason),
         'approval', NEW.id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista');
  RETURN NEW;
END;
$$;

-- 4. Nota da matriz de permissões (aparece na tela de papéis).
UPDATE public.role_permissions
   SET note = 'BDR conversa com ' || internal.nome_agente('comercial') || ' e ' || internal.nome_agente('copy') || '.'
 WHERE role_id = 'bdr' AND capability_key = 'agents.chat';
