-- Campanhas: lista e rascunho. Ativar canal pago ou com verba gravada nao muda o status.
-- Passa por public.hermes_evaluate_action e vira aprovacao (estrategista) ou execucao (C-level/superadmin).

REVOKE INSERT, UPDATE, DELETE ON public.campaigns FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.campaign_list(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_itens JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'campaigns.edit');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC), '[]'::jsonb) INTO v_itens
  FROM (
    SELECT c.id, c.name, c.channel_type, c.status, c.leads_count, c.updated_at
    FROM public.campaigns c
    WHERE c.workspace_id = p_workspace_id
  ) t;
  RETURN jsonb_build_object('ok', true, 'pode_editar', v_escopo IN ('all', 'assigned'), 'itens', v_itens);
END;
$$;

CREATE OR REPLACE FUNCTION public.campaign_save(
  p_workspace_id UUID, p_member_id UUID, p_name TEXT, p_channel TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_id UUID;
  v_nome TEXT := btrim(COALESCE(p_name, ''));
  v_canal TEXT := btrim(COALESCE(p_channel, ''));
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'campaigns.edit');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não cria campanha.');
  END IF;
  IF v_canal NOT IN ('linkedin_ads', 'meta_ads', 'google_ads', 'organico', 'evento', 'seo_geo') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Escolha o canal da campanha.');
  END IF;
  IF v_nome = '' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Dê um nome à campanha.');
  END IF;
  INSERT INTO public.campaigns (workspace_id, name, channel_type, status, budget_usd, leads_count, created_by)
  VALUES (p_workspace_id, v_nome, v_canal, 'rascunho', 0, 0, p_member_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- hermes_evaluate_action chama digest() sem esquema; o search_path vazio escondia extensions.
CREATE OR REPLACE FUNCTION public.campaign_activate(p_workspace_id UUID, p_member_id UUID, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_escopo TEXT;
  v_nome TEXT;
  v_canal TEXT;
  v_status TEXT;
  v_budget NUMERIC;
  v_gasta BOOLEAN;
  v_hermes JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'campaigns.edit');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não cria campanha.');
  END IF;
  SELECT name, channel_type, status, budget_usd
  INTO v_nome, v_canal, v_status, v_budget
  FROM public.campaigns
  WHERE id = p_id AND workspace_id = p_workspace_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Campanha não encontrada.');
  END IF;
  v_gasta := v_canal IN ('linkedin_ads', 'meta_ads', 'google_ads') OR COALESCE(v_budget, 0) > 0;
  IF v_gasta THEN
    v_hermes := public.hermes_evaluate_action(
      p_workspace_id, p_member_id, 'campaigns.edit', NULL, 0, true,
      'Ativar campanha: ' || left(v_nome, 80),
      jsonb_build_object('campaign_id', p_id, 'channel_type', v_canal)
    );
    IF v_hermes->>'status' = 'requires_approval' THEN
      RETURN jsonb_build_object('ok', true, 'destino', 'aprovacao',
        'mensagem', 'A ativação foi para Aprovações. Quem paga decide a verba.');
    END IF;
    IF COALESCE((v_hermes->>'allowed')::boolean, false) THEN
      RETURN jsonb_build_object('ok', true, 'destino', 'execucao', 'execution_id', v_hermes->>'execution_id',
        'mensagem', 'A ativação foi para Execuções. A campanha não foi ligada.');
    END IF;
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_hermes->>'reason', 'A ativação não foi autorizada.'));
  END IF;
  IF v_status = 'ativa' THEN
    RETURN jsonb_build_object('ok', true, 'destino', 'ativa', 'mensagem', 'A campanha já está ativa.');
  END IF;
  UPDATE public.campaigns
  SET status = 'ativa', updated_at = now()
  WHERE id = p_id AND workspace_id = p_workspace_id;
  RETURN jsonb_build_object('ok', true, 'destino', 'ativa', 'mensagem', 'Campanha ativada.');
END;
$$;

CREATE OR REPLACE FUNCTION public.campaign_pause(p_workspace_id UUID, p_member_id UUID, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_status TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'campaigns.edit');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não cria campanha.');
  END IF;
  SELECT status INTO v_status FROM public.campaigns WHERE id = p_id AND workspace_id = p_workspace_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Campanha não encontrada.');
  END IF;
  IF v_status <> 'ativa' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só uma campanha ativa pode ser pausada.');
  END IF;
  UPDATE public.campaigns SET status = 'pausada', updated_at = now()
  WHERE id = p_id AND workspace_id = p_workspace_id;
  RETURN jsonb_build_object('ok', true, 'mensagem', 'Campanha pausada.');
END;
$$;

REVOKE ALL ON FUNCTION public.campaign_list(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_save(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_activate(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_pause(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_list(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_save(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_activate(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_pause(UUID, UUID, UUID) TO authenticated;
