-- ==============================================================================
-- Migration: 20261002000105_agentes_tarefas_cadencias.sql
-- ADR 0043, fatia A: os agentes passam a operar tarefas e cadências pela porta do agente (ADR 0024).
-- Regra de ouro: o agente só PROPÕE. Quem aprova é uma pessoa: tarefa é operação (C-level ou estrategista);
-- inscrever em cadência com envio automático gasta crédito, então é GASTO e só C-level/superadmin decide
-- (approval_decide já impõe isso). Aprovada, a plataforma aplica sozinha, com os mesmos controles da tela.
-- ==============================================================================

-- ---------------------------------------------------------------- inscrição: núcleo compartilhado
-- Tela (cadence_enroll) e aprovação do agente passam pelo mesmo caminho. Quem chama já validou permissão e escopo.
CREATE OR REPLACE FUNCTION internal.cadence_enroll_core(p_workspace_id UUID, p_cadence_id UUID, p_contact_id UUID, p_owner_member_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_existente UUID;
  v_id UUID;
  v_primeiro INTEGER;
BEGIN
  SELECT id INTO v_existente FROM public.cadence_enrollments
   WHERE cadence_id = p_cadence_id AND contact_id = p_contact_id AND status IN ('ativa', 'pausada', 'pausada_resposta') LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'unchanged', 'enrollment_id', v_existente);
  END IF;

  INSERT INTO public.cadence_enrollments (workspace_id, cadence_id, contact_id, owner_member_id)
  VALUES (p_workspace_id, p_cadence_id, p_contact_id, p_owner_member_id) RETURNING id INTO v_id;

  INSERT INTO public.cadence_enrollment_steps (enrollment_id, step_number)
  SELECT v_id, cs.step_number FROM public.cadence_steps cs WHERE cs.cadence_id = p_cadence_id;
  SELECT min(step_number) INTO v_primeiro FROM public.cadence_enrollment_steps WHERE enrollment_id = v_id;
  IF v_primeiro IS NULL THEN
    UPDATE public.cadence_enrollments SET status = 'concluida', completed_at = now() WHERE id = v_id;
  ELSE
    UPDATE public.cadence_enrollments SET current_step_number = v_primeiro WHERE id = v_id;
    UPDATE public.cadence_enrollment_steps es
       SET scheduled_at = now() + cs.delay_days * interval '1 day'
      FROM public.cadence_steps cs
     WHERE es.enrollment_id = v_id AND es.step_number = v_primeiro AND cs.cadence_id = p_cadence_id AND cs.step_number = v_primeiro;
  END IF;

  PERFORM public.audit_write(p_workspace_id, p_user_id, 'cadence.enrolled', 'cadence_enrollment', v_id::text,
    jsonb_build_object('cadence_id', p_cadence_id, 'contact_id', p_contact_id));
  RETURN jsonb_build_object('action', 'enrolled', 'enrollment_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION internal.cadence_enroll_core(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- A tela continua igual: valida permissão e escopo e chama o núcleo.
CREATE OR REPLACE FUNCTION public.cadence_enroll(p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dono UUID;
  v_escopo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'cadences.edit');
  IF v_escopo NOT IN ('all', 'own') THEN
    RAISE EXCEPTION 'Seu papel não pode inscrever contatos em cadências.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cadences WHERE id = p_cadence_id AND workspace_id = p_workspace_id AND status = 'ativa') THEN
    RAISE EXCEPTION 'Cadência não encontrada neste workspace (ou não está ativa).' USING ERRCODE = '42501';
  END IF;
  SELECT a.owner_member_id INTO v_dono
    FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
   WHERE c.id = p_contact_id AND c.workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato não encontrado neste workspace.' USING ERRCODE = '42501';
  END IF;
  v_dono := COALESCE(v_dono, p_member_id);
  IF v_escopo = 'own' AND v_dono <> p_member_id THEN
    RAISE EXCEPTION 'Você só inscreve contatos das suas próprias contas.' USING ERRCODE = '42501';
  END IF;
  RETURN internal.cadence_enroll_core(p_workspace_id, p_cadence_id, p_contact_id, v_dono, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.cadence_enroll(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_enroll(UUID, UUID, UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------- proposta genérica do agente
-- Cria a aprovação de forma idempotente (mesma chave = mesma proposta). Quem chama já validou o token e os dados.
CREATE OR REPLACE FUNCTION internal.agente_propor(
  p_agente public.agent_runtime_tokens, p_categoria TEXT, p_tipo TEXT, p_titulo TEXT, p_motivo TEXT, p_impacto TEXT,
  p_preview TEXT, p_payload JSONB, p_chave TEXT, p_creditos INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
BEGIN
  SELECT id, status INTO v_id, v_status FROM public.approvals WHERE workspace_id = p_agente.workspace_id AND idempotency_key = p_chave;
  IF FOUND THEN
    IF v_status = 'pendente' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'erro', format('Esta mesma proposta já foi decidida (%s).', v_status), 'approval_id', v_id);
  END IF;
  BEGIN
    INSERT INTO public.approvals (
      workspace_id, category, approval_type, agent_code, title, reason, impact, preview,
      requested_by_member_id, status, payload_json, payload_hash, idempotency_key, estimated_credits, history
    ) VALUES (
      p_agente.workspace_id, p_categoria, p_tipo, p_agente.agent_code, p_titulo, left(p_motivo, 500), p_impacto, p_preview,
      p_agente.member_id, 'pendente', p_payload, encode(extensions.digest(p_payload::text, 'sha256'), 'hex'), p_chave, COALESCE(p_creditos, 0),
      jsonb_build_array(to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' Proposta pelo agente ' || initcap(p_agente.agent_code))
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.approvals WHERE workspace_id = p_agente.workspace_id AND idempotency_key = p_chave;
    RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
  END;
  PERFORM public.audit_write(p_agente.workspace_id, NULL, 'agente.proposta_criada', 'approval', v_id::text,
    p_payload || jsonb_build_object('agente', p_agente.agent_code));
  RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION internal.agente_propor(public.agent_runtime_tokens, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- leitura
CREATE OR REPLACE FUNCTION public.agent_list_members(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', wm.id, 'papel', wm.role, 'cargo', wm.job_title) ORDER BY wm.created_at)
    FROM public.workspace_members wm WHERE wm.workspace_id = v.workspace_id AND wm.status = 'active'
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_list_tasks(p_token TEXT, p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF p_status IS NOT NULL AND p_status NOT IN ('pendente', 'em_andamento', 'concluida') THEN
    RAISE EXCEPTION 'Status inválido (use pendente, em_andamento ou concluida).' USING ERRCODE = '22023';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x.t ORDER BY x.due_at)
    FROM (
      SELECT t.due_at,
             jsonb_build_object('id', t.id, 'titulo', t.title, 'canal', t.channel, 'status', t.status, 'vence_em', t.due_at,
                                'responsavel_id', t.assignee_member_id, 'contato_id', t.contact_id, 'contato', c.name,
                                'empresa', a.name, 'origem', t.source) AS t
      FROM public.tasks t
      LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.workspace_id = t.workspace_id
      LEFT JOIN public.accounts a ON a.id = t.account_id AND a.workspace_id = t.workspace_id
      WHERE t.workspace_id = v.workspace_id AND (p_status IS NULL OR t.status = p_status)
      ORDER BY t.due_at
      LIMIT 200
    ) x
  ), '[]'::jsonb);
END;
$$;

-- Custo estimado: 4 créditos por envio automático (o mesmo valor que o motor consome em cadence_finish_step).
CREATE OR REPLACE FUNCTION public.agent_list_cadences(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.name, 'descricao', c.description,
      'passos', (SELECT count(*) FROM public.cadence_steps s WHERE s.cadence_id = c.id),
      'passos_automaticos', (SELECT count(*) FROM public.cadence_steps s WHERE s.cadence_id = c.id AND s.execution_mode = 'auto'),
      'creditos_por_contato', 4 * (SELECT count(*) FROM public.cadence_steps s WHERE s.cadence_id = c.id AND s.execution_mode = 'auto')
    ) ORDER BY c.name)
    FROM public.cadences c WHERE c.workspace_id = v.workspace_id AND c.status = 'ativa'
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------- propostas
CREATE OR REPLACE FUNCTION public.agent_propose_task(
  p_token TEXT, p_title TEXT, p_contact_id UUID, p_assignee_member_id UUID, p_due_in_days INTEGER,
  p_note TEXT, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_titulo TEXT := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_dias INTEGER := COALESCE(p_due_in_days, 0);
  v_conta UUID;
  v_nome TEXT;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_titulo IS NULL OR length(v_titulo) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva o que precisa ser feito (até 200 caracteres).'); END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da tarefa.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF v_dias < 0 OR v_dias > 90 THEN RETURN jsonb_build_object('ok', false, 'erro', 'O prazo deve ser de 0 a 90 dias.'); END IF;
  IF p_note IS NOT NULL AND length(p_note) > 1000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'A observação passa de 1000 caracteres.'); END IF;
  IF p_assignee_member_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE id = p_assignee_member_id AND workspace_id = v.workspace_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O responsável precisa ser um membro ativo deste workspace.');
  END IF;
  IF p_contact_id IS NOT NULL THEN
    SELECT c.account_id, c.name INTO v_conta, v_nome FROM public.contacts c WHERE c.id = p_contact_id AND c.workspace_id = v.workspace_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Contato não encontrado neste workspace.'); END IF;
  END IF;

  v_payload := jsonb_build_object('acao', 'criar_tarefa', 'titulo', v_titulo, 'contact_id', p_contact_id, 'account_id', v_conta,
                                  'assignee_member_id', p_assignee_member_id, 'em_dias', v_dias, 'nota', NULLIF(btrim(COALESCE(p_note, '')), ''));
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Criar tarefa: %s', v_titulo), v_motivo,
    'Cria 1 tarefa na fila do responsável depois da aprovação.',
    format('Tarefa "%s"%s, prazo em %s dia(s)', v_titulo, CASE WHEN v_nome IS NOT NULL THEN ' para ' || v_nome ELSE '' END, v_dias),
    v_payload, v_chave, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_propose_enrollment(
  p_token TEXT, p_cadence_id UUID, p_contact_id UUID, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_cad TEXT;
  v_nome TEXT;
  v_auto INTEGER;
  v_creditos INTEGER;
  v_payload JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da inscrição.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  SELECT c.name INTO v_cad FROM public.cadences c WHERE c.id = p_cadence_id AND c.workspace_id = v.workspace_id AND c.status = 'ativa';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Cadência não encontrada neste workspace (ou não está ativa).'); END IF;
  SELECT c.name INTO v_nome FROM public.contacts c WHERE c.id = p_contact_id AND c.workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Contato não encontrado neste workspace.'); END IF;
  IF EXISTS (SELECT 1 FROM public.cadence_enrollments WHERE cadence_id = p_cadence_id AND contact_id = p_contact_id AND status IN ('ativa', 'pausada', 'pausada_resposta')) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este contato já está nesta cadência.');
  END IF;

  SELECT count(*) INTO v_auto FROM public.cadence_steps WHERE cadence_id = p_cadence_id AND execution_mode = 'auto';
  v_creditos := 4 * v_auto;
  v_payload := jsonb_build_object('acao', 'inscrever_cadencia', 'cadence_id', p_cadence_id, 'cadencia', v_cad, 'contact_id', p_contact_id, 'contato', v_nome);
  -- Com envio automático há gasto de créditos: aprovação de GASTO (só C-level ou superadmin decide).
  RETURN internal.agente_propor(v,
    CASE WHEN v_auto > 0 THEN 'gasto' ELSE 'operacao' END,
    CASE WHEN v_auto > 0 THEN 'execucao_limite' ELSE 'execucao' END,
    format('Inscrever %s na cadência %s', v_nome, v_cad), v_motivo,
    CASE WHEN v_auto > 0 THEN format('Pode gastar até %s créditos em envios automáticos.', v_creditos) ELSE 'Cria tarefas manuais; não gasta créditos.' END,
    format('%s entra na cadência "%s" (%s passo(s) automático(s))', v_nome, v_cad, v_auto),
    v_payload, v_chave, v_creditos);
END;
$$;

-- ---------------------------------------------------------------- aplicar o que foi aprovado
CREATE OR REPLACE FUNCTION public.approvals_aplicar_agente_operacoes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_user UUID := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
  p JSONB := NEW.payload_json;
  v_id UUID;
  v_dono UUID;
  v_r JSONB;
BEGIN
  IF p->>'acao' = 'criar_tarefa' THEN
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = (p->>'assignee_member_id')::uuid AND workspace_id = NEW.workspace_id AND status = 'active') THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Tarefa não criada: o responsável não está mais ativo');
      RETURN NEW;
    END IF;
    IF p->>'contact_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = (p->>'contact_id')::uuid AND workspace_id = NEW.workspace_id) THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Tarefa não criada: o contato não existe mais');
      RETURN NEW;
    END IF;
    INSERT INTO public.tasks (workspace_id, title, account_id, contact_id, assignee_member_id, agent_id, due_at, status, note, source)
    VALUES (NEW.workspace_id, p->>'titulo', (p->>'account_id')::uuid, (p->>'contact_id')::uuid, (p->>'assignee_member_id')::uuid, NEW.agent_code,
            now() + COALESCE((p->>'em_dias')::int, 0) * interval '1 day', 'pendente', NULLIF(p->>'nota', ''), 'agente')
    RETURNING id INTO v_id;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Tarefa criada');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'task', v_id::text, p);

  ELSIF p->>'acao' = 'inscrever_cadencia' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cadences WHERE id = (p->>'cadence_id')::uuid AND workspace_id = NEW.workspace_id AND status = 'ativa') THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Inscrição não feita: a cadência não está mais ativa');
      RETURN NEW;
    END IF;
    SELECT a.owner_member_id INTO v_dono FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
     WHERE c.id = (p->>'contact_id')::uuid AND c.workspace_id = NEW.workspace_id;
    IF NOT FOUND THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Inscrição não feita: o contato não existe mais');
      RETURN NEW;
    END IF;
    v_r := internal.cadence_enroll_core(NEW.workspace_id, (p->>'cadence_id')::uuid, (p->>'contact_id')::uuid,
                                        COALESCE(v_dono, NEW.requested_by_member_id), v_user);
    NEW.history := NEW.history || jsonb_build_array(v_hora || CASE WHEN v_r->>'action' = 'enrolled' THEN ' Contato inscrito na cadência' ELSE ' Contato já estava na cadência' END);
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'cadence_enrollment', v_r->>'enrollment_id', p);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_agente_operacoes ON public.approvals;
CREATE TRIGGER approvals_aplicar_agente_operacoes
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado' AND NEW.agent_code IS NOT NULL)
  EXECUTE FUNCTION public.approvals_aplicar_agente_operacoes();

-- ---------------------------------------------------------------- permissões (ADR 0023)
REVOKE ALL ON FUNCTION public.agent_list_members(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_tasks(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_cadences(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_task(TEXT, TEXT, UUID, UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_enrollment(TEXT, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_agente_operacoes() FROM PUBLIC, anon, authenticated;
-- Exceção documentada (ADR 0024): a porta do agente aceita chamada só com o token; sem token válido, erro 28000.
GRANT EXECUTE ON FUNCTION public.agent_list_members(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_tasks(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_cadences(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_task(TEXT, TEXT, UUID, UUID, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_enrollment(TEXT, UUID, UUID, TEXT, TEXT) TO anon, authenticated, service_role;
