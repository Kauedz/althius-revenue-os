-- ==============================================================================
-- Test: 00009_hermes_policy_engine.sql
-- Verifies Ticket 02 - Universal Hermes Policy Engine (The 4 Sequential Checks)
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace and members
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

-- u_super: Superadmin
-- u_estra: Estrategista
-- u_clevel: C-level
-- u_bdr: BDR
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'estrategista', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 2. Scenario 1 (Check 1 Failure): Role lacks capability key (BDR attempts 'pipeline.boards')
SELECT is(
  (public.hermes_evaluate_action(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '87eb998f-0000-0000-0000-000000000004'::uuid,
    'pipeline.boards',
    NULL,
    0,
    false,
    'Criar Quadro',
    '{"name": "Novo Quadro"}'::jsonb
  )->>'status'),
  'denied_role',
  'Hermes Check 1: Deve recusar acao se o papel nao possui a chave (BDR -> pipeline.boards)'
);

-- 3. Scenario 2 (Check 2 Failure): Data owner violation (BDR attempts to edit another member''s account)
SELECT is(
  (public.hermes_evaluate_action(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '87eb998f-0000-0000-0000-000000000004'::uuid,
    'accounts.edit',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, -- Account belongs to someone else
    0,
    false,
    'Editar Conta Alheia',
    '{"domain": "alheio.com"}'::jsonb
  )->>'status'),
  'denied_owner',
  'Hermes Check 2: Deve recusar acao se o usuario nao e o dono do dado (BDR -> conta alheia)'
);

-- 4. Scenario 3 (Check 3 Trigger): Approval required for spend (Estrategista requests budget spend)
SELECT is(
  (public.hermes_evaluate_action(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '87eb998f-0000-0000-0000-000000000002'::uuid,
    'approvals.spend',
    NULL,
    5000,
    true,
    'Campanha LinkedIn Ads',
    '{"budget_usd": 500}'::jsonb
  )->>'status'),
  'requires_approval',
  'Hermes Check 3: Gasto financeiro pedido pelo estrategista deve gerar status requires_approval'
);

-- Check that approval was created with category 'gasto' and payload_hash
SELECT is(
  (SELECT category FROM public.approvals WHERE title = 'Campanha LinkedIn Ads' LIMIT 1),
  'gasto',
  'Hermes Check 3: Registro de aprovacao deve ser gerado com category = gasto'
);

-- Check that notification was routed to the C-level
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.recipient_member_id = '87eb998f-0000-0000-0000-000000000003'::uuid
      AND n.title LIKE '%Aprovação de gasto%'
  ),
  'Hermes Check 3: Notificacao deve ser enviada para o C-level'
);

-- 5. Scenario 4 (Authorized Execution): C-level approving and executing action directly
SELECT is(
  (public.hermes_evaluate_action(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '87eb998f-0000-0000-0000-000000000003'::uuid,
    'pipeline.boards',
    NULL,
    0,
    false,
    'Criar Quadro SLG',
    '{"name": "Enterprise Outbound"}'::jsonb
  )->>'status'),
  'authorized',
  'Hermes Check 4: Acao valida do C-level deve ser autorizada imediatamente'
);

-- Check that execution record was created
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.executions e
    WHERE e.workspace_id = '11111111-1111-1111-1111-111111111111'::uuid
      AND e.capability_key = 'pipeline.boards'
  ),
  'Hermes: Acao autorizada deve gerar registro em executions'
);

-- Check that audit log recorded the evaluation
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.workspace_id = '11111111-1111-1111-1111-111111111111'::uuid
      AND al.action = 'hermes.evaluation'
  ),
  'Hermes: Toda avaliacao deve ser gravada na tabela de auditoria'
);

SELECT * FROM finish();
ROLLBACK;