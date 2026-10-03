-- ==============================================================================
-- Migration: 20261002000025_approvals_details.sql
-- Aprovações com o que a tela mostra (tipo, motivo, impacto, prévia, créditos, prazo,
-- histórico), decisão "Solicitar ajustes" e leitura restrita a quem decide ou pediu.
-- ==============================================================================

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS approval_type TEXT
    CHECK (approval_type IN ('copy', 'lista', 'crm', 'execucao', 'orcamento', 'execucao_limite', 'creditos')),
  ADD COLUMN IF NOT EXISTS agent_code TEXT
    CHECK (agent_code IS NULL OR agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS impact TEXT,
  ADD COLUMN IF NOT EXISTS preview TEXT,
  ADD COLUMN IF NOT EXISTS estimated_credits INTEGER NOT NULL DEFAULT 0 CHECK (estimated_credits >= 0),
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Sem tipo informado (ex.: pedido criado pelo Hermes), o tipo segue a categoria:
-- gasto -> "Execução acima de limite"; operação -> "Execução".
UPDATE public.approvals
SET approval_type = CASE WHEN category = 'gasto' THEN 'execucao_limite' ELSE 'execucao' END
WHERE approval_type IS NULL;
ALTER TABLE public.approvals ALTER COLUMN approval_type SET NOT NULL;

CREATE OR REPLACE FUNCTION public.approvals_tipo_padrao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_type IS NULL THEN
    NEW.approval_type := CASE WHEN NEW.category = 'gasto' THEN 'execucao_limite' ELSE 'execucao' END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER approvals_tipo_padrao
  BEFORE INSERT ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.approvals_tipo_padrao();

-- Quem paga decide o gasto: tipo de gasto <=> categoria gasto
ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_tipo_categoria_coerentes
  CHECK ((approval_type IN ('orcamento', 'execucao_limite', 'creditos')) = (category = 'gasto'));

ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_status_check;
ALTER TABLE public.approvals
  ADD CONSTRAINT approvals_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'ajustes_solicitados'));

-- Leitura: quem decide (superadmin, estrategista, C-level) ou quem pediu
DROP POLICY IF EXISTS "Members see approvals in their workspace" ON public.approvals;
CREATE POLICY "Quem decide ou quem pediu lê a aprovação"
  ON public.approvals FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_workspace_role(workspace_id, ARRAY['estrategista', 'clevel'])
    OR requested_by_member_id IN (SELECT wm.id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
  );

-- approval_decide: aceita "ajustes_solicitados" (com texto), grava observação e histórico
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
  IF p_decision NOT IN ('aprovado', 'rejeitado', 'ajustes_solicitados') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_decision',
      'reason', 'A decisão deve ser "aprovado", "rejeitado" ou "ajustes_solicitados".'
    );
  END IF;

  IF p_decision = 'ajustes_solicitados' AND COALESCE(trim(p_notes), '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'ajuste_sem_texto',
      'reason', 'Diga o que precisa ser ajustado.'
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
      decided_at = now(),
      decision_notes = NULLIF(trim(p_notes), ''),
      history = history || jsonb_build_array(
        to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' ' ||
        CASE p_decision WHEN 'aprovado' THEN 'Aprovada' WHEN 'rejeitado' THEN 'Rejeitada' ELSE 'Ajustes solicitados' END ||
        ' por ' || COALESCE((SELECT p.name FROM public.profiles p WHERE p.id = v_decider.user_id), v_decider.role)
      )
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
    CASE p_decision WHEN 'aprovado' THEN 'approval_granted' WHEN 'rejeitado' THEN 'approval_rejected' ELSE 'approval_changes_requested' END,
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
