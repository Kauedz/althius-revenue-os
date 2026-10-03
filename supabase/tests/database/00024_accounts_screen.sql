-- ==============================================================================
-- Test: 00024_accounts_screen.sql
-- Contas e leads: campos de segmento e fit e isolamento por workspace.
-- ==============================================================================

BEGIN;
SELECT plan(8);

SELECT has_column('public', 'accounts', 'segment', 'Conta tem segmento no ICP');
SELECT has_column('public', 'accounts', 'fit', 'Conta tem pontuação de fit no ICP');

-- Fit inválido é recusado (deve ser entre 0 e 100)
SELECT throws_ok(
  $$ INSERT INTO public.accounts (workspace_id, name, domain, fit)
     VALUES ('a0000000-0000-0000-0000-000000000001', 'Empresa Teste', 'empresateste.com.br', 150) $$,
  '23514', NULL,
  'Fit acima de 100 é recusado pela restrição de integridade'
);

SELECT throws_ok(
  $$ INSERT INTO public.accounts (workspace_id, name, domain, fit)
     VALUES ('a0000000-0000-0000-0000-000000000001', 'Empresa Teste', 'empresateste.com.br', -5) $$,
  '23514', NULL,
  'Fit negativo é recusado pela restrição de integridade'
);

-- Inserção válida com segmento e fit
INSERT INTO public.accounts (id, workspace_id, name, domain, segment, fit, temperature, city, state_uf)
VALUES ('ca000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'Conta Exemplo', 'contaexemplo.com.br', 'Têxtil', 95, 3, 'São Paulo', 'SP');

SELECT results_eq(
  $$ SELECT name, segment, fit, temperature FROM public.accounts WHERE id = 'ca000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('Conta Exemplo'::text, 'Têxtil'::text, 95::integer, 3::integer) $$,
  'Campos de segmento e fit gravados e lidos corretamente'
);

-- RLS: Membro da Evolut lê as contas da Evolut
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT ok(
  (SELECT count(*) FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') >= 1,
  'Membro do workspace lê as contas do seu workspace'
);

-- RLS: BDR da Evolut lê as contas do seu workspace
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT ok(
  (SELECT count(*) FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001') >= 1,
  'BDR lê as contas do seu workspace'
);

-- RLS: Membro de outro workspace (Grão Norte) não lê contas da Evolut
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is_empty(
  $$ SELECT 1 FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'Isolamento: membro de outro workspace não lê contas da Evolut'
);

SELECT * FROM finish();
ROLLBACK;
