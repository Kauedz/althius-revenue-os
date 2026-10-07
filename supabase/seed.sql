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

-- ICP de demonstração da Evolut (ADR 0067/0069): a nota de fit e as chamas das contas saem dele. Cliente real começa sem ICP.
UPDATE public.workspace_settings SET icp = '{"setores": ["Têxtil", "Agronegócio", "Metalurgia"]}'::jsonb WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001';

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

-- 8. Contas e comitês de compra do protótipo v18 (Evolut Trading).
INSERT INTO public.accounts (id, workspace_id, name, domain, segment, fit, temperature, last_signal_text, owner_member_id, city, state_uf, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Serra Azul Têxtil', 'serraazul.com.br', 'Têxtil', 96, 3, 'Vaga aberta · Gerente de Importação', 'd0000000-0000-0000-0000-000000000004', 'São Paulo', 'SP', 'ativa'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Campo Belo Agro', 'campobeloagro.com.br', 'Agronegócio', 91, 3, 'Anúncio de mídia paga', 'd0000000-0000-0000-0000-000000000004', 'Ribeirão Preto', 'SP', 'ativa'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Metalúrgica Ipê', 'metalurgicaipe.com.br', 'Metalurgia', 84, 2, 'Novo empreendimento aberto', 'd0000000-0000-0000-0000-000000000006', 'Joinville', 'SC', 'ativa'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Delta Saúde', 'deltasaude.com.br', 'Saúde', 79, 2, 'Vaga aberta · Comprador Sênior', 'd0000000-0000-0000-0000-000000000006', 'Belo Horizonte', 'MG', 'ativa'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Rio Claro Cosméticos', 'rioclarocosmeticos.com.br', 'Cosméticos', 62, 1, 'Anúncio de mídia paga', 'd0000000-0000-0000-0000-000000000004', 'Rio Claro', 'SP', 'ativa'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Norte Log Transportes', 'nortelog.com.br', 'Logística', 55, 1, 'Novo empreendimento aberto', 'd0000000-0000-0000-0000-000000000006', 'Manaus', 'AM', 'ativa'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Grão Norte Alimentos', 'graonorte.com.br', 'Alimentos', 88, 3, 'Oportunidade criada · R$ 35.000', 'd0000000-0000-0000-0000-000000000004', 'Cuiabá', 'MT', 'ativa'),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Vértice Indústria', 'verticeindustria.com.br', 'Indústria', 86, 2, 'Respondeu e-mail T2', 'd0000000-0000-0000-0000-000000000006', 'Curitiba', 'PR', 'ativa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contacts (id, workspace_id, account_id, name, job_title, buying_role, photo_url, linkedin_status) VALUES
  -- Serra Azul Têxtil
  ('cb000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Aline Xavier', 'Diretora de Supply Chain', 'decisor', 'aline', 'conectado'),
  ('cb000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Jonas Ribeiro', 'Comprador Sênior', 'campeao', 'jonas', 'conectado'),
  ('cb000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Renata Couto', 'Gerente Financeira', 'influenciador', 'renata', 'sem_conexao'),
  -- Campo Belo Agro
  ('cb000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Marcelo Antunes', 'Diretor de Operações', 'decisor', 'marcelo', 'conectado'),
  ('cb000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Ricardo Sá', 'CFO', 'influenciador', 'ricardo', 'sem_conexao'),
  ('cb000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Fernanda Lopes', 'Coordenadora de Compras', 'campeao', 'fernanda', 'conectado'),
  -- Metalúrgica Ipê
  ('cb000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Tiago Nunes', 'Gerente Industrial', 'influenciador', 'tiago', 'sem_conexao'),
  -- Delta Saúde
  ('cb000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Paula Reis', 'Diretora Administrativa', 'decisor', 'paula', 'conectado'),
  ('cb000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Lívia Andrade', 'Gerente de Suprimentos', 'influenciador', 'livia', 'sem_conexao'),
  ('cb000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Gustavo Prado', 'Comprador Sênior', 'campeao', 'gustavo', 'conectado'),
  -- Norte Log Transportes
  ('cb000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Rafael Moraes', 'Gerente de Logística', 'influenciador', 'rafael', 'sem_conexao'),
  -- Grão Norte Alimentos
  ('cb000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Eduardo Lins', 'Diretor Comercial', 'decisor', 'eduardo', 'conectado'),
  ('cb000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Juliana Freitas', 'Analista de Importação', 'campeao', 'juliana', 'conectado'),
  -- Vértice Indústria
  ('cb000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'Patrícia Moura', 'Diretora de Compras', 'decisor', 'patricia', 'conectado'),
  ('cb000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'André Vieira', 'Gerente de Engenharia', 'influenciador', 'andre', 'sem_conexao')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, value_normalized, position) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'email', 'aline.xavier@serraazul.com.br', 'aline.xavier@serraazul.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'phone', '(11) 90000-0001', '11900000001', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'email', 'jonas.ribeiro@serraazul.com.br', 'jonas.ribeiro@serraazul.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'phone', '(11) 90000-0002', '11900000002', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000003', 'email', 'renata.couto@serraazul.com.br', 'renata.couto@serraazul.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000003', 'phone', '(11) 90000-0003', '11900000003', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'email', 'marcelo.antunes@campobeloagro.com.br', 'marcelo.antunes@campobeloagro.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'phone', '(11) 90000-0004', '11900000004', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000005', 'email', 'ricardo.sa@campobeloagro.com.br', 'ricardo.sa@campobeloagro.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000005', 'phone', '(11) 90000-0005', '11900000005', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000006', 'email', 'fernanda.lopes@campobeloagro.com.br', 'fernanda.lopes@campobeloagro.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000006', 'phone', '(11) 90000-0006', '11900000006', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007', 'email', 'tiago.nunes@metalurgicaipe.com.br', 'tiago.nunes@metalurgicaipe.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007', 'phone', '(11) 90000-0007', '11900000007', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000008', 'email', 'paula.reis@deltasaude.com.br', 'paula.reis@deltasaude.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000008', 'phone', '(11) 90000-0008', '11900000008', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000009', 'email', 'livia.andrade@deltasaude.com.br', 'livia.andrade@deltasaude.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000009', 'phone', '(11) 90000-0009', '11900000009', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000010', 'email', 'gustavo.prado@deltasaude.com.br', 'gustavo.prado@deltasaude.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000010', 'phone', '(11) 90000-0010', '11900000010', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000011', 'email', 'rafael.moraes@nortelog.com.br', 'rafael.moraes@nortelog.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000011', 'phone', '(11) 90000-0011', '11900000011', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000012', 'email', 'eduardo.lins@graonorte.com.br', 'eduardo.lins@graonorte.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000012', 'phone', '(11) 90000-0012', '11900000012', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000013', 'email', 'juliana.freitas@graonorte.com.br', 'juliana.freitas@graonorte.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000013', 'phone', '(11) 90000-0013', '11900000013', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000014', 'email', 'patricia.moura@verticeindustria.com.br', 'patricia.moura@verticeindustria.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000014', 'phone', '(11) 90000-0014', '11900000014', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000015', 'email', 'andre.vieira@verticeindustria.com.br', 'andre.vieira@verticeindustria.com.br', 1),
  ('a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000015', 'phone', '(11) 90000-0015', '11900000015', 1)
ON CONFLICT (workspace_id, type, value_normalized) DO NOTHING;

-- ==============================================================================
-- Antigravity: Notificações iniciais de demonstração para testes e telas
-- ==============================================================================
INSERT INTO public.notifications (id, workspace_id, recipient_member_id, type, title, body, read_at, created_at) VALUES
  ('fa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'approval', 'Aprovação pendente: E-mails T1', 'Campanha de prospecção aguardando autorização C-level.', NULL, now() - interval '20 minutes'),
  ('fa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'system', 'Créditos consumidos', '15 créditos debitados em execuções de prospecção.', NULL, now() - interval '2 hours'),
  ('fa000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'lead', 'Novo lead atribuído', 'Conta Serra Azul atribuída ao seu pipeline.', NULL, now() - interval '1 hour'),
  ('fa000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', 'welcome', 'Boas-vindas ao Althius', 'Workspace Grão Norte configurado com sucesso.', NULL, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- ---- Aprendizados e playbooks de exemplo da Evolut (Claude) — gerados do protótipo v18 (ADR 0024)
INSERT INTO public.learning_entries (id, workspace_id, agent_id, suggestion_text, proposed_change, evidence, status) VALUES
  ('1e000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'comercial', 'Contas com menos de 20 funcionários não converteram em 3 ciclos.', 'Adicionar em Regras: excluir contas com menos de 20 funcionários.', 'Aprendido com 41 aprovações e 12 descartes', 'sugerida'),
  ('1e000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-000000000001', 'marketing', 'LinkedIn teve CPL 38% menor que Meta para Supply Chain.', 'Adicionar em Regras: priorizar LinkedIn Ads para a persona Supply Chain.', 'Aprendido com 4 semanas de campanha', 'sugerida'),
  ('1e000000-0000-0000-0000-0000000000a3', 'a0000000-0000-0000-0000-000000000001', 'copy', 'Abrir pela vaga aberta dobrou a taxa de resposta.', 'Adicionar em Regras: quando houver vaga aberta, citar o cargo na primeira linha.', 'Aprendido com 312 envios', 'sugerida'),
  ('1e000000-0000-0000-0000-0000000000a4', 'a0000000-0000-0000-0000-000000000001', 'copy', 'A objeção "já trabalho com trading" aparece em saúde.', 'Adicionar em Processo: em contas de saúde, responder com o comparativo de custo de trading.', 'Aprendido com 9 respostas', 'sugerida'),
  ('1e000000-0000-0000-0000-0000000000a5', 'a0000000-0000-0000-0000-000000000001', 'revops', 'Ligações entre 8h e 9h passaram mais pelo gatekeeper.', 'Adicionar em Regras: agendar tarefas de ligação entre 8h e 9h.', 'Aprendido com 140 ligações', 'sugerida')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agent_playbooks (id, workspace_id, agent_id, version, author_member_id, content_markdown, is_published) VALUES
  ('1f000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'comercial', '3.2', 'd0000000-0000-0000-0000-000000000002', '# Missão
Encontrar as contas com mais chance de compra dentro do ICP v4 e entregar o comitê mapeado para o time.

# Regras
- Priorize importadores de médio porte do Sudeste e Sul.
- Exclua tradings concorrentes e empresas com menos de 20 funcionários.
- Todo decisor precisa de e-mail corporativo validado.

# Processo
1. Ler o ICP e o CRM para evitar duplicidade.
2. Buscar empresas novas pelo ICP (Google Maps ou Receita Federal por CNAE), dizer o custo em créditos e só rodar quando pedirem.
3. Olhar o fit calculado e o sinal mais recente.
4. Mapear decisor, influenciador e campeão.

# Nunca
- Escrever no CRM sem aprovação.
- Usar dados pessoais que não sejam públicos e profissionais.', true),
  ('1f000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'marketing', '1.3', 'd0000000-0000-0000-0000-000000000002', '# Missão
Manter o ICP certo e gerar demanda qualificada para as contas do ICP com o menor custo por reunião.

# Regras
- O ICP muda por proposta, com o motivo tirado das vendas e dos dados.
- Meta de CPL abaixo de R$ 150.
- Mudanças de orçamento acima de R$ 1.000 pedem aprovação.
- SEO/GEO: priorize páginas de produto e comparativos.

# Processo
1. Comparar o ICP com os negócios ganhos.
2. Ler as campanhas e a verba aprovada.
3. Sugerir realocação com o motivo.

# Nunca
- Publicar anúncio sem aprovação.', true),
  ('1f000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'copy', '2.1', 'd0000000-0000-0000-0000-000000000002', '# Missão
Escrever mensagens consultivas que abrem conversa, no tom da Evolut.

# Tom
Direto, sem jargão, sem promessas que a operação não cumpre.

# Regras
- Abra pelo sinal da conta (vaga, expansão, post).
- Uma pergunta por mensagem.
- E-mails com até 90 palavras.

# Nunca
- Inventar números ou casos.
- Enviar sem aprovação nos passos manuais.', true),
  ('1f000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'revops', '1.4', 'd0000000-0000-0000-0000-000000000002', '# Missão
Manter o CRM confiável e o pipeline previsível.

# Regras
- Não sobrescrever o proprietário do negócio.
- Negócio parado há mais de 14 dias gera tarefa para o dono.
- Relatório semanal toda segunda às 8h.

# Processo
1. Ler o pipeline e os negócios parados.
2. Apontar contas sem responsável e tarefas atrasadas.
3. Montar o relatório quando pedirem, com os números do sistema.

# Nunca
- Apagar registros. Só marcar para revisão.', true)
ON CONFLICT (id) DO NOTHING;

-- ---- Caixa de entrada de exemplo da Evolut (Claude): conexões dos BDRs e conversas só com contatos do CRM
INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, display_name) VALUES
  ('ca500000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'google', 'demo-lucas-google', 'lucas@evolut.com.br'),
  ('ca500000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'linkedin', 'demo-lucas-linkedin', 'Lucas Teixeira'),
  ('ca500000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'whatsapp', 'demo-lucas-whatsapp', '+55 11 90000-0004'),
  ('ca500000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006', 'google', 'demo-bruna-google', 'bruna@evolut.com.br')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.conversations (id, workspace_id, contact_id, account_id, messaging_account_id, channel, external_chat_id, intent, unread, last_message_at) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'ca500000-0000-0000-0000-000000000002', 'linkedin', 'demo-chat-1', 'adiar', true, now() - interval '1 day'),
  ('c5000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'ca500000-0000-0000-0000-000000000004', 'email', 'demo-chat-2', 'objecao', true, now() - interval '1 day 2 hours'),
  ('c5000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'ca500000-0000-0000-0000-000000000001', 'email', 'demo-chat-3', 'positiva', false, now() - interval '3 days'),
  ('c5000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'ca500000-0000-0000-0000-000000000001', 'email', 'demo-chat-4', 'neutra', false, now() - interval '3 days 1 hour'),
  ('c5000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'ca500000-0000-0000-0000-000000000003', 'whatsapp', 'demo-chat-5', 'positiva', true, now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'in', 'demo-msg-1', 'Tenho interesse, mas só no mês que vem.', 'member', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000002', 'in', 'demo-msg-2', 'Já trabalhamos com uma trading.', 'member', now() - interval '1 day 2 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000003', 'in', 'demo-msg-3', 'Vamos marcar 20 minutos na quinta?', 'member', now() - interval '3 days 38 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000003', 'out', 'demo-msg-3r', 'Combinado, quinta às 10h. Envio o convite.', 'member', now() - interval '3 days'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000004', 'in', 'demo-msg-4', 'O responsável está de férias até dia 20.', 'automation', now() - interval '3 days 1 hour'),
  ('a0000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000005', 'in', 'demo-msg-5', 'Recebi. Me liga amanhã depois das 10h?', 'member', now() - interval '2 hours')
ON CONFLICT (external_message_id) DO NOTHING;

-- ---- Canais de exemplo da Evolut (Claude), do protótipo v18 (#geral é criado sozinho com o workspace)
INSERT INTO public.chat_channels (id, workspace_id, slug, name, description, created_by) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sinais-de-compra', 'sinais-de-compra', 'Contas com sinais de compra desta semana', 'd0000000-0000-0000-0000-000000000002'),
  ('c4000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'prospeccao', 'prospeccao', 'Listas, qualificação e enriquecimento', 'd0000000-0000-0000-0000-000000000002'),
  ('c4000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'cadencia-t1-t7', 'cadencia-t1-t7', 'Execução da cadência de importadores', 'd0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.chat_channel_members (workspace_id, channel_id, member_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_channel_agents (workspace_id, channel_id, agent_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'comercial'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'comercial'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'copy'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'copy')
ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, sender_member_id, sender_agent_id, content, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'agent', NULL, 'comercial', 'Encontrei 6 contas novas dentro do ICP desde ontem. A de maior fit é a Serra Azul Têxtil.', now() - interval '3 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'member', 'd0000000-0000-0000-0000-000000000005', NULL, '@Zoe mapeia quem decide importação na Serra Azul?', now() - interval '2 hours 50 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'agent', NULL, 'comercial', 'Decisora: Aline Xavier, Diretora de Supply Chain. Campeão provável: Jonas Ribeiro, Comprador Sênior. Fontes no dossiê.', now() - interval '2 hours 49 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'member', 'd0000000-0000-0000-0000-000000000004', NULL, 'Perfeito. Sobe para a cadência T1 hoje à tarde.', now() - interval '2 hours 30 minutes'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000002', 'agent', NULL, 'comercial', 'Lista do Sudeste pronta: 512 contas com fit acima de 70. Aguardando aprovação para entrar na cadência.', now() - interval '2 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'agent', NULL, 'copy', 'Rascunhei 3 e-mails T1 para a Serra Azul. Enviei para aprovação da Aline.', now() - interval '4 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000003', 'member', 'd0000000-0000-0000-0000-000000000004', NULL, 'Jonas respondeu pedindo proposta. Vou ligar amanhã cedo.', now() - interval '3 hours 20 minutes'),
  ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM public.chat_channels WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND slug = 'geral'), 'member', 'd0000000-0000-0000-0000-000000000002', NULL, 'Semana de foco em importadores do Sudeste. Qualquer dúvida sobre o ICP, me chamem aqui.', now() - interval '1 day');
