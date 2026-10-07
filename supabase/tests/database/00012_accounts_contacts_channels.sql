-- ==============================================================================
-- Test: 00012_accounts_contacts_channels.sql
-- Verifies Ticket 05 - Accounts, Contacts, Contact Channels & Logo Extractor
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace and members
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bdr', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 2. Create accounts: one assigned to BDR 1 (bbbb), one to BDR 2 (cccc)
INSERT INTO public.accounts (id, workspace_id, name, domain, owner_member_id, temperature, state_uf, city) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Acme Corp', 'acme.com', '87eb998f-0000-0000-0000-000000000002', 3, 'SP', 'São Paulo'),
  ('acc00000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Beta Industries', 'beta.ind.br', '87eb998f-0000-0000-0000-000000000003', 1, 'RJ', 'Rio de Janeiro');

-- 3. Create contacts and contact channels
INSERT INTO public.contacts (id, workspace_id, account_id, name, job_title, buying_role, linkedin_status) VALUES 
  ('76485a2b-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000001', 'Roberto Santos', 'CPO', 'decisor', 'conectado');

-- Insert channel with formatting: should normalize automatically
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position) VALUES 
  ('11111111-1111-1111-1111-111111111111', '76485a2b-0000-0000-0000-000000000001', 'whatsapp', '+55 (11) 98765-4321', 1),
  ('11111111-1111-1111-1111-111111111111', '76485a2b-0000-0000-0000-000000000001', 'instagram', '@roberto_cpo', 1);

-- Verify value_normalized
SELECT is(
  (SELECT value_normalized FROM public.contact_channels WHERE type = 'whatsapp' AND contact_id = '76485a2b-0000-0000-0000-000000000001'),
  '5511987654321',
  'Normalização: Telefone/WhatsApp deve remover caracteres especiais automaticamente'
);

SELECT is(
  (SELECT value_normalized FROM public.contact_channels WHERE type = 'instagram' AND contact_id = '76485a2b-0000-0000-0000-000000000001'),
  'roberto_cpo',
  'Normalização: Instagram deve remover o @ inicial e converter para minusculas'
);

-- 4. Test RLS on accounts
-- BDR 1 (bbbb) can update their OWN account (Acme Corp)
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
SET LOCAL ROLE authenticated;

UPDATE public.accounts 
SET city = 'Campinas' 
WHERE id = 'acc00000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT city FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000001'),
  'Campinas',
  'RLS: BDR deve conseguir editar a conta da qual e responsavel'
);

-- BDR 1 attempts to update BDR 2''s account (Beta Industries) -> blocked by RLS
UPDATE public.accounts 
SET city = 'Niterói' 
WHERE id = 'acc00000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT city FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000002'),
  'Rio de Janeiro',
  'RLS: BDR NAO pode atualizar conta sob responsabilidade de outro membro'
);

-- C-level can update ANY account in the workspace
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

UPDATE public.accounts 
SET city = 'Niterói' 
WHERE id = 'acc00000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT city FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000002'),
  'Niterói',
  'RLS: C-level pode atualizar qualquer conta no workspace'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;