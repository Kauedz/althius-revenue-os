-- ==============================================================================
-- Migration: 20261002000122_agente_contexto_integracoes.sql
-- Agentes conectados, ticket 04: o agente lê em apps conectados (HubSpot, Notion...) com o acesso de QUEM PEDIU
-- (decisão do dono, 06/10/2026). Quem pediu é a pessoa da mensagem mais recente da rodada em andamento do agente
-- no canal (uma rodada por vez por agente, ADR 0045). Função de SISTEMA: só service_role (o serviço de integrações a
-- chama depois de receber o token do agente). O token já confere pausa e isolamento por workspace (agent_runtime_resolve).
-- Sem rodada em andamento não há solicitante: o agente nunca usa o acesso de ninguém fora de um pedido.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.integration_agent_context(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_membro UUID;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  SELECT m.sender_member_id INTO v_membro
    FROM public.agent_channel_runs r
    JOIN public.agent_channel_queue q ON q.run_id = r.id
    JOIN public.chat_messages m ON m.id = q.message_id
    JOIN public.workspace_members wm ON wm.id = m.sender_member_id AND wm.workspace_id = r.workspace_id AND wm.status = 'active'
   WHERE r.workspace_id = v.workspace_id AND r.agent_id = v.agent_code AND r.status = 'in_flight'
     AND m.sender_type = 'member'
   ORDER BY m.created_at DESC
   LIMIT 1;
  RETURN jsonb_build_object('workspace_id', v.workspace_id, 'agent_code', v.agent_code, 'requester_member_id', v_membro);
END;
$$;

-- Auditoria do uso de um app por um agente (só nomes: nunca argumentos, tokens nem o conteúdo devolvido pelo app).
-- A tabela é encadeada: o trigger preenche sequência e hash (ADR 0038); aqui nunca se grava isso à mão.
CREATE OR REPLACE FUNCTION public.integration_agent_log(p_workspace_id UUID, p_agent_code TEXT, p_member_id UUID, p_integracao TEXT, p_ferramenta TEXT, p_resultado TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_agent_code IS NULL OR p_agent_code NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN
    RAISE EXCEPTION 'Agente desconhecido.' USING ERRCODE = '22023';
  END IF;
  IF p_resultado IS NULL OR p_resultado NOT IN ('ok', 'erro', 'negado') THEN
    RAISE EXCEPTION 'Resultado inválido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_logs (workspace_id, actor_member_id, actor_role, action, entity_type, new_values)
  VALUES (p_workspace_id, NULL, 'agent', 'agente_usou_integracao', 'integration',
          jsonb_build_object('agente', p_agent_code, 'em_nome_de', p_member_id, 'integracao', left(COALESCE(p_integracao, ''), 60),
                             'ferramenta', left(COALESCE(p_ferramenta, ''), 100), 'resultado', p_resultado));
END;
$$;

REVOKE ALL ON FUNCTION public.integration_agent_context(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_agent_log(UUID, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_agent_log(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_agent_context(TEXT) TO service_role;
