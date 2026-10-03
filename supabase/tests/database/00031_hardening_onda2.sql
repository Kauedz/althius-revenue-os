-- ==============================================================================
-- Test: 00031_hardening_onda2.sql
-- Revisão da onda 2: função do Início com search_path fixo; notificação só pode ter
-- o "lida em" alterado pela própria pessoa (título e texto não).
-- Seed: Aline C-level Evolut (e..03, membro d..03).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.get_home_summary(uuid, uuid)'::regprocedure
          AND proconfig::text LIKE '%search_path=%'),
  'get_home_summary roda com search_path fixo (SECURITY DEFINER seguro)');

SELECT ok(has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'), 'Pessoa pode marcar a própria notificação como lida');
SELECT ok(NOT has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'), 'Pessoa não altera o título da notificação');
SELECT ok(NOT has_column_privilege('authenticated', 'public.notifications', 'body', 'UPDATE'), 'Pessoa não altera o texto da notificação');
SELECT ok(NOT has_column_privilege('authenticated', 'public.notifications', 'recipient_member_id', 'UPDATE'), 'Pessoa não muda o destinatário da notificação');

INSERT INTO public.notifications (id, workspace_id, recipient_member_id, type, title, body)
VALUES ('fb000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'info', 'Original', 'Texto');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok(
  $$ UPDATE public.notifications SET title = 'Adulterado' WHERE id = 'fb000000-0000-0000-0000-000000000031' $$,
  '42501', NULL, 'Tentar mudar o título é recusado');
UPDATE public.notifications SET read_at = now() WHERE id = 'fb000000-0000-0000-0000-000000000031';
RESET ROLE;
SELECT ok((SELECT read_at IS NOT NULL AND title = 'Original' FROM public.notifications WHERE id = 'fb000000-0000-0000-0000-000000000031'),
  'Marcar como lida continua funcionando e o título fica intacto');

SELECT * FROM finish();
ROLLBACK;
