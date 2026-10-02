-- ==============================================================================
-- Migration: 20261002000004_rbac_helper_functions.sql
-- Ticket 05: Helper Functions de Resolução de Papel e RBAC no Postgres
-- ==============================================================================

-- 1. Helper function returning active workspace memberships and roles for the current authenticated user
CREATE OR REPLACE FUNCTION public.current_workspace_member() 
RETURNS TABLE (workspace_id UUID, role TEXT) AS $$
  SELECT wm.workspace_id, wm.role 
  FROM public.workspace_members wm
  INNER JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid() 
    AND wm.status = 'active'
    AND w.status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.current_workspace_member() IS 
  'Retorna a lista de workspaces ativos e papéis do usuário autenticado corrente.';

-- 2. Fast boolean helper to verify if the user has one of the allowed roles in a specific workspace
CREATE OR REPLACE FUNCTION public.has_workspace_role(target_workspace_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.current_workspace_member() cwm
    WHERE cwm.workspace_id = target_workspace_id
      AND cwm.role = ANY(allowed_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.has_workspace_role(UUID, TEXT[]) IS 
  'Verifica se o usuário autenticado possui algum dos papéis permitidos no workspace especificado.';

-- 3. Fast boolean helper to verify membership in a workspace regardless of role
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.current_workspace_member() cwm
    WHERE cwm.workspace_id = target_workspace_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.is_workspace_member(UUID) IS 
  'Verifica se o usuário autenticado pertence ativamente ao workspace especificado.';

-- 4. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.current_workspace_member() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(UUID, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, anon;
