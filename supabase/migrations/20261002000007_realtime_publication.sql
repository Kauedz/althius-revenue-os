-- ==============================================================================
-- Migration: 20261002000007_realtime_publication.sql
-- Ticket 10: Configuração de Publicação Seletiva no Supabase Realtime
-- ==============================================================================

-- 1. Ensure supabase_realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Add workspaces and workspace_members with REPLICA IDENTITY for reliable change detection
ALTER TABLE public.workspaces REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_members REPLICA IDENTITY FULL;

-- 3. Add operational tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;

COMMENT ON PUBLICATION supabase_realtime IS 
  'Publicação seletiva do Supabase Realtime para tabelas operacionais filtradas por RLS.';
