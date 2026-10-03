-- ==============================================================================
-- Migration: 20261002000061_notifications.sql
-- Notificações funcionais por membro e marcação como lida (ADR 0036).
-- ==============================================================================

-- 1. Permissões de tabela explícitas (PostgREST schema cache)
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 2. Política RLS para UPDATE de notificações (marcar como lida)
CREATE POLICY "Members can mark their own notifications as read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    recipient_member_id IN (
      SELECT id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_member_id IN (
      SELECT id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- 3. Função RPC para marcar notificações como lidas com segurança
CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_member_id UUID,
  p_notification_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  -- ADR 0023: validação de segurança de quem está chamando
  PERFORM public.assert_caller_is_member(p_member_id);

  IF p_notification_id IS NOT NULL THEN
    UPDATE public.notifications
    SET read_at = now()
    WHERE id = p_notification_id
      AND recipient_member_id = p_member_id
      AND read_at IS NULL;
  ELSE
    UPDATE public.notifications
    SET read_at = now()
    WHERE recipient_member_id = p_member_id
      AND read_at IS NULL;
  END IF;
END;
$func$;

COMMENT ON FUNCTION public.mark_notifications_read(UUID, UUID) IS
  'Marca uma ou todas as notificações pendentes de um membro como lidas.';

-- 4. Privilégios restritos (ADR 0023)
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID, UUID) TO authenticated;

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';