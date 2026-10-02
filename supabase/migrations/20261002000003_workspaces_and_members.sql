-- ==============================================================================
-- Migration: 20261002000003_workspaces_and_members.sql
-- Ticket 04: Autenticação e Membership Multi-Tenant por Workspace
-- ==============================================================================

-- 1. Create workspaces table (Tenant boundary)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS 
  'Fronteira primária multi-tenant do Revenue OS (Althius).';

CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create workspace_members table (User-to-Tenant relationship with RBAC role)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'superadmin',
    'strategist',
    'client_admin',
    'revops',
    'marketing',
    'bdr',
    'analyst',
    'viewer'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  job_title TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_access_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

COMMENT ON TABLE public.workspace_members IS 
  'Vínculo de pertinência de um usuário ao workspace com o papel operacional desempenhado.';

CREATE TRIGGER set_workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. High-efficiency indices for multi-tenant query resolution
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_status 
  ON public.workspace_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role 
  ON public.workspace_members (workspace_id, role);
