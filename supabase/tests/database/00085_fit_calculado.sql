-- ==============================================================================
-- Test: 00085_fit_calculado.sql
-- Fit calculado de verdade (spec .scratch/prospeccao-revenue, fatia 4; ADR 0067). Sem IA, sem API, sem crédito:
--   aderência ao ICP (até 60: setor/CNAE, porte, região; só conta o que o ICP define),
--   sinais recentes (até 25: nos últimos 30 dias) e dados completos (até 15: site, CNPJ, endereço, telefone, pessoas).
-- Recalcula quando a conta muda, quando chega sinal, quando entra pessoa e quando o ICP muda. Mostra as partes.
-- Isolamento: o ICP de um cliente não mexe no fit do outro.
-- ==============================================================================

BEGIN;
SELECT no_plan();

UPDATE public.workspace_settings SET icp = '{}'::jsonb WHERE workspace_id IN ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001');
INSERT INTO public.accounts (id, workspace_id, name, domain, status, fit) VALUES
  ('c8500000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FIT-A', 'fit-a.test', 'ativa', 99),
  ('c8500000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'FIT-GRAO', 'fit-grao.test', 'ativa', 0);

-- Conta só com site, sem ICP: a nota não é inventada (o 99 digitado não vale).
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 2, 'Só com site e sem ICP: fit 2 (o valor digitado não vale)');
SELECT is((SELECT jsonb_array_length(fit_partes) FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 3, 'Três partes: ICP, sinais e dados');
SELECT ok((SELECT fit_partes->0->>'motivo' FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001') ~ 'ICP não definido', 'Diz que o ICP não foi definido');

-- Dados chegam (enriquecimento): CNPJ, cidade, telefone, CNAE e porte da Receita.
SELECT set_config('althius.enriquecimento', 'on', true);
UPDATE public.accounts SET cnpj = '12345678000195', city = 'Campinas', state_uf = 'SP', telefone = '1933331111',
       cnae = '8630504 - Atividade odontológica', porte = 'MICRO EMPRESA'
 WHERE id = 'c8500000-0000-0000-0000-000000000001';
SELECT set_config('althius.enriquecimento', 'off', true);
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 12, 'Dados completos (menos pessoas): 12 de 15');

-- Uma pessoa entra na conta
INSERT INTO public.contacts (workspace_id, account_id, name) VALUES ('a0000000-0000-0000-0000-000000000001', 'c8500000-0000-0000-0000-000000000001', 'Pessoa Fit');
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 15, 'Com uma pessoa mapeada: dados 15 de 15');

-- O ICP é definido: setor (CNAE), porte e região batem
UPDATE public.workspace_settings SET icp = '{"cnaes":["8630504"],"portes":["MICRO","EPP"],"ufs":["SP"]}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 75, 'ICP definido e tudo bate: 60 + 15');
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000002'), 2, 'ISOLAMENTO: o ICP da Evolut não mexe no fit da Grão');

-- Região não bate
UPDATE public.workspace_settings SET icp = '{"cnaes":["8630504"],"portes":["MICRO","EPP"],"ufs":["RJ"]}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 55, 'Região fora do ICP: perde a parte da região (60/3 = 20)');
SELECT ok((SELECT fit_partes->0->>'motivo' FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001') ~ 'região fora', 'O motivo diz o que não bateu');

-- Setor por texto (segmento) quando o ICP fala em setores
UPDATE public.workspace_settings SET icp = '{"setores":["Odontologia"]}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 15, 'Setor que não aparece na conta: 0 de 60');
UPDATE public.accounts SET segment = 'Odontologia e saúde bucal' WHERE id = 'c8500000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 75, 'Conta mudou (segmento): recalcula e o setor bate');

-- Sinais recentes somam; sinal antigo (mais de 30 dias) não
INSERT INTO public.signal_events (workspace_id, signal_id, account_id, detected_at)
SELECT 'a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.signal_definitions ORDER BY code LIMIT 1), 'c8500000-0000-0000-0000-000000000001', now() - interval '60 days';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 75, 'Sinal de 60 dias atrás não conta');
INSERT INTO public.signal_events (workspace_id, signal_id, account_id)
SELECT 'a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.signal_definitions ORDER BY code LIMIT 1), 'c8500000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 85, 'Chegou sinal: +10');
INSERT INTO public.signal_events (workspace_id, signal_id, account_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id, 'c8500000-0000-0000-0000-000000000001' FROM public.signal_definitions ORDER BY code LIMIT 2;
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 100, '3 sinais recentes: 25 de 25 (nota máxima 100)');
SELECT ok((SELECT fit_partes->1->>'motivo' FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001') ~ '3 sinais', 'O motivo diz quantos sinais');
SELECT ok((SELECT fit_calculado_em FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001') IS NOT NULL, 'Guarda quando calculou');

-- O cliente não escreve o fit à mão
UPDATE public.accounts SET fit = 5 WHERE id = 'c8500000-0000-0000-0000-000000000001';
SELECT is((SELECT fit FROM public.accounts WHERE id = 'c8500000-0000-0000-0000-000000000001'), 100, 'Fit escrito à mão é recalculado');

SELECT * FROM finish();
ROLLBACK;
