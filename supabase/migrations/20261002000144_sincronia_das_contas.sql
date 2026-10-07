-- ==============================================================================
-- Migration: 20261002000144_sincronia_das_contas.sql
-- ADR 0070. O serviço de envio (`cadencia`) passa a CONFERIR com a ponte (Unipile) o que o banco já sabe, sem depender só de
-- aviso por webhook (que se perde, ou nem chega quando o sistema ainda não tem endereço público):
--   - pedidos de conexão ainda abertos (dono já fixado pelo pedido) para achar a conta recém-conectada;
--   - as contas já registradas e seu estado, para a tela mostrar "reconectar" quando a ponte avisar que caiu.
-- Esta função só LÊ e só o serviço chama; quem grava são as funções que já existem (unipile_complete_connection e
-- unipile_set_account_status).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.messaging_sync_state()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'pendentes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'provider', r.provider, 'criado_em', r.created_at) ORDER BY r.created_at)
                             FROM public.messaging_connect_requests r WHERE r.status = 'pending' AND r.expires_at > now()), '[]'::jsonb),
    'registradas', COALESCE((SELECT jsonb_agg(jsonb_build_object('conta', a.unipile_account_id, 'provider', a.provider, 'status', a.status))
                               FROM public.messaging_accounts a), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.messaging_sync_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_sync_state() TO service_role;
