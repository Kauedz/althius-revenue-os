-- ==============================================================================
-- Migration: 20261002000100_motor_cadencia.sql
-- PR 06: motor de cadência. Desenho próprio (nada copiado do Twenty, que é AGPL; ADR 0038).
--
-- O worker (Node) repete: cadence_claim_due -> cadence_prepare_step -> envio pelo provedor -> cadence_finish_step.
-- Tudo o que decide (política Hermes, créditos, agente pausado, idempotência) mora aqui no banco, em transação.
-- O envio externo fica FORA da transação, por isso são duas fases com a execução como elo:
--   prepare: confere, reserva créditos e registra a execução (status running);
--   finish : consome os créditos (ou libera a reserva se falhou) e avança a inscrição.
-- Garantia escolhida: no máximo UM envio por inscrição+passo. Se o worker cair no meio, a execução fica "running"
-- e o passo não é reenviado sozinho (melhor não mandar do que mandar duas vezes).
--
-- Espera: cada passo tem delay_days. O passo seguinte só recebe data quando o anterior termina (espera relativa).
-- Passo automático com o envio automático DESLIGADO na inscrição vira tarefa com o texto pronto (como o manual).
-- ==============================================================================

ALTER TABLE public.cadence_steps ADD COLUMN IF NOT EXISTS delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0);
COMMENT ON COLUMN public.cadence_steps.delay_days IS 'Dias de espera depois do passo anterior (no passo 1, depois da inscrição).';

ALTER TABLE public.cadence_enrollments
  ADD COLUMN IF NOT EXISTS owner_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_send BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;
COMMENT ON COLUMN public.cadence_enrollments.owner_member_id IS 'Quem responde por esta inscrição (dono da conta). Dele saem as mensagens e para ele vão as tarefas e avisos.';
COMMENT ON COLUMN public.cadence_enrollments.auto_send IS 'Envio automático ligado pelo dono (BDR só nas próprias; cadences.auto). Desligado, passos automáticos viram tarefa.';

ALTER TABLE public.cadence_enrollment_steps
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_executions_cadence_attempt ON public.executions ((metadata_json->>'cadence_attempt')) WHERE metadata_json ? 'cadence_attempt';

-- Escopo do papel do membro numa capacidade (all, own, read, request, none). Não decide sozinho: quem chama compara.
CREATE OR REPLACE FUNCTION internal.escopo_do_membro(p_workspace_id UUID, p_member_id UUID, p_capability TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT rp.scope FROM public.workspace_members wm
    JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = p_capability
    WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active'
  ), 'none');
$$;
REVOKE ALL ON FUNCTION internal.escopo_do_membro(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Avança a inscrição depois de um passo: agenda o próximo (espera relativa) ou conclui.
CREATE OR REPLACE FUNCTION internal.cadence_avancar(p_enrollment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_e public.cadence_enrollments;
  v_prox INTEGER;
  v_delay INTEGER;
BEGIN
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = p_enrollment_id;
  SELECT min(step_number) INTO v_prox FROM public.cadence_enrollment_steps WHERE enrollment_id = p_enrollment_id AND status = 'pendente';
  IF v_prox IS NULL THEN
    UPDATE public.cadence_enrollments SET status = 'concluida', completed_at = now() WHERE id = p_enrollment_id AND status = 'ativa';
    RETURN;
  END IF;
  SELECT cs.delay_days INTO v_delay FROM public.cadence_steps cs WHERE cs.cadence_id = v_e.cadence_id AND cs.step_number = v_prox;
  UPDATE public.cadence_enrollment_steps SET scheduled_at = now() + COALESCE(v_delay, 0) * interval '1 day'
   WHERE enrollment_id = p_enrollment_id AND step_number = v_prox AND scheduled_at IS NULL;
  UPDATE public.cadence_enrollments SET current_step_number = v_prox WHERE id = p_enrollment_id;
END;
$$;
REVOKE ALL ON FUNCTION internal.cadence_avancar(UUID) FROM PUBLIC, anon, authenticated;

-- Pausa a inscrição por um motivo e avisa o dono (uma vez).
CREATE OR REPLACE FUNCTION internal.cadence_pausar(p_enrollment_id UUID, p_motivo TEXT, p_texto TEXT)
RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_e public.cadence_enrollments;
BEGIN
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF v_e.status <> 'ativa' THEN RETURN; END IF;
  UPDATE public.cadence_enrollments SET status = 'pausada', paused_at = now(), pause_reason = p_motivo WHERE id = p_enrollment_id;
  PERFORM public.audit_write(v_e.workspace_id, NULL, 'cadence.enrollment_paused', 'cadence_enrollment', p_enrollment_id::text,
    jsonb_build_object('motivo', p_motivo));
  IF v_e.owner_member_id IS NOT NULL THEN
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (v_e.workspace_id, v_e.owner_member_id, 'cadencia_pausada', 'Uma cadência foi pausada', p_texto, 'cadence_enrollment', p_enrollment_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION internal.cadence_pausar(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- inscrição (tela)
CREATE OR REPLACE FUNCTION public.cadence_enroll(p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dono UUID;
  v_existente UUID;
  v_id UUID;
  v_escopo TEXT;
  v_primeiro INTEGER;
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

  SELECT id INTO v_existente FROM public.cadence_enrollments
   WHERE cadence_id = p_cadence_id AND contact_id = p_contact_id AND status IN ('ativa', 'pausada', 'pausada_resposta') LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'unchanged', 'enrollment_id', v_existente);
  END IF;

  INSERT INTO public.cadence_enrollments (workspace_id, cadence_id, contact_id, owner_member_id)
  VALUES (p_workspace_id, p_cadence_id, p_contact_id, v_dono) RETURNING id INTO v_id;

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

  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.enrolled', 'cadence_enrollment', v_id::text,
    jsonb_build_object('cadence_id', p_cadence_id, 'contact_id', p_contact_id));
  RETURN jsonb_build_object('action', 'enrolled', 'enrollment_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.cadence_enroll(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_enroll(UUID, UUID, UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.cadence_enroll IS 'Inscreve um contato numa cadência. BDR só em contatos das próprias contas (cadences.edit own).';

-- ---------------------------------------------------------------- liga/desliga o envio automático (tela)
CREATE OR REPLACE FUNCTION public.cadence_set_auto(p_workspace_id UUID, p_member_id UUID, p_enrollment_id UUID, p_on BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_e public.cadence_enrollments;
  v_escopo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'cadences.auto');
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = p_enrollment_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR v_escopo NOT IN ('all', 'own') OR (v_escopo = 'own' AND v_e.owner_member_id IS DISTINCT FROM p_member_id) THEN
    RAISE EXCEPTION 'Você não pode mudar o envio automático desta inscrição.' USING ERRCODE = '42501';
  END IF;
  IF v_e.auto_send = p_on THEN
    RETURN jsonb_build_object('action', 'unchanged', 'auto_send', p_on);
  END IF;
  UPDATE public.cadence_enrollments SET auto_send = p_on WHERE id = p_enrollment_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.auto_send_changed', 'cadence_enrollment', p_enrollment_id::text, jsonb_build_object('auto_send', p_on));
  RETURN jsonb_build_object('action', 'updated', 'auto_send', p_on);
END;
$$;
REVOKE ALL ON FUNCTION public.cadence_set_auto(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_set_auto(UUID, UUID, UUID, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.cadence_set_auto IS 'Liga/desliga o envio automático de uma inscrição. BDR só nas próprias (cadences.auto own).';

-- ---------------------------------------------------------------- worker: o que venceu
CREATE OR REPLACE FUNCTION public.cadence_claim_due(p_limit INTEGER DEFAULT 20, p_include_auto BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('enrollment_id', q.enrollment_id, 'step_number', q.step_number) ORDER BY q.scheduled_at), '[]'::jsonb)
  FROM (
    SELECT e.id AS enrollment_id, s.step_number, s.scheduled_at
      FROM public.cadence_enrollments e
      JOIN public.cadences c ON c.id = e.cadence_id AND c.status = 'ativa'
      JOIN LATERAL (
        SELECT es.* FROM public.cadence_enrollment_steps es
         WHERE es.enrollment_id = e.id AND es.status = 'pendente' ORDER BY es.step_number LIMIT 1
      ) s ON true
      JOIN public.cadence_steps cs ON cs.cadence_id = e.cadence_id AND cs.step_number = s.step_number
     WHERE e.status = 'ativa'
       AND s.scheduled_at <= now()
       AND (s.next_attempt_at IS NULL OR s.next_attempt_at <= now())
       AND (p_include_auto OR cs.execution_mode = 'manual' OR NOT e.auto_send)
     ORDER BY s.scheduled_at
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 200))
  ) q;
$$;
REVOKE ALL ON FUNCTION public.cadence_claim_due(INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_claim_due(INTEGER, BOOLEAN) TO service_role;
COMMENT ON FUNCTION public.cadence_claim_due IS 'Worker: passos vencidos de inscrições ativas (o primeiro pendente de cada uma). Só backend.';

-- ---------------------------------------------------------------- worker: fase 1
CREATE OR REPLACE FUNCTION public.cadence_prepare_step(p_enrollment_id UUID, p_step_number INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_e public.cadence_enrollments;
  v_s public.cadence_enrollment_steps;
  v_def public.cadence_steps;
  v_cad public.cadences;
  v_contato public.contacts;
  v_menor INTEGER;
  v_dono UUID;
  v_assunto TEXT;
  v_corpo TEXT;
  v_estado TEXT;
  v_provedores TEXT[];
  v_conta public.messaging_accounts;
  v_destino TEXT;
  v_gate JSONB;
  v_exec UUID;
  v_reserva JSONB;
  v_tarefa UUID;
  v_chave TEXT;
  v_custo CONSTANT INTEGER := 4;
  v_motivo TEXT;
BEGIN
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND OR v_e.status <> 'ativa' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'enrollment_not_active');
  END IF;
  SELECT * INTO v_s FROM public.cadence_enrollment_steps WHERE enrollment_id = p_enrollment_id AND step_number = p_step_number FOR UPDATE;
  IF NOT FOUND OR v_s.status <> 'pendente' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'step_not_pending');
  END IF;
  SELECT min(step_number) INTO v_menor FROM public.cadence_enrollment_steps WHERE enrollment_id = p_enrollment_id AND status = 'pendente';
  IF v_menor <> p_step_number THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'not_next_step');
  END IF;
  IF v_s.scheduled_at IS NULL OR v_s.scheduled_at > now() THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'not_due');
  END IF;
  IF v_s.next_attempt_at IS NOT NULL AND v_s.next_attempt_at > now() THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'waiting_retry');
  END IF;
  SELECT * INTO v_cad FROM public.cadences WHERE id = v_e.cadence_id;
  IF v_cad.status <> 'ativa' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'cadence_not_active');
  END IF;
  SELECT * INTO v_def FROM public.cadence_steps WHERE cadence_id = v_e.cadence_id AND step_number = p_step_number;
  SELECT * INTO v_contato FROM public.contacts WHERE id = v_e.contact_id;
  v_dono := v_e.owner_member_id;
  v_assunto := COALESCE(v_s.custom_subject, v_def.subject);
  v_corpo := COALESCE(v_s.custom_body, v_def.body);
  v_chave := p_enrollment_id::text || ':' || p_step_number::text;

  -- Passo manual, ou automático com o envio automático desligado: vira tarefa do responsável, no dia.
  IF v_def.execution_mode = 'manual' OR NOT v_e.auto_send THEN
    IF v_dono IS NULL THEN
      PERFORM internal.cadence_pausar(p_enrollment_id, 'sem_responsavel', 'A cadência foi pausada porque a inscrição não tem responsável.');
      RETURN jsonb_build_object('action', 'blocked', 'reason', 'no_owner');
    END IF;
    IF v_s.task_id IS NULL THEN
      INSERT INTO public.tasks (workspace_id, title, channel, account_id, contact_id, assignee_member_id, due_at, source, note)
      VALUES (v_e.workspace_id, format('%s · %s (passo %s)', v_cad.name, v_contato.name, p_step_number), v_def.channel, v_contato.account_id, v_e.contact_id, v_dono, now(), 'cadencia', v_corpo)
      RETURNING id INTO v_tarefa;
      UPDATE public.cadence_enrollment_steps SET task_id = v_tarefa, status = 'executado', executed_at = now() WHERE id = v_s.id;
      PERFORM internal.cadence_avancar(p_enrollment_id);
      RETURN jsonb_build_object('action', 'task_created', 'task_id', v_tarefa);
    END IF;
    RETURN jsonb_build_object('action', 'skip', 'reason', 'task_exists');
  END IF;

  -- Passo automático. Um envio por vez para a mesma inscrição+passo.
  IF EXISTS (SELECT 1 FROM public.executions WHERE metadata_json->>'cadence_key' = v_chave AND status = 'running') THEN
    RETURN jsonb_build_object('action', 'in_flight');
  END IF;
  IF v_dono IS NULL THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, 'sem_responsavel', 'A cadência foi pausada porque a inscrição não tem responsável.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'no_owner');
  END IF;

  -- Agente que escreve e envia (Lia, copy) pausado pelo cliente: não envia, avisa uma vez, tenta de novo mais tarde.
  SELECT estado INTO v_estado FROM public.workspace_agents WHERE workspace_id = v_e.workspace_id AND agent_code = 'copy';
  v_motivo := NULL;
  IF v_estado = 'pausado' THEN
    v_motivo := 'agent_paused';
  ELSE
    v_provedores := CASE v_def.channel WHEN 'email' THEN ARRAY['google', 'microsoft', 'imap'] ELSE ARRAY[v_def.channel] END;
    SELECT * INTO v_conta FROM public.messaging_accounts
     WHERE member_id = v_dono AND workspace_id = v_e.workspace_id AND provider = ANY (v_provedores) AND status = 'connected'
     ORDER BY connected_at LIMIT 1;
    IF NOT FOUND THEN v_motivo := 'no_connected_account'; END IF;
  END IF;
  IF v_motivo IS NOT NULL THEN
    UPDATE public.cadence_enrollment_steps SET last_error = v_motivo, next_attempt_at = now() + interval '1 hour' WHERE id = v_s.id;
    IF v_s.last_error IS DISTINCT FROM v_motivo THEN
      INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
      VALUES (v_e.workspace_id, v_dono, 'cadencia_bloqueada', 'Um envio da cadência está esperando',
        CASE v_motivo WHEN 'agent_paused' THEN 'O envio automático está parado porque a Lia está pausada. Quando ela voltar, o envio segue sozinho.'
                      ELSE 'O envio automático está parado porque você não tem uma conta conectada para este canal. Conecte na Caixa de entrada.' END,
        'cadence_enrollment', p_enrollment_id);
    END IF;
    RETURN jsonb_build_object('action', 'blocked', 'reason', v_motivo);
  END IF;

  -- Destinatário: e-mail, ou WhatsApp (e, na falta, o telefone do contato).
  SELECT cc.value_normalized INTO v_destino FROM public.contact_channels cc
   WHERE cc.contact_id = v_e.contact_id AND cc.workspace_id = v_e.workspace_id
     AND cc.type = ANY (CASE v_def.channel WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['whatsapp', 'phone'] END)
   ORDER BY CASE cc.type WHEN 'phone' THEN 2 ELSE 1 END, cc."position" LIMIT 1;
  IF v_destino IS NULL THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, 'contato_sem_canal', 'A cadência foi pausada porque o contato não tem o canal deste passo cadastrado.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'contact_without_channel');
  END IF;

  -- Política Hermes (papel, dono do dado, aprovação, créditos). Negada: pausa e avisa; nada é enviado.
  v_gate := public.hermes_evaluate_action(v_e.workspace_id, v_dono, 'cadences.auto', v_dono, v_custo, false,
    format('Envio automático: %s · passo %s', v_cad.name, p_step_number),
    jsonb_build_object('cadence_key', v_chave, 'enrollment_id', p_enrollment_id, 'step_number', p_step_number));
  IF COALESCE((v_gate->>'allowed')::boolean, false) IS NOT TRUE THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, COALESCE(v_gate->>'status', 'denied'),
      'O envio automático foi pausado: ' || COALESCE(v_gate->>'reason', 'a política não autorizou o envio.'));
    RETURN jsonb_build_object('action', 'blocked', 'reason', COALESCE(v_gate->>'status', 'denied'));
  END IF;
  v_exec := (v_gate->>'execution_id')::uuid;

  -- Reserva de créditos (+25% de folga). Sem saldo: a execução morre e a inscrição pausa.
  v_reserva := public.credit_reserve(v_e.workspace_id, v_exec, v_custo, 'Reserva: envio automático da cadência', v_chave || ':a' || (v_s.attempts + 1) || ':reserve');
  IF COALESCE((v_reserva->>'success')::boolean, false) IS NOT TRUE THEN
    UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
    PERFORM internal.cadence_pausar(p_enrollment_id, 'insufficient_credits', 'O envio automático foi pausado: o saldo de créditos não cobre este envio.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'insufficient_credits');
  END IF;

  UPDATE public.executions
     SET status = 'running', agent_code = 'copy', title = format('Cadência %s · passo %s', v_cad.name, p_step_number),
         execution_type = 'Mensagem automática', campaign_name = v_cad.name, reserved_credits = (v_reserva->>'reserved_amount')::int,
         progress = 10,
         metadata_json = metadata_json || jsonb_build_object(
           'cadence_key', v_chave, 'cadence_attempt', v_chave || ':a' || (v_s.attempts + 1), 'enrollment_id', p_enrollment_id, 'step_number', p_step_number,
           'channel', v_def.channel, 'messaging_account_id', v_conta.id, 'contact_id', v_e.contact_id, 'body', v_corpo)
   WHERE id = v_exec;
  UPDATE public.cadence_enrollment_steps SET execution_id = v_exec, last_error = NULL WHERE id = v_s.id;

  RETURN jsonb_build_object('action', 'send', 'execution_id', v_exec, 'channel', v_def.channel, 'recipient', v_destino,
    'subject', v_assunto, 'body', v_corpo, 'unipile_account_id', v_conta.unipile_account_id, 'idempotency_key', v_chave || ':a' || (v_s.attempts + 1));
END;
$$;
REVOKE ALL ON FUNCTION public.cadence_prepare_step(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_prepare_step(UUID, INTEGER) TO service_role;
COMMENT ON FUNCTION public.cadence_prepare_step IS 'Worker, fase 1: decide o que fazer com o passo (tarefa, envio autorizado com créditos reservados, ou bloqueio). Idempotente. Só backend.';

-- ---------------------------------------------------------------- worker: fase 2
CREATE OR REPLACE FUNCTION public.cadence_finish_step(
  p_execution_id UUID, p_ok BOOLEAN, p_external_message_id TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL, p_external_chat_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_x public.executions;
  v_s public.cadence_enrollment_steps;
  v_e public.cadence_enrollments;
  v_conta public.messaging_accounts;
  v_contato public.contacts;
  v_conversa UUID;
  v_chave TEXT;
BEGIN
  SELECT * INTO v_x FROM public.executions WHERE id = p_execution_id FOR UPDATE;
  IF NOT FOUND OR v_x.metadata_json->>'cadence_key' IS NULL THEN
    RETURN jsonb_build_object('action', 'ignored', 'reason', 'execution_not_found');
  END IF;
  IF v_x.status <> 'running' THEN
    RETURN jsonb_build_object('action', 'unchanged');
  END IF;
  SELECT * INTO v_s FROM public.cadence_enrollment_steps WHERE execution_id = p_execution_id FOR UPDATE;
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = (v_x.metadata_json->>'enrollment_id')::uuid FOR UPDATE;
  v_chave := v_x.metadata_json->>'cadence_attempt';

  IF p_ok THEN
    PERFORM public.credit_consume(v_x.workspace_id, p_execution_id, 4, v_x.reserved_credits, 'Envio automático da cadência', v_chave || ':consume');
    UPDATE public.executions SET status = 'completed', actual_credits = 4, progress = 100, processed_count = 1, valid_count = 1 WHERE id = p_execution_id;
    UPDATE public.cadence_enrollment_steps SET status = 'executado', executed_at = now(), last_error = NULL WHERE id = v_s.id;

    -- A mensagem enviada aparece na conversa (as respostas chegam na mesma conversa).
    IF p_external_chat_id IS NOT NULL AND p_external_message_id IS NOT NULL THEN
      SELECT * INTO v_conta FROM public.messaging_accounts WHERE id = (v_x.metadata_json->>'messaging_account_id')::uuid;
      SELECT * INTO v_contato FROM public.contacts WHERE id = (v_x.metadata_json->>'contact_id')::uuid;
      INSERT INTO public.conversations (workspace_id, contact_id, account_id, messaging_account_id, channel, external_chat_id, unread, last_message_at)
      VALUES (v_x.workspace_id, v_contato.id, v_contato.account_id, v_conta.id, v_x.metadata_json->>'channel', p_external_chat_id, false, now())
      ON CONFLICT (messaging_account_id, external_chat_id) DO UPDATE SET last_message_at = now()
      RETURNING id INTO v_conversa;
      INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by, cadence_step_execution_id)
      VALUES (v_x.workspace_id, v_conversa, 'out', v_conta.unipile_account_id || ':' || p_external_message_id, COALESCE(v_x.metadata_json->>'body', ''), 'automation', p_execution_id)
      ON CONFLICT (external_message_id) DO NOTHING;
    END IF;

    PERFORM public.audit_write(v_x.workspace_id, NULL, 'cadence.step_sent', 'cadence_enrollment', v_e.id::text,
      jsonb_build_object('step_number', v_s.step_number, 'execution_id', p_execution_id, 'channel', v_x.metadata_json->>'channel'));
    PERFORM internal.cadence_avancar(v_e.id);
    RETURN jsonb_build_object('action', 'sent');
  END IF;

  -- Falhou: não cobra (consumo 0 libera a reserva inteira), tenta de novo mais tarde, e desiste depois de 3.
  PERFORM public.credit_consume(v_x.workspace_id, p_execution_id, 0, v_x.reserved_credits, 'Liberação: envio da cadência falhou', v_chave || ':release');
  UPDATE public.executions SET status = 'failed', progress = 100,
         errors = errors || jsonb_build_array(jsonb_build_object('erro', COALESCE(left(p_error, 300), 'falha no envio'))) WHERE id = p_execution_id;
  UPDATE public.cadence_enrollment_steps
     SET attempts = attempts + 1, last_error = COALESCE(left(p_error, 300), 'falha no envio'),
         next_attempt_at = now() + (attempts + 1) * interval '15 minutes'
   WHERE id = v_s.id;
  IF v_s.attempts + 1 >= 3 THEN
    PERFORM internal.cadence_pausar(v_e.id, 'falha_envio', 'A cadência foi pausada: o envio falhou 3 vezes. Veja a conexão da sua conta e retome.');
  END IF;
  RETURN jsonb_build_object('action', 'failed');
END;
$$;
REVOKE ALL ON FUNCTION public.cadence_finish_step(UUID, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_finish_step(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO service_role;
COMMENT ON FUNCTION public.cadence_finish_step IS 'Worker, fase 2: consome os créditos e avança a inscrição, ou libera a reserva e agenda nova tentativa. Idempotente. Só backend.';
