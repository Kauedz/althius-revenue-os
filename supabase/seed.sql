-- ==============================================================================
-- Supabase Seed: seed.sql
-- Althius v18: workspaces, usuários de login e membros de demonstração.
-- Só para desenvolvimento local. Senha de todos os usuários: althius-demo
-- ==============================================================================

-- 1. Workspaces de demonstração (os mesmos slugs do front v18)
INSERT INTO public.workspaces (id, name, slug, site_domain, logo_source, status, settings_json) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Evolut Trading', 'evolut', 'evolut.com.br', 'site', 'active', '{"momento": "Execução", "sigla": "EV"}'),
  ('b0000000-0000-0000-0000-000000000001', 'Grão Norte Alimentos', 'grao', 'graonorte.com.br', 'site', 'active', '{"momento": "Preparação", "sigla": "GN"}'),
  ('c0000000-0000-0000-0000-000000000001', 'Vértice Indústria', 'vertice', 'verticeindustria.com.br', 'site', 'active', '{"momento": "Otimização", "sigla": "VI"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  site_domain = EXCLUDED.site_domain,
  settings_json = EXCLUDED.settings_json;

-- 2. Usuários de login (auth.users + auth.identities), um por pessoa do protótipo
WITH pessoas (id, email, nome) AS (VALUES
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'rafael@althius.com.br', 'Rafael Nunes'),
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'camila@althius.com.br', 'Camila Duarte'),
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'aline@evolut.com.br', 'Aline Xavier'),
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'lucas@evolut.com.br', 'Lucas Teixeira'),
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'mateus@evolut.com.br', 'Mateus Maia'),
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'bruna@evolut.com.br', 'Bruna Lima'),
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'eduardo@graonorte.com.br', 'Eduardo Lins')
), novos AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
    extensions.crypt('althius-demo', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', p.nome), now(), now(), '', '', '', ''
  FROM pessoas p
  ON CONFLICT (id) DO NOTHING
  RETURNING id, email
)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT n.id::text, n.id, jsonb_build_object('sub', n.id::text, 'email', n.email, 'email_verified', true), 'email', now(), now(), now()
FROM novos n;

-- 3. Membros com os 4 papéis canônicos
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status, job_title) VALUES
  -- Evolut: os 4 papéis representados
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'superadmin', 'active', 'Operação Althius'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'estrategista', 'active', 'Estrategista GTM'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'clevel', 'active', 'Diretora de Supply Chain'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'bdr', 'active', 'BDR'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'clevel', 'active', 'Diretor Comercial'),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006', 'bdr', 'active', 'BDR'),
  -- Grão Norte: superadmin + estrategista (multi-tenant do time Althius) + C-level do cliente
  ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'superadmin', 'active', 'Operação Althius'),
  ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'estrategista', 'active', 'Estrategista GTM'),
  ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'clevel', 'active', 'CEO'),
  -- Vértice: só o superadmin (o estrategista não foi alocado aqui, para testar "Atribuídos")
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'superadmin', 'active', 'Operação Althius')
ON CONFLICT (id) DO NOTHING;

-- 4. Multiplicadores de preço confidenciais (schema internal, nunca exposto ao cliente)
INSERT INTO internal.pricing_multipliers (capability_code, base_credit_unit, margin_percent, risk_multiplier, is_active) VALUES
  ('maps_business_search', 800, 40.00, 1.25, true),
  ('company_enrichment', 50, 40.00, 1.25, true),
  ('person_enrichment', 80, 40.00, 1.25, true),
  ('email_discovery', 120, 40.00, 1.25, true),
  ('job_signal_monitor', 100, 40.00, 1.25, true)
ON CONFLICT (capability_code) DO NOTHING;

-- 5. Aprovações pendentes da Evolut (as mesmas do protótipo v18). O hash do conteúdo
--    torna a aprovação de uso único: se o conteúdo mudar, a aprovação deixa de valer.
WITH fila (id, categoria, tipo, titulo, solicitante, agente, motivo, impacto, previa, creditos, prazo, historico) AS (VALUES
  ('ac000000-0000-0000-0000-000000000001'::uuid, 'operacao', 'copy', 'E-mails T1 — Serra Azul Têxtil', 'd0000000-0000-0000-0000-000000000005'::uuid, 'copy',
   'Primeiro contato com a decisora mapeada.', '3 e-mails enviados para 1 contato',
   'Aline, vi que a Serra Azul abriu vaga para Gerente de Importação. Como vocês estão lidando com prazo de desembaraço hoje?',
   60, current_date + time '14:00', '["08:05 Criada pelo agente", "08:06 Enviada para Aline Xavier"]'::jsonb),
  ('ac000000-0000-0000-0000-000000000002'::uuid, 'operacao', 'lista', 'Lista de 512 contas para cadência', 'd0000000-0000-0000-0000-000000000002'::uuid, 'comercial',
   'Contas com fit acima de 70 no ICP v4.', '512 contas entram na cadência T1–T7',
   '512 contas · 6 segmentos · Sudeste · fit médio 81', 0, current_date + 1 + time '18:00', '["09:31 Lista gerada"]'::jsonb),
  ('ac000000-0000-0000-0000-000000000003'::uuid, 'gasto', 'orcamento', 'Realocar R$ 8.000 para LinkedIn Ads', 'd0000000-0000-0000-0000-000000000002'::uuid, 'marketing',
   'CPL no LinkedIn 38% menor que no Meta no último ciclo.', 'R$ 8.000 movidos entre canais',
   'Meta Ads: R$ 20.000 → R$ 12.000 · LinkedIn Ads: R$ 10.000 → R$ 18.000', 0, current_date + 3 + time '18:00',
   '["Ontem Recomendação do agente", "Ontem Revisada por Camila Duarte"]'::jsonb),
  ('ac000000-0000-0000-0000-000000000004'::uuid, 'operacao', 'crm', 'Atualizar etapa de 78 negócios', 'd0000000-0000-0000-0000-000000000001'::uuid, 'revops',
   'Negócios sem atividade há 30 dias.', '78 negócios movidos para "Em risco"', '78 negócios · R$ 2,4 mi em pipeline', 0,
   current_date + 4 + time '09:00', '["Ontem Criada"]'::jsonb),
  ('ac000000-0000-0000-0000-000000000005'::uuid, 'gasto', 'execucao_limite', 'Qualificar 4.000 empresas do Nordeste', 'd0000000-0000-0000-0000-000000000002'::uuid, 'comercial',
   'Expansão do ICP para nova região.', 'Reserva de 6.000 créditos', 'Estimativa 6.000 créditos · saldo após reserva 1.950', 6000,
   current_date + 5 + time '09:00', '["Hoje Plano criado pelo copiloto"]'::jsonb)
)
INSERT INTO public.approvals (id, workspace_id, category, approval_type, title, requested_by_member_id, agent_code, reason, impact, preview,
                              estimated_credits, deadline_at, history, status, payload_json, payload_hash)
SELECT f.id, 'a0000000-0000-0000-0000-000000000001', f.categoria, f.tipo, f.titulo, f.solicitante, f.agente, f.motivo, f.impacto, f.previa,
       f.creditos, f.prazo AT TIME ZONE 'America/Sao_Paulo', f.historico, 'pendente',
       jsonb_build_object('titulo', f.titulo, 'previa', f.previa, 'creditos', f.creditos),
       encode(extensions.digest(jsonb_build_object('titulo', f.titulo, 'previa', f.previa, 'creditos', f.creditos)::text, 'sha256'), 'hex')
FROM fila f
ON CONFLICT (id) DO NOTHING;
