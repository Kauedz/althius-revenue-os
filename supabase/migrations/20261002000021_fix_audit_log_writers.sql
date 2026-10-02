-- ==============================================================================
-- Migration: 20261002000021_fix_audit_log_writers.sql
-- Correção: quatro funções gravavam em colunas inexistentes de audit_logs
-- (user_id, action_type, resource_type, resource_id, diff_json). Toda chamada
-- ao Hermes (hermes_evaluate_action -> hermes_record_audit) quebrava com 42703.
-- Agora todas usam public.audit_write, que grava nas colunas reais da tabela.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.audit_write(
  p_workspace_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_ref TEXT,
  p_new_values JSONB
)
RETURNS VOID AS $$
DECLARE
  v_member_id UUID;
  v_role TEXT;
  v_entity_id UUID;
BEGIN
  IF p_actor_user_id IS NOT NULL THEN
    SELECT wm.id, wm.role INTO v_member_id, v_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_actor_user_id
    LIMIT 1;
  END IF;

  IF p_entity_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_entity_id := p_entity_ref::uuid;
  END IF;

  INSERT INTO public.audit_logs (
    workspace_id, actor_user_id, actor_member_id, actor_role,
    action, entity_type, entity_id, new_values
  ) VALUES (
    p_workspace_id, p_actor_user_id, v_member_id, COALESCE(v_role, 'system'),
    p_action, p_entity_type, v_entity_id,
    COALESCE(p_new_values, '{}'::jsonb) || jsonb_build_object('entity_ref', p_entity_ref)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.audit_write(UUID, UUID, TEXT, TEXT, TEXT, JSONB) IS
  'Ponto único de escrita na auditoria imutável. Resolve membro e papel do autor no workspace.';

-- hermes_record_audit (origem: 20261002000009_hermes_policy_engine.sql)
CREATE OR REPLACE FUNCTION public.hermes_record_audit(
  p_workspace_id UUID,
  p_user_id UUID,
  p_capability_key TEXT,
  p_decision JSONB
)
RETURNS VOID AS $$
BEGIN
  PERFORM public.audit_write(
    p_workspace_id,
    p_user_id,
    'hermes.evaluation',
    'capability',
    (p_capability_key)::text,
    p_decision
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- approval_decide (origem: 20261002000011_approvals_workflow.sql)
CREATE OR REPLACE FUNCTION public.approval_decide(
  p_approval_id UUID,
  p_decider_member_id UUID,
  p_decision TEXT,
  p_payload_to_verify JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_approval RECORD;
  v_decider RECORD;
  v_computed_hash TEXT;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- task_send_now (origem: 20261002000015_cadences_and_tasks.sql)
CREATE OR REPLACE FUNCTION public.task_send_now(
  p_task_id UUID,
  p_member_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_task RECORD;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- log_superadmin_inbox_access (origem: 20261002000019_code_review_refinements.sql)
CREATE OR REPLACE FUNCTION public.log_superadmin_inbox_access(p_conversation_id UUID)
RETURNS VOID AS $$
DECLARE
  v_conv RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF public.is_superadmin() THEN
    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF FOUND THEN
      PERFORM public.audit_write(
    v_conv.workspace_id,
    v_user_id,
    'inbox.superadmin_read',
    'conversation',
    (p_conversation_id)::text,
    jsonb_build_object(
          'account_id', v_conv.account_id,
          'contact_id', v_conv.contact_id,
          'channel', v_conv.channel,
          'timestamp', now()
        )
  );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
