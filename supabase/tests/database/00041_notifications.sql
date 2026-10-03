-- ==============================================================================
-- Test: 00041_notifications.sql
-- Notificações funcionais por membro e marcação como lida:
--  - privilégios de execução estritos (ADR 0023);
--  - assert_caller_is_member impede alterar notificação de outro membro;
--  - isolamento por membro: cada pessoa vê e altera somente as próprias;
--  - marcar como lida (individual e em lote).
-- Seed: e..03 Aline (C-level Evolut, membro d..03, ws a..01),
--       e..04 Lucas (BDR Evolut, membro d..04, ws a..01),
--       e..07 Eduardo (C-level Grão Norte, membro d..09, ws b..01).
-- ==============================================================================

BEGIN;
SELECT plan(12);

-- 1. Privilégios da função RPC (ADR 0023)
SELECT ok(NOT has_function_privilege('anon', 'public.mark_notifications_read(uuid, uuid)', 'EXECUTE'), 'anon não executa mark_notifications_read');
SELECT ok(has_function_privilege('authenticated', 'public.mark_notifications_read(uuid, uuid)', 'EXECUTE'), 'authenticated executa mark_notifications_read');

-- Inserção de notificações de teste como postgres
INSERT INTO public.notifications (id, workspace_id, recipient_member_id, type, title, body, read_at)
VALUES
  ('fa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'approval', 'Aprovação pendente', 'E-mails T1', NULL),
  ('fa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'system', 'Integração com falha', 'Mídia paga', NULL),
  ('fa000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'lead', 'Novo lead atribuído', 'Serra Azul', NULL),
  ('fa000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'welcome', 'Boas-vindas', 'Grão Norte', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS de SELECT: Aline só vê as suas 2 notificações
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE id IN ('fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000004')),
  2,
  'Aline vê exclusivamente as suas 2 notificações'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.notifications WHERE id = 'fa000000-0000-0000-0000-000000000003' $$,
  'Aline não vê a notificação de Lucas'
);

-- 3. RLS de SELECT: Lucas só vê a sua notificação
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE id IN ('fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000004')),
  1,
  'Lucas vê exclusivamente a sua notificação'
);

SELECT is(
  (SELECT id FROM public.notifications WHERE id = 'fa000000-0000-0000-0000-000000000003'),
  'fa000000-0000-0000-0000-000000000003'::uuid,
  'A notificação visível para Lucas é a fa...03'
);

-- 4. Tentativa de marcar notificações de outro membro via RPC
SELECT throws_ok(
  $$ SELECT public.mark_notifications_read('d0000000-0000-0000-0000-000000000003', NULL) $$,
  '42501', NULL,
  'Lucas não pode marcar notificações de Aline como lidas'
);

-- 5. Tentativa de update direto via RLS em notificação alheia
UPDATE public.notifications SET read_at = now() WHERE id = 'fa000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT read_at FROM public.notifications WHERE id = 'fa000000-0000-0000-0000-000000000001'),
  NULL,
  'UPDATE direto não afeta notificação de outro membro'
);

-- 6. Aline marca todas as suas notificações como lidas via RPC
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.mark_notifications_read('d0000000-0000-0000-0000-000000000003', NULL) $$,
  'Aline marca suas notificações como lidas com sucesso'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE recipient_member_id = 'd0000000-0000-0000-0000-000000000003' AND read_at IS NULL),
  0,
  'Todas as notificações de Aline foram marcadas como lidas'
);

-- 7. A notificação de Lucas continua não lida
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE id = 'fa000000-0000-0000-0000-000000000003' AND read_at IS NULL),
  1,
  'A notificação de Lucas permanece não lida'
);

-- 8. Lucas marca apenas a sua como lida individualmente
SELECT lives_ok(
  $$ SELECT public.mark_notifications_read('d0000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000003') $$,
  'Lucas marca notificação específica como lida'
);

SELECT * FROM finish();
ROLLBACK;