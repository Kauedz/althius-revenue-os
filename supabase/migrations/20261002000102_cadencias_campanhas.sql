-- ==============================================================================
-- Migration: 20261002000102_cadencias_campanhas.sql
-- PR 08: Cadências e Campanhas ligadas ao banco. Tudo por função, com a pessoa logada conferida no banco (ADR 0023).
--
-- 1. SEGURANÇA (achado, já existia): view_cadence_performance e view_pipeline_analytics rodavam com o poder do dono e
--    qualquer pessoa logada lia as linhas de TODOS os clientes (confirmado: o Grão Norte lia nomes de cadência da Evolut).
--    Agora respeitam o workspace de quem consulta (security_invoker).
-- 2. Cadências: salvar, adicionar e remover o último passo. BDR só as dele (cadences.edit own); C-level só lê.
--    Passo automático só em e-mail/WhatsApp. Com contato em andamento os passos não mudam.
-- 3. Campanhas: verba de mídia é GASTO. Estrategista pede (aprovação de gasto, tipo orçamento), C-level/superadmin aplicam
--    direto ("quem paga decide"); reduzir a verba não é gasto e vale direto. A verba é em reais (budget_usd fica sem uso).
-- ==============================================================================

ALTER VIEW public.view_cadence_performance SET (security_invoker = true);
ALTER VIEW public.view_pipeline_analytics SET (security_invoker = true);

-- ------------------------------------------------------------------ cadências
-- A cadência que a pessoa pode alterar agora (existe no workspace, é dela se o escopo é "own", sem contato em andamento).
CREATE OR REPLACE FUNCTION internal.cadencia_editavel(p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_exigir_parada BOOLEAN)
RETURNS public.cadences
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_c public.cadences;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'cadences.edit', 'Seu papel só consulta cadências.');
  SELECT * INTO v_c FROM public.cadences WHERE id = p_cadence_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadência não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_escopo = 'own' AND v_c.created_by IS DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'Só quem criou a cadência ou um estrategista mexe nela.' USING ERRCODE = '42501';
  END IF;
  IF p_exigir_parada AND EXISTS (SELECT 1 FROM public.cadence_enrollments WHERE cadence_id = p_cadence_id AND status IN ('ativa', 'pausada', 'pausada_resposta')) THEN
    RAISE EXCEPTION 'Há contatos em andamento nesta cadência. Pause ou conclua antes de mudar os passos.' USING ERRCODE = '22023';
  END IF;
  RETURN v_c;
END;
$$;
REVOKE ALL ON FUNCTION internal.cadencia_editavel(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cadence_save(p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_name TEXT, p_description TEXT, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Dê um nome à cadência.' USING ERRCODE = '22023'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('ativa', 'pausada', 'arquivada') THEN RAISE EXCEPTION 'Status de cadência inválido.' USING ERRCODE = '22023'; END IF;
  IF p_cadence_id IS NULL THEN
    PERFORM internal.exigir_escopo(p_workspace_id, p_member_id, 'cadences.edit', 'Seu papel só consulta cadências.');
    INSERT INTO public.cadences (workspace_id, name, description, status, created_by)
    VALUES (p_workspace_id, btrim(p_name), NULLIF(btrim(COALESCE(p_description, '')), ''), p_status, p_member_id) RETURNING id INTO v_id;
    PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.created', 'cadence', v_id::text, jsonb_build_object('name', btrim(p_name)));
    RETURN jsonb_build_object('action', 'created', 'id', v_id);
  END IF;
  PERFORM internal.cadencia_editavel(p_workspace_id, p_member_id, p_cadence_id, false);
  UPDATE public.cadences SET name = btrim(p_name), description = NULLIF(btrim(COALESCE(p_description, '')), ''), status = p_status WHERE id = p_cadence_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.updated', 'cadence', p_cadence_id::text, jsonb_build_object('name', btrim(p_name), 'status', p_status));
  RETURN jsonb_build_object('action', 'updated', 'id', p_cadence_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cadence_add_step(
  p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_channel TEXT, p_mode TEXT, p_delay_days INTEGER, p_subject TEXT, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM internal.cadencia_editavel(p_workspace_id, p_member_id, p_cadence_id, true);
  IF p_channel IS NULL OR p_channel NOT IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call') THEN RAISE EXCEPTION 'Canal de passo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('auto', 'manual') THEN RAISE EXCEPTION 'Modo de passo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'auto' AND p_channel NOT IN ('email', 'whatsapp') THEN RAISE EXCEPTION 'Só e-mail e WhatsApp podem ser automáticos.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'auto' AND btrim(COALESCE(p_body, '')) = '' THEN RAISE EXCEPTION 'Passo automático precisa do texto da mensagem.' USING ERRCODE = '22023'; END IF;
  IF p_delay_days IS NULL OR p_delay_days NOT BETWEEN 0 AND 90 THEN RAISE EXCEPTION 'A espera vai de 0 a 90 dias.' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(max(step_number), 0) + 1 INTO v_n FROM public.cadence_steps WHERE cadence_id = p_cadence_id;
  IF v_n > 12 THEN RAISE EXCEPTION 'Uma cadência tem no máximo 12 passos.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, subject, body, delay_days)
  VALUES (p_workspace_id, p_cadence_id, v_n, p_channel, p_mode, NULLIF(btrim(COALESCE(p_subject, '')), ''), NULLIF(btrim(COALESCE(p_body, '')), ''), p_delay_days);
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.step_added', 'cadence', p_cadence_id::text, jsonb_build_object('step', v_n, 'channel', p_channel, 'mode', p_mode));
  RETURN jsonb_build_object('action', 'added', 'step_number', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.cadence_remove_last_step(p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM internal.cadencia_editavel(p_workspace_id, p_member_id, p_cadence_id, true);
  SELECT max(step_number) INTO v_n FROM public.cadence_steps WHERE cadence_id = p_cadence_id;
  IF v_n IS NULL THEN RAISE EXCEPTION 'Esta cadência não tem passos.' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.cadence_steps WHERE cadence_id = p_cadence_id AND step_number = v_n;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.step_removed', 'cadence', p_cadence_id::text, jsonb_build_object('step', v_n));
  RETURN jsonb_build_object('action', 'removed', 'removed_step', v_n);
END;
$$;

-- ------------------------------------------------------------------ campanhas
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS budget_brl NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (budget_brl >= 0);
COMMENT ON COLUMN public.campaigns.budget_brl IS 'Verba de mídia aprovada, em reais. É gasto: o estrategista pede e o C-level aprova. (budget_usd não é usado.)';

-- Pedido de verba: aprovação de gasto (tipo orçamento) para o C-level. Só quem paga decide (approval_decide).
CREATE OR REPLACE FUNCTION internal.campanha_pedir_verba(p_workspace_id UUID, p_member_id UUID, p_campaign_id UUID, p_de NUMERIC, p_para NUMERIC)
RETURNS UUID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_c public.campaigns;
  v_payload JSONB;
  v_id UUID;
  v_decisor UUID;
BEGIN
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id;
  v_payload := jsonb_build_object('acao', 'verba_campanha', 'campaign_id', p_campaign_id, 'campanha', v_c.name, 'canal', v_c.channel_type, 'de', p_de, 'para', p_para);
  INSERT INTO public.approvals (workspace_id, category, approval_type, title, description, requested_by_member_id, status, payload_json, payload_hash, estimated_credits, impact)
  VALUES (p_workspace_id, 'gasto', 'orcamento', format('Verba de mídia: %s', v_c.name),
          format('Pedido de verba de R$ %s (hoje R$ %s) para a campanha "%s".', to_char(p_para, 'FM999G999G990D00'), to_char(p_de, 'FM999G999G990D00'), v_c.name),
          p_member_id, 'pendente', v_payload, encode(extensions.digest(v_payload::text, 'sha256'), 'hex'), 0,
          format('Verba de mídia da campanha passa de R$ %s para R$ %s.', to_char(p_de, 'FM999G999G990D00'), to_char(p_para, 'FM999G999G990D00')))
  RETURNING id INTO v_id;
  SELECT wm.id INTO v_decisor FROM public.workspace_members wm
   WHERE wm.workspace_id = p_workspace_id AND wm.role IN ('clevel', 'superadmin') AND wm.status = 'active'
   ORDER BY CASE WHEN wm.role = 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
  IF v_decisor IS NOT NULL THEN
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (p_workspace_id, v_decisor, 'approval_required', 'Aprovação de gasto pendente: ' || format('Verba de mídia: %s', v_c.name),
            format('Pedido de verba de R$ %s para a campanha "%s".', to_char(p_para, 'FM999G999G990D00'), v_c.name), 'approval', v_id);
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION internal.campanha_pedir_verba(UUID, UUID, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.campaign_create(p_workspace_id UUID, p_member_id UUID, p_name TEXT, p_channel TEXT, p_budget NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
  v_papel TEXT;
  v_aprovacao UUID;
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'campaigns.edit', 'Só estrategistas e gestores criam campanhas.') <> 'all' THEN
    RAISE EXCEPTION 'Só estrategistas e gestores criam campanhas.' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Dê um nome à campanha.' USING ERRCODE = '22023'; END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('linkedin_ads', 'meta_ads', 'google_ads', 'organico', 'evento', 'seo_geo') THEN RAISE EXCEPTION 'Canal de campanha inválido.' USING ERRCODE = '22023'; END IF;
  IF p_budget IS NULL OR p_budget < 0 THEN RAISE EXCEPTION 'A verba não pode ser negativa.' USING ERRCODE = '22023'; END IF;
  SELECT role INTO v_papel FROM public.workspace_members WHERE id = p_member_id;

  INSERT INTO public.campaigns (workspace_id, name, channel_type, status, created_by) VALUES (p_workspace_id, btrim(p_name), p_channel, 'rascunho', p_member_id) RETURNING id INTO v_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'campaign.created', 'campaign', v_id::text, jsonb_build_object('name', btrim(p_name), 'channel', p_channel));
  IF p_budget > 0 THEN
    IF v_papel IN ('clevel', 'superadmin') THEN
      UPDATE public.campaigns SET budget_brl = p_budget WHERE id = v_id;
      PERFORM public.audit_write(p_workspace_id, auth.uid(), 'campaign.budget_changed', 'campaign', v_id::text, jsonb_build_object('de', 0, 'para', p_budget));
    ELSE
      v_aprovacao := internal.campanha_pedir_verba(p_workspace_id, p_member_id, v_id, 0, p_budget);
    END IF;
  END IF;
  RETURN jsonb_build_object('action', 'created', 'id', v_id, 'approval_id', v_aprovacao);
END;
$$;

CREATE OR REPLACE FUNCTION public.campaign_set_budget(p_workspace_id UUID, p_member_id UUID, p_campaign_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_c public.campaigns;
  v_papel TEXT;
  v_pendente UUID;
  v_aprovacao UUID;
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'campaigns.edit', 'Só estrategistas e gestores mexem na verba.') <> 'all' THEN
    RAISE EXCEPTION 'Só estrategistas e gestores mexem na verba.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'A verba não pode ser negativa.' USING ERRCODE = '22023'; END IF;
  IF p_amount = v_c.budget_brl THEN RETURN jsonb_build_object('action', 'unchanged'); END IF;
  SELECT role INTO v_papel FROM public.workspace_members WHERE id = p_member_id;

  -- Quem paga decide: C-level e superadmin aplicam direto. Reduzir não é gasto. Aumentar, para os demais, é pedido.
  IF v_papel IN ('clevel', 'superadmin') OR p_amount < v_c.budget_brl THEN
    UPDATE public.campaigns SET budget_brl = p_amount WHERE id = p_campaign_id;
    PERFORM public.audit_write(p_workspace_id, auth.uid(), 'campaign.budget_changed', 'campaign', p_campaign_id::text, jsonb_build_object('de', v_c.budget_brl, 'para', p_amount));
    RETURN jsonb_build_object('action', 'updated');
  END IF;
  SELECT id INTO v_pendente FROM public.approvals
   WHERE workspace_id = p_workspace_id AND status = 'pendente' AND payload_json->>'acao' = 'verba_campanha' AND payload_json->>'campaign_id' = p_campaign_id::text LIMIT 1;
  IF v_pendente IS NOT NULL THEN RETURN jsonb_build_object('action', 'pending_exists', 'approval_id', v_pendente); END IF;
  v_aprovacao := internal.campanha_pedir_verba(p_workspace_id, p_member_id, p_campaign_id, v_c.budget_brl, p_amount);
  RETURN jsonb_build_object('action', 'requested', 'approval_id', v_aprovacao);
END;
$$;

CREATE OR REPLACE FUNCTION public.campaign_set_status(p_workspace_id UUID, p_member_id UUID, p_campaign_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_c public.campaigns;
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'campaigns.edit', 'Só estrategistas e gestores mudam o status da campanha.') <> 'all' THEN
    RAISE EXCEPTION 'Só estrategistas e gestores mudam o status da campanha.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM public.campaigns WHERE id = p_campaign_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('rascunho', 'ativa', 'pausada', 'concluida') THEN RAISE EXCEPTION 'Status de campanha inválido.' USING ERRCODE = '22023'; END IF;
  IF v_c.status = p_status THEN RETURN jsonb_build_object('action', 'unchanged'); END IF;
  UPDATE public.campaigns SET status = p_status WHERE id = p_campaign_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'campaign.status_changed', 'campaign', p_campaign_id::text, jsonb_build_object('de', v_c.status, 'para', p_status));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

-- Quando o C-level aprova o pedido, a verba entra na campanha. Se a verba mudou depois do pedido, não aplica (fica no histórico).
CREATE OR REPLACE FUNCTION public.approvals_aplicar_verba_campanha()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_atual NUMERIC;
  v_id UUID;
BEGIN
  IF NEW.payload_json->>'acao' IS DISTINCT FROM 'verba_campanha' THEN RETURN NEW; END IF;
  v_id := (NEW.payload_json->>'campaign_id')::uuid;
  SELECT budget_brl INTO v_atual FROM public.campaigns WHERE id = v_id AND workspace_id = NEW.workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Verba não aplicada: a campanha não existe mais');
    RETURN NEW;
  END IF;
  IF v_atual IS DISTINCT FROM (NEW.payload_json->>'de')::numeric THEN
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Verba não aplicada: a verba da campanha mudou depois do pedido');
    RETURN NEW;
  END IF;
  UPDATE public.campaigns SET budget_brl = (NEW.payload_json->>'para')::numeric WHERE id = v_id;
  NEW.history := NEW.history || jsonb_build_array(v_hora || ' Verba aplicada na campanha');
  PERFORM public.audit_write(NEW.workspace_id, (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id),
    'campaign.budget_applied', 'campaign', v_id::text, NEW.payload_json);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_verba_campanha ON public.approvals;
CREATE TRIGGER approvals_aplicar_verba_campanha
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION public.approvals_aplicar_verba_campanha();
REVOKE ALL ON FUNCTION public.approvals_aplicar_verba_campanha() FROM PUBLIC, anon, authenticated;

-- Permissões (ADR 0023): só quem está logado; cada função confere a pessoa por dentro.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.cadence_save(uuid,uuid,uuid,text,text,text)', 'public.cadence_add_step(uuid,uuid,uuid,text,text,integer,text,text)',
    'public.cadence_remove_last_step(uuid,uuid,uuid)', 'public.campaign_create(uuid,uuid,text,text,numeric)',
    'public.campaign_set_budget(uuid,uuid,uuid,numeric)', 'public.campaign_set_status(uuid,uuid,uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
