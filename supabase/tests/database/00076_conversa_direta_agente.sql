-- ==============================================================================
-- Test: 00076_conversa_direta_agente.sql
-- Conversa direta e PRIVADA de uma pessoa com um agente (várias conversas = threads). É um canal de um tipo próprio
-- (`direto`): resposta sempre ligada, fora da lista de Canais e visível só para a própria pessoa (nem C-level, nem superadmin).
-- Seed: Evolut a0..01: Camila estrategista d..02 (user e..02), Aline C-level d..03 (e..03), Lucas BDR d..04 (e..04),
--       superadmin Rafael d..01 (e..01); Grão Norte b0..01 (estrategista d..08, user e..02).
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT ok(has_function_privilege('authenticated', 'public.agent_direct_create(uuid, uuid, text, text)', 'EXECUTE'), 'Quem está logado abre conversa direta');
SELECT ok(NOT has_function_privilege('anon', 'public.agent_direct_create(uuid, uuid, text, text)', 'EXECUTE'), 'Visitante não');
SELECT ok(has_function_privilege('authenticated', 'public.agent_direct_list(uuid, uuid, text)', 'EXECUTE'), 'Quem está logado lista as próprias conversas');
SELECT ok(NOT has_function_privilege('anon', 'public.agent_direct_list(uuid, uuid, text)', 'EXECUTE'), 'Visitante não');

-- Aline (C-level) abre uma conversa com a Zoe
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
CREATE TEMP TABLE c1 ON COMMIT DROP AS SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', NULL) AS r;
GRANT SELECT ON c1 TO authenticated;
SELECT is((SELECT r->>'ok' FROM c1), 'true', 'Abre a conversa direta');
SELECT ok((SELECT r->>'slug' LIKE 'dm-comercial-%' FROM c1), 'O endereço identifica que é conversa direta com a Zoe');

RESET ROLE;
SELECT is((SELECT kind FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 'direto', 'É um canal do tipo direto');
SELECT is((SELECT count(*)::int FROM public.chat_channel_members WHERE channel_id = (SELECT id FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1))), 1, 'Só uma pessoa participa');
SELECT is((SELECT reply_policy FROM public.chat_channel_agents WHERE channel_id = (SELECT id FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)) AND agent_id = 'comercial'), 'always', 'O agente responde a toda mensagem');
SELECT is((SELECT count(*)::int FROM public.chat_channel_agents WHERE channel_id = (SELECT id FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1))), 1, 'E só aquele agente está na conversa');
SELECT is((SELECT description FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 'Nova conversa', 'Título provisório');

-- Privacidade: a própria pessoa vê; os outros NÃO (nem estrategista, nem superadmin)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 1, 'A Aline vê a própria conversa');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 0, 'A estrategista NÃO vê a conversa direta da Aline');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 0, 'O superadmin NÃO vê a conversa direta da Aline');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_channels WHERE slug = (SELECT r->>'slug' FROM c1)), 0, 'O BDR NÃO vê');

-- Mensagens também ficam privadas
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT r->>'slug' FROM c1), 'Zoe, CANÁRIO-DIRETO-5521', NULL, 'comercial')->>'ok'), 'true', 'Escreve para a Zoe pelo envio normal do chat');
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE content LIKE '%CANÁRIO-DIRETO-5521%'), 1, 'A Aline lê a própria mensagem');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE content LIKE '%CANÁRIO-DIRETO-5521%'), 0, 'CANÁRIO: a estrategista não lê a mensagem');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT is((SELECT count(*)::int FROM public.chat_messages WHERE content LIKE '%CANÁRIO-DIRETO-5521%'), 0, 'CANÁRIO: nem o superadmin');

-- A resposta do agente entra na fila (política "sempre")
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.agent_channel_queue q JOIN public.chat_channels c ON c.id = q.channel_id WHERE c.slug = (SELECT r->>'slug' FROM c1) AND q.agent_id = 'comercial'), 1, 'A mensagem entra na fila do agente');

-- Listagem: só as minhas, com título e se o agente está respondendo
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT jsonb_array_length(public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial'))), 1, 'A Aline lista a conversa dela');
SELECT is((SELECT public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial')->0->>'aguardando'), 'true', 'Aparece como "agente respondendo" enquanto a fila não foi atendida');
SELECT is((SELECT jsonb_array_length(public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'marketing'))), 0, 'Conversas com outro agente não entram');
SELECT throws_ok($$ SELECT public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'comercial') $$, '42501', NULL, 'Não dá para listar as conversas de outra pessoa (membro diferente do login)');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is((SELECT jsonb_array_length(public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'comercial'))), 0, 'A estrategista não lista nada da Aline');

-- Título: renomear (só a dona) e arquivar
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT public.agent_direct_title('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT r->>'slug' FROM c1), '  Prioridades de hoje  ')->>'ok'), 'true', 'Renomeia');
SELECT is((SELECT public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial')->0->>'titulo'), 'Prioridades de hoje', 'O novo título aparece (sem espaços sobrando)');
SELECT is((SELECT public.agent_direct_title('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT r->>'slug' FROM c1), repeat('x', 200))->>'ok'), 'false', 'Título enorme é recusado');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is((SELECT public.agent_direct_title('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', (SELECT r->>'slug' FROM c1), 'Invadido')->>'ok'), 'false', 'Outra pessoa não renomeia a conversa da Aline');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT public.agent_direct_archive('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', (SELECT r->>'slug' FROM c1))->>'ok'), 'true', 'Arquiva');
SELECT is((SELECT jsonb_array_length(public.agent_direct_list('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial'))), 0, 'Arquivada some da lista');

-- Regra de papel: BDR só conversa com Zoe e Lia
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is((SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'comercial', NULL)->>'ok'), 'true', 'BDR conversa com a Zoe');
SELECT is((SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'copy', NULL)->>'ok'), 'true', 'BDR conversa com a Lia');
SELECT is((SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'marketing', NULL)->>'ok'), 'false', 'BDR não conversa com o Jax');
SELECT is((SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'revops', NULL)->>'ok'), 'false', 'BDR não conversa com o Neo');
SELECT is((SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'inventado', NULL)->>'ok'), 'false', 'Agente que não existe');

-- Quem não é a pessoa do login, ou não é do workspace, não abre
SELECT throws_ok($$ SELECT public.agent_direct_create('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', NULL) $$, '42501', NULL, 'Não abre conversa em nome de outra pessoa');
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((SELECT public.agent_direct_create('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'comercial', NULL)->>'ok'), 'false', 'Não abre conversa num workspace de que não participa');

-- A lista de Canais não inclui conversas diretas
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.chat_channels WHERE kind = 'direto' AND is_general), 0, 'Nenhuma conversa direta é o canal geral');
SELECT ok((SELECT kind FROM public.chat_channels WHERE is_general AND workspace_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1) = 'canal', 'Canais comuns continuam do tipo canal');

SELECT * FROM finish();
ROLLBACK;
