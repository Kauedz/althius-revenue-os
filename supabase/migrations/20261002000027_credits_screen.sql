-- Creditos na tela: compra, regras e checagem 4 do Hermes (saldo, teto e limite mensal).

CREATE OR REPLACE FUNCTION public.hermes_credit_gate(
  p_workspace_id uuid,
  p_member_id uuid,
  p_capability_key text,
  p_estimated_credits integer,
  p_is_spend boolean,
  p_action_title text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $function$
DECLARE
  v_mode text;
  v_teto integer;
  v_limite integer;
  v_recarga boolean;
  v_recarga_qtd integer;
  v_disponivel integer := 0;
  v_consumido integer := 0;
  v_motivo text;
  v_approval_id uuid;
  v_clevel uuid;
  v_hash text;
BEGIN
  IF p_estimated_credits < 0 THEN
    RETURN jsonb_build_object('allowed', false, 'status', 'insufficient_credits', 'reason', 'Estimativa de crÃ©ditos invÃ¡lida.');
  END IF;
  SELECT s.credit_mode, s.approval_threshold, s.monthly_credit_limit, s.auto_topup_enabled, s.auto_topup_amount
    INTO v_mode, v_teto, v_limite, v_recarga, v_recarga_qtd
  FROM public.workspace_settings s WHERE s.workspace_id = p_workspace_id;
  v_mode := COALESCE(v_mode, 'auto');
  v_teto := COALESCE(v_teto, 500);
  v_limite := COALESCE(v_limite, 5000);
  v_recarga := COALESCE(v_recarga, false);
  v_recarga_qtd := COALESCE(v_recarga_qtd, 10000);
  SELECT GREATEST(0, w.allowance_balance + w.topup_balance - w.reserved_balance), w.monthly_consumed
    INTO v_disponivel, v_consumido
  FROM public.credit_wallets w WHERE w.workspace_id = p_workspace_id;
  v_disponivel := COALESCE(v_disponivel, 0);
  v_consumido := COALESCE(v_consumido, 0);
  IF v_mode = 'approval' AND p_estimated_credits > v_teto THEN
    v_motivo := format('Acima do teto de %s crÃ©ditos. O pedido foi para AprovaÃ§Ãµes antes de rodar.', v_teto);
  ELSIF p_estimated_credits > 0 AND (v_consumido + p_estimated_credits) > v_limite THEN
    v_motivo := format('Acima do limite mensal de %s crÃ©ditos. O pedido foi para o C-level.', v_limite);
  ELSIF p_estimated_credits > v_disponivel AND NOT (v_recarga AND (v_disponivel + v_recarga_qtd) >= p_estimated_credits) THEN
    v_motivo := format('Saldo disponÃ­vel insuficiente (%s crÃ©ditos). O pedido foi para o C-level.', v_disponivel);
  ELSE
    RETURN NULL;
  END IF;
  v_hash := encode(extensions.digest(COALESCE(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');
  INSERT INTO public.approvals (workspace_id, category, title, description, requested_by_member_id, status, payload_json, payload_hash, estimated_credits)
  VALUES (p_workspace_id, 'gasto', p_action_title, v_motivo, p_member_id, 'pendente', COALESCE(p_payload, '{}'::jsonb), v_hash, GREATEST(p_estimated_credits, 0))
  RETURNING id INTO v_approval_id;
  SELECT wm.id INTO v_clevel FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.role IN ('clevel', 'superadmin') AND wm.status = 'active'
  ORDER BY CASE WHEN wm.role = 'clevel' THEN 1 ELSE 2 END LIMIT 1;
  IF v_clevel IS NOT NULL THEN
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (p_workspace_id, v_clevel, 'approval_required', 'AprovaÃ§Ã£o de gasto pendente: ' || p_action_title, v_motivo, 'approval', v_approval_id);
  END IF;
  RETURN jsonb_build_object('allowed', false, 'status', 'requires_approval', 'reason', v_motivo, 'approval_id', v_approval_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.hermes_credit_gate(uuid, uuid, text, integer, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_credit_gate(uuid, uuid, text, integer, boolean, text, jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.credit_purchase(p_workspace_id uuid, p_member_id uuid, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $function$
DECLARE
  v_member public.workspace_members%ROWTYPE;
  v_scope text;
  v_approval_id uuid;
  v_hash text;
  v_clevel uuid;
  v_payload jsonb;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_member FROM public.workspace_members WHERE id = p_member_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VocÃª nÃ£o participa deste workspace como membro.' USING ERRCODE = '42501';
  END IF;
  SELECT scope INTO v_scope FROM public.role_permissions WHERE role_id = v_member.role AND capability_key = 'credits.buy';
  IF v_member.role <> 'superadmin' AND v_member.workspace_id <> p_workspace_id THEN
    RAISE EXCEPTION 'VocÃª nÃ£o compra crÃ©ditos neste workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_scope IS NULL OR v_scope = 'none' OR v_scope NOT IN ('all', 'assigned', 'request') THEN
    RAISE EXCEPTION 'Seu papel nÃ£o compra crÃ©ditos.' USING ERRCODE = '42501';
  END IF;
  IF p_amount NOT IN (10000, 25000, 50000, 100000) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Pacote de crÃ©ditos nÃ£o reconhecido.');
  END IF;
  v_payload := jsonb_build_object('creditos', p_amount);
  IF v_scope = 'request' THEN
    v_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');
    INSERT INTO public.approvals (workspace_id, category, approval_type, title, description, requested_by_member_id, status, payload_json, payload_hash, estimated_credits)
    VALUES (p_workspace_id, 'gasto', 'creditos', format('Compra de %s crÃ©ditos', p_amount), 'Pedido de compra de crÃ©ditos do estrategista.', p_member_id, 'pendente', v_payload, v_hash, p_amount)
    RETURNING id INTO v_approval_id;
    SELECT wm.id INTO v_clevel FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.role IN ('clevel', 'superadmin') AND wm.status = 'active'
    ORDER BY CASE WHEN wm.role = 'clevel' THEN 1 ELSE 2 END LIMIT 1;
    IF v_clevel IS NOT NULL THEN
      INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
      VALUES (p_workspace_id, v_clevel, 'approval_required', 'AprovaÃ§Ã£o de gasto pendente: compra de crÃ©ditos', format('Pedido de %s crÃ©ditos.', p_amount), 'approval', v_approval_id);
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'requires_approval', 'approval_id', v_approval_id);
  END IF;
  INSERT INTO public.credit_wallets (workspace_id) VALUES (p_workspace_id) ON CONFLICT (workspace_id) DO NOTHING;
  UPDATE public.credit_wallets
  SET topup_balance = topup_balance + p_amount,
      topup_expires_at = COALESCE(topup_expires_at, now()) + INTERVAL '90 days'
  WHERE workspace_id = p_workspace_id;
  INSERT INTO public.credit_transactions (workspace_id, type, amount, wallet_type, description)
  VALUES (p_workspace_id, 'topup', p_amount, 'topup', format('Compra de %s crÃ©ditos', p_amount));
  RETURN jsonb_build_object('success', true, 'status', 'credited', 'amount', p_amount);
END;
$function$;
REVOKE ALL ON FUNCTION public.credit_purchase(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_purchase(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.credit_policy_save(
  p_workspace_id uuid, p_member_id uuid, p_mode text, p_threshold integer, p_monthly_limit integer, p_auto_topup boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_member public.workspace_members%ROWTYPE;
  v_scope text;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_member FROM public.workspace_members WHERE id = p_member_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VocÃª nÃ£o participa deste workspace como membro.' USING ERRCODE = '42501';
  END IF;
  SELECT scope INTO v_scope FROM public.role_permissions WHERE role_id = v_member.role AND capability_key = 'credits.policy';
  IF v_scope IS NULL OR v_scope NOT IN ('all', 'assigned') OR (v_member.role <> 'superadmin' AND v_member.workspace_id <> p_workspace_id) THEN
    RAISE EXCEPTION 'SÃ³ o C-level e o superadmin mudam as regras de crÃ©ditos.' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('auto', 'approval') OR p_threshold < 0 OR p_monthly_limit < 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Modo, teto ou limite mensal invÃ¡lido.');
  END IF;
  INSERT INTO public.workspace_settings (workspace_id, credit_mode, approval_threshold, monthly_credit_limit, auto_topup_enabled)
  VALUES (p_workspace_id, p_mode, p_threshold, p_monthly_limit, p_auto_topup)
  ON CONFLICT (workspace_id) DO UPDATE SET
    credit_mode = EXCLUDED.credit_mode,
    approval_threshold = EXCLUDED.approval_threshold,
    monthly_credit_limit = EXCLUDED.monthly_credit_limit,
    auto_topup_enabled = EXCLUDED.auto_topup_enabled;
  RETURN jsonb_build_object('success', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.credit_policy_save(uuid, uuid, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_policy_save(uuid, uuid, text, integer, integer, boolean) TO authenticated, service_role;

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
