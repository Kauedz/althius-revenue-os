-- ==============================================================================
-- Test: 00070_coleta_de_sinais_pessoas.sql
-- Coleta de sinais, ticket 02 (troca de cargo e posts do decisor): o pedido leva os contatos com LinkedIn (decisores
-- primeiro) e o retrato anterior de cada um; sinais de pessoas não são pedidos para conta sem contato com LinkedIn;
-- o retrato só é guardado por execução concluída; nada vaza entre clientes; a conta guarda o nome da empresa no LinkedIn.
-- Seed: Evolut a0..01; Grão Norte b0..01.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('service_role', 'public.signal_snapshot_save(uuid, jsonb)', 'EXECUTE'), 'Sistema guarda o retrato');
SELECT ok(NOT has_function_privilege('authenticated', 'public.signal_snapshot_save(uuid, jsonb)', 'EXECUTE'), 'Usuário logado não guarda retrato');
SELECT ok(NOT has_function_privilege('anon', 'public.signal_snapshot_save(uuid, jsonb)', 'EXECUTE'), 'Visitante não guarda retrato');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.signal_snapshots', 'SELECT'), 'Retratos não são lidos por usuário');
SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name IN ('linkedin_company_name', 'linkedin_company_url')), 2, 'A conta guarda o nome e o endereço da empresa no LinkedIn');

-- ---- Cenário
UPDATE public.accounts SET status = 'arquivada';
UPDATE internal.signal_recipes SET enabled = false;
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days'),
         ('b0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';

INSERT INTO public.accounts (workspace_id, name, domain, status, linkedin_company_name, linkedin_company_url) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'CANARIO-COM', 'canario-com.test', 'ativa', 'Canario Nome Linkedin', 'https://www.linkedin.com/company/canario-com'),
  ('a0000000-0000-0000-0000-000000000001', 'CANARIO-SEM', 'canario-sem.test', 'ativa', NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', 'CANARIO-OUTRO', 'canario-outro.test', 'ativa', NULL, NULL);

-- CANARIO-COM tem 7 contatos com LinkedIn (1 decisor, 2 campeões, 4 influenciadores) e 1 sem LinkedIn; CANARIO-SEM só e-mail.
INSERT INTO public.contacts (workspace_id, account_id, name, buying_role)
SELECT 'a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.accounts WHERE name = 'CANARIO-COM'), 'CANARIO-CT-' || n,
       CASE WHEN n = 1 THEN 'decisor' WHEN n <= 3 THEN 'campeao' ELSE 'influenciador' END
  FROM generate_series(1, 8) n;
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value)
SELECT 'a0000000-0000-0000-0000-000000000001', id, 'linkedin', CASE WHEN right(name, 1) = '1' THEN 'https://www.linkedin.com/in/Canario-CT-' || right(name, 1) ELSE 'Canario-CT-' || right(name, 1) END
  FROM public.contacts WHERE name LIKE 'CANARIO-CT-%' AND right(name, 1)::int <= 7;
INSERT INTO public.contacts (workspace_id, account_id, name, buying_role) VALUES
  ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.accounts WHERE name = 'CANARIO-SEM'), 'CANARIO-CT-SEM', 'decisor');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value)
  SELECT 'a0000000-0000-0000-0000-000000000001', id, 'email', 'canario-sem@canario-sem.test' FROM public.contacts WHERE name = 'CANARIO-CT-SEM';
-- Um contato de OUTRO cliente com LinkedIn (não pode aparecer no pedido da Evolut).
INSERT INTO public.contacts (workspace_id, account_id, name, buying_role) VALUES
  ('b0000000-0000-0000-0000-000000000001', (SELECT id FROM public.accounts WHERE name = 'CANARIO-OUTRO'), 'CANARIO-CT-OUTRO', 'decisor');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value)
  SELECT 'b0000000-0000-0000-0000-000000000001', id, 'linkedin', 'https://www.linkedin.com/in/canario-outro' FROM public.contacts WHERE name = 'CANARIO-CT-OUTRO';

-- ---- Receitas de pessoas nascem cadastradas, desligadas e exigindo contato com LinkedIn.
SELECT is((SELECT count(*)::int FROM internal.signal_recipes r JOIN public.signal_definitions d ON d.id = r.signal_id
            WHERE d.code IN ('troca_cargo', 'posts_decisor') AND r.requer_contato_linkedin AND NOT r.enabled), 2, 'Troca de cargo e posts: receitas prontas, desligadas, exigem contato com LinkedIn');
UPDATE internal.signal_recipes SET enabled = true WHERE signal_id = (SELECT id FROM public.signal_definitions WHERE code = 'troca_cargo');

CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT public.signal_collect_next(50) AS x;
SELECT is(jsonb_array_length((SELECT x FROM r1)), 2, 'Só as contas que têm contato com LinkedIn são pedidas (a sem contato não reserva crédito nenhum)');
SELECT ok((SELECT NOT bool_or(j->>'account_name' = 'CANARIO-SEM') FROM r1, jsonb_array_elements(x) j), 'A conta sem contato com LinkedIn ficou de fora');
CREATE TEMP TABLE com ON COMMIT DROP AS SELECT j FROM r1, jsonb_array_elements(x) j WHERE j->>'account_name' = 'CANARIO-COM';
SELECT is((SELECT j->>'linkedin_company_name' FROM com), 'Canario Nome Linkedin', 'O pedido leva o nome da empresa no LinkedIn');
SELECT is((SELECT j->>'linkedin_company_url' FROM com), 'https://www.linkedin.com/company/canario-com', 'E o endereço dela');
SELECT is((SELECT jsonb_array_length(j->'contatos') FROM com), 5, 'No máximo 5 contatos por conta');
SELECT is((SELECT j->'contatos'->0->>'papel' FROM com), 'decisor', 'O decisor vem primeiro');
SELECT is((SELECT j->'contatos'->0->>'linkedin_url' FROM com), 'https://www.linkedin.com/in/Canario-CT-1', 'O endereço do perfil mantém as maiúsculas de como foi cadastrado (o LinkedIn diferencia)');
SELECT is((SELECT j->'contatos'->1->>'linkedin_url' FROM com), 'https://www.linkedin.com/in/Canario-CT-2', 'Cadastrado só com o identificador, o endereço é montado com ele, também sem mexer nas maiúsculas');
SELECT ok((SELECT NOT (j::text LIKE '%canario-outro%' OR j::text LIKE '%CANARIO-CT-OUTRO%') FROM com), 'Nenhum contato de outro cliente aparece no pedido desta conta');
SELECT ok((SELECT bool_and(c->'snapshot' IS NULL OR c->'snapshot' = 'null'::jsonb) FROM com, jsonb_array_elements(j->'contatos') c), 'Primeira vez: ainda não há retrato anterior');

-- ---- Retrato: só vale depois que a execução termina; guarda por contato; atualiza em vez de duplicar.
CREATE TEMP TABLE run ON COMMIT DROP AS SELECT (j->>'run_id')::uuid AS id, j->'contatos'->0->>'id' AS contato FROM com;
SELECT is((public.signal_snapshot_save((SELECT id FROM run), jsonb_build_array(jsonb_build_object('chave', (SELECT contato FROM run), 'dados', '{"empresa":"canario","cargo":"Gerente"}'::jsonb))))->>'acao', 'ignorado', 'Execução ainda em andamento: retrato ignorado');
SELECT public.signal_collect_finish((SELECT id FROM run), '[]'::jsonb, 5, 0.02);
SELECT is((public.signal_snapshot_save((SELECT id FROM run), jsonb_build_array(jsonb_build_object('chave', (SELECT contato FROM run), 'dados', '{"empresa":"canario","cargo":"Gerente"}'::jsonb))))->>'acao', 'salvo', 'Execução concluída: retrato salvo');
SELECT is((SELECT count(*)::int FROM internal.signal_snapshots), 1, 'Um retrato guardado');
SELECT public.signal_snapshot_save((SELECT id FROM run), jsonb_build_array(jsonb_build_object('chave', (SELECT contato FROM run), 'dados', '{"empresa":"canario","cargo":"Diretor"}'::jsonb)));
SELECT is((SELECT count(*)::int FROM internal.signal_snapshots), 1, 'Salvar de novo atualiza, não duplica');
SELECT is((SELECT dados->>'cargo' FROM internal.signal_snapshots), 'Diretor', 'E guarda o mais novo');
-- Retrato de contato que não é da conta é recusado (nada de gravar o contato de outro cliente).
SELECT is((public.signal_snapshot_save((SELECT id FROM run), jsonb_build_array(jsonb_build_object('chave', (SELECT id::text FROM public.contacts WHERE name = 'CANARIO-CT-OUTRO'), 'dados', '{"x":1}'::jsonb))))->>'acao', 'salvo', 'Chave que não é contato da conta é descartada sem erro');
SELECT is((SELECT count(*)::int FROM internal.signal_snapshots), 1, 'E nada foi gravado para o contato de outro cliente');

-- ---- Próximo período: o retrato anterior volta no pedido.
UPDATE internal.signal_runs SET periodo = '2020-W01';
CREATE TEMP TABLE r2 ON COMMIT DROP AS SELECT public.signal_collect_next(50) AS x;
SELECT is(jsonb_array_length((SELECT x FROM r2)), 2, 'No período novo as contas são pedidas de novo');
SELECT is((SELECT j->'contatos'->0->'snapshot'->>'cargo' FROM r2, jsonb_array_elements(x) j WHERE j->>'account_name' = 'CANARIO-COM'), 'Diretor', 'O pedido traz o retrato anterior do contato');
SELECT is((SELECT count(*)::int FROM r2, jsonb_array_elements(x) j, jsonb_array_elements(j->'contatos') c WHERE j->>'account_name' = 'CANARIO-OUTRO' AND c->'snapshot' <> 'null'::jsonb), 0, 'O outro cliente não herda retrato de ninguém');

SELECT * FROM finish();
ROLLBACK;
