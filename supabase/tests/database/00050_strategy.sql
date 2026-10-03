-- Seam: Estrategia (ICP e oferta do workspace). Quem escreve e o estrategista; C-level so le; BDR nao ve.
BEGIN;
SELECT no_plan();

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT is(
  (public.strategy_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, NULL, 'icp', 'ICP da Evolut no teste', 'v9', 'Texto do teste')->>'ok'),
  'true',
  'estrategista cria o ICP'
);

SELECT ok(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')->'itens')::text LIKE '%ICP da Evolut no teste%',
  'estrategista ve o ICP que criou'
);
SELECT is(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')->>'pode_editar'),
  'true',
  'estrategista pode editar'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000003')->>'pode_editar'),
  'false',
  'C-level le e nao edita'
);
SELECT ok(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000003')->'itens')::text LIKE '%ICP da Evolut no teste%',
  'C-level ve o ICP da Evolut'
);
SELECT is(
  (public.strategy_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, NULL, 'oferta', 'Oferta da Aline', 'v1', 'nao')->>'erro'),
  'Seu papel só lê a estratégia.',
  'C-level nao grava'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000004')->>'erro'),
  'Seu papel não vê a estratégia.',
  'BDR nao ve a estrategia'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(
  (public.strategy_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000009')->>'erro'),
  'Você não participa deste workspace.',
  'C-level da Grao Norte nao le a Evolut'
);
SELECT is(
  (SELECT count(*)::int FROM public.strategy_items WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'RLS esconde os itens da Evolut de quem e da Grao Norte'
);

SELECT * FROM finish();
ROLLBACK;
