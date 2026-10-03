-- ==============================================================================
-- Migration: 20261002000023_rpc_security_hardening.sql
-- Segurança das funções chamadas pela API (PostgREST /rpc).
-- Antes: as 19 funções SECURITY DEFINER eram executáveis por qualquer um, inclusive
-- sem login (anon): consumir créditos, escrever auditoria, injetar mensagem de webhook,
-- aprovar gasto passando o id de outro membro, ler o funil de outro workspace.
-- Agora:
--  1. Ninguém executa função do schema public por padrão (inclusive funções futuras).
--  2. Helpers usados pela RLS: anon e authenticated (só leem o próprio auth.uid()).
--  3. Ações de usuário: só authenticated, e o membro informado precisa ser quem chama.
--  4. Funções de sistema (créditos, auditoria, webhooks, coleta): só service_role (backend).
-- ==============================================================================

-- Quem chama em nome de um membro precisa ser esse membro.
-- Chamada interna/backend (sem usuário no JWT, ex.: service_role ou outra função) passa.
CREATE OR REPLACE FUNCTION public.assert_caller_is_member(p_member_id UUID)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = p_member_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'O membro informado não pertence a quem está logado.' USING ERRCODE = '42501';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- approval_decide: confere que p_decider_member_id é quem está logado
CREATE OR REPLACE FUNCTION public.approval_decide(p_approval_id uuid, p_decider_member_id uuid, p_decision text, p_payload_to_verify jsonb, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_approval RECORD;
  v_decider RECORD;
  v_computed_hash TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_decider_member_id);
  -- Validate decision input
  IF p_decision NOT IN ('aprovado', 'rejeitado') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_decision',
      'reason', 'A decisão deve ser "aprovado" ou "rejeitado".'
    );
  END IF;

  -- Lock approval row
  SELECT * INTO v_approval 
  FROM public.approvals 
  WHERE id = p_approval_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'approval_not_found',
      'reason', 'Solicitação de aprovação não encontrada.'
    );
  END IF;

  -- Enforce Single-Use
  IF v_approval.status != 'pendente' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'approval_already_processed',
      'reason', format('Esta aprovação já foi processada com o status "%s" e é de uso único.', v_approval.status)
    );
  END IF;

  -- Fetch decider member details
  SELECT wm.user_id, wm.role, wm.workspace_id
  INTO v_decider
  FROM public.workspace_members wm
  WHERE wm.id = p_decider_member_id AND wm.status = 'active';

  IF v_decider.role IS NULL OR v_decider.workspace_id != v_approval.workspace_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_decider',
      'reason', 'Membro decisor inválido ou fora do workspace da aprovação.'
    );
  END IF;

  -- Enforce Financial Authority ("Quem paga decide o gasto")
  IF v_approval.category = 'gasto' THEN
    IF v_decider.role NOT IN ('superadmin', 'clevel') THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized_decider_for_spend',
        'reason', 'Apenas C-level ou Superadmin possuem autorização para decidir aprovações de gasto financeiro.'
      );
    END IF;
  ELSE
    -- Operation category
    IF v_decider.role NOT IN ('superadmin', 'clevel', 'estrategista') THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized_decider_for_operation',
        'reason', 'O papel não possui permissão para aprovar operações de agentes/copy.'
      );
    END IF;
  END IF;

  -- Enforce Cryptographic Payload Hash Integrity
  v_computed_hash := encode(digest(p_payload_to_verify::text, 'sha256'), 'hex');

  IF v_computed_hash != v_approval.payload_hash THEN
    -- Invalidate approval upon tampering
    UPDATE public.approvals
    SET status = 'rejeitado',
        decided_by_member_id = p_decider_member_id,
        decided_at = now()
    WHERE id = p_approval_id;

    INSERT INTO public.notifications (
      workspace_id,
      recipient_member_id,
      type,
      title,
      body,
      entity_type,
      entity_id
    ) VALUES (
      v_approval.workspace_id,
      v_approval.requested_by_member_id,
      'approval_invalidated',
      'Aprovação invalidada por divergência de conteúdo',
      'O conteúdo da ação foi alterado após o envio, violando a integridade criptográfica.',
      'approval',
      p_approval_id
    );

    RETURN jsonb_build_object(
      'success', false,
      'status', 'payload_tampered_hash_mismatch',
      'reason', 'O payload não corresponde ao hash registrado. A aprovação foi automaticamente invalidada.'
    );
  END IF;

  -- Update approval state
  UPDATE public.approvals
  SET status = p_decision,
      decided_by_member_id = p_decider_member_id,
      decided_at = now()
  WHERE id = p_approval_id;

  -- Notify requester about decision
  INSERT INTO public.notifications (
    workspace_id,
    recipient_member_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  ) VALUES (
    v_approval.workspace_id,
    v_approval.requested_by_member_id,
    CASE WHEN p_decision = 'aprovado' THEN 'approval_granted' ELSE 'approval_rejected' END,
    format('Solicitação %s: %s', p_decision, v_approval.title),
    COALESCE(p_notes, format('Sua solicitação de %s foi avaliada por %s.', v_approval.category, v_decider.role)),
    'approval',
    p_approval_id
  );

  -- Record in audit logs
  PERFORM public.audit_write(
    v_approval.workspace_id,
    v_decider.user_id,
    'approval.decided',
    'approval',
    (p_approval_id::text)::text,
    jsonb_build_object(
      'category', v_approval.category,
      'decision', p_decision,
      'title', v_approval.title,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', p_decision,
    'approval_id', p_approval_id
  );
END;
$function$;

-- hermes_evaluate_action: confere que p_member_id é quem está logado
CREATE OR REPLACE FUNCTION public.hermes_evaluate_action(p_workspace_id uuid, p_member_id uuid, p_capability_key text, p_target_owner_id uuid DEFAULT NULL::uuid, p_estimated_credits integer DEFAULT 0, p_is_spend boolean DEFAULT false, p_action_title text DEFAULT 'Ação do Sistema'::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_scope TEXT;
  v_approval_id UUID := NULL;
  v_execution_id UUID := NULL;
  v_hash TEXT;
  v_clevel_member_id UUID;
  v_result JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  -- Retrieve member context
  SELECT wm.user_id, wm.role
  INTO v_user_id, v_role
  FROM public.workspace_members wm
  WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';

  IF v_role IS NULL THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'status', 'denied_role',
      'reason', 'Membro não encontrado ou inativo no workspace.'
    );
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
    RETURN v_result;
  END IF;

  -- ============================================================================
  -- CHECK 1: O papel tem a chave técnica na matriz de capacidades?
  -- ============================================================================
  SELECT rp.scope INTO v_scope
  FROM public.role_permissions rp
  WHERE rp.role_id = v_role AND rp.capability_key = p_capability_key;

  IF v_scope IS NULL OR v_scope = 'none' THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'status', 'denied_role',
      'reason', format('O papel "%s" não possui autorização para a capacidade "%s".', v_role, p_capability_key)
    );
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
    RETURN v_result;
  END IF;

  -- ============================================================================
  -- CHECK 2: O usuário é o dono do dado ("Só o seu" / "Atribuídos")?
  -- ============================================================================
  IF v_scope = 'own' AND p_target_owner_id IS NOT NULL AND p_target_owner_id != v_user_id THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'status', 'denied_owner',
      'reason', 'Acesso negado: a capacidade é restrita exclusivamente aos itens sob sua titularidade.'
    );
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
    RETURN v_result;
  END IF;

  -- ============================================================================
  -- CHECK 3: Precisa de decisão de alguém (Pede, Gasto financeiro ou Acima do teto)?
  -- ============================================================================
  IF v_scope = 'request' OR (p_is_spend AND v_role NOT IN ('superadmin', 'clevel')) THEN
    -- Calculate SHA-256 payload hash to ensure single-use integrity
    v_hash := encode(digest(p_payload::text, 'sha256'), 'hex');

    -- Insert approval record
    INSERT INTO public.approvals (
      workspace_id,
      category,
      title,
      description,
      requested_by_member_id,
      status,
      payload_json,
      payload_hash
    ) VALUES (
      p_workspace_id,
      CASE WHEN p_is_spend THEN 'gasto' ELSE 'operacao' END,
      p_action_title,
      format('Solicitação pendente de aprovação gerada por %s para a capacidade %s.', v_role, p_capability_key),
      p_member_id,
      'pendente',
      p_payload,
      v_hash
    ) RETURNING id INTO v_approval_id;

    -- Route notification to a C-level member of the workspace (or superadmin if none)
    SELECT wm.id INTO v_clevel_member_id
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id 
      AND wm.role IN ('clevel', 'superadmin')
      AND wm.status = 'active'
    ORDER BY CASE WHEN wm.role = 'clevel' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_clevel_member_id IS NOT NULL THEN
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
        v_clevel_member_id,
        'approval_required',
        format('Aprovação de %s pendente: %s', CASE WHEN p_is_spend THEN 'gasto' ELSE 'operação' END, p_action_title),
        format('Uma nova solicitação para a capacidade "%s" foi encaminhada para sua decisão.', p_capability_key),
        'approval',
        v_approval_id
      );
    END IF;

    v_result := jsonb_build_object(
      'allowed', false,
      'status', 'requires_approval',
      'reason', 'A ação requer autorização prévia e foi encaminhada para a fila de Aprovações.',
      'approval_id', v_approval_id
    );
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
    RETURN v_result;
  END IF;

  -- ============================================================================
  -- CHECK 4: Cabe nos créditos (Saldo e limite configurado)?
  -- ============================================================================
  -- Note: Detailed ledger balance verification and wallet reserve deduction is executed in Ticket 03.
  -- Here we ensure the baseline check does not permit negative consumption.
  IF p_estimated_credits < 0 THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'status', 'insufficient_credits',
      'reason', 'Estimativa de créditos inválida.'
    );
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
    RETURN v_result;
  END IF;

  -- ============================================================================
  -- ALL 4 CHECKS PASSED: Criar Execução e Autorizar
  -- ============================================================================
  INSERT INTO public.executions (
    workspace_id,
    capability_key,
    status,
    requested_by_member_id,
    estimated_credits,
    metadata_json
  ) VALUES (
    p_workspace_id,
    p_capability_key,
    'pending',
    p_member_id,
    p_estimated_credits,
    p_payload
  ) RETURNING id INTO v_execution_id;

  v_result := jsonb_build_object(
    'allowed', true,
    'status', 'authorized',
    'reason', 'Ação autorizada com sucesso pelas 4 checagens do Hermes.',
    'execution_id', v_execution_id
  );

  PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_result);
  RETURN v_result;
END;
$function$;

-- task_send_now: confere que p_member_id é quem está logado
CREATE OR REPLACE FUNCTION public.task_send_now(p_task_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_task RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'task_not_found');
  END IF;

  UPDATE public.tasks
  SET status = 'concluida',
      completed_at = now()
  WHERE id = p_task_id;

  -- Record audit
  PERFORM public.audit_write(
    v_task.workspace_id,
    (SELECT user_id FROM public.workspace_members WHERE id = p_member_id),
    'task.send_now',
    'task',
    (p_task_id::text)::text,
    jsonb_build_object('title', v_task.title, 'channel', v_task.channel)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'concluida',
    'task_id', p_task_id
  );
END;
$function$;

-- send_channel_agent_message: confere que p_caller_member_id é quem está logado
CREATE OR REPLACE FUNCTION public.send_channel_agent_message(p_workspace_id uuid, p_caller_member_id uuid, p_channel_id uuid, p_agent_id text, p_user_message text, p_agent_response text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_channel RECORD;
  v_execution_id UUID;
  v_user_msg_id UUID := NULL;
  v_agent_msg_id UUID := NULL;
  v_eval JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_caller_member_id);
  -- Validate member
  SELECT wm.user_id, wm.role INTO v_user_id, v_role
  FROM public.workspace_members wm
  WHERE wm.id = p_caller_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro do workspace inválido ou inativo.' USING ERRCODE = 'P0001';
  END IF;

  -- Validate channel
  SELECT * INTO v_channel 
  FROM public.chat_channels 
  WHERE id = p_channel_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canal não encontrado no workspace informado.' USING ERRCODE = 'P0001';
  END IF;

  -- Verify agent assignment to channel
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_channel_agents
    WHERE channel_id = p_channel_id AND agent_id = p_agent_id
  ) THEN
    RAISE EXCEPTION 'O agente "%" não está atribuído ao canal %.', p_agent_id, v_channel.name USING ERRCODE = 'P0001';
  END IF;

  -- Role boundary check: BDR can only interact with 'comercial' and 'copy'
  IF v_role = 'bdr' AND p_agent_id NOT IN ('comercial', 'copy') THEN
    RAISE EXCEPTION 'BDRs só possuem permissão para interagir com o Agente Comercial e Agente de Copy.' USING ERRCODE = 'P0001';
  END IF;

  -- Hermes policy evaluation for agents.chat (2 credits cost)
  v_eval := public.hermes_evaluate_action(
    p_workspace_id,
    p_caller_member_id,
    'agents.chat',
    v_user_id,
    2,
    false,
    format('Chat com Agente %s no canal #%s', p_agent_id, v_channel.slug),
    jsonb_build_object('channel_id', p_channel_id, 'agent_id', p_agent_id)
  );

  IF (v_eval->>'allowed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Hermes negou a ação: %', (v_eval->>'reason') USING ERRCODE = 'P0001';
  END IF;

  v_execution_id := (v_eval->>'execution_id')::uuid;

  -- Debit 2 credits directly via credit_consume
  PERFORM public.credit_consume(
    p_workspace_id,
    v_execution_id,
    2,
    0,
    format('Conversa com %s no canal #%s', p_agent_id, v_channel.slug),
    p_idempotency_key
  );

  -- Insert user prompt message if provided
  IF p_user_message IS NOT NULL AND length(trim(p_user_message)) > 0 THEN
    INSERT INTO public.chat_messages (
      workspace_id,
      channel_id,
      sender_type,
      sender_member_id,
      content,
      metadata
    ) VALUES (
      p_workspace_id,
      p_channel_id,
      'member',
      p_caller_member_id,
      p_user_message,
      jsonb_build_object('execution_id', v_execution_id)
    ) RETURNING id INTO v_user_msg_id;
  END IF;

  -- Insert agent response message
  INSERT INTO public.chat_messages (
    workspace_id,
    channel_id,
    sender_type,
    sender_agent_id,
    content,
    metadata
  ) VALUES (
    p_workspace_id,
    p_channel_id,
    'agent',
    p_agent_id,
    p_agent_response,
    jsonb_build_object('execution_id', v_execution_id, 'credits_consumed', 2)
  ) RETURNING id INTO v_agent_msg_id;

  RETURN jsonb_build_object(
    'success', true,
    'execution_id', v_execution_id,
    'credits_consumed', 2,
    'user_message_id', v_user_msg_id,
    'agent_message_id', v_agent_msg_id
  );
END;
$function$;

-- get_revenue_funnel_summary: só lê o workspace de quem chama
CREATE OR REPLACE FUNCTION public.get_revenue_funnel_summary(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_pipeline NUMERIC;
  v_weighted_pipeline NUMERIC;
  v_won_amount NUMERIC;
  v_total_leads INTEGER;
  v_stages_json JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.is_superadmin() OR public.is_workspace_member(p_workspace_id)) THEN
    RAISE EXCEPTION 'Sem acesso a este workspace.' USING ERRCODE = '42501';
  END IF;
  -- Sum active pipeline amount
  SELECT 
    COALESCE(SUM(amount), 0.00),
    COALESCE(SUM(amount * win_probability / 100.0), 0.00)
  INTO v_total_pipeline, v_weighted_pipeline
  FROM public.opportunities
  WHERE workspace_id = p_workspace_id AND status = 'ativa';

  -- Sum won amount
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_won_amount
  FROM public.opportunities
  WHERE workspace_id = p_workspace_id AND status = 'ganho';

  -- Sum leads count from campaigns
  SELECT COALESCE(SUM(leads_count), 0)
  INTO v_total_leads
  FROM public.campaigns
  WHERE workspace_id = p_workspace_id;

  -- Build stage totals
  SELECT jsonb_agg(
    jsonb_build_object(
      'stage_key', sd.stage_key,
      'label', sd.slg_label,
      'order_index', sd.order_index,
      'deals_count', COALESCE(counts.deals_count, 0),
      'total_amount', COALESCE(counts.total_amount, 0.00)
    ) ORDER BY sd.order_index
  )
  INTO v_stages_json
  FROM public.stage_definitions sd
  LEFT JOIN (
    SELECT stage_key, count(*) AS deals_count, sum(amount) AS total_amount
    FROM public.opportunities
    WHERE workspace_id = p_workspace_id AND status = 'ativa'
    GROUP BY stage_key
  ) counts ON counts.stage_key = sd.stage_key;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'total_active_pipeline_amount', v_total_pipeline,
    'weighted_pipeline_amount', v_weighted_pipeline,
    'won_revenue_amount', v_won_amount,
    'campaign_leads_count', v_total_leads,
    'stages', COALESCE(v_stages_json, '[]'::jsonb)
  );
END;
$function$;

-- Permissões de execução
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
-- O Postgres dá EXECUTE a PUBLIC em toda função nova por uma regra global (não por schema).
-- Removida para o dono das migrations: toda função nova precisa de GRANT explícito.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Helpers usados dentro das políticas de RLS
GRANT EXECUTE ON FUNCTION
  public.current_workspace_member(),
  public.has_workspace_role(UUID, TEXT[]),
  public.is_workspace_member(UUID),
  public.is_superadmin(),
  public.check_permission(UUID, TEXT, UUID)
TO anon, authenticated;

-- Ações que a tela chama em nome da pessoa logada
GRANT EXECUTE ON FUNCTION
  public.approval_decide(UUID, UUID, TEXT, JSONB, TEXT),
  public.hermes_evaluate_action(UUID, UUID, TEXT, UUID, INTEGER, BOOLEAN, TEXT, JSONB),
  public.task_send_now(UUID, UUID),
  public.send_channel_agent_message(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT),
  public.get_revenue_funnel_summary(UUID),
  public.log_superadmin_inbox_access(UUID)
TO authenticated;

-- Backend (Edge Functions, workers do Hermes) executa tudo
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
