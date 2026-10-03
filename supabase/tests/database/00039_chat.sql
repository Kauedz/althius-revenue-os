-- ==============================================================================
-- Test: 00039_chat.sql
-- Seam: Canais (chat_create_channel, chat_update_channel, chat_archive_channel, chat_send,
-- chat_edit_message, chat_react). Documento de regras: "Gerencia quem criou o canal ou um gestor";
-- "Agente chamado no canal debitar crédito e respeitar o papel de quem chamou".
-- Seed Evolut: Camila estrategista d..02 (e..02), Aline C-level d..03 (e..03), Lucas BDR d..04 (e..04),
-- Mateus C-level d..05, Bruna BDR d..06 (e..06). Canais de exemplo: sinais-de-compra, prospeccao, cadencia-t1-t7.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(EXISTS (SELECT 1 FROM public.chat_channels WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND slug = 'sinais-de-compra'), 'Seed: canais de exemplo da Evolut');
SELECT ok((SELECT count(*) FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'sinais-de-compra') >= 3, 'Seed: mensagens de exemplo');
SELECT ok(NOT has_table_privilege('authenticated', 'public.chat_messages', 'UPDATE'), 'Ninguém altera mensagem direto na tabela');

SET LOCAL ROLE authenticated;

-- 1. Criar canal: nome vira endereço; não repete; precisa de pessoas.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Prospecção', NULL, ARRAY['d0000000-0000-0000-0000-000000000006']::uuid[], ARRAY[]::text[])->>'erro',
  'Já existe um canal #prospeccao.', 'Endereço do canal não repete (nome sem acento)');
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Dupla BDR', 'Só nós', ARRAY[]::uuid[], ARRAY[]::text[])->>'erro',
  'Adicione pelo menos uma pessoa.', 'Canal precisa de pessoas');
SELECT is(public.chat_create_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'Dupla BDR', 'Só nós', ARRAY['d0000000-0000-0000-0000-000000000006']::uuid[], ARRAY['comercial']::text[])->>'slug',
  'dupla-bdr', 'BDR cria canal');
SELECT is((SELECT count(*)::int FROM public.chat_channel_members cm JOIN public.chat_channels c ON c.id = cm.channel_id WHERE c.slug = 'dupla-bdr'), 2, 'Quem cria entra no canal junto com as pessoas escolhidas');

-- 2. Quem vê: Aline (C-level) vê todos; Mateus... não está no canal mas é gestor; Camila idem. BDR de fora não.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT ok(EXISTS (SELECT 1 FROM public.chat_channels WHERE slug = 'dupla-bdr'), 'Bruna vê o canal em que foi colocada');

-- 3. Enviar e mencionar agente.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'dupla-bdr', 'Bom dia, dupla', NULL, NULL)->>'ok', 'true', 'Lucas envia mensagem');
CREATE TEMP TABLE mencao ON COMMIT DROP AS
SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'dupla-bdr', '@Agente Comercial mapeia o comitê da Serra Azul?', NULL, 'comercial') AS r;
SELECT is((SELECT r->>'agente' FROM mencao), 'comercial', 'Menção vira pedido ao agente');
RESET ROLE;
SELECT results_eq(
  $$ SELECT agent_code, requested_by_member_id::text FROM public.executions WHERE id = (SELECT (r->>'execution_id')::uuid FROM mencao) $$,
  $$ VALUES ('comercial'::text, 'd0000000-0000-0000-0000-000000000004'::text) $$, 'Pedido fica na fila do agente, em nome de quem chamou (política Hermes)');
SELECT is((SELECT content FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'dupla-bdr' AND m.sender_type = 'system' ORDER BY m.created_at DESC LIMIT 1),
  'Pedido enviado ao Agente Comercial. A resposta chega aqui quando ele terminar.', 'Canal avisa que o pedido foi enviado (sem resposta inventada)');
SET LOCAL ROLE authenticated;
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'dupla-bdr', '@Agente de RevOps relatório?', NULL, 'revops')->>'erro',
  'O Agente de RevOps não participa de #dupla-bdr.', 'Agente fora do canal não é chamado');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'cadencia-t1-t7', 'oi', NULL, NULL)->>'erro',
  'Canal não encontrado.', 'Bruna não escreve em canal de que não participa');

-- 4. Editar só a própria mensagem; reagir.
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(public.chat_edit_message('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006',
  (SELECT m.id FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'dupla-bdr' AND m.content = 'Bom dia, dupla'), 'Mudei')->>'erro',
  'Só quem escreveu edita a mensagem.', 'Bruna não edita mensagem do Lucas');
SELECT is(public.chat_react('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006',
  (SELECT m.id FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'dupla-bdr' AND m.content = 'Bom dia, dupla'), '👍')->>'ok', 'true', 'Bruna reage');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(public.chat_edit_message('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004',
  (SELECT m.id FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'dupla-bdr' AND m.content = 'Bom dia, dupla'), 'Bom dia, dupla!')->>'ok', 'true', 'Lucas edita a própria');
RESET ROLE;
SELECT results_eq(
  $$ SELECT content, metadata->>'editada', metadata->'reacoes'->'👍' FROM public.chat_messages WHERE content = 'Bom dia, dupla!' $$,
  $$ VALUES ('Bom dia, dupla!'::text, 'true'::text, '["d0000000-0000-0000-0000-000000000006"]'::jsonb) $$, 'Edição e reação gravadas');

-- 5. Gerenciar e arquivar: quem criou ou gestor; #geral não arquiva.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000006", "role": "authenticated"}';
SELECT is(public.chat_archive_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'dupla-bdr')->>'erro',
  'Só quem criou o canal ou um gestor muda o canal.', 'Bruna (não criou) não arquiva');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(public.chat_update_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'dupla-bdr',
  ARRAY['d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000005']::uuid[], ARRAY['comercial', 'copy']::text[])->>'ok',
  'true', 'Aline (gestora) muda pessoas e agentes');
SELECT is(public.chat_archive_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'geral')->>'erro',
  'O canal #geral não pode ser arquivado.', '#geral fica');
SELECT is(public.chat_archive_channel('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'dupla-bdr')->>'ok', 'true', 'Aline arquiva');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.chat_channels WHERE slug = 'dupla-bdr'), 'Canal arquivado some da lista');
RESET ROLE;
SELECT ok(EXISTS (SELECT 1 FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id WHERE c.slug = 'dupla-bdr'), 'As mensagens ficam guardadas');

-- 6. Outro workspace.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'Grão Norte não lê os canais da Evolut');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
