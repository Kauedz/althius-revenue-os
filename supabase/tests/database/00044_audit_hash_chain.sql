-- ==============================================================================
-- Test: 00044_audit_hash_chain.sql
-- Auditoria encadeada (ADR 0038, peça portada do buzz-audit, Apache-2.0).
-- Cada linha de audit_logs guarda o hash da anterior do MESMO workspace.
-- Quem altera ou apaga uma linha antiga quebra a corrente e audit_verify_chain aponta onde.
-- Seed: Rafael superadmin e..01; Aline C-level e..03; Evolut a0..01; Grão Norte b0..01.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Estrutura
SELECT has_column('public', 'audit_logs', 'seq', 'audit_logs tem a posição na corrente (seq)');
SELECT has_column('public', 'audit_logs', 'prev_hash', 'audit_logs tem o hash da linha anterior');
SELECT has_column('public', 'audit_logs', 'hash', 'audit_logs tem o hash da própria linha');
SELECT has_column('public', 'audit_logs', 'hash_version', 'audit_logs tem a versão da codificação');
SELECT col_not_null('public', 'audit_logs', 'hash', 'Toda linha tem hash');

-- 2. Nenhum workspace com auditoria tem a corrente quebrada depois da migration.
--    (O seed de hoje não grava linhas de auditoria; o encadeamento de linhas antigas é
--    conferido na migration com dados reais. NOT EXISTS evita o NULL do bool_and em conjunto vazio.)
SELECT ok(NOT EXISTS (SELECT 1 FROM (SELECT DISTINCT workspace_id AS id FROM public.audit_logs) w
                       WHERE (public.audit_verify_chain(w.id))->>'integra' IS DISTINCT FROM 'true'),
  'Nenhum workspace com a corrente quebrada depois da migration');

-- 3. Workspace novo: a corrente começa do zero e cada linha aponta para a anterior
INSERT INTO public.workspaces (id, name, slug) VALUES
  ('c4000000-0000-0000-0000-0000000000a1', 'Corrente A', 'corrente-a'),
  ('c4000000-0000-0000-0000-0000000000b1', 'Corrente B', 'corrente-b');

INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type, new_values)
VALUES ('c4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-0000000000a1', 'system', 'teste.um', 'teste', '{"b": 2, "a": 1}');

-- Quem grava não escolhe seq nem hash: o banco sobrescreve
INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type, seq, hash, prev_hash)
VALUES ('c4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-0000000000a1', 'system', 'teste.dois', 'teste', 999, '\xdead'::bytea, '\xbeef'::bytea);

INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type)
VALUES ('c4000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-0000000000a1', 'system', 'teste.tres', 'teste');

INSERT INTO public.audit_logs (id, workspace_id, actor_role, action, entity_type)
VALUES ('c4000000-0000-0000-0000-000000000009', 'c4000000-0000-0000-0000-0000000000b1', 'system', 'teste.outro', 'teste');

SELECT is((SELECT seq FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000001'), 1::bigint, 'Primeira linha do workspace é a posição 1');
SELECT ok((SELECT prev_hash IS NULL FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000001'), 'Primeira linha não tem anterior');
SELECT is((SELECT length(hash) FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000001'), 32, 'Hash tem 32 bytes (SHA-256)');
SELECT is((SELECT seq FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000002'), 2::bigint, 'seq informado por quem grava é ignorado');
SELECT is((SELECT prev_hash FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000002'),
          (SELECT hash FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000001'),
          'Segunda linha aponta para o hash da primeira (prev_hash informado é ignorado)');
SELECT isnt((SELECT hash FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000002'), '\xdead'::bytea, 'hash informado por quem grava é ignorado');
SELECT is((SELECT seq FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000009'), 1::bigint, 'Outro workspace tem a própria corrente (começa em 1)');

SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1'),
  '{"integra": true, "linhas": 3, "primeira_quebra": null, "motivo": null}'::jsonb, 'Corrente do workspace A íntegra com 3 linhas');

-- O hash guardado é o que se recalcula a partir da linha (mesma regra na gravação e na verificação)
SELECT is((SELECT internal.audit_calcular_hash(l) FROM public.audit_logs l WHERE id = 'c4000000-0000-0000-0000-000000000001'),
          (SELECT hash FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000001'), 'Hash recalculado bate com o guardado');

-- 4. Adulteração: alguém com acesso de dono do banco desliga a trava e altera a linha 2
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
UPDATE public.audit_logs SET action = 'teste.adulterado' WHERE id = 'c4000000-0000-0000-0000-000000000002';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;

SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1')->>'integra', 'false', 'Linha alterada quebra a corrente');
SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1')->>'primeira_quebra', '2', 'Aponta a linha alterada (posição 2)');
SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1')->>'motivo', 'conteudo_alterado', 'Motivo: conteúdo alterado');
SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000b1')->>'integra', 'true', 'Adulteração em A não afeta a corrente de B');

-- 5. Linha apagada no meio: buraco na sequência
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
UPDATE public.audit_logs SET action = 'teste.dois' WHERE id = 'c4000000-0000-0000-0000-000000000002';
DELETE FROM public.audit_logs WHERE id = 'c4000000-0000-0000-0000-000000000002';
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;

SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1')->>'primeira_quebra', '3', 'Linha apagada: a quebra aparece na linha seguinte (posição 3)');
SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000a1')->>'motivo', 'linha_faltando', 'Motivo: linha faltando');

-- 6. Workspace sem auditoria
SELECT is(public.audit_verify_chain('c4000000-0000-0000-0000-0000000000ff'),
  '{"integra": true, "linhas": 0, "primeira_quebra": null, "motivo": null}'::jsonb, 'Workspace sem linhas: corrente vazia e íntegra');

-- 7. Quem pode verificar
SELECT ok(NOT has_function_privilege('anon', 'public.audit_verify_chain(uuid)', 'EXECUTE'), 'Sem login não verifica');
SELECT ok(has_function_privilege('service_role', 'public.audit_verify_chain(uuid)', 'EXECUTE'), 'Backend (service_role) verifica');
SELECT ok(NOT has_function_privilege('authenticated', 'internal.audit_calcular_hash(public.audit_logs)', 'EXECUTE'), 'Cálculo do hash não é exposto para quem está logado');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.audit_verify_chain('a0000000-0000-0000-0000-000000000001') $$, '42501', NULL, 'C-level não verifica a corrente');

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is(public.audit_verify_chain('a0000000-0000-0000-0000-000000000001')->>'integra', 'true', 'Superadmin verifica a corrente da Evolut');
SELECT is((SELECT h->>'status' FROM jsonb_array_elements(public.admin_health()) h WHERE h->>'nome' = 'Auditoria íntegra'), 'Falha',
  'Saúde da plataforma acusa a corrente quebrada do workspace A');

SELECT * FROM finish();
ROLLBACK;
