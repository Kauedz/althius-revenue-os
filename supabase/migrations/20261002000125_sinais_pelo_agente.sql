-- ==============================================================================
-- Migration: 20261002000125_sinais_pelo_agente.sql
-- Sinais pelo agente (ADR 0060, spec .scratch/sinais-pelo-agente). O agente acha na loja da Apify a fonte de um sinal,
-- TESTA numa conta do próprio cliente (com crédito e teto) e PROPÕE a receita; uma pessoa aprova; a receita aprovada passa
-- a ser usada só nas contas DESTE cliente, pelo mesmo coletor de sempre (ADR 0055).
--  - Receita de cliente (internal.signal_recipes_workspace) vale mais que a da equipe (internal.signal_recipes) para o
--    mesmo sinal, só naquele cliente. Nada muda para os outros clientes.
--  - Teto de gasto da receita do agente = o que o cliente paga pela coleta (créditos × preço do crédito ÷ câmbio): a
--    coleta nunca custa mais do que cobra. O agente nunca vê dólar.
--  - Testar gasta crédito do cliente e precisa de uma pessoa pedindo (a rodada em andamento, ADR 0058); 30 testes por dia.
--  - Propor exige um teste que deu certo de cada ator, nos últimos 7 dias, neste cliente.
--  - Sinais de pessoas (troca de cargo, posts) e sinais internos continuam com a receita da equipe.
-- ==============================================================================

-- 1. Receita do cliente: a que o agente propôs e uma pessoa aprovou.
CREATE TABLE IF NOT EXISTS internal.signal_recipes_workspace (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  fontes JSONB NOT NULL CHECK (jsonb_typeof(fontes) = 'array'),
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  approval_id UUID REFERENCES public.approvals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, signal_id)
);
COMMENT ON TABLE internal.signal_recipes_workspace IS 'Receita de coleta feita pelo agente e aprovada por uma pessoa do cliente (ADR 0060). Vale só neste cliente e tem prioridade sobre a da equipe.';
ALTER TABLE internal.signal_recipes_workspace ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.signal_recipes_workspace FROM PUBLIC, anon, authenticated;

-- 2. Testes de fonte que o agente faz antes de propor.
CREATE TABLE IF NOT EXISTS internal.signal_agent_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL,
  requested_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  ator TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'reservado' CHECK (estado IN ('reservado', 'ok', 'erro')),
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  creditos INTEGER NOT NULL DEFAULT 0,
  itens INTEGER,
  custo_usd NUMERIC(14, 6) CHECK (custo_usd IS NULL OR custo_usd >= 0),
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_signal_agent_tests_ws ON internal.signal_agent_tests (workspace_id, created_at DESC);
COMMENT ON TABLE internal.signal_agent_tests IS 'Testes de ator feitos pelo agente (ADR 0060). custo_usd é custo real do fornecedor: só sistema e superadmin.';
ALTER TABLE internal.signal_agent_tests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.signal_agent_tests FROM PUBLIC, anon, authenticated;

-- 3. Teto em dólar a partir dos créditos cobrados: 1 crédito = R$ 0,0529 (src/app/precos.ts, provisório) e US$ 1 = R$ 5,50
--    (câmbio de referência do dono, ADR 0055). Mudou o preço ou o câmbio? Muda só aqui (migration nova).
CREATE OR REPLACE FUNCTION internal.signal_teto_usd(p_creditos INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT round(GREATEST(COALESCE(p_creditos, 0), 1) * 0.0529 / 5.5, 4);
$$;
REVOKE ALL ON FUNCTION internal.signal_teto_usd(INTEGER) FROM PUBLIC, anon, authenticated;

-- 4. Sinal que o agente pode montar: externo (não interno) e de empresa (não de pessoas).
CREATE OR REPLACE FUNCTION internal.signal_tipo(p_signal_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN d.capability_code LIKE 'internal\_%' THEN 'interno'
    WHEN COALESCE((SELECT r.requer_contato_linkedin FROM internal.signal_recipes r WHERE r.signal_id = d.id), false) THEN 'pessoas'
    ELSE 'empresa' END
  FROM public.signal_definitions d WHERE d.id = p_signal_id;
$$;
REVOKE ALL ON FUNCTION internal.signal_tipo(UUID) FROM PUBLIC, anon, authenticated;

-- 5. Confere e normaliza as fontes que o agente propôs. Devolve {ok, fontes} ou {ok:false, erro}.
--    Formato de cada fonte: {ator, entrada, mapeamento, max_itens?, descricao?}. O mapeamento só aponta campos do item
--    e monta textos com {{campo}}: nada é executado. "vinculo" diz como o item prova que é da conta.
CREATE OR REPLACE FUNCTION internal.signal_fontes_normalizar(p_fontes JSONB, p_creditos INTEGER)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  f JSONB;
  m JSONB;
  v_out JSONB := '[]'::jsonb;
  v_i INTEGER := 0;
  v_max INTEGER;
  v_vinculo TEXT;
BEGIN
  IF p_fontes IS NULL OR jsonb_typeof(p_fontes) <> 'array' OR jsonb_array_length(p_fontes) NOT BETWEEN 1 AND 3 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Informe de 1 a 3 fontes (a primeira é a principal; as outras, reserva).');
  END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(p_fontes) LOOP
    v_i := v_i + 1;
    IF jsonb_typeof(f) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: precisa ser um objeto.', v_i)); END IF;
    IF COALESCE(f->>'ator', '') !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$' THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: ator inválido (use dono/nome, como na loja da Apify).', v_i));
    END IF;
    IF jsonb_typeof(f->'entrada') IS DISTINCT FROM 'object' OR length((f->'entrada')::text) > 4000 THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: a entrada do ator precisa ser um objeto de até 4000 caracteres.', v_i));
    END IF;
    m := f->'mapeamento';
    IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR length(m::text) > 2000 THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: falta o mapeamento (objeto de até 2000 caracteres).', v_i));
    END IF;
    IF COALESCE(btrim(m->>'texto'), '') = '' OR length(m->>'texto') > 300 OR COALESCE(btrim(m->>'chave'), '') = '' OR length(m->>'chave') > 300 THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: o mapeamento precisa de "texto" e "chave" (até 300 caracteres cada).', v_i));
    END IF;
    v_vinculo := m->>'vinculo';
    IF v_vinculo IS NULL OR v_vinculo NOT IN ('empresa', 'dominio', 'entrada') THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: diga no mapeamento o "vinculo" (empresa, dominio ou entrada): como o item prova que é desta conta.', v_i));
    END IF;
    IF v_vinculo = 'empresa' AND COALESCE(btrim(m->>'empresa'), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: vinculo "empresa" precisa do campo "empresa" (onde o item traz o nome da empresa).', v_i));
    END IF;
    IF v_vinculo = 'dominio' AND COALESCE(btrim(m->>'dominio'), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: vinculo "dominio" precisa do campo "dominio" (onde o item traz o site).', v_i));
    END IF;
    v_max := COALESCE(NULLIF(f->>'max_itens', '')::int, 20);
    IF v_max NOT BETWEEN 1 AND 50 THEN RETURN jsonb_build_object('ok', false, 'erro', format('Fonte %s: max_itens entre 1 e 50.', v_i)); END IF;
    v_out := v_out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'fonte', 'apify', 'ator', f->>'ator', 'entrada', f->'entrada', 'mapeamento', m, 'max_itens', v_max,
      'teto_usd', internal.signal_teto_usd(p_creditos), 'reserva', CASE WHEN v_i > 1 THEN true END,
      'descricao', NULLIF(left(btrim(COALESCE(f->>'descricao', '')), 160), ''))));
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'fontes', v_out);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN jsonb_build_object('ok', false, 'erro', 'max_itens precisa ser um número inteiro.');
END;
$$;
REVOKE ALL ON FUNCTION internal.signal_fontes_normalizar(JSONB, INTEGER) FROM PUBLIC, anon, authenticated;

-- 6. Catálogo para o agente: o que existe, o que já coleta e o que ele pode montar. Nunca mostra custo em dólar nem os
--    atores da equipe; mostra os da receita deste cliente (foi o próprio cliente que aprovou).
CREATE OR REPLACE FUNCTION public.agent_signal_catalog(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'codigo', d.code, 'nome', d.name, 'descricao', d.description, 'fonte_sugerida', d.source_label, 'agente', d.agent_code,
      'creditos_por_conta', d.credits_per_account, 'frequencia', COALESCE(s.frequency, d.frequency),
      'ligado_no_cliente', COALESCE(s.enabled, d.default_on),
      'tipo', internal.signal_tipo(d.id),
      'coleta', CASE WHEN rw.enabled THEN 'receita_do_cliente' WHEN rg.enabled THEN 'receita_da_equipe' ELSE 'sem_coleta' END,
      'atores_do_cliente', CASE WHEN rw.signal_id IS NOT NULL THEN (SELECT jsonb_agg(x->>'ator') FROM jsonb_array_elements(rw.fontes) x) END,
      'falhas_recentes', (SELECT count(*) FROM internal.signal_runs sr WHERE sr.workspace_id = v.workspace_id AND sr.signal_id = d.id
                            AND sr.estado = 'erro' AND sr.updated_at > now() - interval '14 days')
    ) ORDER BY d.agent_code, d.code)
      FROM public.signal_definitions d
      LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = v.workspace_id AND s.signal_id = d.id
      LEFT JOIN internal.signal_recipes rg ON rg.signal_id = d.id
      LEFT JOIN internal.signal_recipes_workspace rw ON rw.workspace_id = v.workspace_id AND rw.signal_id = d.id
     WHERE NOT d.is_custom OR EXISTS (SELECT 1 FROM public.workspace_signal_settings s2 WHERE s2.workspace_id = v.workspace_id AND s2.signal_id = d.id)
  ), '[]'::jsonb);
END;
$$;

-- 7. Começo de um teste: confere conta e sinal deste cliente, quem pediu, o limite do dia e reserva o crédito.
CREATE OR REPLACE FUNCTION public.signal_agent_test_start(p_token TEXT, p_signal_code TEXT, p_account_id UUID, p_ator TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_ctx JSONB;
  v_pessoa UUID;
  v_def public.signal_definitions;
  v_conta public.accounts;
  v_creditos INTEGER;
  v_exec UUID;
  v_teste UUID := gen_random_uuid();
  v_res JSONB;
  v_freq TEXT;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  v_ctx := public.integration_agent_context(p_token);
  v_pessoa := NULLIF(v_ctx->>'requester_member_id', '')::uuid;
  IF v_pessoa IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma pessoa pediu agora: o teste gasta créditos e só roda a pedido de alguém.'); END IF;
  IF COALESCE(p_ator, '') !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Ator inválido (use dono/nome, como na loja da Apify).'); END IF;
  SELECT * INTO v_def FROM public.signal_definitions WHERE code = p_signal_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Sinal não encontrado no catálogo.'); END IF;
  IF internal.signal_tipo(v_def.id) <> 'empresa' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este sinal é interno ou de pessoas: a coleta dele é montada pela equipe da Althius.');
  END IF;
  SELECT * INTO v_conta FROM public.accounts WHERE id = p_account_id AND workspace_id = v.workspace_id AND status = 'ativa';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Conta não encontrada (ou arquivada) neste cliente.'); END IF;
  IF (SELECT count(*) FROM internal.signal_agent_tests t WHERE t.workspace_id = v.workspace_id AND t.created_at > now() - interval '1 day') >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Limite de 30 testes de fonte por dia neste cliente. Tente amanhã ou proponha com o que já testou.');
  END IF;

  v_creditos := GREATEST(1, v_def.credits_per_account);
  SELECT COALESCE(s.frequency, v_def.frequency) INTO v_freq FROM (SELECT 1) x
    LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = v.workspace_id AND s.signal_id = v_def.id;
  INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
  VALUES (v.workspace_id, v.agent_code, v_def.capability_code, 'pending', v_pessoa, v_creditos,
          jsonb_build_object('signal_code', v_def.code, 'account_id', v_conta.id, 'teste_de_fonte', v_teste))
  RETURNING id INTO v_exec;
  v_res := public.credit_reserve(v.workspace_id, v_exec, v_creditos, 'Reserva: teste de fonte do sinal ' || v_def.name, 'teste-sinal:' || v_teste || ':reserve');
  IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
    UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo de créditos insuficiente para o teste.');
  END IF;
  UPDATE public.executions SET status = 'running', title = 'Teste de fonte: ' || v_def.name || ' · ' || v_conta.name, execution_type = 'Teste de fonte de sinal',
         reserved_credits = (v_res->>'reserved_amount')::int, progress = 10
   WHERE id = v_exec;
  INSERT INTO internal.signal_agent_tests (id, workspace_id, signal_id, account_id, agent_code, requested_by_member_id, ator, execution_id, reserved_credits, creditos)
  VALUES (v_teste, v.workspace_id, v_def.id, v_conta.id, v.agent_code, v_pessoa, p_ator, v_exec, (v_res->>'reserved_amount')::int, v_creditos);
  RETURN jsonb_build_object('ok', true, 'teste_id', v_teste, 'creditos', v_creditos, 'teto_usd', internal.signal_teto_usd(v_creditos),
    'frequencia', v_freq, 'workspace_id', v.workspace_id, 'agente', v.agent_code, 'em_nome_de', v_pessoa,
    'conta', jsonb_build_object('nome', v_conta.name, 'dominio', v_conta.domain, 'linkedin_nome', v_conta.linkedin_company_name, 'linkedin_url', v_conta.linkedin_company_url));
END;
$$;

-- 8. Fim do teste: deu certo cobra o crédito; falhou devolve. Idempotente (só quem está "reservado" termina).
CREATE OR REPLACE FUNCTION public.signal_agent_test_finish(p_teste_id UUID, p_ok BOOLEAN, p_itens INTEGER, p_custo_usd NUMERIC, p_mensagem TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t internal.signal_agent_tests;
  v_nome TEXT;
BEGIN
  SELECT * INTO t FROM internal.signal_agent_tests WHERE id = p_teste_id FOR UPDATE;
  IF NOT FOUND OR t.estado <> 'reservado' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF p_custo_usd IS NOT NULL AND p_custo_usd < 0 THEN RAISE EXCEPTION 'Custo inválido.' USING ERRCODE = '22023'; END IF;
  SELECT name INTO v_nome FROM public.signal_definitions WHERE id = t.signal_id;
  IF p_ok THEN
    IF t.reserved_credits > 0 OR t.creditos > 0 THEN
      PERFORM public.credit_consume(t.workspace_id, t.execution_id, t.creditos, t.reserved_credits, 'Teste de fonte do sinal ' || v_nome, 'teste-sinal:' || t.id || ':consume');
    END IF;
    UPDATE public.executions SET status = 'completed', actual_credits = t.creditos, progress = 100, processed_count = COALESCE(p_itens, 0) WHERE id = t.execution_id;
  ELSE
    IF t.reserved_credits > 0 THEN
      PERFORM public.credit_consume(t.workspace_id, t.execution_id, 0, t.reserved_credits, 'Liberação: teste de fonte falhou', 'teste-sinal:' || t.id || ':release');
    END IF;
    UPDATE public.executions SET status = 'failed', progress = 100,
           errors = errors || jsonb_build_array(jsonb_build_object('erro', COALESCE(left(p_mensagem, 300), 'falha no teste')))
     WHERE id = t.execution_id;
  END IF;
  UPDATE internal.signal_agent_tests SET estado = CASE WHEN p_ok THEN 'ok' ELSE 'erro' END, itens = p_itens, custo_usd = p_custo_usd,
         mensagem = left(p_mensagem, 300), finished_at = now()
   WHERE id = p_teste_id;
  PERFORM public.audit_write(t.workspace_id, NULL, 'agente_testou_fonte_de_sinal', 'signal', t.signal_id::text,
    jsonb_build_object('agente', t.agent_code, 'em_nome_de', t.requested_by_member_id, 'ator', t.ator, 'resultado', CASE WHEN p_ok THEN 'ok' ELSE 'erro' END, 'itens', p_itens));
  RETURN jsonb_build_object('acao', CASE WHEN p_ok THEN 'cobrado' ELSE 'devolvido' END, 'creditos', CASE WHEN p_ok THEN t.creditos ELSE 0 END);
END;
$$;

-- 9. Proposta de receita: vira aprovação de operação (C-level ou estrategista). Exige teste bom de cada ator.
CREATE OR REPLACE FUNCTION public.agent_propose_signal_recipe(p_token TEXT, p_signal_code TEXT, p_fontes JSONB, p_reason TEXT, p_idempotency_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_def public.signal_definitions;
  v_norm JSONB;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_sem_teste TEXT;
  v_payload JSONB;
  v_lista TEXT;
  v_freq TEXT;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  SELECT * INTO v_def FROM public.signal_definitions WHERE code = p_signal_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Sinal não encontrado no catálogo.'); END IF;
  IF internal.signal_tipo(v_def.id) <> 'empresa' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este sinal é interno ou de pessoas: a coleta dele é montada pela equipe da Althius.');
  END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo: por que esta fonte e o que o teste mostrou.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;
  v_norm := internal.signal_fontes_normalizar(p_fontes, v_def.credits_per_account);
  IF NOT (v_norm->>'ok')::boolean THEN RETURN v_norm; END IF;

  SELECT f->>'ator' INTO v_sem_teste FROM jsonb_array_elements(v_norm->'fontes') f
   WHERE NOT EXISTS (SELECT 1 FROM internal.signal_agent_tests t
                      WHERE t.workspace_id = v.workspace_id AND t.signal_id = v_def.id AND t.ator = f->>'ator'
                        AND t.estado = 'ok' AND COALESCE(t.itens, 0) > 0 AND t.created_at > now() - interval '7 days')
   LIMIT 1;
  IF v_sem_teste IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('Teste antes o ator %s numa conta deste cliente (sinais_testar_fonte) e confira que ele trouxe itens.', v_sem_teste));
  END IF;

  SELECT string_agg(COALESCE(f->>'descricao', f->>'ator') || CASE WHEN (f->>'reserva')::boolean THEN ' (reserva)' ELSE '' END, '; ')
    INTO v_lista FROM jsonb_array_elements(v_norm->'fontes') f;
  SELECT COALESCE(s.frequency, v_def.frequency) INTO v_freq FROM (SELECT 1) x
    LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = v.workspace_id AND s.signal_id = v_def.id;
  v_payload := jsonb_build_object('acao', 'receita_sinal', 'signal_id', v_def.id, 'signal_code', v_def.code, 'fontes', v_norm->'fontes');
  RETURN internal.agente_propor(v, 'operacao', 'execucao',
    format('Nova fonte para o sinal "%s"', v_def.name), v_motivo,
    format('Depois de aprovada, a coleta de "%s" passa a usar esta fonte nas contas ativas deste cliente com o sinal ligado: %s créditos por conta, frequência %s. Pode ser desligada depois.',
           v_def.name, v_def.credits_per_account, v_freq),
    left(format('Fontes: %s', v_lista), 400),
    v_payload, v_chave, 0);
END;
$$;

-- 10. Aprovada: a receita entra (ou é trocada) para este cliente.
CREATE OR REPLACE FUNCTION public.approvals_aplicar_receita_sinal()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_user UUID := (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id);
  p JSONB := NEW.payload_json;
BEGIN
  IF p->>'acao' IS DISTINCT FROM 'receita_sinal' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.signal_definitions WHERE id = (p->>'signal_id')::uuid) THEN
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Fonte não aplicada: o sinal não existe mais');
    RETURN NEW;
  END IF;
  INSERT INTO internal.signal_recipes_workspace (workspace_id, signal_id, enabled, fontes, agent_code, approval_id)
  VALUES (NEW.workspace_id, (p->>'signal_id')::uuid, true, p->'fontes', NEW.agent_code, NEW.id)
  ON CONFLICT (workspace_id, signal_id) DO UPDATE
    SET enabled = true, fontes = EXCLUDED.fontes, agent_code = EXCLUDED.agent_code, approval_id = EXCLUDED.approval_id, updated_at = now();
  NEW.history := NEW.history || jsonb_build_array(v_hora || ' Fonte do sinal aplicada: a próxima coleta já usa');
  PERFORM public.audit_write(NEW.workspace_id, v_user, 'agente.proposta_aplicada', 'signal', p->>'signal_id', p);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS approvals_aplicar_receita_sinal ON public.approvals;
CREATE TRIGGER approvals_aplicar_receita_sinal
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado' AND NEW.agent_code IS NOT NULL)
  EXECUTE FUNCTION public.approvals_aplicar_receita_sinal();

-- 11. A tela continua sabendo quais sinais coletam: os da equipe e os do(s) cliente(s) da pessoa logada.
CREATE OR REPLACE FUNCTION public.signal_codes_com_coleta()
RETURNS TEXT[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(DISTINCT d.code ORDER BY d.code), '{}'::text[])
    FROM public.signal_definitions d
   WHERE EXISTS (SELECT 1 FROM internal.signal_recipes r WHERE r.signal_id = d.id AND r.enabled)
      OR EXISTS (SELECT 1 FROM internal.signal_recipes_workspace rw
                   JOIN public.workspace_members wm ON wm.workspace_id = rw.workspace_id AND wm.status = 'active'
                  WHERE rw.signal_id = d.id AND rw.enabled AND wm.user_id = auth.uid());
$$;

-- 12. O coletor usa a receita do cliente quando ela existe; senão, a da equipe. Igual à versão da migration 118 no resto.
CREATE OR REPLACE FUNCTION public.signal_collect_next(p_limit INTEGER DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_prev internal.signal_runs;
  v_out JSONB := '[]'::jsonb;
  v_n INTEGER := 0;
  v_membro UUID;
  v_exec UUID;
  v_run UUID;
  v_tent INTEGER;
  v_chave TEXT;
  v_res JSONB;
  v_contatos JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('signal_collect_next'));
  FOR r IN
    SELECT a.id AS account_id, a.name AS account_name, a.domain AS account_domain, a.workspace_id,
           a.linkedin_company_name, a.linkedin_company_url,
           d.id AS signal_id, d.code, d.name AS signal_name, d.credits_per_account, d.agent_code, d.capability_code,
           CASE WHEN rw.enabled THEN rw.fontes ELSE rg.fontes END AS fontes,
           CASE WHEN rw.enabled THEN false ELSE COALESCE(rg.requer_contato_linkedin, false) END AS requer_contato_linkedin,
           CASE WHEN rw.enabled THEN 'cliente' ELSE 'equipe' END AS origem,
           COALESCE(s.frequency, d.frequency) AS frequencia, internal.signal_periodo(COALESCE(s.frequency, d.frequency)) AS periodo
      FROM public.accounts a
      JOIN public.signal_definitions d ON true
      LEFT JOIN internal.signal_recipes rg ON rg.signal_id = d.id AND rg.enabled
      LEFT JOIN internal.signal_recipes_workspace rw ON rw.workspace_id = a.workspace_id AND rw.signal_id = d.id AND rw.enabled
      LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = a.workspace_id AND s.signal_id = d.id
     WHERE a.status = 'ativa' AND (rw.enabled OR rg.enabled) AND COALESCE(s.enabled, d.default_on)
       AND (rw.enabled OR NOT COALESCE(rg.requer_contato_linkedin, false) OR EXISTS (
             SELECT 1 FROM public.contacts c JOIN public.contact_channels ch ON ch.contact_id = c.id AND ch.type = 'linkedin'
              WHERE c.account_id = a.id AND c.workspace_id = a.workspace_id))
     ORDER BY a.workspace_id, a.id, d.code
  LOOP
    EXIT WHEN v_n >= GREATEST(1, COALESCE(p_limit, 20));
    SELECT * INTO v_prev FROM internal.signal_runs WHERE signal_id = r.signal_id AND account_id = r.account_id AND periodo = r.periodo FOR UPDATE;
    IF FOUND THEN
      CONTINUE WHEN NOT (v_prev.estado IN ('erro', 'sem_saldo') AND v_prev.tentativas < 3 AND v_prev.updated_at < now() - interval '1 hour');
    END IF;

    SELECT wm.id INTO v_membro FROM public.workspace_members wm
     WHERE wm.workspace_id = r.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista')
     ORDER BY CASE wm.role WHEN 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
    IF v_membro IS NULL THEN
      INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, tentativas, mensagem)
      VALUES (r.workspace_id, r.signal_id, r.account_id, r.periodo, 'erro', 3, 'Cliente sem responsável ativo (C-level ou estrategista) para a coleta.')
      ON CONFLICT (signal_id, account_id, periodo) DO NOTHING;
      CONTINUE;
    END IF;

    v_tent := COALESCE(v_prev.tentativas, 0) + CASE WHEN COALESCE(v_prev.estado, '') = 'sem_saldo' THEN 0 ELSE 1 END;
    IF v_prev.id IS NULL THEN v_tent := 1; END IF;
    v_chave := 'sinal:' || r.code || ':' || r.account_id || ':' || r.periodo || ':a' || v_tent;

    INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
    VALUES (r.workspace_id, r.agent_code, r.capability_code, 'pending', v_membro, r.credits_per_account,
            jsonb_build_object('signal_code', r.code, 'account_id', r.account_id, 'periodo', r.periodo, 'coleta_key', v_chave, 'receita', r.origem))
    RETURNING id INTO v_exec;

    IF r.credits_per_account > 0 THEN
      v_res := public.credit_reserve(r.workspace_id, v_exec, r.credits_per_account, 'Reserva: coleta do sinal ' || r.signal_name, v_chave || ':reserve');
    ELSE
      v_res := jsonb_build_object('success', true, 'reserved_amount', 0);
    END IF;

    IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
      UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
      INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, tentativas, execution_id, mensagem)
      VALUES (r.workspace_id, r.signal_id, r.account_id, r.periodo, 'sem_saldo', v_tent, v_exec, 'Saldo de créditos insuficiente para a coleta.')
      ON CONFLICT (signal_id, account_id, periodo) DO UPDATE SET estado = 'sem_saldo', execution_id = v_exec, mensagem = EXCLUDED.mensagem, updated_at = now();
      CONTINUE;
    END IF;

    UPDATE public.executions
       SET status = 'running', title = 'Coleta: ' || r.signal_name || ' · ' || r.account_name, execution_type = 'Coleta de sinal',
           reserved_credits = (v_res->>'reserved_amount')::int, progress = 10
     WHERE id = v_exec;

    INSERT INTO internal.signal_runs (workspace_id, signal_id, account_id, periodo, estado, tentativas, execution_id, reserved_credits)
    VALUES (r.workspace_id, r.signal_id, r.account_id, r.periodo, 'reservada', v_tent, v_exec, (v_res->>'reserved_amount')::int)
    ON CONFLICT (signal_id, account_id, periodo) DO UPDATE
      SET estado = 'reservada', tentativas = v_tent, execution_id = v_exec, reserved_credits = EXCLUDED.reserved_credits, mensagem = NULL, updated_at = now()
    RETURNING id INTO v_run;

    v_contatos := '[]'::jsonb;
    IF r.requer_contato_linkedin THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.name, 'papel', t.buying_role,
               'linkedin_url', t.url, 'snapshot', sn.dados) ORDER BY t.ordem, t.created_at), '[]'::jsonb)
        INTO v_contatos
        FROM (SELECT c.id, c.name, c.buying_role, c.created_at,
                     (SELECT CASE WHEN trim(ch.value) ~* '^https?://' THEN trim(ch.value) ELSE 'https://www.linkedin.com/in/' || trim(ch.value) END
                        FROM public.contact_channels ch WHERE ch.contact_id = c.id AND ch.type = 'linkedin' ORDER BY ch.position LIMIT 1) AS url,
                     CASE c.buying_role WHEN 'decisor' THEN 1 WHEN 'campeao' THEN 2 ELSE 3 END AS ordem
                FROM public.contacts c
               WHERE c.account_id = r.account_id AND c.workspace_id = r.workspace_id
                 AND EXISTS (SELECT 1 FROM public.contact_channels ch WHERE ch.contact_id = c.id AND ch.type = 'linkedin')
               ORDER BY ordem, c.created_at LIMIT 5) t
        LEFT JOIN internal.signal_snapshots sn ON sn.signal_id = r.signal_id AND sn.account_id = r.account_id AND sn.chave = t.id::text;
    END IF;

    v_n := v_n + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'run_id', v_run, 'workspace_id', r.workspace_id, 'account_id', r.account_id, 'account_name', r.account_name,
      'account_domain', r.account_domain, 'linkedin_company_name', r.linkedin_company_name, 'linkedin_company_url', r.linkedin_company_url,
      'signal_code', r.code, 'signal_name', r.signal_name,
      'credits', r.credits_per_account, 'periodo', r.periodo, 'frequencia', r.frequencia, 'fontes', r.fontes, 'contatos', v_contatos));
  END LOOP;
  RETURN v_out;
END;
$$;

-- 13. Habilidade "fontes de sinais" para os 4 agentes de todo cliente (e dos clientes novos). O cliente pode editar.
CREATE OR REPLACE FUNCTION internal.habilidade_fontes_de_sinais()
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT $txt$# Fontes de sinais: achar, testar e propor

Use quando pedirem para coletar um sinal que ainda não coleta, quando um sinal parar de funcionar, ou quando pedirem "quero saber quando a empresa X fizer Y".

1. Veja o catálogo com sinais_catalogo. Só monte sinais do tipo "empresa"; os de "pessoas" e "interno" são da equipe da Althius. Se a coleta for "receita_da_equipe" e não houver falhas recentes, não troque.
2. Busque fontes com sinais_buscar_fontes (palavras em inglês costumam achar mais: "linkedin jobs", "google maps reviews", "company news"). Prefira fonte com muitos usuários, avaliação alta e poucas falhas. Compare pelo menos 2.
3. Leia a fonte escolhida com sinais_detalhar_fonte: a entrada que ela aceita (parametros) e um exemplo do que devolve.
4. Teste com sinais_testar_fonte numa conta ativa do cliente (listar_contas), com poucos itens. Use as variáveis {{empresa}}, {{dominio}}, {{site}}, {{linkedin_empresa}}, {{linkedin_url}} e {{dias}} na entrada. O teste gasta os créditos de uma coleta: avise antes quanto vai gastar.
5. Leia a amostra: os campos que vieram e os eventos que o mapeamento gerou. Ajuste o mapeamento até os eventos fazerem sentido. Itens de OUTRA empresa não podem virar evento: use vinculo "empresa" (com o campo do nome) ou "dominio" (com o campo do site); "entrada" só quando a própria entrada já é o site ou o perfil da conta.
6. Proponha com sinais_propor_receita: a fonte principal (e até 2 de reserva, também testadas), o mapeamento e o motivo (o que o teste mostrou). Vira uma aprovação; só depois a coleta usa.

Nunca invente o que a fonte devolve: se o teste veio vazio ou com erro, diga isso. Para o cliente, fale da origem do dado (LinkedIn Jobs, Google Maps, site da empresa) e em créditos, nunca em dólar.$txt$;
$$;
REVOKE ALL ON FUNCTION internal.habilidade_fontes_de_sinais() FROM PUBLIC, anon, authenticated;

INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled, version)
SELECT w.id, ag.code, 'Fontes de sinais: achar, testar e propor', 'fontes-de-sinais', internal.habilidade_fontes_de_sinais(), true, 'v1.0'
  FROM public.workspaces w CROSS JOIN (VALUES ('comercial'), ('marketing'), ('copy'), ('revops')) AS ag(code)
ON CONFLICT (workspace_id, agent_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION internal.semear_habilidade_fontes_de_sinais()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled, version)
  SELECT NEW.id, ag.code, 'Fontes de sinais: achar, testar e propor', 'fontes-de-sinais', internal.habilidade_fontes_de_sinais(), true, 'v1.0'
    FROM (VALUES ('comercial'), ('marketing'), ('copy'), ('revops')) AS ag(code)
  ON CONFLICT (workspace_id, agent_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.semear_habilidade_fontes_de_sinais() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workspaces_habilidade_fontes_de_sinais ON public.workspaces;
CREATE TRIGGER workspaces_habilidade_fontes_de_sinais AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION internal.semear_habilidade_fontes_de_sinais();

-- 14. Permissões (ADR 0023). A porta do agente aceita só o token (ADR 0024); começo e fim de teste são do sistema.
REVOKE ALL ON FUNCTION public.agent_signal_catalog(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_signal_recipe(TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.signal_agent_test_start(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.signal_agent_test_finish(UUID, BOOLEAN, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_receita_sinal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_signal_catalog(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_signal_recipe(TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.signal_agent_test_start(TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.signal_agent_test_finish(UUID, BOOLEAN, INTEGER, NUMERIC, TEXT) TO service_role;
