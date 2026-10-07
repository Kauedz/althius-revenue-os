-- ==============================================================================
-- Migration: 20261002000138_orcamento_de_coleta.sql
-- ADR 0069. O cliente paga uma assinatura mensal fixa (valor combinado em contrato) e recebe créditos; o que a Althius gasta de verdade com a
-- coleta (Apify: sinais, enriquecimento, prospecção, teste de fonte) tem TETO EM DÓLAR por cliente e por mês (padrão US$ 50),
-- para o custo nunca passar do que o cliente paga. Valem as duas travas: os créditos do cliente E este orçamento.
--   - o gasto do mês = custo real das coletas já feitas (quando o fornecedor ainda não fechou a conta, vale o teto do crédito
--     cobrado) + o teto do que está em andamento. Mês de Brasília;
--   - antes de reservar qualquer coleta, o banco confere se cabe; se não cabe, nada é reservado nem gasto;
--   - dólar fica só no superadmin (Uso global); o cliente vê só a porcentagem e quantos créditos de coleta ainda cabem;
--   - o limite do Copiloto passa de 60 para 100 perguntas por pessoa por dia (continua grátis).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS internal.coleta_orcamento (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  orcamento_usd NUMERIC(8, 2) NOT NULL DEFAULT 50 CHECK (orcamento_usd >= 0),
  atualizado_por UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE internal.coleta_orcamento IS 'Teto mensal, em dólar, do que a Althius gasta com a coleta (Apify) de cada cliente. Só superadmin (ADR 0069). Sem linha = padrão de US$ 50.';
ALTER TABLE internal.coleta_orcamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.coleta_orcamento FROM PUBLIC, anon, authenticated;

-- Dólar de um crédito, no teto que a coleta pode gastar por crédito cobrado (R$ 0,0529 por crédito, dólar a R$ 5,50).
CREATE OR REPLACE FUNCTION internal.credito_em_usd(p_creditos INTEGER)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT round(GREATEST(COALESCE(p_creditos, 0), 0) * 0.0529 / 5.5, 6);
$$;
REVOKE ALL ON FUNCTION internal.credito_em_usd(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.mes_de_brasilia()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
$$;
REVOKE ALL ON FUNCTION internal.mes_de_brasilia() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.apify_orcamento_usd(p_workspace_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE((SELECT o.orcamento_usd FROM internal.coleta_orcamento o WHERE o.workspace_id = p_workspace_id), 50);
$$;
REVOKE ALL ON FUNCTION internal.apify_orcamento_usd(UUID) FROM PUBLIC, anon, authenticated;

-- Gasto do mês com a coleta: custo real quando já fechou; senão o teto do crédito (reservado ou cobrado).
CREATE OR REPLACE FUNCTION internal.apify_gasto_usd(p_workspace_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT round(
      COALESCE((SELECT sum(CASE WHEN sr.estado = 'reservada' THEN internal.credito_em_usd(sr.reserved_credits)
                                ELSE COALESCE(sr.custo_usd, internal.credito_em_usd(d.credits_per_account)) END)
                  FROM internal.signal_runs sr JOIN public.signal_definitions d ON d.id = sr.signal_id
                 WHERE sr.workspace_id = p_workspace_id AND sr.estado IN ('reservada', 'ok', 'sem_novidade')
                   AND COALESCE(sr.finished_at, sr.created_at) >= internal.mes_de_brasilia()), 0)
    + COALESCE((SELECT sum(CASE WHEN e.estado = 'reservada' THEN internal.credito_em_usd(e.reserved_credits)
                                ELSE COALESCE(e.custo_usd, internal.credito_em_usd(e.creditos)) END)
                  FROM internal.account_enrichments e
                 WHERE e.workspace_id = p_workspace_id AND e.estado IN ('reservada', 'ok', 'sem_dado')
                   AND COALESCE(e.finished_at, e.updated_at) >= internal.mes_de_brasilia()), 0)
    + COALESCE((SELECT sum(CASE WHEN s.estado = 'reservada' THEN internal.credito_em_usd(s.reserved_credits)
                                ELSE COALESCE(c.custo_usd, internal.credito_em_usd(s.creditos_cobrados)) END)
                  FROM public.prospect_searches s LEFT JOIN internal.prospect_search_costs c ON c.search_id = s.id
                 WHERE s.workspace_id = p_workspace_id AND s.estado IN ('reservada', 'concluida', 'sem_resultado')
                   AND COALESCE(s.finished_at, s.updated_at) >= internal.mes_de_brasilia()), 0)
    + COALESCE((SELECT sum(CASE WHEN t.estado = 'reservado' THEN internal.credito_em_usd(t.reserved_credits)
                                ELSE COALESCE(t.custo_usd, internal.credito_em_usd(t.creditos)) END)
                  FROM internal.signal_agent_tests t
                 WHERE t.workspace_id = p_workspace_id AND t.estado IN ('reservado', 'ok')
                   AND COALESCE(t.finished_at, t.created_at) >= internal.mes_de_brasilia()), 0)
  , 6);
$$;
REVOKE ALL ON FUNCTION internal.apify_gasto_usd(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.coleta_restante_usd(p_workspace_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT GREATEST(0, internal.apify_orcamento_usd(p_workspace_id) - internal.apify_gasto_usd(p_workspace_id));
$$;
REVOKE ALL ON FUNCTION internal.coleta_restante_usd(UUID) FROM PUBLIC, anon, authenticated;

-- Quantos créditos de coleta ainda cabem (com a folga de 25% que a reserva sempre leva). É o que o cliente vê no lugar do dólar.
CREATE OR REPLACE FUNCTION internal.coleta_restante_creditos(p_workspace_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT floor(internal.coleta_restante_usd(p_workspace_id) * 5.5 / 0.0529 / 1.25)::integer;
$$;
REVOKE ALL ON FUNCTION internal.coleta_restante_creditos(UUID) FROM PUBLIC, anon, authenticated;

-- Cabe? Confere o job inteiro com a folga da reserva (créditos × 1,25).
CREATE OR REPLACE FUNCTION internal.coleta_cabe(p_workspace_id UUID, p_creditos INTEGER)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(p_creditos, 0) <= 0
      OR internal.coleta_restante_usd(p_workspace_id) >= internal.credito_em_usd(ceil(p_creditos * 1.25)::integer);
$$;
REVOKE ALL ON FUNCTION internal.coleta_cabe(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- Superadmin: ajusta o orçamento de coleta de um cliente (dólar, só aqui).
CREATE OR REPLACE FUNCTION public.admin_coleta_orcamento_set(p_workspace_id UUID, p_usd NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  IF p_usd IS NULL OR p_usd < 0 OR p_usd > 100000 THEN RAISE EXCEPTION 'Orçamento inválido (de 0 a 100.000 dólares).' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id) THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = '22023'; END IF;
  INSERT INTO internal.coleta_orcamento (workspace_id, orcamento_usd, atualizado_por) VALUES (p_workspace_id, round(p_usd, 2), auth.uid())
  ON CONFLICT (workspace_id) DO UPDATE SET orcamento_usd = EXCLUDED.orcamento_usd, atualizado_por = auth.uid(), updated_at = now();
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'coleta.orcamento_ajustado', 'workspace', p_workspace_id::text, jsonb_build_object('orcamento_usd', round(p_usd, 2)));
  RETURN jsonb_build_object('ok', true, 'orcamento_usd', round(p_usd, 2));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_coleta_orcamento_set(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_coleta_orcamento_set(UUID, NUMERIC) TO authenticated, service_role;

-- Cliente: quanto da capacidade de coleta do mês já foi usada e o teto de sinais, sem dólar.
CREATE OR REPLACE FUNCTION public.coleta_painel(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role TEXT;
  v_orc NUMERIC := internal.apify_orcamento_usd(p_workspace_id);
  v_gasto NUMERIC := internal.apify_gasto_usd(p_workspace_id);
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Você não participa deste workspace.' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'coleta_percentual', CASE WHEN v_orc <= 0 THEN 100 ELSE least(100, floor(v_gasto / v_orc * 100))::int END,
    'coleta_restante_creditos', internal.coleta_restante_creditos(p_workspace_id),
    'coleta_atingida', internal.coleta_restante_usd(p_workspace_id) <= 0,
    'sinais_teto', COALESCE((SELECT ws.teto_sinais_mes FROM public.workspace_settings ws WHERE ws.workspace_id = p_workspace_id), 2000),
    'sinais_gasto', internal.signal_gasto_mes(p_workspace_id),
    'contas_monitoradas', (SELECT count(*) FROM public.accounts a WHERE a.workspace_id = p_workspace_id AND a.status = 'ativa' AND internal.conta_monitorada(a.id)),
    'pode_editar_teto', v_role IN ('clevel', 'superadmin'));
END;
$$;
REVOKE ALL ON FUNCTION public.coleta_painel(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coleta_painel(UUID, UUID) TO authenticated, service_role;

-- ---- Funções que passam a conferir o orçamento (e o Copiloto com 100 perguntas) ----

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
       AND internal.conta_monitorada(a.id)
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

    -- Teto mensal de créditos de sinais do cliente: o que passar não coleta sozinho (sobra crédito para prospectar).
    CONTINUE WHEN internal.signal_gasto_mes(r.workspace_id) + r.credits_per_account
                > COALESCE((SELECT ws.teto_sinais_mes FROM public.workspace_settings ws WHERE ws.workspace_id = r.workspace_id), 2000);

    -- Orçamento de coleta do mês (ADR 0069): o que não cabe espera o mês virar; nada é reservado.
    CONTINUE WHEN NOT internal.coleta_cabe(r.workspace_id, r.credits_per_account);

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

CREATE OR REPLACE FUNCTION public.enrichment_next(p_limit INTEGER DEFAULT 10)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_n INTEGER := 0;
  v_membro UUID;
  v_exec UUID;
  v_res JSONB;
  v_creditos INTEGER;
  v_preco_pessoa INTEGER := (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'pessoa');
  v_chave TEXT;
  v_extra JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('enrichment_next'));
  FOR r IN
    SELECT j.*, a.name AS conta_nome
      FROM internal.account_enrichments j
      JOIN public.accounts a ON a.id = j.account_id AND a.status = 'ativa'
     WHERE (j.estado = 'pendente' OR (j.estado IN ('erro', 'sem_saldo') AND j.tentativas < 3 AND j.updated_at < now() - interval '1 hour'))
       AND (j.etapa = 'empresa' OR EXISTS (SELECT 1 FROM internal.account_enrichments e2
                                            WHERE e2.account_id = j.account_id AND e2.etapa = 'empresa'
                                              AND (e2.estado IN ('ok', 'sem_dado') OR (e2.estado = 'erro' AND e2.tentativas >= 3))))
     ORDER BY j.etapa = 'pessoas', j.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 10))
     FOR UPDATE OF j SKIP LOCKED
  LOOP
    SELECT wm.id INTO v_membro FROM public.workspace_members wm
     WHERE wm.workspace_id = r.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista')
     ORDER BY CASE wm.role WHEN 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
    IF v_membro IS NULL THEN
      UPDATE internal.account_enrichments SET estado = 'erro', tentativas = 3, mensagem = 'Cliente sem responsável ativo (C-level ou estrategista).', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;

    v_creditos := CASE r.etapa WHEN 'empresa' THEN (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'empresa') ELSE 5 * v_preco_pessoa END;
    IF NOT internal.coleta_cabe(r.workspace_id, v_creditos) THEN
      UPDATE internal.account_enrichments SET estado = 'sem_saldo', mensagem = 'Limite de coleta do mês atingido. Tentamos de novo quando o limite for liberado ou o mês virar.', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    v_chave := 'enriq:' || r.id || ':a' || (r.tentativas + 1);
    INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
    VALUES (r.workspace_id, 'comercial', CASE r.etapa WHEN 'empresa' THEN 'company_enrichment' ELSE 'person_enrichment' END, 'pending', v_membro, v_creditos,
            jsonb_build_object('account_id', r.account_id, 'etapa', r.etapa, 'enriquecimento_key', v_chave))
    RETURNING id INTO v_exec;
    v_res := CASE WHEN v_creditos > 0 THEN public.credit_reserve(r.workspace_id, v_exec, v_creditos, 'Reserva: enriquecimento (' || r.etapa || ') de ' || r.conta_nome, v_chave || ':reserve')
                  ELSE jsonb_build_object('success', true, 'reserved_amount', 0) END;
    IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
      UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
      UPDATE internal.account_enrichments SET estado = 'sem_saldo', execution_id = v_exec, mensagem = 'Saldo de créditos insuficiente para o enriquecimento.', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    UPDATE public.executions SET status = 'running', execution_type = 'Enriquecimento', progress = 10, reserved_credits = (v_res->>'reserved_amount')::int,
           title = CASE r.etapa WHEN 'empresa' THEN 'Enriquecer empresa: ' ELSE 'Achar personas: ' END || r.conta_nome
     WHERE id = v_exec;
    UPDATE internal.account_enrichments SET estado = 'reservada', tentativas = r.tentativas + 1, execution_id = v_exec,
           reserved_credits = (v_res->>'reserved_amount')::int, mensagem = NULL, updated_at = now()
     WHERE id = r.id;

    IF r.etapa = 'pessoas' THEN
      SELECT jsonb_build_object(
        'personas_alvo', COALESCE((SELECT ws.personas_alvo FROM public.workspace_settings ws WHERE ws.workspace_id = r.workspace_id),
                                  '[{"cargo":"CEO","papel":"decisor"},{"cargo":"Diretor","papel":"decisor"}]'::jsonb),
        'max_pessoas', 5,
        'ja_tem', (SELECT COALESCE(jsonb_agg(DISTINCT ch.value_normalized), '[]'::jsonb) FROM public.contact_channels ch
                     JOIN public.contacts c ON c.id = ch.contact_id
                    WHERE c.account_id = r.account_id AND ch.type = 'linkedin'),
        'contatos_na_conta', (SELECT count(*) FROM public.contacts c WHERE c.account_id = r.account_id))
        INTO v_extra;
    ELSE
      v_extra := '{}'::jsonb;
    END IF;

    v_n := v_n + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'job_id', r.id, 'etapa', r.etapa, 'workspace_id', r.workspace_id, 'creditos', v_creditos,
      'teto_usd', internal.signal_teto_usd(v_creditos),
      'conta', (SELECT jsonb_build_object('id', a.id, 'nome', a.name, 'dominio', a.domain, 'cnpj', a.cnpj, 'razao_social', a.razao_social,
                  'cidade', a.city, 'uf', a.state_uf, 'cep', a.cep, 'endereco', a.endereco, 'lat', a.lat, 'lng', a.lng,
                  'linkedin_nome', a.linkedin_company_name, 'linkedin_url', a.linkedin_company_url, 'campos_manuais', to_jsonb(a.campos_manuais))
                  FROM public.accounts a WHERE a.id = r.account_id)) || v_extra);
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_prospect_estimate(p_token TEXT, p_source_code TEXT, p_parametros JSONB, p_max_empresas INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  f internal.prospect_sources;
  v_norm JSONB;
  v_creditos INTEGER;
  v_id UUID;
  v_titulo TEXT;
  v_pessoa UUID;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF internal.so_a_zoe(v) IS NOT NULL THEN RETURN internal.so_a_zoe(v); END IF;
  SELECT * INTO f FROM internal.prospect_sources WHERE code = p_source_code AND ativo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Fonte não encontrada (veja prospeccao_fontes).'); END IF;
  IF f.publico <> 'empresas' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta fonte traz PESSOAS (B2C), não empresas: pela LGPD ela só roda com decisão explícita da Althius.');
  END IF;
  IF p_max_empresas IS NULL OR p_max_empresas < 1 OR p_max_empresas > f.max_por_busca THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('Peça de 1 a %s empresas por busca nesta fonte.', f.max_por_busca));
  END IF;
  v_norm := internal.prospeccao_parametros(f, p_parametros);
  IF NOT (v_norm->>'ok')::boolean THEN RETURN v_norm; END IF;
  v_creditos := p_max_empresas * f.creditos_por_empresa;
  IF NOT internal.coleta_cabe(v.workspace_id, v_creditos) THEN
    RETURN jsonb_build_object('ok', false, 'coleta_restante_creditos', internal.coleta_restante_creditos(v.workspace_id),
      'erro', format('O limite de coleta deste mês não comporta uma busca de até %s créditos (cabem cerca de %s). Peça menos empresas ou avise a Althius para liberar mais.',
                     v_creditos, internal.coleta_restante_creditos(v.workspace_id)));
  END IF;
  SELECT left(f.nome || ': ' || string_agg(value, ' · ' ORDER BY key), 160) INTO v_titulo FROM jsonb_each_text(v_norm->'parametros');
  v_pessoa := NULLIF(public.integration_agent_context(p_token)->>'requester_member_id', '')::uuid;
  INSERT INTO public.prospect_searches (workspace_id, requested_by_member_id, agent_code, source_code, titulo, parametros, max_empresas, creditos_estimados)
  VALUES (v.workspace_id, v_pessoa, v.agent_code, f.code, COALESCE(v_titulo, f.nome), v_norm->'parametros', p_max_empresas, v_creditos)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'estimativa_id', v_id, 'fonte', f.nome, 'titulo', COALESCE(v_titulo, f.nome), 'max_empresas', p_max_empresas,
    'creditos', v_creditos, 'valida_ate', now() + interval '30 minutes',
    'aviso', format('Isso vai custar até %s créditos (%s por empresa nova; repetidas não cobram; o que não for achado volta). O crédito é gasto mesmo que a pessoa exclua candidatas depois. Diga o custo à pessoa e só rode depois que ela pedir.',
                    v_creditos, f.creditos_por_empresa));
END;
$$;

CREATE OR REPLACE FUNCTION public.prospect_next(p_limit INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_exec UUID;
  v_res JSONB;
  v_chave TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('prospect_next'));
  FOR r IN
    SELECT s.*, f.nome AS fonte_nome, f.ator, f.entrada, f.mapeamento
      FROM public.prospect_searches s JOIN internal.prospect_sources f ON f.code = s.source_code
     WHERE s.estado = 'pendente' OR (s.estado = 'erro' AND s.tentativas BETWEEN 1 AND 2 AND s.updated_at < now() - interval '30 minutes')
     ORDER BY s.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 5))
     FOR UPDATE OF s SKIP LOCKED
  LOOP
    IF r.requested_by_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.id = r.requested_by_member_id AND wm.status = 'active') THEN
      UPDATE public.prospect_searches SET estado = 'erro', tentativas = 3, mensagem = 'Quem pediu a busca não está mais ativo no cliente.', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    IF NOT internal.coleta_cabe(r.workspace_id, r.creditos_estimados) THEN
      UPDATE public.prospect_searches SET estado = 'erro', tentativas = 3,
             mensagem = 'Limite de coleta do mês atingido. Nada foi gasto. Fale com a Althius para liberar mais ou peça a busca de novo no próximo mês.', updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;
    v_chave := 'prosp:' || r.id || ':a' || (r.tentativas + 1);
    INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
    VALUES (r.workspace_id, 'comercial', 'prospecting.search', 'pending', r.requested_by_member_id, r.creditos_estimados,
            jsonb_build_object('prospeccao_id', r.id, 'fonte', r.source_code, 'prospeccao_key', v_chave))
    RETURNING id INTO v_exec;
    v_res := public.credit_reserve(r.workspace_id, v_exec, r.creditos_estimados, 'Reserva: prospecção ' || r.titulo, v_chave || ':reserve');
    IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
      UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
      UPDATE public.prospect_searches SET estado = 'erro', tentativas = 3, execution_id = v_exec,
             mensagem = 'Saldo de créditos insuficiente para a busca. Peça créditos à Althius e peça a busca de novo.', updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;
    UPDATE public.executions SET status = 'running', execution_type = 'Lista', progress = 10, reserved_credits = (v_res->>'reserved_amount')::int,
           title = 'Prospecção: ' || r.titulo
     WHERE id = v_exec;
    UPDATE public.prospect_searches SET estado = 'reservada', tentativas = r.tentativas + 1, execution_id = v_exec,
           reserved_credits = (v_res->>'reserved_amount')::int, mensagem = NULL, updated_at = now()
     WHERE id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'search_id', r.id, 'workspace_id', r.workspace_id, 'titulo', r.titulo, 'parametros', r.parametros, 'max_empresas', r.max_empresas,
      'teto_usd', internal.signal_teto_usd(r.creditos_estimados),
      'fonte', jsonb_build_object('codigo', r.source_code, 'nome', r.fonte_nome, 'ator', r.ator, 'entrada', r.entrada, 'mapeamento', r.mapeamento)));
  END LOOP;
  RETURN v_out;
END;
$$;

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
  IF NOT internal.coleta_cabe(v.workspace_id, v_creditos) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O limite de coleta deste mês acabou: não dá para testar fonte agora. Avise a Althius para liberar mais.');
  END IF;
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

CREATE OR REPLACE FUNCTION public.copilot_ask(p_workspace_id UUID, p_member_id UUID, p_texto TEXT, p_chave TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_chave TEXT := NULLIF(btrim(COALESCE(p_chave, '')), '');
  v_id UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active') THEN
    RAISE EXCEPTION 'Você não participa deste workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_texto = '' OR length(v_texto) > 2000 THEN RAISE EXCEPTION 'Escreva a pergunta (até 2.000 caracteres).' USING ERRCODE = '22023'; END IF;
  IF v_chave IS NULL OR length(v_chave) > 100 THEN RAISE EXCEPTION 'Chave de envio inválida.' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_id FROM public.copilot_messages WHERE member_id = p_member_id AND chave = v_chave;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'id', v_id); END IF;
  IF (SELECT count(*) FROM public.copilot_messages WHERE member_id = p_member_id AND autor = 'pessoa' AND created_at > now() - interval '1 day') >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Limite de 100 perguntas ao Copiloto por dia. Para trabalho, fale direto com o agente.');
  END IF;
  INSERT INTO public.copilot_messages (workspace_id, member_id, autor, texto, estado, chave)
  VALUES (p_workspace_id, p_member_id, 'pessoa', v_texto, 'pendente', v_chave)
  ON CONFLICT (member_id, chave) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM public.copilot_messages WHERE member_id = p_member_id AND chave = v_chave; END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_usage()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', w.id, 'nome', w.name,
      'consumido', COALESCE(c.monthly_consumed, 0),
      'saldo', COALESCE(GREATEST(0, c.allowance_balance + c.topup_balance - c.reserved_balance), 0),
      'execucoes_mes', (SELECT count(*) FROM public.executions e WHERE e.workspace_id = w.id AND e.created_at >= date_trunc('month', now())),
      'ultimo_uso', (SELECT max(e.created_at) FROM public.executions e WHERE e.workspace_id = w.id),
      'tokens_mes', (SELECT COALESCE(sum(u.tokens_entrada + u.tokens_saida), 0) FROM internal.llm_uso u WHERE u.workspace_id = w.id AND u.quando >= date_trunc('month', now())),
      'custo_modelo_usd', (SELECT COALESCE(sum(u.custo_usd), 0) FROM internal.llm_uso u WHERE u.workspace_id = w.id AND u.quando >= date_trunc('month', now())),
      'coleta_usd', internal.apify_gasto_usd(w.id),
      'coleta_orcamento_usd', internal.apify_orcamento_usd(w.id)
    ) ORDER BY COALESCE(c.monthly_consumed, 0) DESC, w.name)
    FROM public.workspaces w LEFT JOIN public.credit_wallets c ON c.workspace_id = w.id
  ), '[]'::jsonb);
END;
$$;
