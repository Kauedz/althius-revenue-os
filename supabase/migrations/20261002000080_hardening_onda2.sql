-- ==============================================================================
-- Migration: 20261002000080_hardening_onda2.sql
-- Revisão da onda 2 (Início e Notificações):
-- 1. get_home_summary é SECURITY DEFINER e não fixava search_path (risco de sequestro de função).
-- 2. A pessoa podia editar título, texto e destinatário das próprias notificações; só precisa do "lida em".
-- ==============================================================================

ALTER FUNCTION public.get_home_summary(uuid, uuid) SET search_path = public, pg_temp;

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
