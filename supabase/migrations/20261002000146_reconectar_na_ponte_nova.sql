-- ==============================================================================
-- Migration: 20261002000146_reconectar_na_ponte_nova.sql
-- ADR 0071. Troca de conta ou de ponte (as contas gratuitas de 7 dias da Unipile se revezam): as contas conectadas somem da ponte
-- nova e a sincronia as marca como "desconectada". Para reconectar, o botão não pode pedir à ponte nova que "reconecte" um id
-- que ela nunca viu: sendo "desconectada", o pedido vira uma conexão nova. O registro da pessoa e do canal é o MESMO, então
-- conversas e mensagens continuam. (Mesma função de antes, só com isso a mais.)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.messaging_connect_start(p_workspace_id UUID, p_member_id UUID, p_provider TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existente public.messaging_accounts;
  v_tipo TEXT := 'create';
  v_pedido UUID;
BEGIN
  PERFORM internal.exigir_membro_proprio(p_workspace_id, p_member_id);
  IF p_provider IS NULL OR p_provider NOT IN ('linkedin', 'whatsapp', 'instagram', 'google', 'microsoft', 'imap') THEN
    RAISE EXCEPTION 'Provedor de mensagem inválido: %', p_provider USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existente FROM public.messaging_accounts WHERE member_id = p_member_id AND provider = p_provider;
  -- Conta que a ponte já nem lista (desconectada: outra conta da Unipile, outra ponte) não tem o que "reconectar": começa do zero,
  -- mas o registro e o histórico são os mesmos (unipile_complete_connection reaproveita o registro da pessoa e do canal).
  IF FOUND AND v_existente.status <> 'disconnected' THEN v_tipo := 'reconnect'; END IF;

  INSERT INTO public.messaging_connect_requests (workspace_id, member_id, provider, kind, reconnect_account_id)
  VALUES (p_workspace_id, p_member_id, p_provider, v_tipo, CASE WHEN v_tipo = 'reconnect' THEN v_existente.unipile_account_id END)
  RETURNING id INTO v_pedido;

  RETURN jsonb_build_object('request_id', v_pedido, 'type', v_tipo, 'provider', p_provider, 'reconnect_account_id', CASE WHEN v_tipo = 'reconnect' THEN v_existente.unipile_account_id END);
END;
$$;
