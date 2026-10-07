-- ==============================================================================
-- Test: 00092_chamas_pelo_fit.sql
-- ADR 0069. As chamas da conta saem da nota de fit (ICP até 60, sinais até 25, dados até 15):
-- 70 a 100 = 3 chamas · 45 a 69 = 2 chamas · até 44 = 1 chama. Quem grava não escolhe a chama. Nunca existe "fria".
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT is(internal.chamas_do_fit(0), 1, 'Fit 0: 1 chama (Aquecendo)');
SELECT is(internal.chamas_do_fit(44), 1, 'Fit 44: 1 chama');
SELECT is(internal.chamas_do_fit(45), 2, 'Fit 45: 2 chamas');
SELECT is(internal.chamas_do_fit(69), 2, 'Fit 69: 2 chamas');
SELECT is(internal.chamas_do_fit(70), 3, 'Fit 70: 3 chamas (Muito quente)');
SELECT is(internal.chamas_do_fit(100), 3, 'Fit 100: 3 chamas');
SELECT is(internal.chamas_do_fit(NULL), 1, 'Sem nota: 1 chama (nunca zero nem "fria")');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.chamas_do_fit(integer)', 'EXECUTE'), 'Função interna');

UPDATE public.workspace_settings SET icp = '{"setores": ["Têxtil"]}'::jsonb WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
INSERT INTO public.accounts (id, workspace_id, name, domain, cnpj, city, telefone, segment, temperature) VALUES
  ('ca920000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CHAMA-TRES', 'chama-tres.test', '11222333000181', 'São Paulo', '1130000000', 'Têxtil', 1),
  ('ca920000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CHAMA-DUAS', 'chama-duas.test', NULL, NULL, NULL, 'Têxtil', 3),
  ('ca920000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CHAMA-UMA', 'chama-uma.test', NULL, NULL, NULL, 'Padaria', 3);

SELECT is((SELECT fit FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000001'), 72, 'ICP bate (60) + dados (12) = 72');
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000001'), 3, 'Fit 72: 3 chamas, mesmo pedindo 1 na gravação');
SELECT is((SELECT fit FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000002'), 62, 'ICP bate (60) + só o site (2) = 62');
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000002'), 2, 'Fit 62: 2 chamas, mesmo pedindo 3 na gravação');
SELECT is((SELECT fit FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000003'), 2, 'Fora do ICP: só o site (2)');
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000003'), 1, 'Fit 2: 1 chama (Aquecendo), mesmo pedindo 3 na gravação');

-- Completar os dados sobe a chama sozinho
UPDATE public.accounts SET cnpj = '11222333000181', city = 'Campinas', telefone = '1930000000' WHERE id = 'ca920000-0000-0000-0000-000000000002';
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000002'), 3, 'Ao completar os dados a conta sobe para 3 chamas');
-- Mudar o ICP recalcula as chamas de todas
UPDATE public.workspace_settings SET icp = '{"setores": ["Padaria"]}'::jsonb WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000001'), 1, 'Mudou o ICP: a conta que saiu do perfil cai para 1 chama');
SELECT is((SELECT temperature FROM public.accounts WHERE id = 'ca920000-0000-0000-0000-000000000003'), 2, 'E a que entrou no perfil sobe para 2 chamas');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.accounts WHERE temperature NOT BETWEEN 1 AND 3), 'Nenhuma conta fora de 1 a 3 chamas');

SELECT * FROM finish();
ROLLBACK;
