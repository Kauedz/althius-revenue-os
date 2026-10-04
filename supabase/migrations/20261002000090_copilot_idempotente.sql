-- ==============================================================================
-- Migration: 20261002000090_copilot_idempotente.sql
-- Correções do Copiloto (migration 89):
--  1. Chave de envio: repetir o mesmo pedido (duplo clique, nova tentativa) devolve o pedido já criado,
--     sem segunda execução, cobrança, aprovação ou aviso ao C-level.
--  2. Pedido que o Hermes manda para Aprovações (teto, limite mensal ou saldo) volta como "enviado
--     para Aprovações", não como falha.
-- A execução não recebe agente: o Copiloto não escolhe um dos 4 agentes. Quem classifica o pedido é o
-- motor de execução (ADR 0024); inventar um agente aqui seria dado falso.
-- ==============================================================================

DROP FUNCTION public.copilot_request(UUID, UUID, TEXT);

CREATE FUNCTION public.copilot_request(p_workspace_id UUID, p_member_id UUID, p_texto TEXT, p_chave UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_hermes JSONB;
  v_existente UUID;
  v_aprovacao UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF v_texto = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva o pedido.'); END IF;
  IF length(v_texto) > 4000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Pedido longo demais (até 4.000 caracteres).'); END IF;
  IF p_chave IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Pedido sem chave de envio.'); END IF;

  -- Duas chamadas com a mesma chave ao mesmo tempo esperam uma pela outra.
  PERFORM pg_advisory_xact_lock(hashtextextended('copilot_request:' || p_chave::text, 0));
  SELECT e.id INTO v_existente FROM public.executions e
  WHERE e.workspace_id = p_workspace_id AND e.requested_by_member_id = p_member_id AND e.metadata_json->>'chave' = p_chave::text;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'execution_id', v_existente, 'repetido', true);
  END IF;
  SELECT a.id INTO v_aprovacao FROM public.approvals a
  WHERE a.workspace_id = p_workspace_id AND a.requested_by_member_id = p_member_id AND a.payload_json->>'chave' = p_chave::text;
  IF v_aprovacao IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'requires_approval', 'approval_id', v_aprovacao, 'repetido', true);
  END IF;

  v_hermes := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'agents.chat', NULL, 2, false,
    'Copiloto: ' || left(v_texto, 80), jsonb_build_object('pedido', v_texto, 'chave', p_chave));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    IF v_hermes->>'status' = 'requires_approval' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'requires_approval', 'approval_id', v_hermes->>'approval_id', 'motivo', v_hermes->>'reason');
    END IF;
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_hermes->>'reason', 'Pedido não autorizado.'), 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions
  SET title = 'Copiloto: ' || left(v_texto, 80), execution_type = 'Pedido ao Copiloto', campaign_name = 'Copiloto'
  WHERE id = (v_hermes->>'execution_id')::uuid;
  RETURN jsonb_build_object('ok', true, 'execution_id', v_hermes->>'execution_id');
END;
$$;
REVOKE ALL ON FUNCTION public.copilot_request(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_request(UUID, UUID, TEXT, UUID) TO authenticated;
