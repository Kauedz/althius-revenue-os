-- Execuções reais: contrato da tela v18, controles no servidor e custo confidencial.
ALTER TABLE public.executions
  ADD COLUMN title text NOT NULL DEFAULT 'Execução',
  ADD COLUMN execution_type text NOT NULL DEFAULT 'Execução',
  ADD COLUMN campaign_name text NOT NULL DEFAULT '—',
  ADD COLUMN requester_label text,
  ADD COLUMN display_time text,
  ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  ADD COLUMN valid_count integer NOT NULL DEFAULT 0 CHECK (valid_count >= 0 AND valid_count <= processed_count),
  ADD COLUMN reserved_credits integer NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  ADD COLUMN plan jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(plan)='array'),
  ADD COLUMN current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  ADD COLUMN logs jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(logs)='array'),
  ADD COLUMN errors jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(errors)='array'),
  ADD COLUMN integrations jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(integrations)='array'),
  ADD COLUMN approval_label text NOT NULL DEFAULT 'Não exigida',
  ADD CONSTRAINT execution_credits_nonnegative CHECK (estimated_credits>=0 AND actual_credits>=0);
ALTER TABLE public.executions DROP CONSTRAINT executions_status_check;
UPDATE public.executions SET status=CASE status WHEN 'pending' THEN 'queued' WHEN 'pending_credits' THEN 'pending_approval' ELSE status END;
ALTER TABLE public.executions ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE public.executions ADD CONSTRAINT executions_status_check CHECK
 (status IN ('pending_approval','scheduled','queued','reserving_credits','running','paused','completed','partial','failed','cancelled'));
-- Compatibilidade com workers antigos: somente os estados canônicos são armazenados.
CREATE FUNCTION public.execution_canonical_status() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.status := CASE NEW.status WHEN 'pending' THEN 'queued' WHEN 'pending_credits' THEN 'pending_approval' ELSE NEW.status END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.execution_canonical_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER execution_canonical_status BEFORE INSERT OR UPDATE OF status ON public.executions
FOR EACH ROW EXECUTE FUNCTION public.execution_canonical_status();
DROP POLICY "Members see executions in their workspace" ON public.executions;
CREATE POLICY "Capacidade de leitura de execuções por workspace" ON public.executions
FOR SELECT TO authenticated USING (public.check_permission(workspace_id,'executions.view'));
REVOKE ALL ON public.executions FROM anon,authenticated;
GRANT SELECT ON public.executions TO authenticated;

CREATE FUNCTION public.execution_costs(p_workspace_id uuid)
RETURNS TABLE(execution_id uuid,cost_usd numeric,providers text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.check_permission(p_workspace_id,'exec.cost') THEN
    RAISE EXCEPTION 'Somente o superadmin consulta custos reais.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT c.execution_id,sum(c.cost_usd),array_agg(DISTINCT c.provider_code)
  FROM internal.provider_cost_events c WHERE c.workspace_id=p_workspace_id GROUP BY c.execution_id;
END;
$$;
REVOKE ALL ON FUNCTION public.execution_costs(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execution_costs(uuid) TO authenticated,service_role;

CREATE FUNCTION public.execution_control(p_execution_id uuid,p_member_id uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_exec public.executions%ROWTYPE;
  v_member public.workspace_members%ROWTYPE;
  v_scope text;
  v_status text;
  v_hold integer;
  v_eval jsonb;
  v_new uuid;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_member FROM public.workspace_members WHERE id=p_member_id AND status='active';
  SELECT * INTO v_exec FROM public.executions WHERE id=p_execution_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','Esta execução não existe ou não está disponível.'); END IF;
  SELECT scope INTO v_scope FROM public.role_permissions WHERE role_id=v_member.role AND capability_key='exec.control';
  IF v_scope IS NULL OR v_scope NOT IN ('all','assigned') OR
     (v_member.role<>'superadmin' AND v_member.workspace_id<>v_exec.workspace_id) THEN
    RAISE EXCEPTION 'Seu papel não controla execuções neste workspace.' USING ERRCODE='42501';
  END IF;
  IF p_action='repeat' AND v_exec.status IN ('completed','partial','failed','cancelled') THEN
    v_eval:=public.hermes_evaluate_action(v_exec.workspace_id,p_member_id,v_exec.capability_key,NULL,v_exec.estimated_credits,false,v_exec.title,v_exec.metadata_json);
    IF NOT COALESCE((v_eval->>'allowed')::boolean,false) THEN
      RETURN v_eval || jsonb_build_object('success',v_eval->>'status'='requires_approval');
    END IF;
    v_new:=(v_eval->>'execution_id')::uuid;
    UPDATE public.executions SET title=v_exec.title, execution_type=v_exec.execution_type,
      agent_code=v_exec.agent_code,campaign_name=v_exec.campaign_name,plan=v_exec.plan,
      integrations=v_exec.integrations,logs=jsonb_build_array('Reexecução solicitada'),
      metadata_json=v_exec.metadata_json || jsonb_build_object('repeated_from',v_exec.id)
    WHERE id=v_new;
    PERFORM public.audit_write(v_exec.workspace_id,v_member.user_id,'execution.repeated','execution',v_new::text,jsonb_build_object('original',v_exec.id));
    RETURN jsonb_build_object('success',true,'status','queued','execution_id',v_new);
  END IF;
  v_status:=CASE
    WHEN p_action='pause' AND v_exec.status IN ('running','queued','scheduled','reserving_credits') THEN 'paused'
    WHEN p_action='resume' AND v_exec.status='paused' THEN 'queued'
    WHEN p_action='cancel' AND v_exec.status IN ('pending_approval','scheduled','queued','reserving_credits','running','paused') THEN 'cancelled'
    ELSE NULL END;
  IF v_status IS NULL THEN RETURN jsonb_build_object('success',false,'status','invalid_transition','reason','Esta ação não é permitida no estado atual da execução.'); END IF;
  IF v_status='cancelled' THEN
    -- Trava a carteira antes de ler o extrato: um consumo simultâneo precisa aparecer no cálculo.
    PERFORM 1 FROM public.credit_wallets WHERE workspace_id=v_exec.workspace_id FOR UPDATE;
    SELECT GREATEST(0,COALESCE(sum(CASE type WHEN 'reserve' THEN amount WHEN 'consume' THEN -amount WHEN 'release' THEN -amount ELSE 0 END),0))::integer
    INTO v_hold FROM public.credit_transactions WHERE execution_id=v_exec.id AND workspace_id=v_exec.workspace_id;
    IF v_hold>0 THEN
      UPDATE public.credit_wallets SET reserved_balance=reserved_balance-v_hold
      WHERE workspace_id=v_exec.workspace_id AND reserved_balance>=v_hold;
      IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de créditos inconsistente; o cancelamento não foi registrado.'; END IF;
      INSERT INTO public.credit_transactions(workspace_id,execution_id,type,amount,wallet_type,description,idempotency_key)
      VALUES(v_exec.workspace_id,v_exec.id,'release',v_hold,'both','Reserva liberada por cancelamento','cancel:'||v_exec.id);
    END IF;
  END IF;
  UPDATE public.executions SET status=v_status,
    reserved_credits=CASE WHEN v_status='cancelled' THEN 0 ELSE reserved_credits END,
    logs=logs || jsonb_build_array(to_char(now() AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || ' ' ||
      CASE v_status WHEN 'paused' THEN 'Pausada' WHEN 'queued' THEN 'Retomada na fila' ELSE 'Cancelada' END)
  WHERE id=v_exec.id;
  PERFORM public.audit_write(v_exec.workspace_id,v_member.user_id,'execution.'||p_action,'execution',v_exec.id::text,jsonb_build_object('before',v_exec.status,'after',v_status));
  RETURN jsonb_build_object('success',true,'status',v_status,'execution_id',v_exec.id);
END;
$$;
REVOKE ALL ON FUNCTION public.execution_control(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execution_control(uuid,uuid,text) TO authenticated,service_role;