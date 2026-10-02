-- ==============================================================================
-- Migration: 20261002000009_hermes_policy_engine.sql
-- Ticket 02: Função de Política do Hermes: As 4 Checagens, Auditoria e Notificações
-- ==============================================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recipient_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS 'Notificações funcionais direcionadas especificamente ao membro responsável.';

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON public.notifications (recipient_member_id, read_at) WHERE read_at IS NULL;

-- 2. Create approvals table with category (operacao vs gasto) and payload_hash
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('operacao', 'gasto')),
  title TEXT NOT NULL,
  description TEXT,
  requested_by_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  decided_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

COMMENT ON TABLE public.approvals IS 'Fila de aprovações com categoria de gasto ou operação e hash para invalidar uso de alteração.';

CREATE INDEX IF NOT EXISTS idx_approvals_workspace_status 
  ON public.approvals (workspace_id, status);

-- 3. Create executions table (central operational ledger of agent & tool runs)
CREATE TABLE IF NOT EXISTS public.executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_code TEXT CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops') OR agent_code IS NULL),
  capability_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'pending_approval', 'pending_credits')),
  requested_by_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  estimated_credits INTEGER NOT NULL DEFAULT 0,
  actual_credits INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.executions IS 'Rastreabilidade atômica de todas as execuções iniciadas por clique, agente ou evento.';

CREATE TRIGGER set_executions_updated_at
  BEFORE UPDATE ON public.executions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_executions_workspace_status 
  ON public.executions (workspace_id, status);

-- 4. Enable RLS on notifications, approvals and executions
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    recipient_member_id IN (
      SELECT id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members see approvals in their workspace"
  ON public.approvals FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

CREATE POLICY "Members see executions in their workspace"
  ON public.executions FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
  );

-- 5. Universal Hermes Evaluation Policy Function (The 4 Sequential Checks)
CREATE OR REPLACE FUNCTION public.hermes_evaluate_action(
  p_workspace_id UUID,
  p_member_id UUID,
  p_capability_key TEXT,
  p_target_owner_id UUID DEFAULT NULL,
  p_estimated_credits INTEGER DEFAULT 0,
  p_is_spend BOOLEAN DEFAULT false,
  p_action_title TEXT DEFAULT 'Ação do Sistema',
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.hermes_evaluate_action IS 
  'Motor de checagem universal do Hermes: chave de papel -> dono do dado -> aprovação -> créditos.';

-- 6. Helper procedure to log Hermes decisions into audit_logs
CREATE OR REPLACE FUNCTION public.hermes_record_audit(
  p_workspace_id UUID,
  p_user_id UUID,
  p_capability_key TEXT,
  p_decision JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    diff_json
  ) VALUES (
    p_workspace_id,
    p_user_id,
    'hermes.evaluation',
    'capability',
    p_capability_key,
    p_decision
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
