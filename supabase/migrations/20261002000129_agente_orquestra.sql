-- ==============================================================================
-- Migration: 20261002000129_agente_orquestra.sql
-- ADR 0065: o agente orquestra a plataforma. Pela porta do agente (ADR 0024, só com o token), três propostas novas:
--   - criar contas (até 50; o site é normalizado; a que já existe fica de fora). Aprovada, a conta nasce e entra
--     sozinha na fila de enriquecimento (ADR 0062);
--   - pedir enriquecimento de contas que já existem (volta para a fila, empresa e pessoas);
--   - levar contas a um quadro do Pipeline (mesma regra da tela, migration 0128).
-- E o PLANO: 2 a 20 passos, cada um uma proposta que já existe, numa aprovação só. Os passos ficam presos ao plano
-- (`parent_approval_id`), não aparecem soltos e não se decidem sozinhos. Aprovado o plano, os passos são aprovados na
-- ordem e cada um aplica o seu efeito (os gatilhos de cada área). Recusado, todos são recusados.
-- Um passo inválido recusa o plano inteiro, dizendo qual (nada fica pela metade).
-- Quem decide: operação (C-level ou estrategista), como as outras propostas do agente.
-- ==============================================================================

ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS parent_approval_id UUID REFERENCES public.approvals(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_approvals_parent ON public.approvals (parent_approval_id) WHERE parent_approval_id IS NOT NULL;
COMMENT ON COLUMN public.approvals.parent_approval_id IS 'Passo de um plano do agente (ADR 0065): só se decide junto com o plano.';

-- ---------------------------------------------------------------- criar contas
CREATE OR REPLACE FUNCTION public.agent_propose_accounts(p_token TEXT, p_contas JSONB, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_item JSONB;
  v_nome TEXT;
  v_dominio TEXT;
  v_uf TEXT;
  v_novas JSONB := '[]'::jsonb;
  v_vistos TEXT[] := '{}';
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique por que estas contas.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF jsonb_typeof(p_contas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_contas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mande pelo menos uma conta (nome e site).');
  END IF;
  IF jsonb_array_length(p_contas) > 50 THEN RETURN jsonb_build_object('ok', false, 'erro', 'No máximo 50 contas por proposta.'); END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_contas) LOOP
    v_nome := NULLIF(btrim(COALESCE(v_item->>'nome', '')), '');
    IF v_nome IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Toda conta precisa de nome.'); END IF;
    v_dominio := public.normalize_domain(v_item->>'site');
    IF v_dominio IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Site inválido para "%s": use o domínio da empresa, como empresa.com.br.', v_nome));
    END IF;
    v_uf := NULLIF(upper(btrim(COALESCE(v_item->>'uf', ''))), '');
    IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('UF inválida para "%s" (use a sigla, como SP).', v_nome));
    END IF;
    CONTINUE WHEN v_dominio = ANY (v_vistos);
    v_vistos := v_vistos || v_dominio;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.accounts a WHERE a.workspace_id = v.workspace_id AND public.normalize_domain(a.domain) = v_dominio);
    v_novas := v_novas || jsonb_build_object('nome', left(v_nome, 200), 'dominio', v_dominio, 'uf', v_uf,
                                            'cidade', NULLIF(left(btrim(COALESCE(v_item->>'cidade', '')), 120), ''));
  END LOOP;
  IF jsonb_array_length(v_novas) = 0 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Todas essas contas já estão na base.'); END IF;

  RETURN internal.agente_propor(v, 'operacao', 'lista', format('Criar %s conta(s)', jsonb_array_length(v_novas)), v_motivo,
    format('Cria %s conta(s) depois da aprovação. Cada uma entra sozinha no enriquecimento.', jsonb_array_length(v_novas)),
    (SELECT string_agg(c->>'nome' || ' (' || (c->>'dominio') || ')', ', ') FROM jsonb_array_elements(v_novas) c),
    jsonb_build_object('acao', 'criar_contas', 'contas', v_novas), v_chave, 0);
END;
$$;

-- ---------------------------------------------------------------- pedir enriquecimento
CREATE OR REPLACE FUNCTION public.agent_propose_enrichment(p_token TEXT, p_account_ids UUID[], p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_ids UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_account_ids, '{}')) AS x WHERE x IS NOT NULL);
  v_nomes TEXT;
  v_n INTEGER;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique por que enriquecer estas contas.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  IF cardinality(v_ids) = 0 OR cardinality(v_ids) > 50 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Mande de 1 a 50 contas.'); END IF;
  SELECT count(*), string_agg(a.name, ', ' ORDER BY a.name) INTO v_n, v_nomes FROM public.accounts a WHERE a.workspace_id = v.workspace_id AND a.id = ANY (v_ids);
  IF v_n <> cardinality(v_ids) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Alguma conta não é deste workspace (use os ids de listar_contas).'); END IF;
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Enriquecer %s conta(s)', v_n), v_motivo,
    'As contas voltam para a fila de enriquecimento (empresa e pessoas). Gasta créditos: 5 por conta e 2 por pessoa achada; o que não achar nada devolve.',
    v_nomes, jsonb_build_object('acao', 'enriquecer_contas', 'account_ids', to_jsonb(v_ids)), v_chave, v_n * 15);
END;
$$;

-- ---------------------------------------------------------------- levar contas ao Pipeline
CREATE OR REPLACE FUNCTION public.agent_propose_add_to_pipeline(p_token TEXT, p_pipeline_id UUID, p_account_ids UUID[], p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_ids UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_account_ids, '{}')) AS x WHERE x IS NOT NULL);
  v_quadro public.pipelines;
  v_nomes TEXT;
  v_n INTEGER;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique por que levar estas contas ao Pipeline.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = v.workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Quadro não encontrado neste workspace.'); END IF;
  IF cardinality(v_ids) = 0 OR cardinality(v_ids) > 500 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Mande de 1 a 500 contas.'); END IF;
  SELECT count(*), string_agg(a.name, ', ' ORDER BY a.name) INTO v_n, v_nomes FROM public.accounts a WHERE a.workspace_id = v.workspace_id AND a.id = ANY (v_ids);
  IF v_n <> cardinality(v_ids) THEN RETURN jsonb_build_object('ok', false, 'erro', 'Alguma conta não é deste workspace (use os ids de listar_contas).'); END IF;
  RETURN internal.agente_propor(v, 'operacao', 'execucao', format('Levar %s conta(s) ao quadro %s', v_n, v_quadro.name), v_motivo,
    format('Cria um negócio por conta no quadro "%s" (%s), na primeira etapa, com valor 0. Quem já está no quadro não duplica.', v_quadro.name, upper(v_quadro.motion)),
    v_nomes, jsonb_build_object('acao', 'levar_contas', 'pipeline_id', p_pipeline_id, 'quadro', v_quadro.name, 'account_ids', to_jsonb(v_ids)), v_chave, 0);
END;
$$;

-- ---------------------------------------------------------------- plano: vários passos numa aprovação só
CREATE OR REPLACE FUNCTION public.agent_propose_plan(p_token TEXT, p_titulo TEXT, p_passos JSONB, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_titulo TEXT := NULLIF(left(btrim(COALESCE(p_titulo, '')), 160), '');
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_passo JSONB;
  v_i INTEGER := 0;
  v_r JSONB;
  v_filhos UUID[] := '{}';
  v_resumo JSONB := '[]'::jsonb;
  v_preview TEXT := '';
  v_tit TEXT;
  v_plano JSONB;
  v_existente UUID;
  v_ids_texto UUID[];
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v_titulo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Dê um título ao plano.'); END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o objetivo do plano.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 180 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 180 caracteres).'); END IF;
  IF jsonb_typeof(p_passos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_passos) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Um plano tem pelo menos 2 passos (para 1 passo, use a proposta direta).');
  END IF;
  IF jsonb_array_length(p_passos) > 20 THEN RETURN jsonb_build_object('ok', false, 'erro', 'No máximo 20 passos por plano.'); END IF;

  -- O mesmo plano de novo: devolve o que já existe.
  SELECT id INTO v_existente FROM public.approvals WHERE workspace_id = v.workspace_id AND idempotency_key = v_chave;
  IF FOUND THEN RETURN internal.agente_propor(v, 'operacao', 'execucao', '', '', '', '', '{}'::jsonb, v_chave, 0); END IF;

  BEGIN
    FOR v_passo IN SELECT * FROM jsonb_array_elements(p_passos) LOOP
      v_i := v_i + 1;
      v_ids_texto := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(COALESCE(v_passo->'conta_ids', '[]'::jsonb)) AS x);
      v_r := CASE v_passo->>'tipo'
        WHEN 'criar_contas' THEN public.agent_propose_accounts(p_token, v_passo->'contas', v_motivo, v_chave || ':' || v_i)
        WHEN 'enriquecer' THEN public.agent_propose_enrichment(p_token, v_ids_texto, v_motivo, v_chave || ':' || v_i)
        WHEN 'levar_contas' THEN public.agent_propose_add_to_pipeline(p_token, NULLIF(v_passo->>'quadro_id', '')::uuid, v_ids_texto, v_motivo, v_chave || ':' || v_i)
        WHEN 'criar_negocio' THEN public.agent_propose_deal(p_token, NULLIF(v_passo->>'quadro_id', '')::uuid, NULLIF(v_passo->>'conta_id', '')::uuid,
            COALESCE((v_passo->>'valor_reais')::numeric, 0), v_passo->>'etapa', NULLIF(v_passo->>'responsavel_id', '')::uuid,
            NULLIF(v_passo->>'fecha_em', '')::date, v_motivo, v_chave || ':' || v_i)
        WHEN 'mover_negocio' THEN public.agent_propose_move_deal(p_token, NULLIF(v_passo->>'negocio_id', '')::uuid, v_passo->>'etapa', v_motivo, v_chave || ':' || v_i)
        WHEN 'criar_tarefa' THEN public.agent_propose_task(p_token, v_passo->>'titulo', NULLIF(v_passo->>'contato_id', '')::uuid,
            NULLIF(v_passo->>'responsavel_id', '')::uuid, COALESCE((v_passo->>'prazo_dias')::int, 0), v_passo->>'observacao', v_motivo, v_chave || ':' || v_i)
        WHEN 'inscrever_cadencia' THEN public.agent_propose_enrollment(p_token, NULLIF(v_passo->>'cadencia_id', '')::uuid,
            NULLIF(v_passo->>'contato_id', '')::uuid, v_motivo, v_chave || ':' || v_i)
        ELSE jsonb_build_object('ok', false, 'erro', 'tipo desconhecido (use criar_contas, enriquecer, levar_contas, criar_negocio, mover_negocio, criar_tarefa ou inscrever_cadencia).')
      END;
      IF NOT COALESCE((v_r->>'ok')::boolean, false) OR v_r->>'status' IS DISTINCT FROM 'aguardando_aprovacao' THEN
        RAISE EXCEPTION 'Passo %: %', v_i, COALESCE(v_r->>'erro', 'não foi possível registrar.') USING ERRCODE = 'P0001';
      END IF;
      SELECT title INTO v_tit FROM public.approvals WHERE id = (v_r->>'approval_id')::uuid;
      v_filhos := v_filhos || (v_r->>'approval_id')::uuid;
      v_resumo := v_resumo || jsonb_build_object('passo', v_i, 'approval_id', v_r->>'approval_id', 'titulo', v_tit);
      v_preview := v_preview || v_i || '. ' || v_tit || E'\n';
    END LOOP;

    v_plano := internal.agente_propor(v, 'operacao', 'execucao', 'Plano: ' || v_titulo, v_motivo,
      format('Aprova os %s passos de uma vez; cada um é aplicado na ordem.', v_i), rtrim(v_preview, E'\n'),
      jsonb_build_object('acao', 'plano', 'titulo', v_titulo, 'passos', v_resumo), v_chave, 0);
    UPDATE public.approvals SET parent_approval_id = (v_plano->>'approval_id')::uuid WHERE id = ANY (v_filhos);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    -- Nada fica pela metade: os passos já registrados voltam junto (savepoint deste bloco).
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
  END;
  RETURN v_plano || jsonb_build_object('passos', v_i);
END;
$$;

-- ---------------------------------------------------------------- aplicar o que foi aprovado
CREATE OR REPLACE FUNCTION public.approvals_aplicar_agente_orquestra()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_user UUID := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
  p JSONB := NEW.payload_json;
  c JSONB;
  v_n INTEGER := 0;
  v_k INTEGER;
  v_r JSONB;
  v_filho RECORD;
BEGIN
  IF p->>'acao' = 'plano' THEN
    -- Os passos acompanham a decisão do plano, na ordem em que foram propostos.
    PERFORM set_config('althius.plano_decidindo', 'on', true);
    FOR v_filho IN SELECT id FROM public.approvals WHERE parent_approval_id = NEW.id AND status = 'pendente' ORDER BY created_at, id LOOP
      UPDATE public.approvals SET status = CASE WHEN NEW.status = 'aprovado' THEN 'aprovado' ELSE 'rejeitado' END,
             decided_by_member_id = NEW.decided_by_member_id, decided_at = now()
       WHERE id = v_filho.id;
      v_n := v_n + 1;
    END LOOP;
    PERFORM set_config('althius.plano_decidindo', 'off', true);
    NEW.history := NEW.history || jsonb_build_array(v_hora || CASE WHEN NEW.status = 'aprovado' THEN format(' %s passos aprovados e aplicados', v_n) ELSE format(' %s passos recusados', v_n) END);
    RETURN NEW;
  END IF;
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;

  IF p->>'acao' = 'criar_contas' THEN
    FOR c IN SELECT * FROM jsonb_array_elements(p->'contas') LOOP
      INSERT INTO public.accounts (workspace_id, name, domain, state_uf, city, temperature)
      VALUES (NEW.workspace_id, c->>'nome', c->>'dominio', NULLIF(c->>'uf', ''), NULLIF(c->>'cidade', ''), 1)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_k = ROW_COUNT;
      v_n := v_n + v_k;
    END LOOP;
    NEW.history := NEW.history || jsonb_build_array(v_hora || format(' %s conta(s) criada(s)', v_n));
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'approval', NEW.id::text, jsonb_build_object('acao', 'criar_contas', 'criadas', v_n));

  ELSIF p->>'acao' = 'enriquecer_contas' THEN
    INSERT INTO internal.account_enrichments (workspace_id, account_id, etapa)
    SELECT a.workspace_id, a.id, e.etapa
      FROM public.accounts a CROSS JOIN (VALUES ('empresa'), ('pessoas')) AS e(etapa)
     WHERE a.workspace_id = NEW.workspace_id AND a.id IN (SELECT x::uuid FROM jsonb_array_elements_text(p->'account_ids') AS x)
       AND a.status = 'ativa' AND NOT COALESCE(a.is_duplicate, false)
    ON CONFLICT (account_id, etapa) DO UPDATE SET estado = 'pendente', tentativas = 0, mensagem = NULL, updated_at = now()
      WHERE internal.account_enrichments.estado IN ('ok', 'sem_dado', 'erro', 'sem_saldo');
    GET DIAGNOSTICS v_k = ROW_COUNT;
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Contas na fila de enriquecimento');
    PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'approval', NEW.id::text, jsonb_build_object('acao', 'enriquecer_contas', 'na_fila', v_k));

  ELSIF p->>'acao' = 'levar_contas' THEN
    BEGIN
      v_r := internal.levar_contas_ao_quadro(NEW.workspace_id, (p->>'pipeline_id')::uuid,
        ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p->'account_ids') AS x), NEW.requested_by_member_id, false);
      NEW.history := NEW.history || jsonb_build_array(v_hora || format(' %s conta(s) no quadro; %s já estavam', v_r->>'criados', v_r->>'ja_estavam'));
      PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'pipeline', p->>'pipeline_id', jsonb_build_object('acao', 'levar_contas', 'criados', v_r->'criados'));
    EXCEPTION WHEN OTHERS THEN
      NEW.history := NEW.history || jsonb_build_array(v_hora || ' Não aplicado: ' || SQLERRM);
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_agente_orquestra ON public.approvals;
CREATE TRIGGER approvals_aplicar_agente_orquestra
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status <> 'pendente' AND NEW.agent_code IS NOT NULL)
  EXECUTE FUNCTION public.approvals_aplicar_agente_orquestra();

-- Um passo de plano não se decide sozinho: só junto com o plano.
CREATE OR REPLACE FUNCTION public.approvals_passo_so_com_o_plano()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(current_setting('althius.plano_decidindo', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Este pedido é um passo de um plano: decida o plano inteiro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_passo_so_com_o_plano ON public.approvals;
CREATE TRIGGER approvals_passo_so_com_o_plano
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status <> 'pendente' AND NEW.parent_approval_id IS NOT NULL)
  EXECUTE FUNCTION public.approvals_passo_so_com_o_plano();

-- ---------------------------------------------------------------- permissões (ADR 0023 e 0024)
REVOKE ALL ON FUNCTION public.agent_propose_accounts(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_enrichment(TEXT, UUID[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_add_to_pipeline(TEXT, UUID, UUID[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_plan(TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_agente_orquestra() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_passo_so_com_o_plano() FROM PUBLIC, anon, authenticated;
-- A porta do agente aceita anon porque cada função exige o token do agente (ADR 0024).
GRANT EXECUTE ON FUNCTION public.agent_propose_accounts(TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_enrichment(TEXT, UUID[], TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_add_to_pipeline(TEXT, UUID, UUID[], TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_plan(TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
