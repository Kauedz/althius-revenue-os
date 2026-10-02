-- ==============================================================================
-- Migration: 20261002000012_accounts_contacts_channels.sql
-- Ticket 05: Contas, Contatos, Contact Channels e Extrator de Logo
-- ==============================================================================

-- 1. Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  logo_url TEXT,
  temperature INTEGER NOT NULL DEFAULT 1 CHECK (temperature BETWEEN 1 AND 3),
  last_signal_text TEXT,
  state_uf TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  owner_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'arquivada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_account_domain UNIQUE (workspace_id, domain)
);

COMMENT ON TABLE public.accounts IS 'Contas canônicas e empresas qualificadas no ICP do workspace.';

CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_accounts_workspace_owner 
  ON public.accounts (workspace_id, owner_member_id);

CREATE INDEX IF NOT EXISTS idx_accounts_state_uf 
  ON public.accounts (workspace_id, state_uf);

-- 2. Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_title TEXT,
  buying_role TEXT CHECK (buying_role IN ('decisor', 'influenciador', 'campeao')),
  linkedin_status TEXT DEFAULT 'sem_conexao' CHECK (linkedin_status IN ('sem_conexao', 'convite_enviado', 'conectado')),
  photo_url TEXT,
  owner_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contacts IS 'Pessoas verificadas vinculadas a uma conta do CRM e membros do comitê de compras.';

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_contacts_account 
  ON public.contacts (account_id);

-- 3. Create contact_channels table (E-mails, Telefones, WhatsApp, LinkedIn e Instagram)
CREATE TABLE IF NOT EXISTS public.contact_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'whatsapp', 'linkedin', 'instagram')),
  value TEXT NOT NULL,
  value_normalized TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1 CHECK (position BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_channel_value UNIQUE (workspace_id, type, value_normalized)
);

COMMENT ON TABLE public.contact_channels IS 'Canais de contato normalizados utilizados pelo filtro de privacidade da Caixa de entrada.';

CREATE INDEX IF NOT EXISTS idx_contact_channels_lookup 
  ON public.contact_channels (workspace_id, type, value_normalized);

-- 4. Channel value normalization function and trigger
CREATE OR REPLACE FUNCTION public.normalize_channel_value(p_type TEXT, p_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_type = 'email' THEN
    RETURN lower(trim(p_value));
  ELSIF p_type IN ('phone', 'whatsapp') THEN
    RETURN regexp_replace(p_value, '[^0-9]', '', 'g');
  ELSIF p_type = 'instagram' THEN
    RETURN lower(regexp_replace(trim(p_value), '^@', ''));
  ELSIF p_type = 'linkedin' THEN
    RETURN lower(trim(regexp_replace(p_value, '^https?:\/\/(www\.)?linkedin\.com\/in\/', '')));
  ELSE
    RETURN lower(trim(p_value));
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.trg_normalize_contact_channel()
RETURNS TRIGGER AS $$
BEGIN
  NEW.value_normalized := public.normalize_channel_value(NEW.type, NEW.value);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_normalize_channel
  BEFORE INSERT OR UPDATE ON public.contact_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_normalize_contact_channel();

-- 5. Enable RLS on accounts, contacts and contact_channels
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view accounts in their workspace"
  ON public.accounts FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized roles can update accounts based on ownership"
  ON public.accounts FOR UPDATE TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = accounts.workspace_id))
    ))
  )
  WITH CHECK (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = accounts.workspace_id))
    ))
  );

CREATE POLICY "Members can view contacts in their workspace"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Authorized roles can update contacts based on ownership"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = contacts.workspace_id))
    ))
  )
  WITH CHECK (
    public.is_superadmin() OR
    (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()) AND (
      public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel']) OR
      (public.has_workspace_role(workspace_id, ARRAY['bdr']) AND 
       owner_member_id IN (SELECT id FROM public.workspace_members WHERE user_id = auth.uid() AND workspace_id = contacts.workspace_id))
    ))
  );

CREATE POLICY "Members can view contact channels in their workspace"
  ON public.contact_channels FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Managers can manage contact channels"
  ON public.contact_channels FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel', 'bdr'])
  );

-- 6. Helper function to extract or resolve domain logo
CREATE OR REPLACE FUNCTION public.fetch_domain_logo(p_domain TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_domain IS NULL OR trim(p_domain) = '' THEN
    RETURN NULL;
  END IF;
  RETURN format('https://img.logo.dev/%s?token=pk_anonymous&size=128', lower(trim(p_domain)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
