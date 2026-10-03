-- ==============================================================================
-- Test: 00014_unipile_inbox_privacy_filter.sql
-- Verifies Ticket 07 - Unipile Messaging Accounts, Webhook & Strict CRM-Only Privacy Filter
-- ==============================================================================

-- Contagens restritas ao workspace do próprio teste: o seed de demonstração também tem conversas.
BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace, members, account, contact and contact channel
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Connect BDR's WhatsApp via Unipile
INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, display_name, status) VALUES 
  ('30a03713-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '87eb998f-0000-0000-0000-000000000001', 'whatsapp', 'unipile_wa_bdr_01', 'Lucas (WhatsApp Pessoal)', 'connected');

-- Setup CRM account and contact
INSERT INTO public.accounts (id, workspace_id, name, domain, owner_member_id) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hospital São Lucas', 'saolucas.com.br', '87eb998f-0000-0000-0000-000000000001');

INSERT INTO public.contacts (id, workspace_id, account_id, name, job_title, buying_role) VALUES 
  ('76485a2b-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000001', 'Dr. Roberto Silveira', 'Diretor de TI', 'decisor');

-- Register known CRM channel for contact (WhatsApp: 5511987654321)
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position) VALUES 
  ('11111111-1111-1111-1111-111111111111', '76485a2b-0000-0000-0000-000000000001', 'whatsapp', '+55 (11) 98765-4321', 1);

-- 2. Scenario 1: Private message from NON-CRM contact (e.g. family member +55 11 91111-2222)
SELECT is(
  (public.unipile_ingest_message(
    'unipile_wa_bdr_01',
    'whatsapp',
    '+55 (11) 91111-2222', -- Not in CRM!
    'chat_private_fam',
    'msg_ext_private_001',
    'Oi filho, tudo bem? Nao esqueca o jantar hoje!',
    false,
    'neutra'
  )->>'action'),
  'discarded',
  'Filtro So-CRM: Mensagem de remetente fora do CRM DEVE ser descartada'
);

-- Verify zero persistence in database (Absolute privacy!)
SELECT is(
  (SELECT count(*)::integer FROM public.conversations WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Privacidade: Nenhuma conversa de remetente fora do CRM pode ser gravada'
);

SELECT is(
  (SELECT count(*)::integer FROM public.messages WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Privacidade: Nenhuma mensagem de remetente fora do CRM pode ser gravada'
);

-- 3. Scenario 2: Group chat message (even if a CRM contact is in the group)
SELECT is(
  (public.unipile_ingest_message(
    'unipile_wa_bdr_01',
    'whatsapp',
    '+55 (11) 98765-4321', -- Known contact, BUT in a group!
    'chat_group_family',
    'msg_ext_group_001',
    'Alguem viu a chave do carro?',
    true, -- is_group = true!
    'neutra'
  )->>'action'),
  'discarded',
  'Filtro So-CRM: Mensagens de grupo devem ser SEMPRE descartadas'
);

SELECT is(
  (SELECT count(*)::integer FROM public.conversations WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Privacidade: Nenhuma conversa de grupo pode ser gravada'
);

-- 4. Scenario 3: Legitimate message from verified CRM contact
SELECT is(
  (public.unipile_ingest_message(
    'unipile_wa_bdr_01',
    'whatsapp',
    '+55 (11) 98765-4321', -- Verified CRM contact!
    'chat_roberto_saolucas',
    'msg_ext_crm_001',
    'Ola Lucas, recebemos a proposta e gostariamos de agendar a demonstracao na terca.',
    false,
    'positiva'
  )->>'action'),
  'persisted',
  'Filtro So-CRM: Mensagem de contato do CRM DEVE ser persistida na Caixa de entrada'
);

-- Verify persistence and linkage
SELECT is(
  (SELECT count(*)::integer FROM public.conversations WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'Caixa de entrada: Conversa persistida com sucesso'
);

SELECT is(
  (SELECT intent FROM public.conversations WHERE workspace_id = '11111111-1111-1111-1111-111111111111' LIMIT 1),
  'positiva',
  'Caixa de entrada: Intencao da mensagem classificada como positiva'
);

SELECT is(
  (SELECT text FROM public.messages WHERE workspace_id = '11111111-1111-1111-1111-111111111111' LIMIT 1),
  'Ola Lucas, recebemos a proposta e gostariamos de agendar a demonstracao na terca.',
  'Caixa de entrada: Texto da mensagem persistido com integridade'
);

-- 5. Scenario 4: Delete contact cascades to delete all conversations and messages
DELETE FROM public.contacts WHERE id = '76485a2b-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::integer FROM public.conversations WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Cascade: Excluir o contato do CRM deve apagar automaticamente todas as conversas dele'
);

SELECT is(
  (SELECT count(*)::integer FROM public.messages WHERE workspace_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Cascade: Excluir o contato do CRM deve apagar automaticamente todas as mensagens dele'
);

SELECT * FROM finish();
ROLLBACK;