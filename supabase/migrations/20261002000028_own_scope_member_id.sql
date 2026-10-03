-- ==============================================================================
-- Migration: 20261002000028_own_scope_member_id.sql
-- Escopo "own": o dono do dado e o id do membro (owner_member_id),
-- nao o id de login (auth.uid()). Sem dono informado, a pergunta continua
-- verdadeira para listas e politicas que nao apontam um registro.
-- A checagem 2 do Hermes usa o mesmo criterio: o membro que age.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_permission(
  p_workspace_id UUID,
  p_capability_key TEXT,
  p_target_owner_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_scope TEXT;
BEGIN
  -- Superadmin has unrestricted platform-wide access
  IF public.is_superadmin() THEN
    SELECT scope INTO v_scope
    FROM public.role_permissions
    WHERE role_id = 'superadmin' AND capability_key = p_capability_key;
    
    IF v_scope IN ('all', 'assigned', 'own', 'read') THEN
      RETURN true;
    END IF;
  END IF;

  -- Determine user role in target workspace
  SELECT wm.role INTO v_role
  FROM public.workspace_members wm
  INNER JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.status = 'active'
    AND w.status = 'active';

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Lookup capability scope for role
  SELECT rp.scope INTO v_scope
  FROM public.role_permissions rp
  WHERE rp.role_id = v_role AND rp.capability_key = p_capability_key;

  IF v_scope IS NULL OR v_scope = 'none' THEN
    RETURN false;
  ELSIF v_scope = 'all' THEN
    RETURN true;
  ELSIF v_scope = 'assigned' THEN
    RETURN true; -- User is an active member of this workspace
  ELSIF v_scope = 'own' THEN
    IF p_target_owner_id IS NULL THEN
      RETURN true;
    END IF;
    -- O dono do dado e um membro (owner_member_id), nunca o id de login.
    RETURN EXISTS (
      SELECT 1
      FROM public.workspace_members dono
      WHERE dono.id = p_target_owner_id
        AND dono.workspace_id = p_workspace_id
        AND dono.user_id = auth.uid()
        AND dono.status = 'active'
    );
  ELSIF v_scope = 'read' THEN
    RETURN true;
  ELSIF v_scope = 'request' THEN
    RETURN false; -- Direct execution forbidden; requires approval workflow
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


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
  v_gate JSONB;
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
  IF v_scope = 'own' AND p_target_owner_id IS NOT NULL AND p_target_owner_id != p_member_id THEN
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
  v_gate := public.hermes_credit_gate(p_workspace_id, p_member_id, p_capability_key, p_estimated_credits, p_is_spend, p_action_title, p_payload);
  IF v_gate IS NOT NULL THEN
    PERFORM public.hermes_record_audit(p_workspace_id, v_user_id, p_capability_key, v_gate);
    RETURN v_gate;
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
