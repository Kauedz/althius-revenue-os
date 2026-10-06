-- ==============================================================================
-- Migration: 20261002000107_agentes_campanhas.sql
-- ADR 0043, fatia C: os agentes passam a operar campanhas pela porta do agente (ADR 0024).
-- O agente só PROPÕE. Verba de mídia é GASTO: aumentar a verba vira aprovação de gasto (tipo orçamento) e só
-- C-level/superadmin decide ("quem paga decide"; approval_decide impõe). Reduzir a verba, criar campanha (sem verba)
-- e mudar status são operação. A verba aprovada é aplicada pelo gatilho que já existe (approvals_aplicar_verba_campanha,
-- mesmo formato de pedido da tela), então tela e agente passam pelo mesmo caminho. Tudo em reais.
-- ==============================================================================

-- ---------------------------------------------------------------- correção: pedido de verba com valor "1000.00"
-- O pedido guardava a verba atual como 1000.00 (numeric com 2 casas). A tela devolve o conteúdo pelo JavaScript, que
-- escreve 1000, e aí o hash do conteúdo não bate: a aprovação era invalidada sozinha ("conteúdo mudou"). Agora o valor
-- é guardado sem zeros à direita (trim_scale), igual nos dois lados. Vale para a tela (campanha_pedir_verba) e para o agente.
CREATE OR REPLACE FUNCTION internal.campanha_pedir_verba(p_workspace_id UUID, p_member_id UUID, p_campaign_id UUID, p_de NUMERIC, p_para NUMERIC)
RETURNS UUID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_c public.campaigns;
  v_payload JSONB;
  v_id UUID;
  v_decisor UUID;
BEGIN
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id;
  v_payload := jsonb_build_object('acao', 'verba_campanha', 'campaign_id', p_campaign_id, 'campanha', v_c.name, 'canal', v_c.channel_type,
                                  'de', trim_scale(p_de), 'para', trim_scale(p_para));
  INSERT INTO public.approvals (workspace_id, category, approval_type, title, description, requested_by_member_id, status, payload_json, payload_hash, estimated_credits, impact)
  VALUES (p_workspace_id, 'gasto', 'orcamento', format('Verba de mídia: %s', v_c.name),
          format('Pedido de verba de R$ %s (hoje R$ %s) para a campanha "%s".', to_char(p_para, 'FM999G999G990D00'), to_char(p_de, 'FM999G999G990D00'), v_c.name),
          p_member_id, 'pendente', v_payload, encode(extensions.digest(v_payload::text, 'sha256'), 'hex'), 0,
          format('Verba de mídia da campanha passa de R$ %s para R$ %s.', to_char(p_de, 'FM999G999G990D00'), to_char(p_para, 'FM999G999G990D00')))
  RETURNING id INTO v_id;
  SELECT wm.id INTO v_decisor FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id AND wm.role IN ('clevel', 'superadmin') AND wm.status = 'active'
   ORDER BY CASE WHEN wm.role = 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
  IF v_decisor IS NOT NULL THEN
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (p_workspace_id, v_decisor, 'approval_required', 'Aprovação de gasto pendente: ' || format('Verba de mídia: %s', v_c.name),
            format('Pedido de verba de R$ %s para a campanha "%s".', to_char(p_para, 'FM999G999G990D00'), v_c.name), 'approval', v_id);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION internal.campanha_pedir_verba(UUID, UUID, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- leitura
CREATE OR REPLACE FUNCTION public.agent_list_campaigns(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.name, 'canal', c.channel_type, 'status', c.status,
                                        'verba_reais', c.budget_brl, 'leads', c.leads_count) ORDER BY c.created_at DESC)
    FROM public.campaigns c WHERE c.workspace_id = v.workspace_id
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------- propostas
CREATE OR REPLACE FUNCTION public.agent_propose_campaign(p_token TEXT, p_name TEXT, p_channel TEXT, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_nome TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_nome IS NULL OR length(v_nome) > 120 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Dê um nome à campanha (até 120 caracteres).'); END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('linkedin_ads', 'meta_ads', 'google_ads', 'organico', 'evento', 'seo_geo') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Canal de campanha inválido (use linkedin_ads, meta_ads, google_ads, organico, evento ou seo_geo).');
  END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da campanha.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;

  v_payload := jsonb_build_object('acao', 'criar_campanha', 'nome', v_nome, 'canal', p_channel);
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Criar campanha: %s', v_nome), v_motivo,
    'Cria 1 campanha em rascunho, sem verba, depois da aprovação. Verba é pedida à parte.',
    format('Campanha "%s" (%s) em rascunho', v_nome, p_channel), v_payload, v_chave, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_propose_campaign_budget(p_token TEXT, p_campaign_id UUID, p_amount NUMERIC, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_c public.campaigns;
  v_pendente UUID;
  v_gasto BOOLEAN;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da verba.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'A verba deve ficar entre R$ 0 e R$ 100 milhões.'); END IF;
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id AND workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Campanha não encontrada neste workspace.'); END IF;
  IF p_amount = v_c.budget_brl THEN RETURN jsonb_build_object('ok', false, 'erro', 'A campanha já tem essa verba.'); END IF;
  -- Já existe pedido de verba pendente para a campanha (da tela ou de outro agente): não empilha outro.
  SELECT id INTO v_pendente FROM public.approvals
   WHERE workspace_id = v.workspace_id AND status = 'pendente' AND payload_json->>'acao' = 'verba_campanha' AND payload_json->>'campaign_id' = p_campaign_id::text
     AND idempotency_key IS DISTINCT FROM v_chave LIMIT 1;
  IF v_pendente IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Já existe um pedido de verba pendente para esta campanha. Espere a decisão.', 'approval_id', v_pendente);
  END IF;

  v_gasto := p_amount > v_c.budget_brl;
  -- Mesmo formato do pedido da tela (campanha_pedir_verba): o gatilho de verba aplica quando aprovado.
  v_payload := jsonb_build_object('acao', 'verba_campanha', 'campaign_id', p_campaign_id, 'campanha', v_c.name, 'canal', v_c.channel_type,
                                  'de', trim_scale(v_c.budget_brl), 'para', trim_scale(p_amount));
  RETURN internal.agente_propor(v,
    CASE WHEN v_gasto THEN 'gasto' ELSE 'operacao' END,
    CASE WHEN v_gasto THEN 'orcamento' ELSE 'execucao' END,
    format('Verba de mídia: %s', v_c.name), v_motivo,
    format('Verba da campanha passa de R$ %s para R$ %s.', to_char(v_c.budget_brl, 'FM999G999G990D00'), to_char(p_amount, 'FM999G999G990D00')),
    format('%s: R$ %s → R$ %s', v_c.name, to_char(v_c.budget_brl, 'FM999G999G990D00'), to_char(p_amount, 'FM999G999G990D00')),
    v_payload, v_chave, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_propose_campaign_status(p_token TEXT, p_campaign_id UUID, p_status TEXT, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_c public.campaigns;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da mudança de status.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF p_status IS NULL OR p_status NOT IN ('rascunho', 'ativa', 'pausada', 'concluida') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Status inválido (use rascunho, ativa, pausada ou concluida).');
  END IF;
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id AND workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Campanha não encontrada neste workspace.'); END IF;
  IF v_c.status = p_status THEN RETURN jsonb_build_object('ok', false, 'erro', 'A campanha já está neste status.'); END IF;

  v_payload := jsonb_build_object('acao', 'status_campanha', 'campaign_id', p_campaign_id, 'campanha', v_c.name, 'de', v_c.status, 'para', p_status);
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Campanha %s: %s', v_c.name, p_status), v_motivo,
    'Muda o status de 1 campanha depois da aprovação. A verba já aprovada não muda.',
    format('%s: %s → %s', v_c.name, v_c.status, p_status), v_payload, v_chave, 0);
END;
$$;

-- ---------------------------------------------------------------- aplicar o que foi aprovado
CREATE OR REPLACE FUNCTION public.approvals_aplicar_agente_campanhas()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_user UUID := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
  p JSONB := NEW.payload_json;
  v_id UUID;
  v_atual TEXT;
BEGIN
  IF p->>'acao' = 'criar_campanha' THEN
    INSERT INTO public.campaigns (workspace_id, name, channel_type, status, created_by)
    VALUES (NEW.workspace_id, p->>'nome', p->>'canal', 'rascunho', NEW.requested_by_member_id) RETURNING id INTO v_id;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Campanha criada em rascunho');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'campaign', v_id::text, p);

  ELSIF p->>'acao' = 'status_campanha' THEN
    SELECT status INTO v_atual FROM public.campaigns WHERE id = (p->>'campaign_id')::uuid AND workspace_id = NEW.workspace_id FOR UPDATE;
    IF NOT FOUND THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: a campanha não existe mais');
      RETURN NEW;
    END IF;
    IF v_atual IS DISTINCT FROM p->>'de' THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: o status da campanha mudou depois do pedido');
      RETURN NEW;
    END IF;
    UPDATE public.campaigns SET status = p->>'para' WHERE id = (p->>'campaign_id')::uuid;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Status da campanha alterado');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'campaign', p->>'campaign_id', p);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_agente_campanhas ON public.approvals;
CREATE TRIGGER approvals_aplicar_agente_campanhas
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado' AND NEW.agent_code IS NOT NULL)
  EXECUTE FUNCTION public.approvals_aplicar_agente_campanhas();

-- ---------------------------------------------------------------- permissões (ADR 0023)
REVOKE ALL ON FUNCTION public.agent_list_campaigns(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_campaign(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_campaign_budget(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_campaign_status(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_agente_campanhas() FROM PUBLIC, anon, authenticated;
-- Exceção documentada (ADR 0024): a porta do agente aceita chamada só com o token; sem token válido, erro 28000.
GRANT EXECUTE ON FUNCTION public.agent_list_campaigns(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_campaign(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_campaign_budget(TEXT, UUID, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_campaign_status(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
