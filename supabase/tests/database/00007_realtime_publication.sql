-- ==============================================================================
-- Test: 00007_realtime_publication.sql
-- Verifies Ticket 10 - Selective Realtime publication
-- ==============================================================================

BEGIN;

-- 1. Check publication existence
SELECT is(
  (SELECT COUNT(*)::int FROM pg_publication WHERE pubname = 'supabase_realtime'),
  1,
  'Publicação supabase_realtime deve existir'
);

-- 2. Check published tables
SELECT isnt_empty(
  $$ SELECT schemaname, tablename FROM pg_publication_tables 
     WHERE pubname = 'supabase_realtime' AND tablename = 'workspaces' $$,
  'Tabela workspaces deve estar na publicação supabase_realtime'
);

SELECT isnt_empty(
  $$ SELECT schemaname, tablename FROM pg_publication_tables 
     WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_members' $$,
  'Tabela workspace_members deve estar na publicação supabase_realtime'
);

-- 3. Negative check: audit_logs must NOT be in realtime publication (avoids socket overload)
SELECT is_empty(
  $$ SELECT schemaname, tablename FROM pg_publication_tables 
     WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs' $$,
  'Tabela audit_logs NÃO deve estar na publicação supabase_realtime'
);

ROLLBACK;
