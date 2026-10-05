-- ==============================================================================
-- Migration: 20261002000099_unipile_status_avisa_dono.sql
-- Correção da 0097 (que já está na master e não muda): quando a conexão de uma conta de mensagem
-- piora (atenção ou desligada), o DONO da conta recebe uma notificação. O roteiro do PR 04 pedia o aviso.
-- Só avisa quando o status MUDA para pior; voltar a "conectada" ou repetir o mesmo status não avisa.
-- CREATE OR REPLACE preserva as permissões (só service_role) da 0097.
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

  IF p_status <> 'connected' THEN
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (
      v_conta.workspace_id, v_conta.member_id, 'conexao_atencao',
      'Sua conta de mensagens precisa ser reconectada',
      CASE WHEN p_status = 'attention' THEN 'A conexão pede uma nova autorização. Reconecte na Caixa de entrada para voltar a receber respostas.'
           ELSE 'A conexão foi desligada. Reconecte na Caixa de entrada para voltar a receber respostas.' END,
      'messaging_account', v_conta.id
    );
  END IF;

  RETURN jsonb_build_object('action', 'updated', 'status', p_status);
END;
$$;
