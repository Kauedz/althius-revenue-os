-- ==============================================================================
-- Test: 00013_signals_apify_catalog.sql
-- Verifies Ticket 06 - Apify Data Gateway, 20 Catalog Signals & Events
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace, members, and account
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'clevel', 'active'),
  ('87eb998f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'estrategista', 'active'),
  ('87eb998f-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.accounts (id, workspace_id, name, domain, temperature) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hospital São Lucas', 'saolucas.com.br', 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Verify that all 20 canonical signals are seeded
SELECT is(
  (SELECT count(*)::integer FROM public.signal_definitions),
  20,
  'Sinais: Catalogo global deve conter exatamente os 20 sinais canonicos'
);

-- Verify specific high-value signals
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.signal_definitions 
    WHERE code = 'vagas_cargo' AND agent_code = 'comercial' AND credits_per_account = 5
  ),
  'Sinais: Sinal "Vagas abertas por cargo" cadastrado com 5 creditos e Agente Comercial'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.signal_definitions 
    WHERE code = 'geo_presence' AND agent_code = 'marketing' AND credits_per_account = 10
  ),
  'Sinais: Sinal "Presenca em respostas de IA (GEO)" cadastrado com 10 creditos e Agente de Marketing'
);

-- 3. Test Signal Event Processing & Temperature Bump
SELECT ok(
  public.process_signal_event(
    '11111111-1111-1111-1111-111111111111'::uuid,
    (SELECT id FROM public.signal_definitions WHERE code = 'vagas_cargo'),
    'acc00000-0000-0000-0000-000000000001'::uuid,
    NULL,
    '3 novas vagas para Diretor de Supply Chain detectadas',
    '{"job_titles": ["Diretor de Supply Chain", "Head de Logistica"]}'::jsonb,
    2, -- Bump from 1 to 3 chamas (hot signal)
    'Campinas',
    'SP'
  ) IS NOT NULL,
  'Signal Events: Funcao process_signal_event deve registrar evento com sucesso'
);

-- Verify Account was updated with temperature = 3, location and signal text
SELECT is(
  (SELECT temperature FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000001'),
  3,
  'Signal Events: Conta deve ter subido para temperatura maxima (3 chamas)'
);

SELECT is(
  (SELECT last_signal_text FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000001'),
  '3 novas vagas para Diretor de Supply Chain detectadas',
  'Signal Events: last_signal_text da conta deve ser atualizado com o texto do evento'
);

SELECT is(
  (SELECT state_uf FROM public.accounts WHERE id = 'acc00000-0000-0000-0000-000000000001'),
  'SP',
  'Signal Events: Estado da conta deve ter sido atualizado para SP'
);

-- Verify Hot Signal Notification generated
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.workspace_id = '11111111-1111-1111-1111-111111111111'::uuid
      AND n.title LIKE '%Sinal quente%'
  ),
  'Signal Events: Sinal quente de 3 chamas deve gerar notificacao automatica'
);

SELECT * FROM finish();
ROLLBACK;