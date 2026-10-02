-- ==============================================================================
-- Test: 00018_chat_channels_and_agents.sql
-- Verifies Ticket 11 - Canais de Chat: #geral Obrigatório, Agentes por Canal e Cobrança de Créditos
-- ==============================================================================

BEGIN;

SELECT plan(12);

-- 1. Setup mock workspace and members
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('22222222-2222-2222-2222-222222222222', 'Althius Trading Corp', 'althius-trading')
ON CONFLICT (id) DO NOTHING;

-- Initialize wallet with 10.000 credits
INSERT INTO public.credit_wallets (
  workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at
) VALUES (
  '22222222-2222-2222-2222-222222222222', 10000, 0, 0, now() + INTERVAL '30 days'
) ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 10000, reserved_balance = 0;

-- Test 1: Channel #geral must have been created automatically on workspace creation
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.chat_channels 
    WHERE workspace_id = '22222222-2222-2222-2222-222222222222' 
      AND slug = 'geral' 
      AND is_general = true
  ),
  'Workspace setup: Canal #geral deve ser criado automaticamente ao instanciar o workspace'
);

-- Test 2: All 4 agents should be assigned to #geral by default
SELECT is(
  (
    SELECT count(*)::integer 
    FROM public.chat_channel_agents ca
    JOIN public.chat_channels c ON c.id = ca.channel_id
    WHERE c.workspace_id = '22222222-2222-2222-2222-222222222222' AND c.slug = 'geral'
  ),
  4,
  'Agentes #geral: Todos os 4 agentes canônicos devem estar atribuídos ao canal #geral por padrão'
);

-- 2. Add members to workspace
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES
  ('f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'estrategista', 'active'),
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'bdr', 'active');

-- Test 3: Members should automatically become members of #geral
SELECT is(
  (
    SELECT count(*)::integer 
    FROM public.chat_channel_members cm
    JOIN public.chat_channels c ON c.id = cm.channel_id
    WHERE c.workspace_id = '22222222-2222-2222-2222-222222222222' 
      AND c.slug = 'geral'
      AND cm.member_id IN ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')
  ),
  2,
  'Adesão automática: Novos membros do workspace devem ser inscritos automaticamente no #geral'
);

-- Test 4: Cannot delete #geral
SELECT throws_ok(
  $$ DELETE FROM public.chat_channels WHERE workspace_id = '22222222-2222-2222-2222-222222222222' AND slug = 'geral' $$,
  'P0001',
  NULL,
  'Proteção #geral: Canal #geral não pode ser excluído'
);

-- Test 5: Cannot remove member from #geral
SELECT throws_ok(
  $$ 
    DELETE FROM public.chat_channel_members 
    WHERE member_id = 'f0000000-0000-0000-0000-000000000001' 
      AND channel_id = (SELECT id FROM public.chat_channels WHERE workspace_id = '22222222-2222-2222-2222-222222222222' AND slug = 'geral')
  $$,
  'P0001',
  NULL,
  'Proteção #geral: Membros não podem ser desvinculados do canal #geral'
);

-- 3. Create a custom channel #estrategia-receita with only Agente Comercial
INSERT INTO public.chat_channels (id, workspace_id, slug, name, description, is_general, created_by) VALUES
  ('12ebdaae-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'estrategia-receita', 'Estratégia de Receita', 'Discussão tática', false, 'f0000000-0000-0000-0000-000000000001');

INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id) VALUES
  ('22222222-2222-2222-2222-222222222222', '12ebdaae-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001');

INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id) VALUES
  ('22222222-2222-2222-2222-222222222222', '12ebdaae-0000-0000-0000-000000000001', 'comercial');

-- Test 6: Verify custom channel members and agents
SELECT is(
  (SELECT count(*)::integer FROM public.chat_channel_agents WHERE channel_id = '12ebdaae-0000-0000-0000-000000000001'),
  1,
  'Canal customizado: Apenas 1 agente deve estar atribuído a #estrategia-receita'
);

-- Test 7: Direct insertion of message by an unassigned agent (e.g. revops in #estrategia-receita) must fail
SELECT throws_ok(
  $$
    INSERT INTO public.chat_messages (
      workspace_id, channel_id, sender_type, sender_agent_id, content
    ) VALUES (
      '22222222-2222-2222-2222-222222222222',
      '12ebdaae-0000-0000-0000-000000000001',
      'agent',
      'revops',
      'Tentativa de mensagem não autorizada no canal'
    );
  $$,
  'P0001',
  NULL,
  'Enforcement de Agente: Agente não atribuído ao canal não pode postar mensagens'
);

-- Test 8: Insertion of message by an assigned agent (comercial) must succeed
SELECT lives_ok(
  $$
    INSERT INTO public.chat_messages (
      workspace_id, channel_id, sender_type, sender_agent_id, content
    ) VALUES (
      '22222222-2222-2222-2222-222222222222',
      '12ebdaae-0000-0000-0000-000000000001',
      'agent',
      'comercial',
      'Olá estrategista, revisei as contas prioritárias.'
    );
  $$,
  'Agente atribuído pode postar mensagem no canal'
);

-- 4. Test send_channel_agent_message procedure and credit deduction
-- Initial allowance balance is 10000
SELECT is(
  (SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = '22222222-2222-2222-2222-222222222222'),
  10000,
  'Saldo inicial de créditos deve ser 10.000'
);

-- Call send_channel_agent_message on #geral (2 credits deducted)
SELECT lives_ok(
  $$
    SELECT public.send_channel_agent_message(
      '22222222-2222-2222-2222-222222222222',
      'f0000000-0000-0000-0000-000000000001',
      (SELECT id FROM public.chat_channels WHERE workspace_id = '22222222-2222-2222-2222-222222222222' AND slug = 'geral'),
      'copy',
      'Qual o tom ideal para este segmento?',
      'Recomendo um tom consultivo e direto, destacando o ganho de tempo.',
      'idemp-chat-test-01'
    );
  $$,
  'send_channel_agent_message deve executar sem erro para o estrategista'
);

-- Test 11: Wallet balance must have decreased by exactly 2 credits (from 10000 to 9998)
SELECT is(
  (SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = '22222222-2222-2222-2222-222222222222'),
  9998,
  'Dedução de Créditos: Interação no chat deve deduzir exatamente 2 créditos da carteira'
);

-- Test 12: BDR chatting with unauthorized agent (e.g. revops) must fail per role capabilities
SELECT throws_ok(
  $$
    SELECT public.send_channel_agent_message(
      '22222222-2222-2222-2222-222222222222',
      'f0000000-0000-0000-0000-000000000002',
      (SELECT id FROM public.chat_channels WHERE workspace_id = '22222222-2222-2222-2222-222222222222' AND slug = 'geral'),
      'revops',
      'Como está o forecast?',
      'Aqui está o forecast...',
      'idemp-chat-test-02'
    );
  $$,
  'P0001',
  NULL,
  'Permissão BDR: BDR não tem permissão para interagir diretamente com RevOps (apenas Comercial e Copy)'
);

SELECT * FROM finish();
ROLLBACK;
