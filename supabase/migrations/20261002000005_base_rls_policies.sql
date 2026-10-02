-- ==============================================================================
-- Migration: 20261002000005_base_rls_policies.sql
-- Ticket 06: Políticas RLS Base por Tabela no Schema public
-- ==============================================================================

-- 1. Enable RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspaces they are members of"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Admins can update their workspace"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    public.has_workspace_role(id, ARRAY['superadmin', 'client_admin'])
  )
  WITH CHECK (
    public.has_workspace_role(id, ARRAY['superadmin', 'client_admin'])
  );

-- 2. Enable RLS on workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view other members in their workspace"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Admins can manage workspace memberships"
  ON public.workspace_members
  FOR ALL
  TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['superadmin', 'client_admin'])
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['superadmin', 'client_admin'])
  );
