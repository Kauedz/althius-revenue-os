-- ==============================================================================
-- Test: 00011_approvals_workflow.sql
-- Verifies Ticket 04 - Operation vs Spend Approvals, Payload Hash and Single-Use
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace and members
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'superadmin', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'estrategista', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 2. Create approval of category 'gasto'
INSERT INTO public.approvals (
  id,
  workspace_id,
  category,
  title,
  requested_by_member_id,
  status,
  payload_json,
  payload_hash
) VALUES (
  '18ad521d-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'gasto',
  'Orçamento de Mídia Q4',
  '87eb998f-0000-0000-0000-000000000002', -- Estrategista requested
  'pendente',
  '{"budget_usd": 1500, "channel": "linkedin"}'::jsonb,
  encode(digest('{"budget_usd": 1500, "channel": "linkedin"}'::jsonb::text, 'sha256'), 'hex')
);

-- Test: Estrategista tries to approve 'gasto' -> must be rejected
SELECT is(
  (public.approval_decide(
    '18ad521d-0000-0000-0000-000000000001'::uuid,
    '87eb998f-0000-0000-0000-000000000002'::uuid, -- Estrategista
    'aprovado',
    '{"budget_usd": 1500, "channel": "linkedin"}'::jsonb
  )->>'status'),
  'unauthorized_decider_for_spend',
  'Regra de Dinheiro: Estrategista nao pode aprovar gasto financeiro'
);

-- Aprovação separada para o cenário de adulteração (a adulteração invalida a aprovação)
INSERT INTO public.approvals (id, workspace_id, category, title, requested_by_member_id, status, payload_json, payload_hash) VALUES (
  '18ad521d-0000-0000-0000-0000000000ff', '11111111-1111-1111-1111-111111111111', 'gasto', 'Orçamento adulterado',
  '87eb998f-0000-0000-0000-000000000002', 'pendente', '{"budget_usd": 1500, "channel": "linkedin"}'::jsonb,
  encode(digest('{"budget_usd": 1500, "channel": "linkedin"}'::jsonb::text, 'sha256'), 'hex')
);

-- Test: C-level tries to approve with tampered payload -> must be rejected by hash mismatch
SELECT is(
  (public.approval_decide(
    '18ad521d-0000-0000-0000-0000000000ff'::uuid,
    '87eb998f-0000-0000-0000-000000000003'::uuid, -- C-level
    'aprovado',
    '{"budget_usd": 99999, "channel": "linkedin"}'::jsonb -- Tampered payload!
  )->>'status'),
  'payload_tampered_hash_mismatch',
  'Payload Hash: Alteracao no payload invalida a aprovacao'
);

-- Test: C-level approves with correct payload -> must succeed
SELECT is(
  (public.approval_decide(
    '18ad521d-0000-0000-0000-000000000001'::uuid,
    '87eb998f-0000-0000-0000-000000000003'::uuid, -- C-level
    'aprovado',
    '{"budget_usd": 1500, "channel": "linkedin"}'::jsonb
  )->>'status'),
  'aprovado',
  'C-level com payload autentico deve aprovar com sucesso'
);

-- Test: Single-use enforcement -> attempting to decide again must fail
SELECT is(
  (public.approval_decide(
    '18ad521d-0000-0000-0000-000000000001'::uuid,
    '87eb998f-0000-0000-0000-000000000003'::uuid,
    'rejeitado',
    '{"budget_usd": 1500, "channel": "linkedin"}'::jsonb
  )->>'status'),
  'approval_already_processed',
  'Uso Unico: Tentativa de reaproveitar ou redecidir aprovacao deve ser bloqueada'
);

-- 3. Create approval of category 'operacao' (e.g. Copy draft)
INSERT INTO public.approvals (
  id,
  workspace_id,
  category,
  title,
  requested_by_member_id,
  status,
  payload_json,
  payload_hash
) VALUES (
  '18ad521d-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'operacao',
  'Revisão de Copy para Cadência D0',
  '87eb998f-0000-0000-0000-000000000004', -- BDR requested
  'pendente',
  '{"copy_id": 42, "subject": "Oportunidade de expansao"}'::jsonb,
  encode(digest('{"copy_id": 42, "subject": "Oportunidade de expansao"}'::jsonb::text, 'sha256'), 'hex')
);

-- Test: Estrategista CAN approve 'operacao'
SELECT is(
  (public.approval_decide(
    '18ad521d-0000-0000-0000-000000000002'::uuid,
    '87eb998f-0000-0000-0000-000000000002'::uuid, -- Estrategista
    'aprovado',
    '{"copy_id": 42, "subject": "Oportunidade de expansao"}'::jsonb
  )->>'status'),
  'aprovado',
  'Operacao: Estrategista possui autorizacao para aprovar operacoes de copy/estrategia'
);

SELECT * FROM finish();
ROLLBACK;