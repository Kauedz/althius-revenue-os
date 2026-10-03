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

-- 6. Execuções do protótipo v18, persistidas no banco local.
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001042','a0000000-0000-0000-0000-000000000001','comercial','accounts.import','running','d0000000-0000-0000-0000-000000000002','Qualificar 1.200 importadores do Sudeste','Lista','Importação sem risco · Q4',NULL,'Hoje, 09:12',64,768,512,1800,1800,1150,'["Ler contas existentes no CRM para evitar duplicidade","Buscar importadores por NCM e região","Cruzar CNPJ com dados cadastrais","Pontuar fit com ICP v4","Gerar lista priorizada"]'::jsonb,3,'["09:12 Execução iniciada","09:14 1.204 empresas encontradas","09:31 512 contas com fit acima de 70"]'::jsonb,'[]'::jsonb,'["CRM","Dados de prospecção"]'::jsonb,'Aprovada por Aline Xavier') ON CONFLICT(id) DO NOTHING;
INSERT INTO internal.provider_cost_events(workspace_id,execution_id,provider_code,cost_usd) VALUES ('a0000000-0000-0000-0000-000000000001','ec000000-0000-0000-0000-000000001042','seed_v18',41.2);
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001041','a0000000-0000-0000-0000-000000000001','comercial','accounts.edit','partial','d0000000-0000-0000-0000-000000000004','Mapear comitê de 48 contas quentes','Enriquecimento','Importação sem risco · Q4',NULL,'Hoje, 08:40',100,48,39,480,480,390,'["Identificar cargos-alvo por conta","Validar e-mails corporativos","Classificar papéis no comitê"]'::jsonb,3,'["08:40 Iniciada","09:02 39 de 48 contas com decisor validado"]'::jsonb,'["9 contas sem decisor público identificado"]'::jsonb,'["Enriquecimento de contatos"]'::jsonb,'Não exigida') ON CONFLICT(id) DO NOTHING;
INSERT INTO internal.provider_cost_events(workspace_id,execution_id,provider_code,cost_usd) VALUES ('a0000000-0000-0000-0000-000000000001','ec000000-0000-0000-0000-000000001041','seed_v18',12.1);
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001040','a0000000-0000-0000-0000-000000000001','copy','cadences.edit','pending_approval','d0000000-0000-0000-0000-000000000005','Rascunhar e-mails T1 para Serra Azul','Copy','Cadência Importadores T1–T7',NULL,'Hoje, 08:05',0,0,0,60,0,0,'["Ler contexto da conta","Gerar 3 variações de e-mail","Enviar para aprovação"]'::jsonb,0,'["08:05 Plano criado, aguardando aprovação"]'::jsonb,'[]'::jsonb,'["E-mail"]'::jsonb,'Pendente · Aline Xavier') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001039','a0000000-0000-0000-0000-000000000001','revops','pipeline.deals','paused','d0000000-0000-0000-0000-000000000001','Atualizar 120 negócios no CRM','CRM','—',NULL,'Ontem, 18:20',35,42,42,0,0,0,'["Ler negócios em Proposta","Atualizar etapa e próxima tarefa"]'::jsonb,1,'["18:20 Iniciada","18:41 Pausada pelo estrategista"]'::jsonb,'[]'::jsonb,'["CRM"]'::jsonb,'Aprovada por Aline Xavier') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001038','a0000000-0000-0000-0000-000000000001','marketing','campaigns.edit','failed','d0000000-0000-0000-0000-000000000002','Leitura semanal de mídia paga','Análise','Importação sem risco · Q4',NULL,'Ontem, 07:00',20,0,0,20,20,4,'["Ler métricas da semana","Detectar anomalias","Sugerir realocação"]'::jsonb,1,'["07:00 Iniciada","07:01 Falha ao ler dados de mídia"]'::jsonb,'["Conexão de mídia paga expirou — reconectar na Central de Integrações"]'::jsonb,'["Mídia paga"]'::jsonb,'Não exigida') ON CONFLICT(id) DO NOTHING;
INSERT INTO internal.provider_cost_events(workspace_id,execution_id,provider_code,cost_usd) VALUES ('a0000000-0000-0000-0000-000000000001','ec000000-0000-0000-0000-000000001038','seed_v18',0.3);
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001037','a0000000-0000-0000-0000-000000000001','revops','analytics.view','completed','d0000000-0000-0000-0000-000000000001','Relatório semanal de pipeline','Relatório','—','Agendada','Seg, 08:00',100,312,312,0,0,0,'["Consolidar funil","Calcular pipeline influenciado","Publicar relatório"]'::jsonb,3,'["08:00 Iniciada","08:03 Publicado"]'::jsonb,'[]'::jsonb,'["CRM","Planilhas"]'::jsonb,'Não exigida') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001036','a0000000-0000-0000-0000-000000000001','comercial','accounts.import','scheduled','d0000000-0000-0000-0000-000000000002','Lista de 300 indústrias do Sul','Lista','Expansão Sul',NULL,'Amanhã, 09:00',0,0,0,450,0,0,'["Buscar indústrias por CNAE","Pontuar fit"]'::jsonb,0,'["Agendada para amanhã, 09:00"]'::jsonb,'[]'::jsonb,'["Dados de prospecção"]'::jsonb,'Aprovada por Aline Xavier') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.executions(id,workspace_id,agent_code,capability_key,status,requested_by_member_id,title,execution_type,campaign_name,requester_label,display_time,progress,processed_count,valid_count,estimated_credits,reserved_credits,actual_credits,plan,current_step,logs,errors,integrations,approval_label) VALUES ('ec000000-0000-0000-0000-000000001035','a0000000-0000-0000-0000-000000000001','comercial','accounts.edit','queued','d0000000-0000-0000-0000-000000000004','Enriquecer 80 contatos de feira','Enriquecimento','Evento Intermodal',NULL,'Hoje, 09:40',0,0,0,160,0,0,'["Validar contatos","Associar às contas"]'::jsonb,0,'["09:40 Na fila"]'::jsonb,'[]'::jsonb,'["Enriquecimento de contatos"]'::jsonb,'Não exigida') ON CONFLICT(id) DO NOTHING;

-- 7. Creditos do prototipo: saldo, extrato e regras padrao (teto 500, limite 5.000).
INSERT INTO public.workspace_settings (workspace_id, credit_mode, approval_threshold, monthly_credit_limit, auto_topup_enabled)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'auto', 500, 5000, false),
  ('b0000000-0000-0000-0000-000000000001', 'auto', 500, 5000, false),
  ('c0000000-0000-0000-0000-000000000001', 'auto', 500, 5000, false)
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO public.credit_wallets (workspace_id, allowance_balance, topup_balance, reserved_balance, monthly_consumed)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 7950, 0, 0, 2050),
  ('b0000000-0000-0000-0000-000000000001', 10000, 0, 0, 0),
  ('c0000000-0000-0000-0000-000000000001', 10000, 0, 0, 0)
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO public.credit_transactions (id, workspace_id, type, amount, wallet_type, description, agent_code, created_at) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'grant', 10000, 'allowance', 'Créditos iniciais do workspace', NULL, '2026-09-01 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'consume', 200, 'allowance', 'Mapeamento de comitê · 8 contas', 'comercial', '2026-09-05 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'consume', 640, 'allowance', 'Enriquecimento · 64 contatos', 'comercial', '2026-09-08 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'consume', 192, 'allowance', 'E-mails automáticos · 48 envios', 'copy', '2026-09-12 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'consume', 700, 'allowance', 'Sinais monitorados · setembro', 'comercial', '2026-09-15 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'consume', 120, 'allowance', 'Leitura semanal de mídia', 'marketing', '2026-09-22 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'consume', 118, 'allowance', 'Rascunhos e respostas · 59', 'copy', '2026-09-26 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'consume', 80, 'allowance', 'Relatórios e higiene do CRM', 'revops', '2026-09-29 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 'grant', 10000, 'allowance', 'Créditos iniciais do workspace', NULL, '2026-09-01 09:00:00-03'),
  ('cc000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'grant', 10000, 'allowance', 'Créditos iniciais do workspace', NULL, '2026-09-01 09:00:00-03')
ON CONFLICT (id) DO NOTHING;
