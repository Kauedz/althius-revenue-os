-- ==============================================================================
-- Test: 00034_my_account.sql
-- Seam: perfil da pessoa (Configurações → Minha conta e Notificações) e depósito de fotos.
-- A pessoa edita nome, cargo, telefone, foto e preferências do PRÓPRIO perfil; nada de outra pessoa.
-- Seed: Aline e..03, Lucas e..04.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT has_column('public', 'profiles', 'job_title', 'Perfil tem cargo');
SELECT has_column('public', 'profiles', 'phone', 'Perfil tem telefone');
SELECT has_column('public', 'profiles', 'preferences', 'Perfil tem preferências de notificação');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'job_title', 'UPDATE'), 'Pessoa pode editar o cargo');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'), 'Pessoa pode editar o telefone');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'preferences', 'UPDATE'), 'Pessoa pode editar as preferências');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'), 'E-mail não muda por aqui (vem do login)');

SELECT throws_ok(
  $$ UPDATE public.profiles SET preferences = '"texto"' WHERE id = 'e0000000-0000-0000-0000-000000000003' $$,
  '23514', NULL, 'Preferências precisam ser um objeto');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
UPDATE public.profiles SET job_title = 'Diretora de Supply Chain', phone = '+55 11 99999-0000', preferences = '{"notif": true, "som": false}'
WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET job_title = 'Invadido' WHERE id = 'e0000000-0000-0000-0000-000000000004';
RESET ROLE;
SELECT results_eq(
  $$ SELECT job_title, phone, preferences FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('Diretora de Supply Chain'::text, '+55 11 99999-0000'::text, '{"notif": true, "som": false}'::jsonb) $$,
  'Aline grava cargo, telefone e preferências no próprio perfil');
SELECT isnt((SELECT job_title FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000004'), 'Invadido', 'Aline não altera o perfil do Lucas');

-- Fotos: depósito próprio; cada pessoa só grava na própria pasta.
SELECT ok(EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars' AND public), 'Existe o depósito de fotos de perfil');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Pessoa grava a própria foto'),
  'Regra: a pessoa só grava foto na própria pasta');

SELECT * FROM finish();
ROLLBACK;
