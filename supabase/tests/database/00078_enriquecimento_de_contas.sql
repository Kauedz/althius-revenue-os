-- ==============================================================================
-- Test: 00078_enriquecimento_de_contas.sql
-- Enriquecimento automático (ADR 0062): conta nova entra sozinha na fila; "empresa" (Receita, site, localização) e
-- depois "pessoas" (até 5 do LinkedIn, com telefone e origem). O que uma pessoa digitou nunca é sobrescrito. Crédito
-- reservado antes, cobrado só pelo que veio (5 por conta, 2 por pessoa) e devolvido na falha. Quem pediu para sair
-- (LGPD) não volta. Isolamento entre clientes.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03 / e..03, BDR d..04 / e..04); Grão Norte b0..01.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- ---- Permissões
SELECT ok(NOT has_function_privilege('anon', 'public.enrichment_next(integer)', 'EXECUTE'), 'Visitante não pega trabalho');
SELECT ok(NOT has_function_privilege('authenticated', 'public.enrichment_next(integer)', 'EXECUTE'), 'Usuário logado não pega trabalho (reserva crédito)');
SELECT ok(has_function_privilege('service_role', 'public.enrichment_next(integer)', 'EXECUTE'), 'Só o serviço pega trabalho');
SELECT ok(NOT has_function_privilege('authenticated', 'public.enrichment_finish(uuid, jsonb, numeric)', 'EXECUTE'), 'Usuário logado não entrega resultado');
SELECT ok(has_function_privilege('service_role', 'public.enrichment_finish(uuid, jsonb, numeric)', 'EXECUTE'), 'Só o serviço entrega resultado');
SELECT ok(NOT has_function_privilege('authenticated', 'public.enrichment_fail(uuid, text)', 'EXECUTE'), 'Usuário logado não marca falha');
SELECT ok(NOT has_function_privilege('anon', 'public.account_enrichment_request(uuid, uuid, uuid[])', 'EXECUTE'), 'Visitante não pede enriquecimento');
SELECT ok(has_function_privilege('authenticated', 'public.account_enrichment_request(uuid, uuid, uuid[])', 'EXECUTE'), 'Tela pede enriquecimento');
SELECT ok(NOT has_function_privilege('anon', 'public.contact_suppress(uuid, uuid)', 'EXECUTE'), 'Visitante não remove contato');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.account_enrichments', 'SELECT'), 'Fila (com custo real) não é lida direto');
SELECT ok(NOT has_table_privilege('authenticated', 'internal.enrichment_suppressions', 'SELECT'), 'Lista de supressão não é lida direto');

-- ---- Cenário: só as contas do teste participam.
DELETE FROM internal.account_enrichments;
UPDATE public.accounts SET status = 'arquivada';
INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, allowance_expires_at)
  VALUES ('a0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days'),
         ('b0000000-0000-0000-0000-000000000001', 1000, 0, 0, now() + interval '20 days')
  ON CONFLICT (workspace_id) DO UPDATE SET allowance_balance = 1000, topup_balance = 0, reserved_balance = 0, monthly_consumed = 0, allowance_expires_at = now() + interval '20 days';

INSERT INTO public.accounts (id, workspace_id, name, domain, status, is_duplicate) VALUES
  ('c7800000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-EN-E1', 'canario-en-e1.test', 'ativa', false),
  ('c7800000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-EN-DUP', 'canario-en-dup.test', 'ativa', true),
  ('c7800000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CANARIO-EN-E3', 'canario-en-e3.test', 'ativa', false),
  ('c7800000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'CANARIO-EN-G1', 'canario-en-g1.test', 'ativa', false);

-- ---- Fila automática
SELECT is((SELECT array_agg(etapa ORDER BY etapa) FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000001'),
  ARRAY['empresa', 'pessoas'], 'Conta nova entra sozinha na fila (empresa e pessoas)');
SELECT is((SELECT count(*)::int FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000002'), 0, 'Conta duplicada não é enriquecida (não gasta crédito à toa)');
SELECT ok((SELECT campos_manuais @> ARRAY['name', 'domain'] FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Nome e site digitados contam como manuais');

-- Uma pessoa preenche a cidade antes do enriquecimento: vale a dela.
UPDATE public.accounts SET city = 'Campinas' WHERE id = 'c7800000-0000-0000-0000-000000000001';
SELECT ok((SELECT 'city' = ANY (campos_manuais) FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Cidade editada à mão entra em campos manuais');

-- ---- Primeira rodada: só "empresa" (pessoas espera a empresa terminar)
CREATE TEMP TABLE r1 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.enrichment_next(10)) x;
SELECT is((SELECT count(*)::int FROM r1), 3, 'Pega as 3 contas (E1, E3 e a da Grão)');
SELECT ok(NOT EXISTS (SELECT 1 FROM r1 WHERE x->>'etapa' = 'pessoas'), 'Pessoas só depois da empresa');
SELECT is((SELECT (x->>'creditos')::int FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 5, 'Empresa custa 5 créditos');
SELECT is((SELECT (x->>'teto_usd')::numeric FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), round(5 * 0.0529 / 5.5, 4), 'Teto do fornecedor = o que o cliente paga');
SELECT is((SELECT x->'conta'->>'dominio' FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 'canario-en-e1.test', 'O serviço recebe o site da conta');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 14, 'Reservou 5 por conta do cliente, com a folga de 25% do cofre (E1 e E3: 7 + 7)');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'), 7, 'Cada cliente paga só as suas contas');
SELECT is((SELECT count(*)::int FROM public.executions WHERE metadata_json->>'account_id' = 'c7800000-0000-0000-0000-000000000001' AND status = 'running'), 1, 'Vira uma execução visível');
SELECT is(jsonb_array_length(public.enrichment_next(10)), 0, 'Nada pego duas vezes');

-- ---- Empresa E1: dados da Receita, localização e logo
CREATE TEMP TABLE f1 ON COMMIT DROP AS SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'),
  '{"campos": {"cnpj": "12.345.678/0001-95", "razao_social": "CANARIO EN LTDA", "cep": "01310-100", "city": "São Paulo", "state_uf": "sp",
               "lat": -23.56, "lng": -46.65, "localizacao_precisao": "cep", "logo_url": "http://inseguro.test/logo.png", "telefone": "(11) 3333-4444",
               "domain": "outro-site.test"},
    "fontes": {"cnpj": "Site da empresa", "razao_social": "Receita Federal", "lat": "BrasilAPI CEP"}}', 0.004) AS r;
SELECT is((SELECT r->>'acao' FROM f1), 'concluido', 'Resultado aplicado');
SELECT is((SELECT (r->>'creditos')::int FROM f1), 5, 'Achou dado: cobra 5');
SELECT is((SELECT cnpj FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), '12345678000195', 'CNPJ guardado só com números');
SELECT is((SELECT state_uf FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'SP', 'UF normalizada');
SELECT is((SELECT cep FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), '01310100', 'CEP só com números');
SELECT is((SELECT city FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Campinas', 'MANUAL VENCE: a cidade digitada não muda');
SELECT is((SELECT domain FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'canario-en-e1.test', 'MANUAL VENCE: o site digitado não muda');
SELECT is((SELECT logo_url FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), NULL, 'Logo sem https é recusado');
SELECT is((SELECT lat FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001')::numeric, -23.56, 'Latitude guardada');
SELECT is((SELECT localizacao_precisao FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'cep', 'Precisão da localização guardada');
SELECT is((SELECT fontes->'razao_social'->>'fonte' FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Receita Federal', 'Cada dado guarda a fonte');
SELECT is((SELECT fontes->'telefone'->>'fonte' FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'enriquecimento', 'Sem fonte informada, fica "enriquecimento"');
SELECT ok((SELECT NOT ('cnpj' = ANY (campos_manuais)) AND enriquecido_em IS NOT NULL FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Dado enriquecido não vira manual');
SELECT is((SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 995, 'Cobrou 5 do saldo');
SELECT is((SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), '{}', 0)->>'acao'), 'ignorado', 'Entregar de novo não cobra de novo');
SELECT is((SELECT custo_usd FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000001' AND etapa = 'empresa'), 0.004::numeric(14,6), 'Custo real guardado só na fila interna');

-- Depois do enriquecimento, a pessoa edita o CEP: passa a ser manual.
UPDATE public.accounts SET cep = '04538133' WHERE id = 'c7800000-0000-0000-0000-000000000001';
SELECT ok((SELECT 'cep' = ANY (campos_manuais) FROM public.accounts WHERE id = 'c7800000-0000-0000-0000-000000000001'), 'Edição depois do enriquecimento também vira manual');

-- Valor inválido de fora é ignorado.
SELECT is(internal.enrichment_valor('lat', '"10.5"'), NULL, 'Latitude fora do Brasil é ignorada');
SELECT is(internal.enrichment_valor('cnpj', '"123"'), NULL, 'CNPJ curto é ignorado');
SELECT is(internal.enrichment_valor('state_uf', '"XX"'), NULL, 'UF inexistente é ignorada');

-- ---- Empresa E3 sem nada: devolve a reserva. Grão falha: devolve e tenta depois.
SELECT is((SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000003'), '{"campos": {}}', 0)->>'creditos'), '0', 'Sem dado novo: não cobra');
SELECT is((SELECT estado FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000003' AND etapa = 'empresa'), 'sem_dado', 'Fica marcado "sem dado"');
SELECT is((SELECT public.enrichment_fail((SELECT (x->>'job_id')::uuid FROM r1 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000004'), 'BrasilAPI fora do ar')->>'acao'), 'falhou', 'Falha registrada');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'Falha devolve a reserva');
SELECT is((SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'), 1000, 'Falha não cobra nada');
SELECT is((SELECT status FROM public.executions WHERE id = (SELECT execution_id FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000004' AND etapa = 'empresa')), 'failed', 'A execução mostra a falha');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Nada fica preso na reserva do Evolut');

-- ---- Pessoas
-- Já existe no Evolut alguém com este LinkedIn; e alguém pediu para sair.
INSERT INTO public.contacts (id, workspace_id, account_id, name) VALUES
  ('c7810000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c7800000-0000-0000-0000-000000000001', 'Já Existe'),
  ('c7810000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c7800000-0000-0000-0000-000000000004', 'Contato da Grão');
INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c7810000-0000-0000-0000-000000000001', 'linkedin', 'https://www.linkedin.com/in/ja-existe', 1),
  ('b0000000-0000-0000-0000-000000000001', 'c7810000-0000-0000-0000-000000000002', 'linkedin', 'https://www.linkedin.com/in/pessoa-dois', 1);
INSERT INTO internal.enrichment_suppressions (workspace_id, tipo, valor_normalizado)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'linkedin', public.normalize_channel_value('linkedin', 'https://www.linkedin.com/in/pediu-para-sair'));

CREATE TEMP TABLE r2 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.enrichment_next(10)) x;
SELECT is((SELECT count(*)::int FROM r2), 2, 'Agora vêm as pessoas de E1 e E3 (a Grão falhou e espera)');
SELECT ok((SELECT bool_and(x->>'etapa' = 'pessoas') FROM r2), 'Só etapa pessoas');
SELECT is((SELECT (x->>'creditos')::int FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 10, 'Reserva 5 pessoas × 2');
SELECT is((SELECT (x->>'max_pessoas')::int FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 5, 'Até 5 pessoas por conta');
SELECT is((SELECT x->'personas_alvo'->0->>'cargo' FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 'CEO', 'Leva os cargos alvo do cliente');
SELECT ok((SELECT x->'ja_tem' ? public.normalize_channel_value('linkedin', 'https://www.linkedin.com/in/ja-existe') FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), 'Diz quem a conta já tem');
SELECT is((SELECT x->'conta'->>'cnpj' FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'), '12345678000195', 'Pessoas recebe o que a empresa achou');

CREATE TEMP TABLE f2 ON COMMIT DROP AS SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'),
  '{"pessoas": [
     {"nome": "", "linkedin_url": "https://www.linkedin.com/in/sem-nome"},
     {"nome": "Link Ruim", "linkedin_url": "https://example.test/in/link-ruim"},
     {"nome": "Repetida", "linkedin_url": "https://www.linkedin.com/in/ja-existe/"},
     {"nome": "Saiu", "linkedin_url": "https://br.linkedin.com/in/pediu-para-sair"},
     {"nome": "Pessoa Um", "cargo": "CEO", "papel": "decisor", "linkedin_url": "https://br.linkedin.com/in/pessoa-um?trk=x", "foto_url": "https://media.licdn.test/um.jpg",
      "telefones": [{"numero": "+55 11 98765-4321", "fonte": "Apify (telefone)"}, {"numero": "123"}], "emails": [{"email": "um@canario.test", "fonte": "Apify"}, {"email": "nao-e-email"}]},
     {"nome": "Pessoa Dois", "cargo": "Diretor", "papel": "chefe", "linkedin_url": "https://www.linkedin.com/in/pessoa-dois", "foto_url": "http://inseguro.test/dois.jpg"},
     {"nome": "Pessoa Três", "linkedin_url": "https://www.linkedin.com/in/pessoa-tres"},
     {"nome": "Pessoa Quatro", "linkedin_url": "https://www.linkedin.com/in/pessoa-quatro"},
     {"nome": "Pessoa Cinco", "linkedin_url": "https://www.linkedin.com/in/pessoa-cinco"},
     {"nome": "Pessoa Seis", "linkedin_url": "https://www.linkedin.com/in/pessoa-seis"}
   ]}', 0.03) AS r;
SELECT is((SELECT (r->>'preenchidos')::int FROM f2), 5, 'Cria no máximo 5 pessoas');
SELECT is((SELECT (r->>'creditos')::int FROM f2), 10, 'Cobra 2 por pessoa criada');
SELECT is((SELECT count(*)::int FROM public.contacts WHERE account_id = 'c7800000-0000-0000-0000-000000000001' AND origem = 'enriquecimento'), 5, 'As 5 pessoas estão na conta, marcadas como enriquecidas');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.contacts WHERE name IN ('Saiu', 'Repetida', 'Link Ruim', 'Pessoa Seis') AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'Sem repetida, sem link ruim, sem quem pediu para sair, sem passar de 5');
SELECT ok(EXISTS (SELECT 1 FROM public.contacts WHERE name = 'Pessoa Dois' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'ISOLAMENTO: existir na Grão não impede no Evolut');
SELECT is((SELECT photo_url FROM public.contacts WHERE name = 'Pessoa Um' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'https://media.licdn.test/um.jpg', 'Foto do LinkedIn guardada');
SELECT is((SELECT photo_url FROM public.contacts WHERE name = 'Pessoa Dois' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), NULL, 'Foto sem https é recusada');
SELECT is((SELECT buying_role FROM public.contacts WHERE name = 'Pessoa Dois' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'influenciador', 'Papel desconhecido vira influenciador');
SELECT is((SELECT ch.value FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Um' AND ch.type = 'linkedin'), 'https://www.linkedin.com/in/pessoa-um', 'LinkedIn limpo (sem rastreio)');
SELECT is((SELECT count(*)::int FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Um' AND ch.type = 'phone'), 1, 'Só o telefone válido entra');
SELECT is((SELECT ch.fonte FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Um' AND ch.type = 'phone'), 'Apify (telefone)', 'LGPD: telefone guarda a fonte');
SELECT ok((SELECT ch.coletado_em IS NOT NULL FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Um' AND ch.type = 'phone'), 'LGPD: e a data da coleta');
SELECT is((SELECT count(*)::int FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Um' AND ch.type = 'email'), 1, 'Só o e-mail válido entra');
SELECT is((SELECT allowance_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 985, 'Saldo: 1000 − 5 (empresa) − 10 (5 pessoas)');

SELECT is((SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r2 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000003'), '{"pessoas": []}', 0)->>'creditos'), '0', 'Ninguém achado: não cobra');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'E devolve a reserva inteira');

-- ---- Sem saldo: não roda e não deixa saldo negativo.
UPDATE public.credit_wallets SET allowance_balance = 0, topup_balance = 0, reserved_balance = 0 WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001';
INSERT INTO public.accounts (id, workspace_id, name, domain, status) VALUES
  ('c7800000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'CANARIO-EN-G2', 'canario-en-g2.test', 'ativa');
SELECT is(jsonb_array_length(public.enrichment_next(10)), 0, 'Sem saldo, nada é pego');
SELECT is((SELECT estado FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000005' AND etapa = 'empresa'), 'sem_saldo', 'Fica "sem saldo" para tentar depois');

-- ---- Pedir de novo (tela): só gestores, só contas do próprio cliente.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.account_enrichment_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', ARRAY['c7800000-0000-0000-0000-000000000003']::uuid[]) $$,
  '42501', NULL, 'BDR não pede enriquecimento (gasta crédito)');
SELECT throws_ok($$ SELECT public.contact_suppress((SELECT id FROM public.contacts WHERE name = 'Pessoa Um' LIMIT 1), 'd0000000-0000-0000-0000-000000000004') $$,
  '42501', NULL, 'BDR não remove contato a pedido');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.account_enrichment_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', ARRAY['c7800000-0000-0000-0000-000000000003']::uuid[]) $$,
  '42501', NULL, 'Ninguém pede em nome de outro membro');
SELECT is(public.account_enrichment_request('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
  ARRAY['c7800000-0000-0000-0000-000000000003', 'c7800000-0000-0000-0000-000000000004']::uuid[]), 2, 'C-level pede de novo: só as 2 etapas da conta do PRÓPRIO cliente');
SELECT lives_ok($$ SELECT public.contact_suppress((SELECT id FROM public.contacts WHERE name = 'Pessoa Um' AND workspace_id = 'a0000000-0000-0000-0000-000000000001'), 'd0000000-0000-0000-0000-000000000003') $$,
  'C-level remove contato a pedido do titular');
RESET ROLE;

SELECT is((SELECT estado FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000004' AND etapa = 'empresa'), 'erro', 'CANÁRIO: conta da Grão não foi mexida');
SELECT is((SELECT estado FROM internal.account_enrichments WHERE account_id = 'c7800000-0000-0000-0000-000000000003' AND etapa = 'empresa'), 'pendente', 'A conta do Evolut voltou para a fila');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.contacts WHERE name = 'Pessoa Um'), 'O contato foi apagado');
SELECT is((SELECT count(*)::int FROM internal.enrichment_suppressions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND tipo IN ('linkedin', 'phone', 'email')), 4,
  'LinkedIn, telefone e e-mail dele entram na supressão (mais o que já estava)');
SELECT is((SELECT count(*)::int FROM public.audit_logs WHERE action = 'contato_removido_a_pedido'), 1, 'A remoção fica na auditoria');

-- Quem pediu para sair não volta, nem com outro link de rastreio, nem com o mesmo telefone.
UPDATE internal.account_enrichments SET estado = 'pendente' WHERE account_id = 'c7800000-0000-0000-0000-000000000001' AND etapa = 'pessoas';
UPDATE internal.account_enrichments SET estado = 'ok' WHERE account_id = 'c7800000-0000-0000-0000-000000000003';
CREATE TEMP TABLE r3 ON COMMIT DROP AS SELECT x FROM jsonb_array_elements(public.enrichment_next(10)) x;
SELECT is((SELECT r->>'preenchidos' FROM (SELECT public.enrichment_finish((SELECT (x->>'job_id')::uuid FROM r3 WHERE x->'conta'->>'id' = 'c7800000-0000-0000-0000-000000000001'),
  '{"pessoas": [{"nome": "Pessoa Um", "linkedin_url": "https://www.linkedin.com/in/pessoa-um/?utm=1"},
                {"nome": "Pessoa Sete", "linkedin_url": "https://www.linkedin.com/in/pessoa-sete", "telefones": [{"numero": "11987654321"}]}]}', 0) AS r) z), '1',
  'LGPD: só a pessoa nova entra');
SELECT is((SELECT count(*)::int FROM public.contact_channels ch JOIN public.contacts c ON c.id = ch.contact_id WHERE c.name = 'Pessoa Sete' AND ch.type = 'phone'), 0,
  'LGPD: o telefone de quem saiu não volta, nem em outra pessoa');

SELECT * FROM finish();
ROLLBACK;
