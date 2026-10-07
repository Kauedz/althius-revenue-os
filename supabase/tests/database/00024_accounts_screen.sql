-- ==============================================================================
-- Test: 00024_accounts_screen.sql
-- Contas e leads: campos de segmento e fit e isolamento por workspace.
-- ==============================================================================

BEGIN;
SELECT plan(8);

SELECT has_column('public', 'accounts', 'segment', 'Conta tem segmento no ICP');
SELECT has_column('public', 'accounts', 'fit', 'Conta tem pontuação de fit no ICP');

-- O fit é calculado pelo banco (ADR 0067): o valor escrito à mão não vale, nem fora de 0 a 100.
INSERT INTO public.accounts (id, workspace_id, name, domain, fit)
VALUES ('ca000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Empresa Teste', 'empresateste.com.br', 150);
SELECT ok((SELECT fit BETWEEN 0 AND 100 AND fit <> 150 FROM public.accounts WHERE id = 'ca000000-0000-0000-0000-000000000002'),
  'Fit acima de 100 escrito à mão é substituído pelo calculado');
UPDATE public.accounts SET fit = -5 WHERE id = 'ca000000-0000-0000-0000-000000000002';
SELECT ok((SELECT fit BETWEEN 0 AND 100 FROM public.accounts WHERE id = 'ca000000-0000-0000-0000-000000000002'),
  'Fit negativo escrito à mão é substituído pelo calculado');

-- Inserção válida com segmento: o fit vem do cálculo (só site, sem ICP nem sinais: 2)
UPDATE public.workspace_settings SET icp = '{}'::jsonb WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
INSERT INTO public.accounts (id, workspace_id, name, domain, segment, fit, temperature, city, state_uf)
VALUES ('ca000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'Conta Exemplo', 'contaexemplo.com.br', 'Têxtil', 95, 3, 'São Paulo', 'SP');

SELECT results_eq(
  $$ SELECT name, segment, fit, temperature FROM public.accounts WHERE id = 'ca000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('Conta Exemplo'::text, 'Têxtil'::text, 5::integer, 3::integer) $$,
  'Campos de segmento gravados; fit calculado (site 2 + cidade 3)'
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
