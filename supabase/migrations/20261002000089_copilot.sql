-- ==============================================================================
-- Migration: 20261002000089_copilot.sql
-- Copiloto no modo real: o pedido passa pelas 4 checagens da política Hermes (papel, dono do dado,
-- decisão, créditos) e vira execução na fila. O protótipo simulava plano, resultado e progresso;
-- aqui nada é simulado: o plano e o resultado chegam quando o motor de execução (Hermes Agent) rodar.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.copilot_request(p_workspace_id UUID, p_member_id UUID, p_texto TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_hermes JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF v_texto = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva o pedido.'); END IF;
  IF length(v_texto) > 4000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Pedido longo demais (até 4.000 caracteres).'); END IF;
  v_hermes := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'agents.chat', NULL, 2, false,
    'Copiloto: ' || left(v_texto, 80), jsonb_build_object('pedido', v_texto));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_hermes->>'reason', 'Pedido não autorizado.'), 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions
  SET title = 'Copiloto: ' || left(v_texto, 80), execution_type = 'Pedido ao Copiloto', campaign_name = 'Copiloto'
  WHERE id = (v_hermes->>'execution_id')::uuid;
  RETURN jsonb_build_object('ok', true, 'execution_id', v_hermes->>'execution_id');
END;
$$;
REVOKE ALL ON FUNCTION public.copilot_request(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_request(UUID, UUID, TEXT) TO authenticated;
