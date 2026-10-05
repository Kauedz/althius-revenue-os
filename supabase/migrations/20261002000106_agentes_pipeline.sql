-- ==============================================================================
-- Migration: 20261002000106_agentes_pipeline.sql
-- ADR 0043, fatia B: os agentes passam a operar o pipeline pela porta do agente (ADR 0024).
-- O agente só PROPÕE (criar negócio, mover de etapa). Quem decide é uma pessoa (operação: C-level ou estrategista).
-- Aprovada, a plataforma aplica com os mesmos efeitos da tela: histórico de etapa com QUEM moveu, chance padrão da etapa.
-- Não há "nota" de negócio no banco hoje, então não existe ferramenta de nota (nada inventado).
-- ==============================================================================

-- ---------------------------------------------------------------- leitura
CREATE OR REPLACE FUNCTION public.agent_list_accounts(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.name, 'dominio', a.domain, 'segmento', a.segment, 'responsavel_id', a.owner_member_id) ORDER BY a.name)
    FROM (SELECT * FROM public.accounts WHERE workspace_id = v.workspace_id ORDER BY name LIMIT 500) a
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_list_pipelines(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.name, 'motion', p.motion, 'etapas', p.stage_order) ORDER BY p.motion, p.name)
    FROM public.pipelines p WHERE p.workspace_id = v.workspace_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_list_deals(p_token TEXT, p_status TEXT DEFAULT 'ativa')
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF p_status IS NOT NULL AND p_status NOT IN ('ativa', 'ganho', 'perdido', 'arquivada') THEN
    RAISE EXCEPTION 'Status inválido (use ativa, ganho, perdido ou arquivada).' USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x.d ORDER BY x.created_at DESC)
    FROM (
      SELECT o.created_at,
             jsonb_build_object('id', o.id, 'titulo', o.title, 'quadro_id', o.pipeline_id, 'quadro', p.name, 'etapa', o.stage_key,
                                'valor_reais', o.amount, 'fecha_em', o.close_date, 'chance', o.win_probability, 'saude', o.health,
                                'status', o.status, 'responsavel_id', o.owner_member_id, 'conta_id', o.account_id) AS d
      FROM public.opportunities o JOIN public.pipelines p ON p.id = o.pipeline_id
      WHERE o.workspace_id = v.workspace_id AND (p_status IS NULL OR o.status = p_status)
      ORDER BY o.created_at DESC
      LIMIT 200
    ) x
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------- propostas
CREATE OR REPLACE FUNCTION public.agent_propose_deal(
  p_token TEXT, p_pipeline_id UUID, p_account_id UUID, p_amount NUMERIC, p_stage_key TEXT, p_owner_member_id UUID,
  p_close_date DATE, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_etapa TEXT := COALESCE(NULLIF(btrim(COALESCE(p_stage_key, '')), ''), 'entrada');
  v_quadro public.pipelines;
  v_conta TEXT;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo do negócio.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1000000000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'O valor deve ficar entre R$ 0 e R$ 1 bilhão.'); END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Quadro não encontrado neste workspace.'); END IF;
  IF v_etapa = 'ganho' OR NOT (v_quadro.stage_order ? v_etapa) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Etapa inválida para um negócio novo (use uma etapa do quadro, exceto ganho).');
  END IF;
  SELECT a.name INTO v_conta FROM public.accounts a WHERE a.id = p_account_id AND a.workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Conta não encontrada neste workspace.'); END IF;
  IF p_owner_member_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE id = p_owner_member_id AND workspace_id = v.workspace_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O responsável precisa ser um membro ativo deste workspace.');
  END IF;

  v_payload := jsonb_build_object('acao', 'criar_negocio', 'pipeline_id', p_pipeline_id, 'quadro', v_quadro.name, 'account_id', p_account_id, 'conta', v_conta,
                                  'valor', p_amount, 'etapa', v_etapa, 'owner_member_id', p_owner_member_id, 'fecha_em', p_close_date);
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Criar negócio: %s', v_conta), v_motivo,
    'Cria 1 negócio no quadro depois da aprovação.',
    format('Negócio com %s no quadro "%s", etapa %s, R$ %s', v_conta, v_quadro.name, v_etapa, to_char(p_amount, 'FM999G999G999G990D00')),
    v_payload, v_chave, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_propose_move_deal(
  p_token TEXT, p_opportunity_id UUID, p_to_stage TEXT, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_o public.opportunities;
  v_quadro public.pipelines;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da mudança de etapa.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  SELECT * INTO v_o FROM public.opportunities WHERE id = p_opportunity_id AND workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Negócio não encontrado neste workspace.'); END IF;
  IF v_o.status NOT IN ('ativa', 'ganho') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Este negócio não está mais ativo.'); END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = v_o.pipeline_id;
  IF p_to_stage IS NULL OR NOT (v_quadro.stage_order ? p_to_stage) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Etapa inexistente neste quadro.'); END IF;
  IF p_to_stage = v_o.stage_key THEN RETURN jsonb_build_object('ok', false, 'erro', 'O negócio já está nesta etapa.'); END IF;

  v_payload := jsonb_build_object('acao', 'mover_negocio', 'opportunity_id', p_opportunity_id, 'negocio', v_o.title, 'de', v_o.stage_key, 'para', p_to_stage);
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Mover negócio %s para %s', v_o.title, p_to_stage), v_motivo,
    'Muda a etapa de 1 negócio depois da aprovação.',
    format('%s: %s → %s', v_o.title, v_o.stage_key, p_to_stage),
    v_payload, v_chave, 0);
END;
$$;

-- ---------------------------------------------------------------- aplicar o que foi aprovado
CREATE OR REPLACE FUNCTION public.approvals_aplicar_agente_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_user UUID := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
  p JSONB := NEW.payload_json;
  v_quadro public.pipelines;
  v_o public.opportunities;
  v_conta public.accounts;
  v_id UUID;
  v_pos INTEGER;
  v_prob INTEGER;
BEGIN
  IF p->>'acao' = 'criar_negocio' THEN
    SELECT * INTO v_quadro FROM public.pipelines WHERE id = (p->>'pipeline_id')::uuid AND workspace_id = NEW.workspace_id;
    SELECT * INTO v_conta FROM public.accounts WHERE id = (p->>'account_id')::uuid AND workspace_id = NEW.workspace_id;
    IF v_quadro.id IS NULL OR v_conta.id IS NULL OR NOT (v_quadro.stage_order ? (p->>'etapa')) THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Negócio não criado: o quadro ou a conta não existe mais');
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = (p->>'owner_member_id')::uuid AND workspace_id = NEW.workspace_id AND status = 'active') THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Negócio não criado: o responsável não está mais ativo');
      RETURN NEW;
    END IF;
    SELECT default_probability INTO v_prob FROM public.stage_definitions WHERE stage_key = p->>'etapa';
    SELECT COALESCE(min(position), 1) - 1 INTO v_pos FROM public.opportunities WHERE pipeline_id = v_quadro.id AND stage_key = p->>'etapa';
    INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, stage_key, title, amount, close_date, win_probability, health, position, owner_member_id, status)
    VALUES (NEW.workspace_id, v_quadro.id, v_conta.id, p->>'etapa', v_conta.name, (p->>'valor')::numeric, NULLIF(p->>'fecha_em', '')::date,
            COALESCE(v_prob, 10), 'no_prazo', v_pos, (p->>'owner_member_id')::uuid, 'ativa')
    RETURNING id INTO v_id;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Negócio criado');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'opportunity', v_id::text, p);

  ELSIF p->>'acao' = 'mover_negocio' THEN
    SELECT * INTO v_o FROM public.opportunities WHERE id = (p->>'opportunity_id')::uuid AND workspace_id = NEW.workspace_id FOR UPDATE;
    IF NOT FOUND OR v_o.status NOT IN ('ativa', 'ganho') THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: o negócio não está mais ativo');
      RETURN NEW;
    END IF;
    IF v_o.stage_key IS DISTINCT FROM p->>'de' THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: o negócio mudou de etapa depois do pedido');
      RETURN NEW;
    END IF;
    SELECT * INTO v_quadro FROM public.pipelines WHERE id = v_o.pipeline_id;
    IF NOT (v_quadro.stage_order ? (p->>'para')) THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: a etapa não existe mais no quadro');
      RETURN NEW;
    END IF;
    SELECT COALESCE(max(position), 0) + 1 INTO v_pos FROM public.opportunities WHERE pipeline_id = v_o.pipeline_id AND stage_key = p->>'para';
    -- O histórico guarda QUEM aprovou o movimento (a pessoa), como na tela.
    PERFORM set_config('althius.mover_member_id', NEW.decided_by_member_id::text, true);
    UPDATE public.opportunities
       SET stage_key = p->>'para', position = v_pos, status = CASE WHEN p->>'para' = 'ganho' THEN 'ganho' ELSE 'ativa' END
     WHERE id = v_o.id;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Negócio movido de etapa');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'opportunity', v_o.id::text, p);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_agente_pipeline ON public.approvals;
CREATE TRIGGER approvals_aplicar_agente_pipeline
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado' AND NEW.agent_code IS NOT NULL)
  EXECUTE FUNCTION public.approvals_aplicar_agente_pipeline();

-- ---------------------------------------------------------------- permissões (ADR 0023)
REVOKE ALL ON FUNCTION public.agent_list_accounts(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_pipelines(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_deals(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_deal(TEXT, UUID, UUID, NUMERIC, TEXT, UUID, DATE, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_move_deal(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_agente_pipeline() FROM PUBLIC, anon, authenticated;
-- Exceção documentada (ADR 0024): a porta do agente aceita chamada só com o token; sem token válido, erro 28000.
GRANT EXECUTE ON FUNCTION public.agent_list_accounts(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_pipelines(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_deals(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_deal(TEXT, UUID, UUID, NUMERIC, TEXT, UUID, DATE, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_move_deal(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
