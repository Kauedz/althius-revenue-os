-- ==============================================================================
-- Migration: 20261002000132_icp_estruturado.sql
-- ICP estruturado (spec .scratch/prospeccao-revenue, fatia 3; ADR 0067). Até aqui o ICP era só texto no Playbook
-- (ADR 0057). Agora cada cliente tem campos: setores, CNAEs, porte, funcionários, faturamento, capital social, estados,
-- cidades e observações (`workspace_settings.icp`). Os cargos alvo continuam em `personas_alvo` (ADR 0062).
--  - Nada de valor padrão: sem ICP, o campo é vazio ({}). Campo vazio não vira valor.
--  - Gestor do cliente (C-level, estrategista, superadmin) edita na tela (Estratégia). BDR não.
--  - O Jax (marketing) PROPÕE mudanças: vira aprovação de operação; aprovada, o ICP muda.
--  - Os agentes leem o ICP (agent_icp) e ele entra no contexto de toda resposta (harness_playbook), para a Zoe montar as
--    buscas e o fit (fatia 4) usar.
-- ==============================================================================

ALTER TABLE public.workspace_settings ADD COLUMN IF NOT EXISTS icp JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(icp) = 'object');
COMMENT ON COLUMN public.workspace_settings.icp IS 'ICP estruturado do cliente (ADR 0067): setores, cnaes, portes, funcionarios_min/max, faturamento_min/max, capital_min/max, ufs, cidades, observacoes. Vazio = sem ICP.';

-- Confere e normaliza um ICP. Devolve {ok, icp} ou {ok:false, erro}.
CREATE OR REPLACE FUNCTION internal.icp_normalizar(p_icp JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_in JSONB := COALESCE(p_icp, '{}'::jsonb);
  v_out JSONB := '{}'::jsonb;
  v_chave TEXT;
  v_lista TEXT[];
  v_item TEXT;
  v_limpos TEXT[];
  v_n NUMERIC;
  v_par TEXT[];
  v_listas CONSTANT TEXT[] := ARRAY['setores', 'cnaes', 'portes', 'ufs', 'cidades'];
  v_numeros CONSTANT TEXT[] := ARRAY['funcionarios_min', 'funcionarios_max', 'faturamento_min', 'faturamento_max', 'capital_min', 'capital_max'];
BEGIN
  IF jsonb_typeof(v_in) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'erro', 'O ICP precisa ser um objeto.'); END IF;
  FOR v_chave IN SELECT jsonb_object_keys(v_in) LOOP
    IF NOT (v_chave = ANY (v_listas || v_numeros || ARRAY['observacoes', 'atualizado_em', 'atualizado_por'])) THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('O ICP não tem o campo "%s" (use: %s, observacoes).', v_chave, array_to_string(v_listas || v_numeros, ', ')));
    END IF;
  END LOOP;

  FOREACH v_chave IN ARRAY v_listas LOOP
    CONTINUE WHEN NOT (v_in ? v_chave) OR jsonb_typeof(v_in->v_chave) = 'null';
    IF jsonb_typeof(v_in->v_chave) = 'string' THEN
      v_lista := string_to_array(v_in->>v_chave, ',');
    ELSIF jsonb_typeof(v_in->v_chave) = 'array' THEN
      v_lista := ARRAY(SELECT x FROM jsonb_array_elements_text(v_in->v_chave) x);
    ELSE
      RETURN jsonb_build_object('ok', false, 'erro', format('"%s" é uma lista.', v_chave));
    END IF;
    v_limpos := '{}';
    FOREACH v_item IN ARRAY v_lista LOOP
      v_item := btrim(regexp_replace(COALESCE(v_item, ''), '\s+', ' ', 'g'));
      CONTINUE WHEN v_item = '';
      CASE v_chave
        WHEN 'cnaes' THEN
          v_item := regexp_replace(v_item, '[^0-9]', '', 'g');
          IF v_item !~ '^[0-9]{7}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Cada CNAE tem 7 dígitos (ex.: 8630504).'); END IF;
        WHEN 'portes' THEN
          v_item := upper(v_item);
          IF v_item NOT IN ('MICRO', 'EPP', 'DEMAIS') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Porte aceita só MICRO, EPP e DEMAIS (como a Receita Federal).'); END IF;
        WHEN 'ufs' THEN
          v_item := upper(v_item);
          IF v_item NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
            RETURN jsonb_build_object('ok', false, 'erro', format('"%s" não é sigla de estado (ex.: SP).', v_item));
          END IF;
        ELSE
          IF length(v_item) > 80 THEN RETURN jsonb_build_object('ok', false, 'erro', format('Cada item de "%s" tem até 80 caracteres.', v_chave)); END IF;
      END CASE;
      -- Sem repetir (sem diferenciar maiúsculas).
      CONTINUE WHEN EXISTS (SELECT 1 FROM unnest(v_limpos) y WHERE lower(y) = lower(v_item));
      v_limpos := v_limpos || v_item;
    END LOOP;
    IF cardinality(v_limpos) > 50 THEN RETURN jsonb_build_object('ok', false, 'erro', format('"%s" aceita até 50 itens.', v_chave)); END IF;
    IF cardinality(v_limpos) > 0 THEN v_out := v_out || jsonb_build_object(v_chave, to_jsonb(v_limpos)); END IF;
  END LOOP;

  FOREACH v_chave IN ARRAY v_numeros LOOP
    CONTINUE WHEN NOT (v_in ? v_chave) OR jsonb_typeof(v_in->v_chave) = 'null' OR btrim(v_in->>v_chave) = '';
    BEGIN v_n := replace(replace(v_in->>v_chave, '.', ''), ',', '.')::numeric;
    EXCEPTION WHEN others THEN v_n := NULL; END;
    IF jsonb_typeof(v_in->v_chave) = 'number' THEN v_n := (v_in->>v_chave)::numeric; END IF;
    IF v_n IS NULL OR v_n < 0 THEN RETURN jsonb_build_object('ok', false, 'erro', format('"%s" é um número (sem letras, maior ou igual a zero).', v_chave)); END IF;
    v_out := v_out || jsonb_build_object(v_chave, v_n);
  END LOOP;
  FOREACH v_chave IN ARRAY ARRAY['funcionarios', 'faturamento', 'capital'] LOOP
    IF (v_out->>(v_chave || '_min'))::numeric > (v_out->>(v_chave || '_max'))::numeric THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Em %s, o mínimo é maior que o máximo.', v_chave));
    END IF;
  END LOOP;

  IF NULLIF(btrim(COALESCE(v_in->>'observacoes', '')), '') IS NOT NULL THEN
    IF length(v_in->>'observacoes') > 1000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Observações com até 1000 caracteres.'); END IF;
    v_out := v_out || jsonb_build_object('observacoes', btrim(v_in->>'observacoes'));
  END IF;
  RETURN jsonb_build_object('ok', true, 'icp', v_out);
END;
$$;
REVOKE ALL ON FUNCTION internal.icp_normalizar(JSONB) FROM PUBLIC, anon, authenticated;

-- O ICP em texto, para o contexto do agente. Vazio = nulo.
CREATE OR REPLACE FUNCTION internal.icp_texto(p_icp JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN COALESCE(p_icp, '{}'::jsonb) - 'atualizado_em' - 'atualizado_por' = '{}'::jsonb THEN NULL ELSE
    concat_ws(E'\n', '## ICP estruturado (tela Estratégia)',
      CASE WHEN p_icp ? 'setores' THEN '- Setores: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(p_icp->'setores') x) END,
      CASE WHEN p_icp ? 'cnaes' THEN '- CNAEs: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(p_icp->'cnaes') x) END,
      CASE WHEN p_icp ? 'portes' THEN '- Porte (Receita Federal): ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(p_icp->'portes') x) END,
      CASE WHEN p_icp ? 'funcionarios_min' OR p_icp ? 'funcionarios_max' THEN
        '- Funcionários: ' || COALESCE(p_icp->>'funcionarios_min', '?') || ' a ' || COALESCE(p_icp->>'funcionarios_max', '?') END,
      CASE WHEN p_icp ? 'faturamento_min' OR p_icp ? 'faturamento_max' THEN
        '- Faturamento anual (R$): ' || COALESCE(p_icp->>'faturamento_min', '?') || ' a ' || COALESCE(p_icp->>'faturamento_max', '?') END,
      CASE WHEN p_icp ? 'capital_min' OR p_icp ? 'capital_max' THEN
        '- Capital social (R$): ' || COALESCE(p_icp->>'capital_min', '?') || ' a ' || COALESCE(p_icp->>'capital_max', '?') END,
      CASE WHEN p_icp ? 'ufs' THEN '- Estados: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(p_icp->'ufs') x) END,
      CASE WHEN p_icp ? 'cidades' THEN '- Cidades: ' || (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(p_icp->'cidades') x) END,
      CASE WHEN p_icp ? 'observacoes' THEN '- Observações: ' || (p_icp->>'observacoes') END)
  END;
$$;
REVOKE ALL ON FUNCTION internal.icp_texto(JSONB) FROM PUBLIC, anon, authenticated;

-- Grava (já normalizado) com a marca de quem mudou e quando.
CREATE OR REPLACE FUNCTION internal.icp_gravar(p_workspace_id UUID, p_icp JSONB, p_quem TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_icp JSONB := p_icp || jsonb_build_object('atualizado_em', now(), 'atualizado_por', p_quem);
BEGIN
  INSERT INTO public.workspace_settings (workspace_id, icp) VALUES (p_workspace_id, v_icp)
  ON CONFLICT (workspace_id) DO UPDATE SET icp = EXCLUDED.icp;
  RETURN v_icp;
END;
$$;
REVOKE ALL ON FUNCTION internal.icp_gravar(UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;

-- Tela: gestor do cliente edita.
CREATE OR REPLACE FUNCTION public.workspace_icp_set(p_workspace_id UUID, p_member_id UUID, p_icp JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role TEXT;
  v_norm JSONB;
  v_icp JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active';
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'estrategista', 'clevel') THEN
    RAISE EXCEPTION 'Só gestores do cliente (C-level ou estrategista) editam o ICP.' USING ERRCODE = '42501';
  END IF;
  v_norm := internal.icp_normalizar(p_icp);
  IF NOT (v_norm->>'ok')::boolean THEN RAISE EXCEPTION '%', v_norm->>'erro' USING ERRCODE = '22023'; END IF;
  v_icp := internal.icp_gravar(p_workspace_id, v_norm->'icp', p_member_id::text);
  PERFORM public.audit_write(p_workspace_id, (SELECT user_id FROM public.workspace_members WHERE id = p_member_id), 'icp_atualizado', 'workspace', p_workspace_id::text, v_norm->'icp');
  RETURN jsonb_build_object('ok', true, 'icp', v_icp);
END;
$$;

-- Porta do agente: ler (todos os agentes) e propor (só o Jax).
CREATE OR REPLACE FUNCTION public.agent_icp(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((SELECT jsonb_build_object('icp', s.icp - 'atualizado_por', 'personas_alvo', s.personas_alvo)
                     FROM public.workspace_settings s WHERE s.workspace_id = v.workspace_id),
                  jsonb_build_object('icp', '{}'::jsonb, 'personas_alvo', '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_propose_icp(p_token TEXT, p_icp JSONB, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_norm JSONB;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF v.agent_code <> 'marketing' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Quem cuida do ICP é o Jax (estratégia). Peça a ele.'); END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique por que mudar o ICP (o que os dados ou o Playbook mostram).'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  v_norm := internal.icp_normalizar(p_icp);
  IF NOT (v_norm->>'ok')::boolean THEN RETURN v_norm; END IF;
  IF v_norm->'icp' = '{}'::jsonb THEN RETURN jsonb_build_object('ok', false, 'erro', 'O ICP proposto está vazio.'); END IF;
  RETURN internal.agente_propor(v, 'operacao', 'execucao', 'Atualizar o ICP', v_motivo,
    'Substitui o ICP estruturado do cliente (tela Estratégia). A Zoe passa a usar este ICP nas buscas e o fit das contas é recalculado.',
    left(internal.icp_texto(v_norm->'icp'), 900), jsonb_build_object('acao', 'icp', 'icp', v_norm->'icp'), v_chave, 0);
END;
$$;

-- Aprovada a proposta do Jax: o ICP muda.
CREATE OR REPLACE FUNCTION internal.approvals_aplicar_icp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_norm JSONB := internal.icp_normalizar(NEW.payload_json->'icp');
BEGIN
  IF NOT (v_norm->>'ok')::boolean THEN RETURN NEW; END IF;
  PERFORM internal.icp_gravar(NEW.workspace_id, v_norm->'icp', 'agente:' || NEW.agent_code);
  PERFORM public.audit_write(NEW.workspace_id, (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id),
    'agente.proposta_aplicada', 'workspace', NEW.workspace_id::text, NEW.payload_json);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.approvals_aplicar_icp() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS approvals_aplicar_icp ON public.approvals;
CREATE TRIGGER approvals_aplicar_icp AFTER UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado' AND NEW.agent_code IS NOT NULL AND NEW.payload_json->>'acao' = 'icp')
  EXECUTE FUNCTION internal.approvals_aplicar_icp();

-- O contexto de toda resposta do agente leva o ICP junto do Playbook publicado (ADR 0057).
CREATE OR REPLACE FUNCTION public.harness_playbook(p_workspace_id UUID, p_agent_code TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH p AS (
    SELECT p.version, p.content_markdown FROM public.agent_playbooks p
     WHERE p.workspace_id = p_workspace_id AND p.agent_id = p_agent_code AND p.is_published LIMIT 1
  ), i AS (
    SELECT internal.icp_texto(s.icp) AS texto FROM public.workspace_settings s WHERE s.workspace_id = p_workspace_id
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM p) THEN jsonb_build_object('versao', (SELECT version FROM p),
      'conteudo', concat_ws(E'\n\n', (SELECT content_markdown FROM p), (SELECT texto FROM i)))
    WHEN (SELECT texto FROM i) IS NOT NULL THEN jsonb_build_object('versao', 'icp', 'conteudo', (SELECT texto FROM i))
  END;
$$;

REVOKE ALL ON FUNCTION public.workspace_icp_set(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_icp_set(UUID, UUID, JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.agent_icp(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_icp(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_icp(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_icp(TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.harness_playbook(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.harness_playbook(UUID, TEXT) TO service_role;
