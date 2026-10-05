-- ==============================================================================
-- Migration: 20261002000098_conexao_contas.sql
-- PR 05: conexão das contas de mensagem pelo assistente hospedado (ADR 0017: a conta é da PESSOA).
--
-- Fluxo: a tela chama o backend; o backend chama messaging_connect_start COMO A PESSOA (com o login dela),
-- recebe um pedido (id único, vale 30 min) e gera o link do assistente usando esse id como "nome".
-- Quando a conexão dá certo, o aviso volta ao backend, que chama unipile_complete_connection
-- (só service_role) com o id do pedido. O pedido fixa de quem é a conta: o aviso externo nunca decide o dono.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.messaging_connect_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('linkedin', 'whatsapp', 'instagram', 'google', 'microsoft', 'imap')),
  kind TEXT NOT NULL CHECK (kind IN ('create', 'reconnect')),
  reconnect_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messaging_connect_requests IS
  'Pedidos de conexão de conta de mensagem (um por clique em Conectar). Fixam o dono da conta. Só o banco acessa.';

CREATE INDEX IF NOT EXISTS idx_messaging_connect_requests_member ON public.messaging_connect_requests (member_id, provider);

-- RLS ligada e nenhuma política: a tela não enxerga esta tabela (ADR 0023).
ALTER TABLE public.messaging_connect_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messaging_connect_requests FROM PUBLIC, anon, authenticated;

-- Confere quem está logado e devolve o membro ativo. Erro 42501 em qualquer dúvida.
CREATE OR REPLACE FUNCTION internal.exigir_membro_proprio(p_workspace_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_caller_is_member(p_member_id);
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RAISE EXCEPTION 'O membro informado não pertence a este workspace.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.check_permission(p_workspace_id, 'inbox.connect', p_member_id) THEN
    RAISE EXCEPTION 'Seu papel não pode conectar contas de mensagem.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION internal.exigir_membro_proprio(UUID, UUID) FROM PUBLIC, anon, authenticated;

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
  IF FOUND THEN v_tipo := 'reconnect'; END IF;

  INSERT INTO public.messaging_connect_requests (workspace_id, member_id, provider, kind, reconnect_account_id)
  VALUES (p_workspace_id, p_member_id, p_provider, v_tipo, v_existente.unipile_account_id)
  RETURNING id INTO v_pedido;

  RETURN jsonb_build_object('request_id', v_pedido, 'type', v_tipo, 'provider', p_provider, 'reconnect_account_id', v_existente.unipile_account_id);
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_connect_start(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_connect_start(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.messaging_connect_start IS
  'Abre um pedido de conexão da PRÓPRIA conta de mensagem (create ou reconnect). Só quem está logado, só para si.';

-- Conclui o pedido. Idempotente: o mesmo aviso de novo não muda nada.
CREATE OR REPLACE FUNCTION public.unipile_complete_connection(p_request_id UUID, p_unipile_account_id TEXT, p_display_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pedido public.messaging_connect_requests;
  v_conta public.messaging_accounts;
  v_conta_id UUID;
BEGIN
  IF p_unipile_account_id IS NULL OR btrim(p_unipile_account_id) = '' THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'account_id_missing');
  END IF;

  SELECT * INTO v_pedido FROM public.messaging_connect_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'request_not_found');
  END IF;
  IF v_pedido.status = 'done' THEN
    RETURN jsonb_build_object('action', 'unchanged');
  END IF;
  IF v_pedido.expires_at < now() THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'request_expired');
  END IF;

  -- A conta externa já pertence a outra pessoa/provedor? Nunca se transfere por aviso.
  SELECT * INTO v_conta FROM public.messaging_accounts WHERE unipile_account_id = p_unipile_account_id;
  IF FOUND AND (v_conta.member_id <> v_pedido.member_id OR v_conta.provider <> v_pedido.provider) THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'account_already_linked');
  END IF;

  -- Mesma pessoa e mesmo provedor: o MESMO registro é reaproveitado (reconectar não cria outro).
  SELECT * INTO v_conta FROM public.messaging_accounts WHERE member_id = v_pedido.member_id AND provider = v_pedido.provider;
  IF FOUND THEN
    UPDATE public.messaging_accounts
       SET unipile_account_id = p_unipile_account_id, status = 'connected', reconnect_url = NULL,
           display_name = COALESCE(NULLIF(btrim(p_display_name), ''), display_name)
     WHERE id = v_conta.id;
    v_conta_id := v_conta.id;
  ELSE
    INSERT INTO public.messaging_accounts (workspace_id, member_id, provider, unipile_account_id, display_name, status)
    VALUES (v_pedido.workspace_id, v_pedido.member_id, v_pedido.provider, p_unipile_account_id, NULLIF(btrim(p_display_name), ''), 'connected')
    RETURNING id INTO v_conta_id;
  END IF;

  UPDATE public.messaging_connect_requests SET status = 'done' WHERE id = v_pedido.id;

  PERFORM public.audit_write(
    v_pedido.workspace_id, NULL, 'messaging_account.connected', 'messaging_account', v_conta_id::text,
    jsonb_build_object('provider', v_pedido.provider, 'tipo', v_pedido.kind, 'unipile_account_id', p_unipile_account_id)
  );

  RETURN jsonb_build_object('action', 'connected', 'messaging_account_id', v_conta_id);
END;
$$;
REVOKE ALL ON FUNCTION public.unipile_complete_connection(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_complete_connection(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.unipile_complete_connection IS
  'Webhook de conexão: conclui o pedido e grava a conta no membro que pediu. Reconectar reaproveita o registro. Só backend.';

-- A pessoa desliga a própria conexão (a conta externa é encerrada por fora; aqui só para de entrar mensagem).
CREATE OR REPLACE FUNCTION public.messaging_disconnect(p_workspace_id UUID, p_member_id UUID, p_provider TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_conta public.messaging_accounts;
BEGIN
  PERFORM internal.exigir_membro_proprio(p_workspace_id, p_member_id);

  SELECT * INTO v_conta FROM public.messaging_accounts WHERE member_id = p_member_id AND provider = p_provider AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'messaging_account_not_found');
  END IF;
  IF v_conta.status = 'disconnected' THEN
    RETURN jsonb_build_object('action', 'unchanged');
  END IF;

  UPDATE public.messaging_accounts SET status = 'disconnected' WHERE id = v_conta.id;
  PERFORM public.audit_write(
    p_workspace_id, auth.uid(), 'messaging_account.disconnected', 'messaging_account', v_conta.id::text,
    jsonb_build_object('provider', v_conta.provider, 'de', v_conta.status)
  );
  RETURN jsonb_build_object('action', 'disconnected');
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_disconnect(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_disconnect(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.messaging_disconnect IS
  'A pessoa desliga a própria conexão de mensagem (para de entrar na Caixa de entrada). Só quem está logado, só a própria.';
