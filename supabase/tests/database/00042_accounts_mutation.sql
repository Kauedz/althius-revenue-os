-- ==============================================================================
-- Test: 00042_accounts_mutation.sql
-- Mutação de contas e importação com regra de duplicidade (ADR 0037):
--  - privilégios de execução estritos (ADR 0023);
--  - create_account respeita workspace e valida chamador;
--  - update_account respeita accounts.edit (BDR só edita suas contas próprias);
--  - import_accounts bloqueia BDR (accounts.import = none) e marca duplicidade.
-- Seed: e..03 Aline (C-level Evolut, membro d..03, ws a..01),
--       e..04 Lucas (BDR Evolut, membro d..04, ws a..01),
--       e..07 Eduardo (C-level Grão Norte, membro d..09, ws b..01).
-- ==============================================================================

BEGIN;
SELECT plan(16);

-- 1. Privilégios das RPCs (ADR 0023)
SELECT ok(NOT has_function_privilege('anon', 'public.create_account(uuid, uuid, text, text, text, text, int, uuid)', 'EXECUTE'), 'anon não executa create_account');
SELECT ok(has_function_privilege('authenticated', 'public.create_account(uuid, uuid, text, text, text, text, int, uuid)', 'EXECUTE'), 'authenticated executa create_account');
SELECT ok(has_function_privilege('authenticated', 'public.update_account(uuid, uuid, text, text, text, text, int, uuid)', 'EXECUTE'), 'authenticated executa update_account');
SELECT ok(has_function_privilege('authenticated', 'public.import_accounts(uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated executa import_accounts');

-- 2. create_account: Aline (C-level) cria conta
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.create_account(
       'a0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000003',
       'Nova Indústria Brasil',
       'novaindustria.com.br',
       'SP',
       'São Paulo',
       2,
       'd0000000-0000-0000-0000-000000000004'
     ) $$,
  'Aline (C-level) cria nova conta atribuindo ao Lucas'
);

SELECT is(
  (SELECT count(*)::int FROM public.accounts WHERE domain = 'novaindustria.com.br'),
  1,
  'Conta Nova Indústria Brasil inserida com sucesso'
);

-- 3. create_account: Lucas tenta chamar com id de membro de Aline -> REJEITADO
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT throws_ok(
  $$ SELECT public.create_account(
       'a0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000003',
       'Fraude Tech',
       'fraudetech.com.br',
       'RJ',
       'Rio',
       1,
       NULL
     ) $$,
  '42501', NULL,
  'Lucas não pode criar conta com id de membro alheio'
);

-- 4. update_account e accounts.edit: Lucas (BDR) edita sua própria conta (Serra Azul c...01)
SELECT lives_ok(
  $$ SELECT public.update_account(
       'c0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000004',
       'Serra Azul Têxtil SA',
       'serraazul.com.br',
       'MG',
       'Belo Horizonte',
       3,
       'd0000000-0000-0000-0000-000000000004'
     ) $$,
  'Lucas (BDR) edita conta em que é o responsável'
);

SELECT is(
  (SELECT name FROM public.accounts WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  'Serra Azul Têxtil SA',
  'Nome da conta Serra Azul atualizado por Lucas'
);

-- 5. update_account: Lucas tenta editar conta de outro membro (Metalúrgica Ipê c...03, dono Renan d...06)
SELECT throws_ok(
  $$ SELECT public.update_account(
       'c0000000-0000-0000-0000-000000000003',
       'd0000000-0000-0000-0000-000000000004',
       'Hack Metalurgica',
       'metalurgicaipe.com.br',
       'SC',
       'Joinville',
       1,
       NULL
     ) $$,
  '42501', NULL,
  'Lucas (BDR) não pode editar conta que não é dele'
);

-- 6. import_accounts: Lucas (BDR) tenta importar -> REJEITADO (accounts.import = none)
SELECT throws_ok(
  $$ SELECT public.import_accounts(
       'a0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000004',
       '[{"name": "X", "domain": "x.com"}]'::jsonb
     ) $$,
  '42501', NULL,
  'BDR não tem permissão para importar lista de contas'
);

-- 7. import_accounts: Aline (C-level) importa lista com 1 inédita e 1 duplicada (serraazul.com.br)
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT lives_ok(
  $$ SELECT public.import_accounts(
       'a0000000-0000-0000-0000-000000000001',
       'd0000000-0000-0000-0000-000000000003',
       '[
          {"name": "Serra Azul Têxtil Repetida", "domain": "serraazul.com.br", "state_uf": "MG", "city": "Belo Horizonte"},
          {"name": "Inédita Logística", "domain": "ineditalog.com.br", "state_uf": "PR", "city": "Curitiba"}
        ]'::jsonb
     ) $$,
  'Aline importa lista de contas'
);

-- A conta original c...01 continua intacta (nunca apaga)
SELECT is(
  (SELECT name FROM public.accounts WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  'Serra Azul Têxtil SA',
  'Conta original continua preservada e não foi sobrescrita'
);

-- A conta duplicada foi marcada como is_duplicate = true
SELECT is(
  (SELECT is_duplicate FROM public.accounts WHERE name = 'Serra Azul Têxtil Repetida'),
  true,
  'Conta repetida foi marcada com is_duplicate = true'
);

SELECT is(
  (SELECT duplicate_of_id FROM public.accounts WHERE name = 'Serra Azul Têxtil Repetida'),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'Conta repetida aponta para o id da conta original'
);

-- A conta inédita foi inserida com is_duplicate = false
SELECT is(
  (SELECT is_duplicate FROM public.accounts WHERE domain = 'ineditalog.com.br'),
  false,
  'Conta inédita tem is_duplicate = false'
);

SELECT * FROM finish();
ROLLBACK;