-- ==============================================================================
-- Migration: 20261002000101_pipeline_tarefas.sql
-- PR 07: Pipeline e Tarefas ligados ao banco. Tudo por função, com a pessoa logada conferida no banco (ADR 0023).
--   Quadros (pipeline.boards: só gestores, máximo 5 por motion), negócios (pipeline.deals: BDR só os dele),
--   histórico de etapa com QUEM moveu, tarefas (tasks.assign: BDR só para si).
-- ==============================================================================

-- Canais de tarefa que a tela já oferece: "Reunião" e "CRM" ganham valor próprio (antes cairiam em "outro").
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_channel_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_channel_check
  CHECK (channel IS NULL OR channel IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call', 'reuniao', 'crm', 'outro'));

-- O histórico guardava o DONO do negócio como quem moveu. Agora guarda quem moveu de verdade, quando a função informa;
-- sem informação (UPDATE direto), mantém o comportamento antigo.
CREATE OR REPLACE FUNCTION public.trg_opportunity_stage_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_default_prob INTEGER;
  v_mover UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.stage_key IS DISTINCT FROM NEW.stage_key) THEN
    SELECT default_probability INTO v_default_prob FROM public.stage_definitions WHERE stage_key = NEW.stage_key;
    NEW.win_probability := COALESCE(v_default_prob, NEW.win_probability);
    IF NEW.stage_key = 'ganho' THEN
      NEW.win_probability := 100;
      NEW.status := 'ganho';
    END IF;
    BEGIN
      v_mover := NULLIF(current_setting('althius.mover_member_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
      v_mover := NULL;
    END;
    INSERT INTO public.opportunity_stage_history (workspace_id, opportunity_id, from_stage_key, to_stage_key, moved_by_member_id)
    VALUES (NEW.workspace_id, NEW.id, OLD.stage_key, NEW.stage_key, COALESCE(v_mover, NEW.owner_member_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Quem está logado, como membro ativo do workspace, e o escopo do papel na capacidade (all ou own). Erro 42501 em qualquer dúvida.
CREATE OR REPLACE FUNCTION internal.exigir_escopo(p_workspace_id UUID, p_member_id UUID, p_capability TEXT, p_mensagem TEXT DEFAULT 'Seu papel não pode fazer isto.')
RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, p_capability);
  IF v_escopo NOT IN ('all', 'own') THEN
    RAISE EXCEPTION '%', p_mensagem USING ERRCODE = '42501';
  END IF;
  RETURN v_escopo;
END;
$$;
REVOKE ALL ON FUNCTION internal.exigir_escopo(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Todo workspace tem pelo menos um quadro por motion (a tela do Pipeline depende disso e o único quadro de uma motion
-- não pode ser excluído). Os nomes seguem o quadro de reserva que a 0019 já criava ("SLG (Geral)" etc.).
INSERT INTO public.pipelines (workspace_id, motion, name)
SELECT w.id, m, upper(m) || ' (Geral)'
  FROM public.workspaces w CROSS JOIN unnest(ARRAY['slg', 'mlg', 'plg']) AS m
 WHERE NOT EXISTS (SELECT 1 FROM public.pipelines p WHERE p.workspace_id = w.id AND p.motion = m);

CREATE OR REPLACE FUNCTION internal.pipelines_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.pipelines (workspace_id, motion, name)
  SELECT NEW.id, m, upper(m) || ' (Geral)' FROM unnest(ARRAY['slg', 'mlg', 'plg']) AS m;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.pipelines_padrao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_workspace_pipelines_padrao ON public.workspaces;
CREATE TRIGGER trg_workspace_pipelines_padrao
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION internal.pipelines_padrao();

-- Apagar um workspace apaga os quadros dele em cascata. A regra da 0019 recria um quadro "(Geral)" quando o último é apagado;
-- numa remoção de workspace isso criaria quadro para um workspace que já não existe. Agora ela só recria se o workspace continua lá.
CREATE OR REPLACE FUNCTION public.handle_pipeline_deletion_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  v_target_pipeline_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
    RETURN OLD;
  END IF;
  SELECT id INTO v_target_pipeline_id FROM public.pipelines
   WHERE workspace_id = OLD.workspace_id AND motion = OLD.motion AND id != OLD.id ORDER BY created_at ASC LIMIT 1;
  IF v_target_pipeline_id IS NULL THEN
    INSERT INTO public.pipelines (workspace_id, motion, name) VALUES (OLD.workspace_id, OLD.motion, format('%s (Geral)', upper(OLD.motion)))
    RETURNING id INTO v_target_pipeline_id;
  END IF;
  UPDATE public.opportunities SET pipeline_id = v_target_pipeline_id WHERE pipeline_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------ quadros
CREATE OR REPLACE FUNCTION public.pipeline_create(p_workspace_id UUID, p_member_id UUID, p_motion TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.boards', 'Só gestores criam quadros.') <> 'all' THEN
    RAISE EXCEPTION 'Só gestores criam quadros.' USING ERRCODE = '42501';
  END IF;
  IF p_motion IS NULL OR p_motion NOT IN ('slg', 'mlg', 'plg') THEN
    RAISE EXCEPTION 'Motion inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Dê um nome ao quadro.' USING ERRCODE = '22023';
  END IF;
  -- O limite de 5 por motion é do gatilho check_pipeline_motion_limit (mensagem em português).
  INSERT INTO public.pipelines (workspace_id, motion, name) VALUES (p_workspace_id, p_motion, btrim(p_name)) RETURNING id INTO v_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'pipeline.created', 'pipeline', v_id::text, jsonb_build_object('motion', p_motion, 'name', btrim(p_name)));
  RETURN jsonb_build_object('action', 'created', 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_rename(p_workspace_id UUID, p_member_id UUID, p_pipeline_id UUID, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.boards', 'Só gestores renomeiam quadros.') <> 'all' THEN
    RAISE EXCEPTION 'Só gestores renomeiam quadros.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Quadro não encontrado neste workspace.' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Dê um nome ao quadro.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pipelines SET name = btrim(p_name) WHERE id = p_pipeline_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'pipeline.renamed', 'pipeline', p_pipeline_id::text, jsonb_build_object('name', btrim(p_name)));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_reorder_stages(p_workspace_id UUID, p_member_id UUID, p_pipeline_id UUID, p_stage_order JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_etapas TEXT[];
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.boards', 'Só gestores reordenam etapas.') <> 'all' THEN
    RAISE EXCEPTION 'Só gestores reordenam etapas.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Quadro não encontrado neste workspace.' USING ERRCODE = '42501';
  END IF;
  IF p_stage_order IS NULL OR jsonb_typeof(p_stage_order) <> 'array' THEN
    RAISE EXCEPTION 'A ordem das etapas precisa ser uma lista.' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(e ORDER BY o) INTO v_etapas FROM jsonb_array_elements_text(p_stage_order) WITH ORDINALITY AS t(e, o);
  -- São sempre as 6 etapas fixas, sem repetir, e "ganho" fica por último.
  IF array_length(v_etapas, 1) IS DISTINCT FROM 6
     OR (SELECT count(DISTINCT e) FROM unnest(v_etapas) e) <> 6
     OR EXISTS (SELECT 1 FROM unnest(v_etapas) e WHERE e NOT IN (SELECT stage_key FROM public.stage_definitions))
     OR v_etapas[6] <> 'ganho' THEN
    RAISE EXCEPTION 'As 6 etapas são fixas e "ganho" é sempre a última.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pipelines SET stage_order = to_jsonb(v_etapas) WHERE id = p_pipeline_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'pipeline.stages_reordered', 'pipeline', p_pipeline_id::text, jsonb_build_object('ordem', to_jsonb(v_etapas)));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.pipeline_delete(p_workspace_id UUID, p_member_id UUID, p_pipeline_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_quadro public.pipelines;
  v_destino UUID;
  v_movidos INTEGER;
BEGIN
  IF internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.boards', 'Só gestores excluem quadros.') <> 'all' THEN
    RAISE EXCEPTION 'Só gestores excluem quadros.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quadro não encontrado neste workspace.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_destino FROM public.pipelines
   WHERE workspace_id = p_workspace_id AND motion = v_quadro.motion AND id <> p_pipeline_id ORDER BY created_at, id LIMIT 1;
  IF v_destino IS NULL THEN
    RAISE EXCEPTION 'O único quadro de uma motion não pode ser excluído.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.opportunities SET pipeline_id = v_destino WHERE pipeline_id = p_pipeline_id;
  GET DIAGNOSTICS v_movidos = ROW_COUNT;
  DELETE FROM public.pipelines WHERE id = p_pipeline_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'pipeline.deleted', 'pipeline', p_pipeline_id::text,
    jsonb_build_object('name', v_quadro.name, 'negocios_movidos', v_movidos, 'para', v_destino));
  RETURN jsonb_build_object('action', 'deleted', 'moved_to', v_destino, 'deals_moved', v_movidos);
END;
$$;

-- ------------------------------------------------------------------ negócios
-- Renumera a coluna (quadro + etapa) na ordem recebida.
CREATE OR REPLACE FUNCTION internal.pipeline_renumerar(p_ids UUID[])
RETURNS VOID
LANGUAGE sql SET search_path = '' AS $$
  UPDATE public.opportunities o SET position = t.rn
    FROM (SELECT id, (row_number() OVER (ORDER BY ord))::int AS rn FROM unnest(p_ids) WITH ORDINALITY AS u(id, ord)) t
   WHERE o.id = t.id AND o.position IS DISTINCT FROM t.rn;
$$;
REVOKE ALL ON FUNCTION internal.pipeline_renumerar(UUID[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.opportunity_create(
  p_workspace_id UUID, p_member_id UUID, p_pipeline_id UUID, p_account_id UUID, p_amount NUMERIC, p_close_date DATE,
  p_probability INTEGER, p_stage_key TEXT, p_health TEXT, p_owner_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_quadro public.pipelines;
  v_conta public.accounts;
  v_id UUID;
  v_topo INTEGER;
  v_ganho BOOLEAN := p_stage_key = 'ganho';
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.deals');
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quadro não encontrado neste workspace.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_conta FROM public.accounts WHERE id = p_account_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF p_owner_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_owner_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RAISE EXCEPTION 'O responsável precisa ser um membro ativo deste workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_escopo = 'own' AND p_owner_member_id <> p_member_id THEN
    RAISE EXCEPTION 'Você só cria negócios para você mesmo.' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'O valor do negócio não pode ser negativo.' USING ERRCODE = '22023'; END IF;
  IF p_stage_key IS NULL OR NOT (v_quadro.stage_order ? p_stage_key) THEN RAISE EXCEPTION 'Etapa inexistente neste quadro.' USING ERRCODE = '22023'; END IF;
  IF p_health IS NULL OR p_health NOT IN ('no_prazo', 'em_risco', 'atrasado') THEN RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023'; END IF;
  IF p_probability IS NULL OR p_probability NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'A chance de ganho vai de 0 a 100.' USING ERRCODE = '22023'; END IF;

  SELECT COALESCE(min(position), 1) - 1 INTO v_topo FROM public.opportunities WHERE pipeline_id = p_pipeline_id AND stage_key = p_stage_key;
  INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, stage_key, title, amount, close_date, win_probability, health, position, owner_member_id, status)
  VALUES (p_workspace_id, p_pipeline_id, p_account_id, p_stage_key, v_conta.name, p_amount, p_close_date,
          CASE WHEN v_ganho THEN 100 ELSE p_probability END, p_health, v_topo, p_owner_member_id, CASE WHEN v_ganho THEN 'ganho' ELSE 'ativa' END)
  RETURNING id INTO v_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'opportunity.created', 'opportunity', v_id::text,
    jsonb_build_object('account_id', p_account_id, 'stage', p_stage_key, 'amount', p_amount, 'owner', p_owner_member_id));
  RETURN jsonb_build_object('action', 'created', 'id', v_id);
END;
$$;

-- Edita o negócio. Mudar de etapa passa pelo gatilho (histórico), com QUEM mudou.
CREATE OR REPLACE FUNCTION public.opportunity_update(
  p_workspace_id UUID, p_member_id UUID, p_opportunity_id UUID, p_amount NUMERIC, p_close_date DATE,
  p_probability INTEGER, p_stage_key TEXT, p_health TEXT, p_owner_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_o public.opportunities;
  v_quadro public.pipelines;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.deals');
  SELECT * INTO v_o FROM public.opportunities WHERE id = p_opportunity_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_escopo = 'own' AND (v_o.owner_member_id IS DISTINCT FROM p_member_id OR p_owner_member_id IS DISTINCT FROM p_member_id) THEN
    RAISE EXCEPTION 'Só o responsável ou um gestor mexe neste negócio.' USING ERRCODE = '42501';
  END IF;
  IF v_o.status NOT IN ('ativa', 'ganho') THEN RAISE EXCEPTION 'Este negócio não está mais ativo.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = v_o.pipeline_id;
  IF p_owner_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_owner_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RAISE EXCEPTION 'O responsável precisa ser um membro ativo deste workspace.' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'O valor do negócio não pode ser negativo.' USING ERRCODE = '22023'; END IF;
  IF p_stage_key IS NULL OR NOT (v_quadro.stage_order ? p_stage_key) THEN RAISE EXCEPTION 'Etapa inexistente neste quadro.' USING ERRCODE = '22023'; END IF;
  IF p_health IS NULL OR p_health NOT IN ('no_prazo', 'em_risco', 'atrasado') THEN RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023'; END IF;
  IF p_probability IS NULL OR p_probability NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'A chance de ganho vai de 0 a 100.' USING ERRCODE = '22023'; END IF;

  PERFORM set_config('althius.mover_member_id', p_member_id::text, true);
  IF v_o.stage_key <> p_stage_key THEN
    UPDATE public.opportunities SET stage_key = p_stage_key WHERE id = p_opportunity_id;   -- gatilho: histórico e chance padrão
  END IF;
  UPDATE public.opportunities
     SET amount = p_amount, close_date = p_close_date, health = p_health, owner_member_id = p_owner_member_id,
         win_probability = CASE WHEN p_stage_key = 'ganho' THEN 100 ELSE p_probability END,
         status = CASE WHEN p_stage_key = 'ganho' THEN 'ganho' ELSE 'ativa' END
   WHERE id = p_opportunity_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'opportunity.updated', 'opportunity', p_opportunity_id::text,
    jsonb_build_object('stage', p_stage_key, 'amount', p_amount, 'owner', p_owner_member_id));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

-- Move o negócio de etapa (e/ou de posição na coluna). O BDR só move os dele.
CREATE OR REPLACE FUNCTION public.opportunity_move(
  p_workspace_id UUID, p_member_id UUID, p_opportunity_id UUID, p_to_stage TEXT, p_before_opportunity_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_o public.opportunities;
  v_quadro public.pipelines;
  v_ids UUID[];
  v_antes INTEGER;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.deals');
  SELECT * INTO v_o FROM public.opportunities WHERE id = p_opportunity_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_escopo = 'own' AND v_o.owner_member_id IS DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'Só o responsável ou um gestor mexe neste negócio.' USING ERRCODE = '42501';
  END IF;
  IF v_o.status NOT IN ('ativa', 'ganho') THEN RAISE EXCEPTION 'Este negócio não está mais ativo.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = v_o.pipeline_id;
  IF p_to_stage IS NULL OR NOT (v_quadro.stage_order ? p_to_stage) THEN RAISE EXCEPTION 'Etapa inexistente neste quadro.' USING ERRCODE = '22023'; END IF;

  PERFORM set_config('althius.mover_member_id', p_member_id::text, true);
  IF v_o.stage_key <> p_to_stage THEN
    UPDATE public.opportunities SET stage_key = p_to_stage, status = CASE WHEN p_to_stage = 'ganho' THEN 'ganho' ELSE 'ativa' END WHERE id = p_opportunity_id;
  END IF;

  -- Posição na coluna de destino: antes do negócio indicado, ou no fim.
  SELECT COALESCE(array_agg(o.id ORDER BY o.position, o.created_at, o.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.opportunities o
   WHERE o.pipeline_id = v_o.pipeline_id AND o.stage_key = p_to_stage AND o.id <> p_opportunity_id AND o.status IN ('ativa', 'ganho');
  v_antes := CASE WHEN p_before_opportunity_id IS NULL THEN NULL ELSE array_position(v_ids, p_before_opportunity_id) END;
  IF v_antes IS NULL THEN
    v_ids := v_ids || p_opportunity_id;
  ELSE
    v_ids := v_ids[1:v_antes - 1] || p_opportunity_id || v_ids[v_antes:array_length(v_ids, 1)];
  END IF;
  PERFORM internal.pipeline_renumerar(v_ids);

  IF v_o.stage_key <> p_to_stage THEN
    PERFORM public.audit_write(p_workspace_id, auth.uid(), 'opportunity.moved', 'opportunity', p_opportunity_id::text,
      jsonb_build_object('de', v_o.stage_key, 'para', p_to_stage));
  END IF;
  RETURN jsonb_build_object('action', 'moved', 'stage', p_to_stage);
END;
$$;

CREATE OR REPLACE FUNCTION public.opportunity_archive(p_workspace_id UUID, p_member_id UUID, p_opportunity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_o public.opportunities;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.deals');
  SELECT * INTO v_o FROM public.opportunities WHERE id = p_opportunity_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_escopo = 'own' AND v_o.owner_member_id IS DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'Só o responsável ou um gestor mexe neste negócio.' USING ERRCODE = '42501';
  END IF;
  IF v_o.status = 'arquivada' THEN RETURN jsonb_build_object('action', 'unchanged'); END IF;
  UPDATE public.opportunities SET status = 'arquivada' WHERE id = p_opportunity_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'opportunity.archived', 'opportunity', p_opportunity_id::text, jsonb_build_object('stage', v_o.stage_key));
  RETURN jsonb_build_object('action', 'archived');
END;
$$;

-- ------------------------------------------------------------------ tarefas
CREATE OR REPLACE FUNCTION public.task_create(
  p_workspace_id UUID, p_member_id UUID, p_title TEXT, p_channel TEXT, p_account_id UUID, p_contact_id UUID,
  p_assignee_member_id UUID, p_agent_id TEXT, p_due_at TIMESTAMPTZ, p_status TEXT, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_id UUID;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'tasks.assign');
  IF p_title IS NULL OR btrim(p_title) = '' THEN RAISE EXCEPTION 'Escreva o que precisa ser feito.' USING ERRCODE = '22023'; END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call', 'reuniao', 'crm', 'outro') THEN
    RAISE EXCEPTION 'Canal de tarefa inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pendente', 'em_andamento', 'concluida') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  IF p_agent_id IS NOT NULL AND p_agent_id NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN RAISE EXCEPTION 'Agente inválido.' USING ERRCODE = '22023'; END IF;
  IF p_assignee_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_assignee_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RAISE EXCEPTION 'O responsável precisa ser um membro ativo deste workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_escopo = 'own' AND p_assignee_member_id <> p_member_id THEN
    RAISE EXCEPTION 'Você só cria tarefas para você mesmo.' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Conta não encontrada neste workspace.' USING ERRCODE = '42501';
  END IF;
  IF p_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_contact_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Contato não encontrado neste workspace.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.tasks (workspace_id, title, channel, account_id, contact_id, assignee_member_id, agent_id, due_at, status, note, source, completed_at)
  VALUES (p_workspace_id, btrim(p_title), p_channel, p_account_id, p_contact_id, p_assignee_member_id, p_agent_id, COALESCE(p_due_at, now()), p_status,
          NULLIF(btrim(COALESCE(p_note, '')), ''), 'manual', CASE WHEN p_status = 'concluida' THEN now() END)
  RETURNING id INTO v_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'task.created', 'task', v_id::text,
    jsonb_build_object('title', btrim(p_title), 'assignee', p_assignee_member_id, 'channel', p_channel));
  RETURN jsonb_build_object('action', 'created', 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION internal.tarefa_do_membro(p_workspace_id UUID, p_member_id UUID, p_task_id UUID)
RETURNS public.tasks
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_t public.tasks;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'tasks.assign');
  SELECT * INTO v_t FROM public.tasks WHERE id = p_task_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_escopo = 'own' AND v_t.assignee_member_id <> p_member_id THEN
    RAISE EXCEPTION 'Só o responsável ou um gestor mexe nesta tarefa.' USING ERRCODE = '42501';
  END IF;
  RETURN v_t;
END;
$$;
REVOKE ALL ON FUNCTION internal.tarefa_do_membro(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.task_set_status(p_workspace_id UUID, p_member_id UUID, p_task_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_t public.tasks;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pendente', 'em_andamento', 'concluida') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  v_t := internal.tarefa_do_membro(p_workspace_id, p_member_id, p_task_id);
  IF v_t.status = p_status THEN RETURN jsonb_build_object('action', 'unchanged'); END IF;
  UPDATE public.tasks SET status = p_status, completed_at = CASE WHEN p_status = 'concluida' THEN now() END WHERE id = p_task_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'task.status_changed', 'task', p_task_id::text, jsonb_build_object('de', v_t.status, 'para', p_status));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.task_postpone(p_workspace_id UUID, p_member_id UUID, p_task_id UUID, p_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_t public.tasks;
BEGIN
  IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Adie de 1 a 30 dias.' USING ERRCODE = '22023'; END IF;
  v_t := internal.tarefa_do_membro(p_workspace_id, p_member_id, p_task_id);
  UPDATE public.tasks SET due_at = GREATEST(due_at, now()) + p_days * interval '1 day' WHERE id = p_task_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'task.postponed', 'task', p_task_id::text, jsonb_build_object('dias', p_days));
  RETURN jsonb_build_object('action', 'updated');
END;
$$;

-- Permissões (ADR 0023): só quem está logado; cada função confere a pessoa por dentro.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.pipeline_create(uuid,uuid,text,text)', 'public.pipeline_rename(uuid,uuid,uuid,text)', 'public.pipeline_delete(uuid,uuid,uuid)',
    'public.pipeline_reorder_stages(uuid,uuid,uuid,jsonb)', 'public.opportunity_create(uuid,uuid,uuid,uuid,numeric,date,integer,text,text,uuid)',
    'public.opportunity_update(uuid,uuid,uuid,numeric,date,integer,text,text,uuid)', 'public.opportunity_move(uuid,uuid,uuid,text,uuid)',
    'public.opportunity_archive(uuid,uuid,uuid)', 'public.task_create(uuid,uuid,text,text,uuid,uuid,uuid,text,timestamptz,text,text)',
    'public.task_set_status(uuid,uuid,uuid,text)', 'public.task_postpone(uuid,uuid,uuid,integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
