-- ==============================================================================
-- Test: 00016_pipeline_motions_stages.sql
-- Verifies Ticket 09 - 3 Motions, Max 5 Boards, 6 Canonical Stages & Stage History
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace, members, and account
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bdr', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.accounts (id, workspace_id, name, domain) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hospital São Lucas', 'saolucas.com.br');

-- 2. Verify all 6 canonical stages exist with correct probabilities
SELECT results_eq(
  $$ SELECT stage_key, default_probability FROM public.stage_definitions ORDER BY order_index $$,
  $$ VALUES 
     ('entrada', 10),
     ('qualificacao', 20),
     ('descoberta', 35),
     ('proposta', 55),
     ('negociacao', 75),
     ('ganho', 100)
  $$,
  'Etapas Canônicas: As 6 etapas devem ter exatamente as probabilidades padrao definidas'
);

-- 3. Test Max 5 Boards per motion ceiling
-- Create 5 SLG boards: all must succeed
INSERT INTO public.pipelines (workspace_id, motion, name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 1'),
  ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 2'),
  ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 3'),
  ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 4'),
  ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 5');

-- 6th SLG board must fail with limit error
SELECT throws_ok(
  $$
    INSERT INTO public.pipelines (workspace_id, motion, name) VALUES 
      ('11111111-1111-1111-1111-111111111111', 'slg', 'SLG Quadro 6 Excedente');
  $$,
  'P0001',
  NULL,
  'Teto de Quadros: Banco DEVE recusar o 6º quadro da mesma motion no workspace'
);

-- 4. Test Opportunity Stage Transition and History
INSERT INTO public.opportunities (
  id, 
  workspace_id, 
  pipeline_id, 
  account_id, 
  title, 
  stage_key, 
  amount, 
  owner_member_id
) VALUES (
  '7ca6f6e8-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  (SELECT id FROM public.pipelines WHERE name = 'SLG Quadro 1'),
  'acc00000-0000-0000-0000-000000000001',
  'Licenciamento Enterprise São Lucas',
  'entrada',
  50000.00,
  '87eb998f-0000-0000-0000-000000000002' -- BDR 1 (bbbb)
);

-- Move opportunity to 'descoberta'
UPDATE public.opportunities 
SET stage_key = 'descoberta' 
WHERE id = '7ca6f6e8-0000-0000-0000-000000000001';

-- Verify probability reset to stage default (35%)
SELECT is(
  (SELECT win_probability FROM public.opportunities WHERE id = '7ca6f6e8-0000-0000-0000-000000000001'),
  35,
  'Mudar de Etapa: Probabilidade de ganho deve voltar ao padrao da etapa (descoberta = 35%)'
);

-- Verify stage history entry created
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.opportunity_stage_history 
    WHERE opportunity_id = '7ca6f6e8-0000-0000-0000-000000000001'
      AND from_stage_key = 'entrada'
      AND to_stage_key = 'descoberta'
  ),
  'Histórico de Etapas: Transicao de etapa deve ser registrada em opportunity_stage_history'
);

-- 5. Move opportunity to 'ganho'
UPDATE public.opportunities 
SET stage_key = 'ganho' 
WHERE id = '7ca6f6e8-0000-0000-0000-000000000001';

SELECT is(
  (SELECT win_probability FROM public.opportunities WHERE id = '7ca6f6e8-0000-0000-0000-000000000001'),
  100,
  'Ganho: Probabilidade em etapa ganho deve ser obrigatoriamente 100%'
);

-- 6. Test RLS: BDR 1 can update their OWN opportunity
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
SET LOCAL ROLE authenticated;

UPDATE public.opportunities 
SET amount = 60000.00 
WHERE id = '7ca6f6e8-0000-0000-0000-000000000001';

SELECT is(
  (SELECT amount FROM public.opportunities WHERE id = '7ca6f6e8-0000-0000-0000-000000000001'),
  60000.00::numeric,
  'RLS: BDR deve conseguir alterar valor da oportunidade sob sua responsabilidade'
);

-- BDR 2 attempts to update BDR 1''s opportunity -> blocked by RLS
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

UPDATE public.opportunities 
SET amount = 99999.00 
WHERE id = '7ca6f6e8-0000-0000-0000-000000000001';

SELECT is(
  (SELECT amount FROM public.opportunities WHERE id = '7ca6f6e8-0000-0000-0000-000000000001'),
  60000.00::numeric,
  'RLS: BDR NAO pode alterar oportunidade de outro operador'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;