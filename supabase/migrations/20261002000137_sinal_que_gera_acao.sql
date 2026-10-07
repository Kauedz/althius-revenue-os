-- ==============================================================================
-- Migration: 20261002000137_sinal_que_gera_acao.sql
-- Sinal que gera ação (spec .scratch/prospeccao-revenue, fatia 8; ADR 0067). Quando chega um sinal FORTE
-- (temperature_bump = 2) numa conta de FIT ALTO (70 ou mais, já com o sinal contado), a Zoe PROPÕE o próximo passo,
-- usando as propostas que já existem (ADR 0065), sem modelo de IA e sem crédito:
--   - a conta não tem negócio ativo  → "levar ao Pipeline" (primeiro quadro do cliente);
--   - a conta já tem negócio ativo   → "criar tarefa" para o responsável da conta (prazo 1 dia, com o sinal na nota).
-- Nada roda sem aprovação (os gatilhos de aplicação são os de sempre). Sem duplicar: o mesmo sinal tem chave própria,
-- e enquanto houver proposta de sinal PENDENTE para a conta, outro sinal não cria outra. Zoe pausada não propõe.
-- ==============================================================================

CREATE OR REPLACE FUNCTION internal.sinal_propoe_proximo_passo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.accounts;
  v_sinal TEXT;
  v_texto TEXT;
  v_membro UUID;
  v_dono UUID;
  v_quadro public.pipelines;
  v_payload JSONB;
  v_titulo TEXT;
  v_motivo TEXT;
  v_impacto TEXT;
  v_preview TEXT;
  v_chave TEXT := 'sinal:' || NEW.id;
  v_id UUID;
BEGIN
  IF COALESCE(NEW.temperature_bump, 0) < 2 THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.accounts WHERE id = NEW.account_id AND workspace_id = NEW.workspace_id AND status = 'ativa';
  IF NOT FOUND OR a.fit < 70 THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.workspace_agents WHERE workspace_id = NEW.workspace_id AND agent_code = 'comercial' AND estado = 'pausado') THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.approvals WHERE workspace_id = NEW.workspace_id AND status = 'pendente'
               AND payload_json->>'origem' = 'sinal' AND payload_json->>'conta_do_sinal' = a.id::text) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.approvals WHERE workspace_id = NEW.workspace_id AND idempotency_key = v_chave) THEN RETURN NULL; END IF;

  -- Quem "pede" em nome da Zoe: o responsável do cliente (C-level, depois estrategista), como no enriquecimento.
  SELECT wm.id INTO v_membro FROM public.workspace_members wm
   WHERE wm.workspace_id = NEW.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista')
   ORDER BY CASE wm.role WHEN 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
  IF v_membro IS NULL THEN RETURN NULL; END IF;

  SELECT name INTO v_sinal FROM public.signal_definitions WHERE id = NEW.signal_id;
  v_texto := left(COALESCE(NULLIF(btrim(COALESCE(NEW.payload->>'texto', NEW.payload->>'evento', '')), ''), v_sinal, 'sinal'), 200);
  v_motivo := left(format('Sinal forte "%s" em %s, que tem fit %s (%s).', COALESCE(v_sinal, 'sinal'), a.name, a.fit, v_texto), 500);

  IF NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.account_id = a.id AND o.status = 'ativa') THEN
    SELECT * INTO v_quadro FROM public.pipelines WHERE workspace_id = NEW.workspace_id ORDER BY created_at LIMIT 1;
  END IF;
  IF v_quadro.id IS NOT NULL THEN
    v_titulo := format('Levar %s ao quadro %s', a.name, v_quadro.name);
    v_impacto := format('Cria um negócio para %s no quadro "%s" (%s), na primeira etapa, com valor 0.', a.name, v_quadro.name, upper(v_quadro.motion));
    v_preview := a.name;
    v_payload := jsonb_build_object('acao', 'levar_contas', 'pipeline_id', v_quadro.id, 'quadro', v_quadro.name, 'account_ids', jsonb_build_array(a.id));
  ELSE
    v_dono := COALESCE((SELECT wm.id FROM public.workspace_members wm WHERE wm.id = a.owner_member_id AND wm.status = 'active'), v_membro);
    v_titulo := left(format('Falar com %s: %s', a.name, COALESCE(v_sinal, 'sinal novo')), 160);
    v_impacto := 'Cria 1 tarefa na fila do responsável da conta depois da aprovação.';
    v_preview := format('Tarefa "%s", prazo em 1 dia', v_titulo);
    v_payload := jsonb_build_object('acao', 'criar_tarefa', 'titulo', v_titulo, 'contact_id', NULL, 'account_id', a.id,
                                    'assignee_member_id', v_dono, 'em_dias', 1, 'nota', v_texto);
    v_titulo := 'Criar tarefa: ' || v_titulo;
  END IF;
  v_payload := v_payload || jsonb_build_object('origem', 'sinal', 'conta_do_sinal', a.id, 'signal_event_id', NEW.id);

  INSERT INTO public.approvals (workspace_id, category, approval_type, agent_code, title, reason, impact, preview,
                                requested_by_member_id, status, payload_json, payload_hash, idempotency_key, estimated_credits, history)
  VALUES (NEW.workspace_id, 'operacao', 'execucao', 'comercial', v_titulo, v_motivo, v_impacto, v_preview,
          v_membro, 'pendente', v_payload, encode(extensions.digest(v_payload::text, 'sha256'), 'hex'), v_chave, 0,
          jsonb_build_array(to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' Proposta pela Zoe a partir de um sinal forte'))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    PERFORM public.audit_write(NEW.workspace_id, NULL, 'agente.proposta_criada', 'approval', v_id::text, v_payload || jsonb_build_object('agente', 'comercial'));
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION internal.sinal_propoe_proximo_passo() FROM PUBLIC, anon, authenticated;
-- Nome depois de "signal_events_fit": o fit já está recalculado com este sinal quando a proposta é avaliada.
DROP TRIGGER IF EXISTS signal_events_proximo_passo ON public.signal_events;
CREATE TRIGGER signal_events_proximo_passo AFTER INSERT ON public.signal_events
  FOR EACH ROW EXECUTE FUNCTION internal.sinal_propoe_proximo_passo();
