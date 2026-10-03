-- Seam: Campanhas. Rascunho grava direto. Ativar canal pago passa pelo Hermes e nao liga a campanha.
BEGIN;
SELECT no_plan();

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT is(
  (public.campaign_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, 'Campanha organica no teste', 'organico')->>'ok'),
  'true',
  'estrategista cria rascunho sem verba'
);

SELECT is(
  (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')->>'pode_editar'),
  'true',
  'estrategista pode editar'
);

SELECT ok(
  (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')::text LIKE '%Campanha organica no teste%')
  AND (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')::text NOT LIKE '%US$%')
  AND (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002')::text NOT LIKE '%budget_usd%'),
  'lista traz o rascunho e nao traz dolar'
);

SELECT is(
  (public.campaign_activate(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    (SELECT id FROM public.campaigns WHERE name = 'Campanha organica no teste' AND workspace_id = 'a0000000-0000-0000-0000-000000000001')
  )->>'destino'),
  'ativa',
  'canal sem verba pode ser ligado'
);

SELECT is(
  (public.campaign_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, 'Campanha paga no teste', 'linkedin_ads')->>'ok'),
  'true',
  'estrategista cria rascunho pago'
);

SELECT is(
  (public.campaign_activate(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    (SELECT id FROM public.campaigns WHERE name = 'Campanha paga no teste' AND workspace_id = 'a0000000-0000-0000-0000-000000000001')
  )->>'destino'),
  'aprovacao',
  'estrategista nao liga campanha paga: vai para Aprovacoes'
);

SELECT is(
  (SELECT status FROM public.campaigns WHERE name = 'Campanha paga no teste'),
  'rascunho',
  'campanha paga continua rascunho'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is(
  (public.campaign_activate(
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000003'::uuid,
    (SELECT id FROM public.campaigns WHERE name = 'Campanha paga no teste' AND workspace_id = 'a0000000-0000-0000-0000-000000000001')
  )->>'destino'),
  'execucao',
  'C-level tambem nao liga direto: vira execucao'
);
SELECT is(
  (SELECT status FROM public.campaigns WHERE name = 'Campanha paga no teste'),
  'rascunho',
  'mesmo o C-level nao muda o status da campanha paga'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT is(
  (public.campaign_save('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000004'::uuid, 'Campanha do Lucas', 'organico')->>'erro'),
  'Seu papel não cria campanha.',
  'BDR nao cria'
);
SELECT is(
  (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000004')->>'pode_editar'),
  'false',
  'BDR le e nao edita'
);

SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(
  (public.campaign_list('a0000000-0000-0000-0000-000000000001'::uuid, 'd0000000-0000-0000-0000-000000000009')->>'erro'),
  'Você não participa deste workspace.',
  'Grao Norte nao le a Evolut'
);
SELECT is(
  (SELECT count(*)::int FROM public.campaigns WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'RLS esconde campanhas da Evolut'
);

SELECT * FROM finish();
ROLLBACK;
