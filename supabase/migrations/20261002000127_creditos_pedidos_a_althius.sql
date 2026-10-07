-- ==============================================================================
-- Migration: 20261002000127_creditos_pedidos_a_althius.sql
-- Créditos não se compram em 1 clique (ADR 0064). O cliente assina por mês e a Althius opera a plataforma junto com ele:
-- quem tem a capacidade `credits.buy` (C-level, estrategista, superadmin) PEDE créditos à Althius. O pedido é uma
-- aprovação de gasto do tipo `creditos`, que só o superadmin decide; aprovada, o crédito entra no saldo uma vez.
-- Antes: o C-level somava saldo na hora, sem pagamento nenhum, e o pedido do estrategista, se aprovado, não creditava nada.
-- ==============================================================================

-- 1. Pedir créditos: sempre vira pedido à Althius (nunca soma saldo aqui).
CREATE OR REPLACE FUNCTION public.credit_purchase(p_workspace_id uuid, p_member_id uuid, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_member public.workspace_members%ROWTYPE;
  v_scope text;
  v_approval_id uuid;
  v_payload jsonb;
  v_althius RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_member FROM public.workspace_members WHERE id = p_member_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não participa deste workspace como membro.' USING ERRCODE = '42501';
  END IF;
  -- O superadmin (Althius) pede por qualquer cliente; os outros só no próprio workspace.
  IF v_member.role <> 'superadmin' AND v_member.workspace_id <> p_workspace_id THEN
    RAISE EXCEPTION 'Você não pede créditos neste workspace.' USING ERRCODE = '42501';
  END IF;
  SELECT scope INTO v_scope FROM public.role_permissions WHERE role_id = v_member.role AND capability_key = 'credits.buy';
  IF v_scope IS NULL OR v_scope NOT IN ('all', 'assigned', 'request') THEN
    RAISE EXCEPTION 'Seu papel não pede créditos.' USING ERRCODE = '42501';
  END IF;
  IF p_amount NOT IN (10000, 25000, 50000, 100000) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Pacote de créditos não reconhecido.');
  END IF;

  v_payload := jsonb_build_object('creditos', p_amount, 'para', 'althius');
  INSERT INTO public.approvals (workspace_id, category, approval_type, title, description, requested_by_member_id, status, payload_json, payload_hash, estimated_credits)
  VALUES (p_workspace_id, 'gasto', 'creditos', format('Pedido de %s créditos à Althius', p_amount),
          'A Althius confere o pedido e libera os créditos. A cobrança segue o contrato do cliente.',
          p_member_id, 'pendente', v_payload, encode(extensions.digest(v_payload::text, 'sha256'), 'hex'), p_amount)
  RETURNING id INTO v_approval_id;

  -- Avisa a Althius (o superadmin que participa do workspace).
  FOR v_althius IN SELECT wm.id FROM public.workspace_members wm
                    WHERE wm.workspace_id = p_workspace_id AND wm.role = 'superadmin' AND wm.status = 'active' LOOP
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (p_workspace_id, v_althius.id, 'approval_required', 'Pedido de créditos para liberar',
            format('Pedido de %s créditos.', p_amount), 'approval', v_approval_id);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'status', 'requested', 'approval_id', v_approval_id, 'amount', p_amount);
END;
$function$;
REVOKE ALL ON FUNCTION public.credit_purchase(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_purchase(uuid, uuid, integer) TO authenticated, service_role;

-- 2. Só a Althius (superadmin) decide pedido de créditos; aprovado, o crédito entra no saldo (uma vez: a aprovação é de uso único).
CREATE OR REPLACE FUNCTION public.approvals_creditos_da_althius()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_creditos INTEGER := (NEW.payload_json->>'creditos')::integer;
  v_user UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members wm
                  WHERE wm.id = NEW.decided_by_member_id AND wm.workspace_id = NEW.workspace_id AND wm.role = 'superadmin' AND wm.status = 'active') THEN
    RAISE EXCEPTION 'Só a Althius libera ou recusa pedido de créditos.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'aprovado' AND v_creditos > 0 THEN
    INSERT INTO public.credit_wallets (workspace_id) VALUES (NEW.workspace_id) ON CONFLICT (workspace_id) DO NOTHING;
    UPDATE public.credit_wallets
       SET topup_balance = topup_balance + v_creditos,
           topup_expires_at = COALESCE(topup_expires_at, now()) + INTERVAL '90 days'
     WHERE workspace_id = NEW.workspace_id;
    INSERT INTO public.credit_transactions (workspace_id, type, amount, wallet_type, description)
    VALUES (NEW.workspace_id, 'topup', v_creditos, 'topup', 'Créditos liberados pela Althius');
    NEW.history := NEW.history || jsonb_build_array(to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' Créditos liberados no saldo');
    v_user := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'creditos.liberados', 'approval', NEW.id::text, NEW.payload_json);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.approvals_creditos_da_althius() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS approvals_creditos_da_althius ON public.approvals;
CREATE TRIGGER approvals_creditos_da_althius
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status <> 'pendente' AND NEW.approval_type = 'creditos')
  EXECUTE FUNCTION public.approvals_creditos_da_althius();

-- 3. Recarga automática desligada: com ela ligada, o agente gastava além do saldo como se comprasse sozinho.
--    A Althius opera junto com o cliente, então nada compra créditos sem um pedido.
CREATE OR REPLACE FUNCTION public.workspace_settings_sem_recarga()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.auto_topup_enabled := false;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.workspace_settings_sem_recarga() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS workspace_settings_sem_recarga ON public.workspace_settings;
CREATE TRIGGER workspace_settings_sem_recarga
  BEFORE INSERT OR UPDATE OF auto_topup_enabled ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.workspace_settings_sem_recarga();

UPDATE public.workspace_settings SET auto_topup_enabled = false WHERE auto_topup_enabled;
