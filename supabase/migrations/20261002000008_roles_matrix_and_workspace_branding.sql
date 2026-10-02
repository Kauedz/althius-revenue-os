-- ==============================================================================
-- Migration: 20261002000008_roles_matrix_and_workspace_branding.sql
-- Ticket 01: Papéis, Matriz de 33 Capacidades e RLS Base (Althius v18)
-- ==============================================================================

-- 1. Add workspace branding and domain columns
ALTER TABLE public.workspaces 
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS site_domain TEXT,
  ADD COLUMN IF NOT EXISTS logo_source TEXT CHECK (logo_source IN ('upload', 'site')) DEFAULT 'site';

COMMENT ON COLUMN public.workspaces.logo_url IS 'URL do logo do workspace, carregado manualmente ou extraído do site.';
COMMENT ON COLUMN public.workspaces.site_domain IS 'Domínio institucional do workspace para busca e enriquecimento de marca.';
COMMENT ON COLUMN public.workspaces.logo_source IS 'Origem do logo: upload manual ou extração automática pelo site.';

-- 2. Update role constraint on workspace_members to strictly enforce the 4 canonical roles
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;

-- Update existing rows if any legacy names exist
UPDATE public.workspace_members SET role = 'estrategista' WHERE role IN ('strategist');
UPDATE public.workspace_members SET role = 'clevel' WHERE role IN ('client_admin', 'owner', 'cliente');

ALTER TABLE public.workspace_members 
  ADD CONSTRAINT workspace_members_role_check 
  CHECK (role IN ('superadmin', 'estrategista', 'clevel', 'bdr'));

-- 3. Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Catálogo dos 4 papéis canônicos da plataforma Althius.';

-- 4. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('all', 'assigned', 'own', 'read', 'request', 'none')),
  area TEXT NOT NULL,
  capability_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_capability UNIQUE (role_id, capability_key)
);

COMMENT ON TABLE public.role_permissions IS 'Matriz canônica das 33 capacidades mapeadas por papel com respectivos escopos.';

CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup 
  ON public.role_permissions (role_id, capability_key);

-- 5. Enable RLS on roles and role_permissions
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to roles for authenticated users"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to role_permissions for authenticated users"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- 6. Helper function to check if the current user is a superadmin globally
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.role = 'superadmin'
      AND wm.status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.is_superadmin() IS 'Verifica se o usuário autenticado possui o papel superadmin em qualquer workspace ativo.';

-- 7. Helper function to evaluate permissions against the 33-capability matrix
CREATE OR REPLACE FUNCTION public.check_permission(
  p_workspace_id UUID,
  p_capability_key TEXT,
  p_target_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_scope TEXT;
BEGIN
  -- Superadmin has unrestricted platform-wide access
  IF public.is_superadmin() THEN
    SELECT scope INTO v_scope
    FROM public.role_permissions
    WHERE role_id = 'superadmin' AND capability_key = p_capability_key;
    
    IF v_scope IN ('all', 'assigned', 'own', 'read') THEN
      RETURN true;
    END IF;
  END IF;

  -- Determine user role in target workspace
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  INNER JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND w.status = 'active';

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Lookup capability scope for role
  SELECT rp.scope INTO v_scope
  FROM public.role_permissions rp
  WHERE rp.role_id = v_role AND rp.capability_key = p_capability_key;

  IF v_scope IS NULL OR v_scope = 'none' THEN
    RETURN false;
  ELSIF v_scope = 'all' THEN
    RETURN true;
  ELSIF v_scope = 'assigned' THEN
    RETURN true; -- User is an active member of this workspace
  ELSIF v_scope = 'own' THEN
    IF p_target_owner_id IS NULL OR p_target_owner_id = auth.uid() THEN
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  ELSIF v_scope = 'read' THEN
    RETURN true;
  ELSIF v_scope = 'request' THEN
    RETURN false; -- Direct execution forbidden; requires approval workflow
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.check_permission(UUID, TEXT, UUID) IS 'Avalia dinamicamente se o usuário corrente pode executar a capacidade no escopo requerido.';

-- 8. Update RLS policies on workspaces
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Admins can update their workspace" ON public.workspaces;

CREATE POLICY "Users can view workspaces based on role scope"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin() OR 
    id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized roles can update workspace branding and settings"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin() OR
    (id IN (SELECT workspace_id FROM public.current_workspace_member()) AND
     public.has_workspace_role(id, ARRAY['estrategista', 'clevel']))
  )
  WITH CHECK (
    public.is_superadmin() OR
    (id IN (SELECT workspace_id FROM public.current_workspace_member()) AND
     public.has_workspace_role(id, ARRAY['estrategista', 'clevel']))
  );

-- 9. Update RLS policies on workspace_members
DROP POLICY IF EXISTS "Members can view other members in their workspace" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage workspace memberships" ON public.workspace_members;

CREATE POLICY "Members can view other members in their workspace"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin() OR
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized roles can manage workspace memberships"
  ON public.workspace_members
  FOR ALL
  TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND
     public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']))
  )
  WITH CHECK (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND
     public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) AND
     -- Hierarchy guard: C-level cannot invite or promote to superadmin or estrategista
     (public.has_workspace_role(workspace_id, ARRAY['estrategista']) OR role IN ('clevel', 'bdr')))
  );

-- 10. Seed canonical roles
INSERT INTO public.roles (id, name, description) VALUES
  ('superadmin', 'Superadmin', 'Time Althius (operação da plataforma): acesso global, custos reais e auditoria.'),
  ('estrategista', 'Estrategista', 'Time Althius (GTM do cliente): alocado aos workspaces atribuídos, autor de playbooks e cadências.'),
  ('clevel', 'C-level', 'Diretoria do cliente (CEO, CRO, CMO): decide gastos, compra créditos, aprova verba e pausa agentes.'),
  ('bdr', 'BDR/SDR', 'Time comercial do cliente: restrito a contas, negócios, tarefas e cadências atribuídas.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 11. Seed the 33 capabilities across all 4 roles
-- Scope values: s -> all, a -> assigned, p -> own, l -> read, q -> request, n -> none
INSERT INTO public.role_permissions (role_id, capability_key, scope, area, capability_name, note) VALUES
  -- Area: Workspace
  ('superadmin', 'ws.switch', 'all', 'Workspace', 'Trocar de workspace', 'Superadmin vê todos.'),
  ('estrategista', 'ws.switch', 'assigned', 'Workspace', 'Trocar de workspace', 'Estrategista vê só os workspaces em que foi colocado.'),
  ('clevel', 'ws.switch', 'none', 'Workspace', 'Trocar de workspace', ''),
  ('bdr', 'ws.switch', 'none', 'Workspace', 'Trocar de workspace', ''),

  ('superadmin', 'ws.create', 'all', 'Workspace', 'Criar e arquivar workspace', ''),
  ('estrategista', 'ws.create', 'none', 'Workspace', 'Criar e arquivar workspace', ''),
  ('clevel', 'ws.create', 'none', 'Workspace', 'Criar e arquivar workspace', ''),
  ('bdr', 'ws.create', 'none', 'Workspace', 'Criar e arquivar workspace', ''),

  ('superadmin', 'ws.brand', 'all', 'Workspace', 'Mudar o logo do workspace', 'Aparece na barra lateral e no seletor de workspaces.'),
  ('estrategista', 'ws.brand', 'all', 'Workspace', 'Mudar o logo do workspace', 'Aparece na barra lateral e no seletor de workspaces.'),
  ('clevel', 'ws.brand', 'all', 'Workspace', 'Mudar o logo do workspace', 'Aparece na barra lateral e no seletor de workspaces.'),
  ('bdr', 'ws.brand', 'none', 'Workspace', 'Mudar o logo do workspace', ''),

  ('superadmin', 'team.invite', 'all', 'Workspace', 'Convidar e mudar papel', 'Ninguém dá um papel acima do próprio.'),
  ('estrategista', 'team.invite', 'all', 'Workspace', 'Convidar e mudar papel', 'Estrategista convida C-level e BDR.'),
  ('clevel', 'team.invite', 'all', 'Workspace', 'Convidar e mudar papel', 'C-level convida C-level e BDR.'),
  ('bdr', 'team.invite', 'none', 'Workspace', 'Convidar e mudar papel', ''),

  ('superadmin', 'settings.own', 'own', 'Workspace', 'Minha conta, notificações e aparência', ''),
  ('estrategista', 'settings.own', 'own', 'Workspace', 'Minha conta, notificações e aparência', ''),
  ('clevel', 'settings.own', 'own', 'Workspace', 'Minha conta, notificações e aparência', ''),
  ('bdr', 'settings.own', 'own', 'Workspace', 'Minha conta, notificações e aparência', ''),

  -- Area: Agentes
  ('superadmin', 'agents.chat', 'all', 'Agentes', 'Conversar com agentes', ''),
  ('estrategista', 'agents.chat', 'all', 'Agentes', 'Conversar com agentes', ''),
  ('clevel', 'agents.chat', 'all', 'Agentes', 'Conversar com agentes', ''),
  ('bdr', 'agents.chat', 'own', 'Agentes', 'Conversar com agentes', 'BDR conversa com o Agente Comercial e o Agente de Copy.'),

  ('superadmin', 'agents.configure', 'all', 'Agentes', 'Editar e publicar playbook e skills', ''),
  ('estrategista', 'agents.configure', 'all', 'Agentes', 'Editar e publicar playbook e skills', ''),
  ('clevel', 'agents.configure', 'read', 'Agentes', 'Editar e publicar playbook e skills', 'C-level lê e aprova; quem escreve é o estrategista.'),
  ('bdr', 'agents.configure', 'none', 'Agentes', 'Editar e publicar playbook e skills', ''),

  ('superadmin', 'agents.signals', 'all', 'Agentes', 'Ligar e desligar sinais', ''),
  ('estrategista', 'agents.signals', 'all', 'Agentes', 'Ligar e desligar sinais', ''),
  ('clevel', 'agents.signals', 'read', 'Agentes', 'Ligar e desligar sinais', ''),
  ('bdr', 'agents.signals', 'none', 'Agentes', 'Ligar e desligar sinais', ''),

  ('superadmin', 'signals.custom', 'all', 'Agentes', 'Criar sinal personalizado', ''),
  ('estrategista', 'signals.custom', 'none', 'Agentes', 'Criar sinal personalizado', ''),
  ('clevel', 'signals.custom', 'none', 'Agentes', 'Criar sinal personalizado', ''),
  ('bdr', 'signals.custom', 'none', 'Agentes', 'Criar sinal personalizado', ''),

  ('superadmin', 'agents.pause', 'all', 'Agentes', 'Pausar agente', 'Botão de emergência do cliente.'),
  ('estrategista', 'agents.pause', 'all', 'Agentes', 'Pausar agente', ''),
  ('clevel', 'agents.pause', 'all', 'Agentes', 'Pausar agente', 'Botão de emergência do cliente.'),
  ('bdr', 'agents.pause', 'none', 'Agentes', 'Pausar agente', ''),

  ('superadmin', 'agents.autonomy', 'all', 'Agentes', 'Mudar autonomia do agente', ''),
  ('estrategista', 'agents.autonomy', 'all', 'Agentes', 'Mudar autonomia do agente', ''),
  ('clevel', 'agents.autonomy', 'request', 'Agentes', 'Mudar autonomia do agente', ''),
  ('bdr', 'agents.autonomy', 'none', 'Agentes', 'Mudar autonomia do agente', ''),

  -- Area: Receita
  ('superadmin', 'accounts.edit', 'all', 'Receita', 'Editar conta: site, logo, comitê e LinkedIn', ''),
  ('estrategista', 'accounts.edit', 'all', 'Receita', 'Editar conta: site, logo, comitê e LinkedIn', ''),
  ('clevel', 'accounts.edit', 'all', 'Receita', 'Editar conta: site, logo, comitê e LinkedIn', ''),
  ('bdr', 'accounts.edit', 'own', 'Receita', 'Editar conta: site, logo, comitê e LinkedIn', 'BDR edita as contas em que é responsável.'),

  ('superadmin', 'accounts.import', 'all', 'Receita', 'Importar lista de contas', ''),
  ('estrategista', 'accounts.import', 'all', 'Receita', 'Importar lista de contas', ''),
  ('clevel', 'accounts.import', 'all', 'Receita', 'Importar lista de contas', ''),
  ('bdr', 'accounts.import', 'none', 'Receita', 'Importar lista de contas', ''),

  ('superadmin', 'prospecting.approve', 'all', 'Receita', 'Aprovar lista de prospecção', ''),
  ('estrategista', 'prospecting.approve', 'all', 'Receita', 'Aprovar lista de prospecção', ''),
  ('clevel', 'prospecting.approve', 'all', 'Receita', 'Aprovar lista de prospecção', ''),
  ('bdr', 'prospecting.approve', 'read', 'Receita', 'Aprovar lista de prospecção', ''),

  ('superadmin', 'cadences.edit', 'all', 'Receita', 'Editar cadência', ''),
  ('estrategista', 'cadences.edit', 'all', 'Receita', 'Editar cadência', ''),
  ('clevel', 'cadences.edit', 'read', 'Receita', 'Editar cadência', ''),
  ('bdr', 'cadences.edit', 'own', 'Receita', 'Editar cadência', ''),

  ('superadmin', 'cadences.auto', 'all', 'Receita', 'Ligar envio automático (e-mail e WhatsApp)', 'Consome créditos.'),
  ('estrategista', 'cadences.auto', 'all', 'Receita', 'Ligar envio automático (e-mail e WhatsApp)', 'Consome créditos.'),
  ('clevel', 'cadences.auto', 'all', 'Receita', 'Ligar envio automático (e-mail e WhatsApp)', 'Consome créditos.'),
  ('bdr', 'cadences.auto', 'own', 'Receita', 'Ligar envio automático (e-mail e WhatsApp)', 'Consome créditos nas próprias contas.'),

  ('superadmin', 'tasks.assign', 'all', 'Receita', 'Criar tarefa para outra pessoa', ''),
  ('estrategista', 'tasks.assign', 'all', 'Receita', 'Criar tarefa para outra pessoa', ''),
  ('clevel', 'tasks.assign', 'all', 'Receita', 'Criar tarefa para outra pessoa', ''),
  ('bdr', 'tasks.assign', 'own', 'Receita', 'Criar tarefa para outra pessoa', 'BDR cria tarefa só para si.'),

  ('superadmin', 'inbox.read', 'read', 'Receita', 'Ler a Caixa de entrada', 'Leitura pelo time Althius registrada na Auditoria.'),
  ('estrategista', 'inbox.read', 'read', 'Receita', 'Ler a Caixa de entrada', 'Leitura pelo time Althius registrada na Auditoria.'),
  ('clevel', 'inbox.read', 'read', 'Receita', 'Ler a Caixa de entrada', 'Só conversas com contatos do CRM.'),
  ('bdr', 'inbox.read', 'own', 'Receita', 'Ler a Caixa de entrada', 'Só conversas com contatos do CRM nas suas contas.'),

  ('superadmin', 'inbox.connect', 'own', 'Receita', 'Conectar WhatsApp, LinkedIn, Instagram e e-mail', 'Cada pessoa conecta as próprias contas.'),
  ('estrategista', 'inbox.connect', 'own', 'Receita', 'Conectar WhatsApp, LinkedIn, Instagram e e-mail', 'Cada pessoa conecta as próprias contas.'),
  ('clevel', 'inbox.connect', 'own', 'Receita', 'Conectar WhatsApp, LinkedIn, Instagram e e-mail', 'Cada pessoa conecta as próprias contas.'),
  ('bdr', 'inbox.connect', 'own', 'Receita', 'Conectar WhatsApp, LinkedIn, Instagram e e-mail', 'Cada pessoa conecta as próprias contas.'),

  ('superadmin', 'pipeline.boards', 'all', 'Receita', 'Criar, renomear e excluir quadros do Pipeline', ''),
  ('estrategista', 'pipeline.boards', 'all', 'Receita', 'Criar, renomear e excluir quadros do Pipeline', ''),
  ('clevel', 'pipeline.boards', 'all', 'Receita', 'Criar, renomear e excluir quadros do Pipeline', ''),
  ('bdr', 'pipeline.boards', 'none', 'Receita', 'Criar, renomear e excluir quadros do Pipeline', ''),

  ('superadmin', 'pipeline.deals', 'all', 'Receita', 'Criar e mover negócios', ''),
  ('estrategista', 'pipeline.deals', 'all', 'Receita', 'Criar e mover negócios', ''),
  ('clevel', 'pipeline.deals', 'all', 'Receita', 'Criar e mover negócios', ''),
  ('bdr', 'pipeline.deals', 'own', 'Receita', 'Criar e mover negócios', 'BDR move só os negócios em que é responsável.'),

  ('superadmin', 'campaigns.edit', 'all', 'Receita', 'Criar campanha', ''),
  ('estrategista', 'campaigns.edit', 'all', 'Receita', 'Criar campanha', ''),
  ('clevel', 'campaigns.edit', 'all', 'Receita', 'Criar campanha', ''),
  ('bdr', 'campaigns.edit', 'none', 'Receita', 'Criar campanha', ''),

  -- Area: Aprovações e dinheiro
  ('superadmin', 'approvals.decide', 'all', 'Aprovações e dinheiro', 'Aprovar plano de agente, copy, lista e CRM', ''),
  ('estrategista', 'approvals.decide', 'all', 'Aprovações e dinheiro', 'Aprovar plano de agente, copy, lista e CRM', ''),
  ('clevel', 'approvals.decide', 'all', 'Aprovações e dinheiro', 'Aprovar plano de agente, copy, lista e CRM', ''),
  ('bdr', 'approvals.decide', 'none', 'Aprovações e dinheiro', 'Aprovar plano de agente, copy, lista e CRM', ''),

  ('superadmin', 'approvals.spend', 'all', 'Aprovações e dinheiro', 'Aprovar verba de mídia e execução acima do limite', ''),
  ('estrategista', 'approvals.spend', 'request', 'Aprovações e dinheiro', 'Aprovar verba de mídia e execução acima do limite', 'Estrategista pede, não aprova.'),
  ('clevel', 'approvals.spend', 'all', 'Aprovações e dinheiro', 'Aprovar verba de mídia e execução acima do limite', 'Dinheiro do cliente: decide quem paga.'),
  ('bdr', 'approvals.spend', 'none', 'Aprovações e dinheiro', 'Aprovar verba de mídia e execução acima do limite', ''),

  ('superadmin', 'credits.buy', 'all', 'Aprovações e dinheiro', 'Comprar créditos', ''),
  ('estrategista', 'credits.buy', 'request', 'Aprovações e dinheiro', 'Comprar créditos', 'Estrategista pede.'),
  ('clevel', 'credits.buy', 'all', 'Aprovações e dinheiro', 'Comprar créditos', ''),
  ('bdr', 'credits.buy', 'none', 'Aprovações e dinheiro', 'Comprar créditos', ''),

  ('superadmin', 'credits.policy', 'all', 'Aprovações e dinheiro', 'Modo de consumo, limite mensal e recarga', ''),
  ('estrategista', 'credits.policy', 'read', 'Aprovações e dinheiro', 'Modo de consumo, limite mensal e recarga', ''),
  ('clevel', 'credits.policy', 'all', 'Aprovações e dinheiro', 'Modo de consumo, limite mensal e recarga', ''),
  ('bdr', 'credits.policy', 'none', 'Aprovações e dinheiro', 'Modo de consumo, limite mensal e recarga', ''),

  -- Area: Operação e dados
  ('superadmin', 'executions.view', 'all', 'Operação e dados', 'Ver execuções', ''),
  ('estrategista', 'executions.view', 'all', 'Operação e dados', 'Ver execuções', ''),
  ('clevel', 'executions.view', 'all', 'Operação e dados', 'Ver execuções', ''),
  ('bdr', 'executions.view', 'none', 'Operação e dados', 'Ver execuções', ''),

  ('superadmin', 'exec.control', 'all', 'Operação e dados', 'Pausar, cancelar e refazer execução', ''),
  ('estrategista', 'exec.control', 'all', 'Operação e dados', 'Pausar, cancelar e refazer execução', ''),
  ('clevel', 'exec.control', 'none', 'Operação e dados', 'Pausar, cancelar e refazer execução', ''),
  ('bdr', 'exec.control', 'none', 'Operação e dados', 'Pausar, cancelar e refazer execução', ''),

  ('superadmin', 'exec.cost', 'all', 'Operação e dados', 'Ver custo real e fornecedores', 'Confidencial Althius.'),
  ('estrategista', 'exec.cost', 'none', 'Operação e dados', 'Ver custo real e fornecedores', ''),
  ('clevel', 'exec.cost', 'none', 'Operação e dados', 'Ver custo real e fornecedores', ''),
  ('bdr', 'exec.cost', 'none', 'Operação e dados', 'Ver custo real e fornecedores', ''),

  ('superadmin', 'integrations.connect', 'all', 'Operação e dados', 'Conectar integrações do workspace', 'CRM, e-mail da empresa, mídia, reuniões e conhecimento.'),
  ('estrategista', 'integrations.connect', 'all', 'Operação e dados', 'Conectar integrações do workspace', ''),
  ('clevel', 'integrations.connect', 'all', 'Operação e dados', 'Conectar integrações do workspace', ''),
  ('bdr', 'integrations.connect', 'none', 'Operação e dados', 'Conectar integrações do workspace', ''),

  ('superadmin', 'analytics.view', 'all', 'Operação e dados', 'Ver relatórios', ''),
  ('estrategista', 'analytics.view', 'all', 'Operação e dados', 'Ver relatórios', ''),
  ('clevel', 'analytics.view', 'all', 'Operação e dados', 'Ver relatórios', ''),
  ('bdr', 'analytics.view', 'none', 'Operação e dados', 'Ver relatórios', ''),

  ('superadmin', 'channels.manage', 'all', 'Operação e dados', 'Gerenciar qualquer canal e o #geral', ''),
  ('estrategista', 'channels.manage', 'all', 'Operação e dados', 'Gerenciar qualquer canal e o #geral', ''),
  ('clevel', 'channels.manage', 'all', 'Operação e dados', 'Gerenciar qualquer canal e o #geral', ''),
  ('bdr', 'channels.manage', 'own', 'Operação e dados', 'Gerenciar qualquer canal e o #geral', 'BDR gerencia os canais que criou.'),

  ('superadmin', 'admin', 'all', 'Operação e dados', 'Painel Althius: uso global, margens, auditoria e saúde', 'Exclusivo do Superadmin.'),
  ('estrategista', 'admin', 'none', 'Operação e dados', 'Painel Althius: uso global, margens, auditoria e saúde', ''),
  ('clevel', 'admin', 'none', 'Operação e dados', 'Painel Althius: uso global, margens, auditoria e saúde', ''),
  ('bdr', 'admin', 'none', 'Operação e dados', 'Painel Althius: uso global, margens, auditoria e saúde', '')
ON CONFLICT (role_id, capability_key) DO UPDATE SET
  scope = EXCLUDED.scope,
  area = EXCLUDED.area,
  capability_name = EXCLUDED.capability_name,
  note = EXCLUDED.note;
