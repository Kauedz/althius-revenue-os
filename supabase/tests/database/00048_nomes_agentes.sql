-- ==============================================================================
-- Test: 00048_nomes_agentes.sql
-- Nomes de exibição dos agentes no banco (Zoe, Jax, Lia e Neo). Só a exibição muda: os códigos
-- (comercial, marketing, copy, revops) ficam. As frases não usam artigo ("ao Zoe", "O Lia" ficariam erradas).
-- Seed: Lucas é BDR da Evolut (membro d..04); #geral tem os quatro agentes.
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. O nome que o banco usa para cada agente
SELECT is(internal.nome_agente('comercial'), 'Zoe', 'comercial aparece como Zoe');
SELECT is(internal.nome_agente('marketing'), 'Jax', 'marketing aparece como Jax');
SELECT is(internal.nome_agente('copy'), 'Lia', 'copy aparece como Lia');
SELECT is(internal.nome_agente('revops'), 'Neo', 'revops aparece como Neo');
SELECT is(internal.nome_agente('outro'), NULL, 'Código desconhecido não vira nome inventado');

-- 2. A nota da matriz de permissões (tela de papéis) cita os nomes novos
SELECT is((SELECT note FROM public.role_permissions WHERE role_id = 'bdr' AND capability_key = 'agents.chat'),
  'BDR conversa com Zoe e Lia.', 'Nota do BDR na matriz usa os nomes novos');
SELECT is((SELECT count(*) FROM public.role_permissions WHERE note ~ 'Agente (Comercial|de Marketing|de Copy|de RevOps)'), 0::bigint,
  'Nenhuma nota da matriz sobra com nome antigo');

-- 3. BDR só conversa com Zoe e Lia: a recusa diz isso com os nomes novos
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM public.workspace_members WHERE id = 'd0000000-0000-0000-0000-000000000004'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT is(public.chat_send('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'geral', '@Jax campanha?', NULL, 'marketing')->>'erro',
  'BDR conversa com Zoe e Lia.', 'Recusa do BDR para o Jax usa os nomes novos');

SELECT * FROM finish();
ROLLBACK;
