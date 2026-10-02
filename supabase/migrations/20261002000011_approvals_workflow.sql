-- ==============================================================================
-- Migration: 20261002000011_approvals_workflow.sql
-- Ticket 04: Aprovações com Categoria (Operação vs. Gasto) e Payload Hash
-- ==============================================================================

-- 1. Stored Procedure: approval_decide (Validates decider role, payload hash, and enforces single-use)
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
  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    diff_json
  ) VALUES (
    v_approval.workspace_id,
    v_decider.user_id,
    'approval.decided',
    'approval',
    p_approval_id::text,
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

COMMENT ON FUNCTION public.approval_decide IS 
  'Decide aprovações garantindo regra de gasto, integridade de hash e uso único.';
