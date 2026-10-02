-- ==============================================================================
-- Migration: 20261002000013_signals_apify_catalog.sql
-- Ticket 06: Gateway do Apify com Catálogo de 20 Sinais e Eventos
-- ==============================================================================

-- 1. Create signal_definitions table (Global catalog of signals)
CREATE TABLE IF NOT EXISTS public.signal_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_label TEXT NOT NULL,
  description TEXT,
  credits_per_account INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'semanal',
  default_on BOOLEAN NOT NULL DEFAULT true,
  capability_code TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.signal_definitions IS 'Catálogo canônico dos 20 sinais de intenção de compra da plataforma Althius.';

-- 2. Create workspace_signal_settings table (Per-workspace activation and calibration)
CREATE TABLE IF NOT EXISTS public.workspace_signal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT DEFAULT 'semanal',
  updated_by UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_signal UNIQUE (workspace_id, signal_id)
);

COMMENT ON TABLE public.workspace_signal_settings IS 'Configuração de quais sinais estão ativados e com qual frequência em cada workspace.';

-- 3. Create signal_events table (Signal detection occurrences on target accounts)
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  temperature_bump INTEGER NOT NULL DEFAULT 1 CHECK (temperature_bump BETWEEN 0 AND 2),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.signal_events IS 'Ocorrências reais de sinais detectados em contas-alvo pelo motor Apify ou gatilhos internos.';

CREATE INDEX IF NOT EXISTS idx_signal_events_account 
  ON public.signal_events (account_id, detected_at DESC);

-- 4. Enable RLS
ALTER TABLE public.signal_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_signal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view signal definitions"
  ON public.signal_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmin can manage signal definitions"
  ON public.signal_definitions FOR ALL TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Members see workspace signal settings"
  ON public.workspace_signal_settings FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

CREATE POLICY "Estrategista and Admins manage workspace signal settings"
  ON public.workspace_signal_settings FOR ALL TO authenticated
  USING (
    public.is_superadmin() OR
    public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
  );

CREATE POLICY "Members see signal events in their workspace"
  ON public.signal_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));

-- 5. Stored Procedure: process_signal_event
CREATE OR REPLACE FUNCTION public.process_signal_event(
  p_workspace_id UUID,
  p_signal_id UUID,
  p_account_id UUID,
  p_execution_id UUID,
  p_signal_text TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_temperature_bump INTEGER DEFAULT 1,
  p_city TEXT DEFAULT NULL,
  p_state_uf TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_new_temp INTEGER;
  v_account_name TEXT;
  v_signal_name TEXT;
  v_recipient_member_id UUID;
BEGIN
  -- Insert signal event
  INSERT INTO public.signal_events (
    workspace_id,
    signal_id,
    account_id,
    execution_id,
    payload,
    temperature_bump
  ) VALUES (
    p_workspace_id,
    p_signal_id,
    p_account_id,
    p_execution_id,
    p_payload,
    p_temperature_bump
  ) RETURNING id INTO v_event_id;

  -- Update target account
  UPDATE public.accounts
  SET temperature = LEAST(3, temperature + p_temperature_bump),
      last_signal_text = p_signal_text,
      city = COALESCE(p_city, city),
      state_uf = COALESCE(p_state_uf, state_uf)
  WHERE id = p_account_id
  RETURNING temperature, name INTO v_new_temp, v_account_name;

  -- If temperature reached maximum (3 flames), trigger Hot Signal notification
  IF v_new_temp >= 3 THEN
    SELECT name INTO v_signal_name 
    FROM public.signal_definitions 
    WHERE id = p_signal_id;

    -- Send notification to Estrategista or C-level
    SELECT id INTO v_recipient_member_id
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND role IN ('estrategista', 'clevel')
      AND status = 'active'
    ORDER BY CASE WHEN role = 'estrategista' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_recipient_member_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        workspace_id,
        recipient_member_id,
        type,
        title,
        body,
        entity_type,
        entity_id
      ) VALUES (
        p_workspace_id,
        v_recipient_member_id,
        'hot_signal',
        format('🔥 Sinal quente na conta "%s"', v_account_name),
        format('A conta atingiu temperatura máxima de 3 chamas pelo sinal "%s": %s', v_signal_name, p_signal_text),
        'account',
        p_account_id
      );
    END IF;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Seed the 20 canonical signals
INSERT INTO public.signal_definitions (agent_code, code, name, source_label, description, credits_per_account, frequency, default_on, capability_code, is_custom) VALUES
  -- Agente Comercial (7)
  ('comercial', 'vagas_cargo', 'Vagas abertas por cargo', 'LinkedIn Jobs', 'Monitora contratações e abertura de vagas para cargos-chave.', 5, 'semanal', true, 'job_signal_monitor', false),
  ('comercial', 'troca_cargo', 'Troca de cargo do decisor', 'LinkedIn', 'Identifica quando um executivo do comitê assume novo cargo ou empresa.', 5, 'semanal', true, 'person_enrichment', false),
  ('comercial', 'receita_federal', 'Dados cadastrais da Receita', 'Receita Federal', 'Consulta CNPJ, CNAE, capital social, sócios e filiais.', 2, 'mensal', true, 'company_enrichment', false),
  ('comercial', 'nova_filial', 'Nova filial ou mudança de endereço', 'Google Maps / Juntas', 'Detecta expansão física e novas instalações da empresa.', 3, 'mensal', true, 'company_enrichment', false),
  ('comercial', 'rodada_investimento', 'Rodada de investimento ou M&A', 'Notícias & CVM', 'Captação de investimento, fusões, aquisições e IPO.', 4, 'semanal', true, 'market_scan', false),
  ('comercial', 'importacao_ncm', 'Importação recorrente por NCM', 'Siscomex / Comex', 'Movimentações aduaneiras e importações por código de produto.', 4, 'mensal', true, 'market_scan', false),
  ('comercial', 'licitacoes_publicas', 'Licitações e contratos públicos', 'Diários Oficiais', 'Participação e homologação de contratos públicos governamentais.', 4, 'semanal', true, 'market_scan', false),

  -- Agente de Marketing (6)
  ('marketing', 'anuncios_ativos', 'Anúncios ativos', 'Meta / Google Ad Library', 'Mapeia anúncios patrocinados ativos no Facebook, Instagram e Google.', 5, 'semanal', true, 'ad_signal_monitor', false),
  ('marketing', 'gaps_seo', 'Gaps de SEO do site', 'Site Audit', 'Varredura técnica de SEO, velocidade e indexação.', 8, 'mensal', true, 'site_audit', false),
  ('marketing', 'geo_presence', 'Presença em respostas de IA (GEO)', 'Perplexity / ChatGPT Search', 'Avalia se a marca aparece nas respostas de mecanismos de busca de IA.', 10, 'mensal', true, 'geo_presence', false),
  ('marketing', 'seguidores_concorrente', 'Seguidores de concorrente', 'Redes Sociais', 'Monitora público engajado com concorrentes diretos.', 20, 'mensal', false, 'social_followers', false),
  ('marketing', 'expositores_eventos', 'Expositores de eventos e feiras', 'Feiras Setoriais', 'Presença confirmada como expositor em feiras do setor.', 6, 'mensal', true, 'event_exhibitor_map', false),
  ('marketing', 'avaliacoes_reclamacoes', 'Avaliações e reclamações', 'Google Reviews / Reclame Aqui', 'Reputação e novas reclamações de clientes da conta.', 3, 'semanal', true, 'review_monitor', false),

  -- Agente de Copy (3)
  ('copy', 'posts_decisor', 'Posts do decisor', 'LinkedIn Feed', 'Publicações recentes do decisor para hiper-personalização de copy.', 3, 'semanal', true, 'social_posts', false),
  ('copy', 'noticias_empresa', 'Notícias da empresa', 'Google News / Valor', 'Fatos relevantes e comunicados de imprensa recentes.', 3, 'semanal', true, 'market_scan', false),
  ('copy', 'objecoes_recorrentes', 'Objeções recorrentes', 'Caixa de entrada interna', 'Análise de objeções comuns nas conversas para ajuste de copy.', 0, 'semanal', true, 'internal_inbox', false),

  -- Agente de RevOps (4)
  ('revops', 'negocio_parado', 'Negócio parado', 'Pipeline interno', 'Identifica oportunidades sem avanço na mesma etapa por mais de 14 dias.', 0, 'diario', true, 'internal_pipeline', false),
  ('revops', 'contato_invalido', 'Contato inválido', 'Bounce de e-mail / Unipile', 'Detecta falhas permanentes de entrega para saneamento.', 1, 'diario', true, 'internal_bounce', false),
  ('revops', 'duplicidade_crm', 'Duplicidade no CRM', 'CRM Sync', 'Varredura de contas e contatos duplicados no workspace.', 0, 'semanal', true, 'internal_crm', false),
  ('revops', 'mudanca_tech_stack', 'Mudança de stack tecnológica', 'BuiltWith / Wappalyzer', 'Detecção de instalação ou troca de ERP, CRM ou ferramentas de marketing.', 4, 'mensal', true, 'tech_detection', false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  source_label = EXCLUDED.source_label,
  description = EXCLUDED.description,
  credits_per_account = EXCLUDED.credits_per_account,
  capability_code = EXCLUDED.capability_code;
