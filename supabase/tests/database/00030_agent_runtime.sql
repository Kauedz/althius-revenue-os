-- ==============================================================================
-- Test: 00030_agent_runtime.sql
-- Hermes Agent pela "porta" da Althius (ADR 0024): cada agente de cada cliente tem um token
-- que só abre o workspace dele; o agente lista contatos e PROPÕE mudança; só a aprovação muda o CRM.
-- Seed: Evolut a0..01 (Camila estrategista d..02, Aline C-level d..03), Grão Norte b0..01
--       (Camila estrategista d..08); contato Aline Xavier cb..01 (Serra Azul, Evolut).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- Dados do teste: conta e contato da Grão Norte, e um contato canário (fato único) na Evolut.
INSERT INTO public.accounts (id, workspace_id, name, domain, status)
VALUES ('ca000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'Cerealista Boa Safra', 'boasafra.com.br', 'ativa');
INSERT INTO public.contacts (id, workspace_id, account_id, name, job_title)
VALUES ('cc000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-0000000000b1', 'Renata Lopes', NULL),
       ('cc000000-0000-0000-0000-0000000000a9', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Canário PIPOCA-7731', 'Teste');

-- 1. Tabela de tokens: só o sistema enxerga.
SELECT has_table('public', 'agent_runtime_tokens', 'Existe a tabela de tokens dos agentes');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.agent_runtime_tokens'::regclass), 'Tokens dos agentes têm RLS ligada');
SELECT ok(NOT has_table_privilege('authenticated', 'public.agent_runtime_tokens', 'SELECT'), 'Usuário logado não lê a tabela de tokens');
SELECT ok(NOT has_table_privilege('anon', 'public.agent_runtime_tokens', 'SELECT'), 'Visitante não lê a tabela de tokens');
SELECT has_column('public', 'agent_runtime_tokens', 'token_hash', 'Token guardado só como hash');
SELECT hasnt_column('public', 'agent_runtime_tokens', 'token', 'O token em texto puro nunca é guardado');

-- 2. Criar token é ação de sistema.
SELECT ok(NOT has_function_privilege('authenticated', 'public.agent_runtime_token_create(uuid, text, uuid)', 'EXECUTE'), 'Usuário logado não cria token de agente');
SELECT ok(NOT has_function_privilege('anon', 'public.agent_runtime_token_create(uuid, text, uuid)', 'EXECUTE'), 'Visitante não cria token de agente');
SELECT ok(has_function_privilege('service_role', 'public.agent_runtime_token_create(uuid, text, uuid)', 'EXECUTE'), 'Sistema cria token de agente');

CREATE TEMP TABLE tk ON COMMIT DROP AS SELECT
  public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') AS evolut,
  public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000008') AS grao;
GRANT SELECT ON tk TO anon;

SELECT ok((SELECT evolut LIKE 'alt_agente_%' AND length(evolut) > 50 FROM tk), 'Token tem prefixo reconhecível e é longo');
SELECT is((SELECT count(*)::int FROM public.agent_runtime_tokens WHERE token_hash = encode(extensions.digest((SELECT evolut FROM tk), 'sha256'), 'hex')), 1, 'Banco guarda o hash do token');

SELECT throws_ok(
  $$ SELECT public.agent_runtime_token_create('b0000000-0000-0000-0000-000000000001', 'comercial', 'd0000000-0000-0000-0000-000000000002') $$,
  '22023', NULL, 'Token não nasce para membro de outro workspace');
SELECT throws_ok(
  $$ SELECT public.agent_runtime_token_create('a0000000-0000-0000-0000-000000000001', 'vendas', 'd0000000-0000-0000-0000-000000000002') $$,
  '22023', NULL, 'Só os 4 agentes fixos recebem token');

-- 3. Ferramentas do agente: chamadas com o token (sem login de pessoa).
SELECT ok(has_function_privilege('anon', 'public.agent_list_contacts(text)', 'EXECUTE'), 'Porta do agente aceita chamada só com o token');
SELECT ok(has_function_privilege('anon', 'public.agent_propose_update(text, uuid, text, text, text, text)', 'EXECUTE'), 'Proposta do agente aceita chamada só com o token');

SET LOCAL ROLE anon;

SELECT throws_ok($$ SELECT public.agent_list_contacts('alt_agente_inventado') $$, '28000', NULL, 'Token inventado é recusado');

SELECT ok(
  (SELECT public.agent_list_contacts(evolut)::text LIKE '%PIPOCA-7731%' FROM tk),
  'Evolut enxerga o próprio contato canário');
SELECT ok(
  (SELECT public.agent_list_contacts(grao)::text NOT LIKE '%PIPOCA-7731%' FROM tk),
  'CANÁRIO: Grão Norte nunca enxerga contato da Evolut');
SELECT is(
  (SELECT jsonb_array_length(public.agent_list_contacts(grao)) FROM tk), 1,
  'Grão Norte vê só o próprio contato');
SELECT ok(
  (SELECT public.agent_list_contacts(evolut) @> '[{"id": "cb000000-0000-0000-0000-000000000001", "nome": "Aline Xavier", "cargo": "Diretora de Supply Chain", "empresa": "Serra Azul Têxtil"}]'::jsonb FROM tk),
  'Contato vem com nome, cargo e empresa');

-- Proposta de outro workspace é recusada e não cria nada.
SELECT is(
  (SELECT public.agent_propose_update(grao, 'cb000000-0000-0000-0000-000000000001', 'cargo', 'CEO', 'teste', 'k-grao-1')->>'ok' FROM tk),
  'false', 'Grão Norte não propõe mudança em contato da Evolut');
SELECT is(
  (SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'nome', 'Outra', 'teste', 'k-nome')->>'erro' FROM tk),
  'Campo não pode ser alterado pelo agente.', 'Agente só propõe campos permitidos');
SELECT is(
  (SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'cargo', '   ', 'teste', 'k-vazio')->>'ok' FROM tk),
  'false', 'Valor vazio é recusado');

-- Proposta válida.
CREATE TEMP TABLE prop ON COMMIT DROP AS
SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'cargo', 'Diretora Comercial', 'Assinatura de e-mail atualizada', 'k-aline-1') AS r FROM tk;
SELECT is((SELECT r->>'status' FROM prop), 'aguardando_aprovacao', 'Proposta vira aprovação pendente');
SELECT is(
  (SELECT (public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000001', 'cargo', 'Diretora Comercial', 'Assinatura de e-mail atualizada', 'k-aline-1')->>'approval_id') FROM tk),
  (SELECT r->>'approval_id' FROM prop), 'Mesma chave de idempotência devolve a mesma aprovação');

RESET ROLE;

SELECT is((SELECT count(*)::int FROM public.approvals WHERE idempotency_key IN ('k-grao-1', 'k-nome', 'k-vazio')), 0, 'Propostas recusadas não criam aprovação');
SELECT results_eq(
  $$ SELECT category, approval_type, agent_code, requested_by_member_id::text, status, preview
     FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop) $$,
  $$ VALUES ('operacao'::text, 'crm'::text, 'comercial'::text, 'd0000000-0000-0000-0000-000000000002'::text, 'pendente'::text,
             'Cargo de Aline Xavier: Diretora de Supply Chain → Diretora Comercial'::text) $$,
  'Aprovação mostra agente, quem responde por ele e a prévia da mudança');
SELECT is((SELECT job_title FROM public.contacts WHERE id = 'cb000000-0000-0000-0000-000000000001'), 'Diretora de Supply Chain', 'Antes da aprovação, nada muda no CRM');
SELECT ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = (SELECT (r->>'approval_id')::uuid FROM prop) AND action = 'agente.proposta_criada'), 'Proposta fica na auditoria');

-- 4. Aprovação aplica; rejeição não aplica.
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM prop), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop)))->>'success',
  'true', 'C-level aprova a proposta');
SELECT is((SELECT job_title FROM public.contacts WHERE id = 'cb000000-0000-0000-0000-000000000001'), 'Diretora Comercial', 'Depois da aprovação, o cargo muda no CRM');

SET LOCAL ROLE anon;
CREATE TEMP TABLE prop2 ON COMMIT DROP AS
SELECT public.agent_propose_update(grao, 'cc000000-0000-0000-0000-0000000000b1', 'cargo', 'Compradora', 'teste', 'k-renata') AS r FROM tk;
RESET ROLE;
SELECT is(
  public.approval_decide((SELECT (r->>'approval_id')::uuid FROM prop2), 'd0000000-0000-0000-0000-000000000009', 'rejeitado',
    (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop2)))->>'success',
  'true', 'C-level da Grão Norte rejeita');
SELECT is((SELECT job_title FROM public.contacts WHERE id = 'cc000000-0000-0000-0000-0000000000b1'), NULL, 'Rejeitada: nada muda');
SET LOCAL ROLE anon;
SELECT is(
  (SELECT public.agent_propose_update(grao, 'cc000000-0000-0000-0000-0000000000b1', 'cargo', 'Compradora', 'teste', 'k-renata') FROM tk)->>'erro',
  'Esta mesma proposta já foi decidida (rejeitado).', 'Repetir proposta já rejeitada não volta para a fila');
RESET ROLE;

-- Proposta velha: se o cargo mudou depois do pedido, a aprovação não sobrescreve.
SET LOCAL ROLE anon;
CREATE TEMP TABLE prop3 ON COMMIT DROP AS
SELECT public.agent_propose_update(evolut, 'cb000000-0000-0000-0000-000000000002', 'cargo', 'Gerente de Compras', 'teste', 'k-jonas') AS r FROM tk;
RESET ROLE;
UPDATE public.contacts SET job_title = 'Head de Compras' WHERE id = 'cb000000-0000-0000-0000-000000000002';
SELECT public.approval_decide((SELECT (r->>'approval_id')::uuid FROM prop3), 'd0000000-0000-0000-0000-000000000003', 'aprovado',
  (SELECT payload_json FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop3)));
SELECT is((SELECT job_title FROM public.contacts WHERE id = 'cb000000-0000-0000-0000-000000000002'), 'Head de Compras', 'Proposta velha não sobrescreve mudança feita depois');
SELECT ok((SELECT history::text LIKE '%não aplicada%' FROM public.approvals WHERE id = (SELECT (r->>'approval_id')::uuid FROM prop3)), 'Histórico diz que a mudança não foi aplicada');

-- 5. Token revogado para de funcionar.
UPDATE public.agent_runtime_tokens SET revoked_at = now() WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE anon;
SELECT throws_ok($$ SELECT public.agent_list_contacts((SELECT grao FROM tk)) $$, '28000', NULL, 'Token revogado é recusado');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
