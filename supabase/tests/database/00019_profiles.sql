-- ==============================================================================
-- Test: 00019_profiles.sql
-- Perfis (nome e e-mail) das pessoas, visíveis só para quem divide workspace.
-- Usa os usuários do seed: e...01 superadmin, e...03 Aline (C-level Evolut),
-- e...04 Lucas (BDR Evolut), e...07 Eduardo (C-level Grão Norte).
-- ==============================================================================

BEGIN;
SELECT plan(9);

SELECT has_table('public', 'profiles', 'Tabela public.profiles deve existir');

SELECT is(
  (SELECT name FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000003'),
  'Aline Xavier',
  'Perfil é criado a partir do cadastro de login, com o nome informado'
);

-- Um novo login ganha perfil automaticamente
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000aa', 'authenticated', 'authenticated', 'novo@evolut.com.br', '', now(), '{}'::jsonb, '{"name": "Pessoa Nova"}'::jsonb, now(), now());

SELECT is(
  (SELECT email FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-0000000000aa'),
  'novo@evolut.com.br',
  'Novo usuário de login ganha perfil com o e-mail'
);

-- Lucas (BDR Evolut) enxerga Aline (mesmo workspace) mas não Eduardo (só Grão Norte)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004"}';

SELECT isnt_empty(
  $$ SELECT 1 FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000003' $$,
  'Membro vê o perfil de quem divide workspace com ele'
);

SELECT is_empty(
  $$ SELECT 1 FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000007' $$,
  'Membro NÃO vê perfil de pessoa de outro workspace'
);

SELECT isnt_empty(
  $$ SELECT 1 FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000004' $$,
  'Pessoa sempre vê o próprio perfil'
);

-- Pessoa muda o próprio nome, mas não o e-mail (que define origem Althius/cliente)
SELECT lives_ok(
  $$ UPDATE public.profiles SET name = 'Lucas T.' WHERE id = 'e0000000-0000-0000-0000-000000000004' $$,
  'Pessoa edita o próprio nome'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET email = 'lucas@althius.com.br' WHERE id = 'e0000000-0000-0000-0000-000000000004' $$,
  '42501', NULL,
  'Pessoa NÃO troca o próprio e-mail pelo perfil'
);

-- Superadmin vê todos
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001"}';
SELECT isnt_empty(
  $$ SELECT 1 FROM public.profiles WHERE id = 'e0000000-0000-0000-0000-000000000007' $$,
  'Superadmin vê o perfil de qualquer pessoa'
);

SELECT * FROM finish();
ROLLBACK;
