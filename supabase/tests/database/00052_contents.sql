-- Seam: Conteudos. Rascunho cria e edita. Publicar segue o Hermes: se pedir aprovacao, nao marca como publicado.
BEGIN;
SELECT no_plan();

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT is(
  (public.content_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, NULL::uuid, 'Conteudo da Evolut no teste', 'email', '', 'Texto do teste')->>'ok'),
  'true',
  'estrategista cria rascunho'
);

SELECT is(
  (public.content_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')->>'pode_editar'),
  'true',
  'estrategista pode editar'
);

SELECT ok(
  (public.content_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')::text LIKE '%Conteudo da Evolut no teste%')
  AND (public.content_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')::text NOT LIKE '%US$%'),
  'lista traz o rascunho e nao traz dolar'
);

SELECT is(
  (SELECT status FROM public.content_items WHERE name = 'Conteudo da Evolut no teste'),
  'rascunho',
  'nasce rascunho'
);

SELECT is(
  (public.content_publish(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    (SELECT id FROM public.content_items WHERE name = 'Conteudo da Evolut no teste' AND workspace_id = 'a0000000-0000-0000-0000-000000000001')
  )->>'destino'),
  'publicado',
  'quem aprova copy publica de verdade'
);

SELECT is(
  (SELECT status FROM public.content_items WHERE name = 'Conteudo da Evolut no teste'),
  'ativo',
  'publicado fica ativo'
);

SELECT is(
  (public.content_save(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    (SELECT id FROM public.content_items WHERE name = 'Conteudo da Evolut no teste'),
    'Conteudo editado no teste', 'post', '', 'Texto novo'
  )->>'ok'),
  'true',
  'edita o rascunho publicado'
);

SELECT is(
  (SELECT status FROM public.content_items WHERE name = 'Conteudo editado no teste'),
  'rascunho',
  'mudar o texto tira a publicacao'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(
  (public.content_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000004'::uuid, NULL::uuid, 'Conteudo do Lucas', 'email', '', 'nao')->>'erro'),
  'Seu papel não edita conteúdo.',
  'BDR nao edita'
);
SELECT is(
  (public.content_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000004')->>'pode_editar'),
  'false',
  'BDR le e nao edita'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(
  (public.content_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000009')->>'erro'),
  'Você não participa deste workspace.',
  'Grao Norte nao le a Evolut'
);
SELECT is(
  (SELECT count(*)::int FROM public.content_items WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'RLS esconde conteudos da Evolut'
);

SELECT * FROM finish();
ROLLBACK;
