-- ==============================================================================
-- Migration: 20261002000085_inbox.sql
-- Caixa de entrada no banco.
-- 1. Correção de vazamento: a política antiga de messages deixava qualquer membro do workspace ler
--    todas as mensagens (inclusive de conversas de outro BDR). Agora a mensagem segue a conversa.
-- 2. inbox_mark_read: só o dono da conexão marca como lida (quem só lê não apaga o "não lida" do BDR).
-- 3. inbox_request_reply: "Sugerir resposta" vira pedido ao Agente de Copy pela política Hermes.
-- 4. inbox_opt_out: "Excluir contato do CRM" (LGPD) apaga contato, conversas e mensagens.
-- ==============================================================================

DROP POLICY IF EXISTS "Authorized members view messages" ON public.messages;
CREATE POLICY "Mensagem visível para quem vê a conversa" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id));

-- Conversa visível para o membro (mesma regra da política de conversations) e se ele é o dono da conexão.
CREATE OR REPLACE FUNCTION internal.conversa_do_membro(p_workspace_id UUID, p_member_id UUID, p_conversation_id UUID)
RETURNS TABLE (visivel BOOLEAN, dono BOOLEAN, contato UUID, nome_contato TEXT, papel TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (wm.role IN ('superadmin', 'estrategista', 'clevel') OR ma.member_id = wm.id) AS visivel,
    ma.member_id = wm.id AS dono,
    c.contact_id, ct.name, wm.role
  FROM public.conversations c
  JOIN public.messaging_accounts ma ON ma.id = c.messaging_account_id
  JOIN public.contacts ct ON ct.id = c.contact_id
  JOIN public.workspace_members wm ON wm.id = p_member_id AND wm.workspace_id = c.workspace_id AND wm.status = 'active'
  WHERE c.id = p_conversation_id AND c.workspace_id = p_workspace_id;
$$;
REVOKE ALL ON FUNCTION internal.conversa_do_membro(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inbox_mark_read(p_workspace_id UUID, p_member_id UUID, p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.conversa_do_membro(p_workspace_id, p_member_id, p_conversation_id);
  IF NOT FOUND OR NOT v.visivel THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.');
  END IF;
  IF v.dono THEN
    UPDATE public.conversations SET unread = false WHERE id = p_conversation_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.inbox_request_reply(p_workspace_id UUID, p_member_id UUID, p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
  v_hermes JSONB;
  v_titulo TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.conversa_do_membro(p_workspace_id, p_member_id, p_conversation_id);
  IF NOT FOUND OR NOT v.visivel THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.');
  END IF;
  v_titulo := 'Sugerir resposta para ' || v.nome_contato;
  -- Mesmas 4 checagens de qualquer ação (papel, dono do dado, decisão, créditos).
  v_hermes := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'agents.chat', NULL, 5, false, v_titulo,
    jsonb_build_object('acao', 'sugerir_resposta', 'conversation_id', p_conversation_id));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_hermes->>'reason', 'Pedido não autorizado.'), 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions
  SET agent_code = 'copy', title = v_titulo, execution_type = 'Sugestão de resposta', campaign_name = 'Caixa de entrada'
  WHERE id = (v_hermes->>'execution_id')::uuid;
  RETURN jsonb_build_object('ok', true, 'execution_id', v_hermes->>'execution_id');
END;
$$;

CREATE OR REPLACE FUNCTION public.inbox_opt_out(p_workspace_id UUID, p_member_id UUID, p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
  v_escopo TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.conversa_do_membro(p_workspace_id, p_member_id, p_conversation_id);
  IF NOT FOUND OR NOT v.visivel THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.');
  END IF;
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'accounts.edit');
  -- BDR ("só o seu") exclui contatos das próprias conversas; quem tem "Sim" exclui qualquer um.
  IF NOT (v_escopo IN ('all', 'assigned') OR (v_escopo = 'own' AND v.dono)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não exclui contatos do CRM.');
  END IF;
  DELETE FROM public.contacts WHERE id = v.contato AND workspace_id = p_workspace_id;
  -- Sem nome nem conteúdo: só o fato e quem pediu (o titular pediu para sair).
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'lgpd.contato_excluido', 'contact', v.contato::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_mark_read(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_request_reply(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_opt_out(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_mark_read(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_request_reply(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_opt_out(UUID, UUID, UUID) TO authenticated;
