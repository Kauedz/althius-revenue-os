-- ==============================================================================
-- Migration: 20261002000097_unipile_webhook.sql
-- PR 04: receptor de webhook da Unipile. Funções que o serviço `webhooks` chama (só service_role).
--
-- 1. unipile_set_account_status: a conexão de uma conta caiu, pede atenção ou voltou.
--    Atualiza messaging_accounts e audita só quando o status MUDA (avisos repetidos não geram linha).
-- 2. unipile_handle_new_relation: o LinkedIn aceitou um convite. O workspace vem da CONTA de mensagem
--    (nunca de parâmetro), então o mesmo perfil em outro cliente não é tocado.
-- 3. Endurecimento (ADR 0023): as duas funções antigas da 0014 ganham search_path fixo.
--    Os corpos já qualificam tudo com public.; ALTER FUNCTION não mexe nas permissões.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.unipile_set_account_status(p_unipile_account_id TEXT, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_conta public.messaging_accounts;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('connected', 'attention', 'disconnected') THEN
    RAISE EXCEPTION 'Status de conexão inválido: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_conta FROM public.messaging_accounts WHERE unipile_account_id = p_unipile_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'messaging_account_not_found');
  END IF;

  IF v_conta.status = p_status THEN
    RETURN jsonb_build_object('action', 'unchanged', 'status', p_status);
  END IF;

  UPDATE public.messaging_accounts SET status = p_status WHERE id = v_conta.id;

  PERFORM public.audit_write(
    v_conta.workspace_id, NULL, 'messaging_account.status_changed', 'messaging_account', v_conta.id::text,
    jsonb_build_object('provider', v_conta.provider, 'de', v_conta.status, 'para', p_status)
  );

  RETURN jsonb_build_object('action', 'updated', 'status', p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.unipile_set_account_status(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_set_account_status(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.unipile_set_account_status IS
  'Webhook da Unipile: muda o status da conexão (connected, attention, disconnected) e audita a mudança. Só backend.';

CREATE OR REPLACE FUNCTION public.unipile_handle_new_relation(p_unipile_account_id TEXT, p_linkedin_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_conta public.messaging_accounts;
BEGIN
  SELECT * INTO v_conta FROM public.messaging_accounts WHERE unipile_account_id = p_unipile_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'messaging_account_not_found');
  END IF;

  IF public.unipile_handle_linkedin_connected(v_conta.workspace_id, p_linkedin_identifier) THEN
    RETURN jsonb_build_object('action', 'connected');
  END IF;
  RETURN jsonb_build_object('action', 'ignored', 'reason', 'non_crm_contact');
END;
$$;
REVOKE ALL ON FUNCTION public.unipile_handle_new_relation(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_handle_new_relation(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.unipile_handle_new_relation IS
  'Webhook da Unipile: convite do LinkedIn aceito. O workspace é o da conta de mensagem. Só backend.';

ALTER FUNCTION public.unipile_ingest_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) SET search_path = '';
ALTER FUNCTION public.unipile_handle_linkedin_connected(UUID, TEXT) SET search_path = '';
