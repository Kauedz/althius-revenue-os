-- ==============================================================================
-- Test: 00056_variaveis_cadencia.sql
-- PR 10: variáveis nos textos das cadências ({{primeiro_nome}}, {{empresa}}, {{cargo}}...).
--   Passo automático com variável sem dado BLOQUEIA o envio e avisa o dono. Nunca sai mensagem com {{...}}.
--   Passo manual (tarefa) mostra o que falta em vez de esconder.
-- Seed: Lucas BDR (user e..04, membro d..04, dono das contas c..01 e c..02); Camila estrategista (e..02, d..02).
--       Aline Xavier cb..01: cargo "Diretora de Supply Chain", Serra Azul Têxtil, São Paulo/SP, serraazul.com.br.
--       Marcelo Antunes cb..04: cargo "Diretor de Operações", Campo Belo Agro. Carteira da Evolut: 7950, 0 reservado.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Preparação (dono do banco)
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES ('f7000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cadência com variáveis', 'ativa');
INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, subject, body, delay_days) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 1, 'email', 'auto', 'Olá {{primeiro_nome}}',
   'Vi a {{ Empresa }} ({{CARGO}}) em {{cidade}}/{{uf}}. Abraço, {{meu_nome}} · {{dominio}}', 0),
  ('a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 2, 'linkedin', 'manual', NULL, 'Oi {{primeiro_nome}}, sobre {{cargo}} na {{empresa}}', 1);
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES ('f7000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Cadência sem inscritos', 'ativa');
-- Uma inscrição por caso (dono Lucas, envio automático ligado), passo 1 vencido
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f7100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', true),
  ('f7100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', true),
  ('f7100000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', false);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, scheduled_at) VALUES
  ('f7100000-0000-0000-0000-000000000001', 1, now()), ('f7100000-0000-0000-0000-000000000001', 2, NULL),
  ('f7100000-0000-0000-0000-000000000002', 1, now()), ('f7100000-0000-0000-0000-000000000002', 2, NULL),
  ('f7100000-0000-0000-0000-000000000003', 1, now()), ('f7100000-0000-0000-0000-000000000003', 2, NULL);
CREATE TEMP TABLE t_base AS SELECT reserved_balance AS r FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

-- 1. Catálogo e permissões
SELECT is(public.cadence_variable_names(), ARRAY['primeiro_nome', 'nome', 'empresa', 'cargo', 'cidade', 'uf', 'dominio', 'meu_nome'], 'Catálogo de variáveis');
SELECT ok(has_function_privilege('authenticated', 'public.cadence_variable_names()', 'EXECUTE'), 'Quem está logado lê o catálogo');
SELECT ok(NOT has_function_privilege('anon', 'public.cadence_variable_names()', 'EXECUTE'), 'Sem login não lê');

-- 2. Resolvedor: maiúsculas e espaços não importam; o que falta é listado
SELECT is(internal.resolver_variaveis('Oi {{PRIMEIRO_NOME}} da {{ empresa }}', '{"primeiro_nome": "Ana", "empresa": "Acme"}'::jsonb), '{"texto": "Oi Ana da Acme", "faltando": []}'::jsonb, 'Substitui ignorando caixa e espaços');
SELECT is(internal.resolver_variaveis('Oi {{primeiro_nome}} {{cargo}}', '{"primeiro_nome": "Ana", "cargo": ""}'::jsonb), '{"texto": "Oi Ana {{cargo}}", "faltando": ["cargo"]}'::jsonb, 'Dado vazio conta como faltando e o marcador fica');
SELECT is(internal.resolver_variaveis('Oi {{apelido}}', '{"primeiro_nome": "Ana"}'::jsonb), '{"texto": "Oi {{apelido}}", "faltando": ["apelido"]}'::jsonb, 'Variável desconhecida também é falta');
SELECT is(internal.resolver_variaveis('{{cargo}} e {{cargo}} e {{empresa}}', '{}'::jsonb)->'faltando', '["cargo", "empresa"]'::jsonb, 'Falta listada uma vez, na ordem');
SELECT is(internal.resolver_variaveis('Sem variável', '{}'::jsonb), '{"texto": "Sem variável", "faltando": []}'::jsonb, 'Texto sem variável fica igual');
SELECT is(internal.resolver_variaveis(NULL, '{}'::jsonb), '{"texto": null, "faltando": []}'::jsonb, 'Nulo continua nulo');
SELECT is(internal.resolver_variaveis('Preço {{ não é variável }} e {x}', '{}'::jsonb), '{"texto": "Preço {{ não é variável }} e {x}", "faltando": []}'::jsonb, 'Só {{nome_simples}} conta como variável');

-- 3. Envio automático com tudo preenchido: sai resolvido, sem {{
CREATE TEMP TABLE t_a AS SELECT public.cadence_prepare_step('f7100000-0000-0000-0000-000000000001', 1) AS r;
SELECT is((SELECT r->>'action' FROM t_a), 'send', 'Com todos os dados, autoriza o envio');
SELECT is((SELECT r->>'subject' FROM t_a), 'Olá Aline', 'Assunto resolvido');
SELECT is((SELECT r->>'body' FROM t_a), 'Vi a Serra Azul Têxtil (Diretora de Supply Chain) em São Paulo/SP. Abraço, Lucas Teixeira · serraazul.com.br', 'Corpo resolvido, com maiúsculas e espaços tolerados');
SELECT ok((SELECT (r->>'body') !~ '\{\{' AND (r->>'subject') !~ '\{\{' FROM t_a), 'Nada de {{ na mensagem que vai sair');
SELECT is((SELECT metadata_json->>'body' FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM t_a)), (SELECT r->>'body' FROM t_a), 'A execução guarda o texto exato que saiu');

-- 4. Falta dado: bloqueia, não reserva crédito, avisa uma vez e destrava quando o dado chega
UPDATE public.contacts SET job_title = NULL WHERE id = 'cb000000-0000-0000-0000-000000000004';
CREATE TEMP TABLE t_b AS SELECT public.cadence_prepare_step('f7100000-0000-0000-0000-000000000002', 1) AS r;
SELECT is((SELECT r->>'action' FROM t_b), 'blocked', 'Falta o cargo: não envia');
SELECT is((SELECT r->>'reason' FROM t_b), 'missing_variables', 'Motivo: variável sem dado');
SELECT is((SELECT r->'variables' FROM t_b), '["cargo"]'::jsonb, 'Diz qual variável falta');
SELECT is((SELECT count(*) FROM public.executions WHERE metadata_json->>'cadence_key' = 'f7100000-0000-0000-0000-000000000002:1'), 0::bigint, 'Nenhuma execução criada');
SELECT is((SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), (SELECT r + 5 FROM t_base), 'Nenhum crédito reservado para o bloqueado (só o envio do caso 3)');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_bloqueada' AND entity_id = 'f7100000-0000-0000-0000-000000000002'), 1::bigint, 'Dono avisado');
SELECT ok((SELECT body LIKE '%cargo%' FROM public.notifications WHERE type = 'cadencia_bloqueada' AND entity_id = 'f7100000-0000-0000-0000-000000000002'), 'O aviso diz o que falta');
SELECT ok((SELECT last_error LIKE 'variaveis_faltando%cargo%' AND next_attempt_at > now() FROM public.cadence_enrollment_steps WHERE enrollment_id = 'f7100000-0000-0000-0000-000000000002' AND step_number = 1), 'Passo espera e tenta de novo mais tarde');
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = 'f7100000-0000-0000-0000-000000000002' AND step_number = 1;
SELECT is(public.cadence_prepare_step('f7100000-0000-0000-0000-000000000002', 1)->>'reason', 'missing_variables', 'Ainda sem o dado: continua bloqueado');
SELECT is((SELECT count(*) FROM public.notifications WHERE type = 'cadencia_bloqueada' AND entity_id = 'f7100000-0000-0000-0000-000000000002'), 1::bigint, 'Sem aviso repetido');
UPDATE public.contacts SET job_title = 'Diretor de Operações' WHERE id = 'cb000000-0000-0000-0000-000000000004';
UPDATE public.cadence_enrollment_steps SET next_attempt_at = NULL WHERE enrollment_id = 'f7100000-0000-0000-0000-000000000002' AND step_number = 1;
CREATE TEMP TABLE t_b2 AS SELECT public.cadence_prepare_step('f7100000-0000-0000-0000-000000000002', 1) AS r;
SELECT is((SELECT r->>'action' FROM t_b2), 'send', 'O dado chegou: o envio segue sozinho');
SELECT ok((SELECT (r->>'body') LIKE '%Diretor de Operações%' FROM t_b2), 'e já com o cargo');

-- 5. Variável desconhecida que escapou da validação (inserida por fora): bloqueia
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f7100000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', true);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, custom_body, scheduled_at) VALUES ('f7100000-0000-0000-0000-000000000004', 1, 'Oi {{apelido}}', now());
SELECT is(public.cadence_prepare_step('f7100000-0000-0000-0000-000000000004', 1)->'variables', '["apelido"]'::jsonb, 'Texto personalizado com variável desconhecida não sai');

-- 5b. Dado de contato com {{...}} (importação suja) não vira marcador na mensagem
UPDATE public.contacts SET name = '{{cargo}} Silva' WHERE id = 'cb000000-0000-0000-0000-000000000004';
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f7100000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', true);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, scheduled_at) VALUES ('f7100000-0000-0000-0000-000000000006', 1, now()), ('f7100000-0000-0000-0000-000000000006', 2, NULL);
CREATE TEMP TABLE t_c AS SELECT public.cadence_prepare_step('f7100000-0000-0000-0000-000000000006', 1) AS r;
SELECT is((SELECT r->>'action' FROM t_c), 'send', 'Nome sujo não impede o envio');
SELECT ok((SELECT (r->>'subject') !~ '\{\{' AND (r->>'body') !~ '\{\{' FROM t_c), 'Mas as chaves do dado não viram marcador na mensagem');
SELECT is((SELECT r->>'subject' FROM t_c), 'Olá cargo', 'As chaves saem do valor, o resto fica');
UPDATE public.contacts SET name = 'Marcelo Antunes' WHERE id = 'cb000000-0000-0000-0000-000000000004';

-- 6. Passo manual / envio automático desligado: vira tarefa com o texto resolvido; o que falta aparece como [FALTA: ...]
SELECT is(public.cadence_prepare_step('f7100000-0000-0000-0000-000000000003', 1)->>'action', 'task_created', 'Envio automático desligado: vira tarefa');
SELECT is((SELECT note FROM public.tasks WHERE source = 'cadencia' AND contact_id = 'cb000000-0000-0000-0000-000000000001' AND channel = 'email'), 'Vi a Serra Azul Têxtil (Diretora de Supply Chain) em São Paulo/SP. Abraço, Lucas Teixeira · serraazul.com.br', 'Tarefa com o texto pronto');
UPDATE public.contacts SET job_title = NULL WHERE id = 'cb000000-0000-0000-0000-000000000001';
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, owner_member_id, auto_send) VALUES
  ('f7100000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', false);
INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number, scheduled_at) VALUES ('f7100000-0000-0000-0000-000000000005', 1, NULL), ('f7100000-0000-0000-0000-000000000005', 2, now());
UPDATE public.cadence_enrollment_steps SET status = 'executado' WHERE enrollment_id = 'f7100000-0000-0000-0000-000000000005' AND step_number = 1;
SELECT is(public.cadence_prepare_step('f7100000-0000-0000-0000-000000000005', 2)->>'action', 'task_created', 'Passo manual com dado faltando ainda vira tarefa');
SELECT is((SELECT note FROM public.tasks WHERE source = 'cadencia' AND channel = 'linkedin' AND contact_id = 'cb000000-0000-0000-0000-000000000001'), 'Atenção: faltam dados do contato: cargo.' || E'\n' || 'Oi Aline, sobre [FALTA: cargo] na Serra Azul Têxtil', 'A tarefa mostra o que falta, sem {{');

-- 7. Quem edita não grava variável inexistente (o erro lista as válidas)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000002', 'email', 'manual', 0, NULL, 'Oi {{apelido}}') $$, '22023', NULL, 'Texto com variável inexistente é recusado');
SELECT throws_ok($$ SELECT public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000002', 'email', 'manual', 0, 'Assunto {{xyz}}', 'ok') $$, '22023', NULL, 'Assunto com variável inexistente também');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.cadence_steps WHERE cadence_id = 'f7000000-0000-0000-0000-000000000002'), 0::bigint, 'Nenhum passo com variável inválida foi gravado');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(public.cadence_add_step('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000002', 'email', 'auto', 0, 'Oi {{ PRIMEIRO_NOME }}', 'Da {{empresa}}, {{cargo}}')->>'action', 'added', 'Variável válida (com espaços e maiúsculas) é aceita');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
