-- ==============================================================================
-- Migration: 20261002000130_sinais_so_contas_monitoradas.sql
-- Spec .scratch/prospeccao-revenue, fatia 1 (ADR 0066). Com 1.000 contas, rodar sinais em todas, toda semana, gasta o
-- crédito do cliente e não sobra para prospectar empresas novas. Agora a coleta AUTOMÁTICA de sinais:
--   - roda só nas contas MONITORADAS: com negócio ativo no Pipeline, numa cadência ativa, ou marcada à mão
--     (`accounts.monitorar_sinais`). Conta antiga parada não gasta nada sozinha;
--   - respeita um TETO MENSAL de créditos de sinais por cliente (`workspace_settings.teto_sinais_mes`, padrão 2.000;
--     0 desliga os sinais automáticos). Teste de fonte pelo agente e prospecção não entram nesse teto.
-- ==============================================================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS monitorar_sinais BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.accounts.monitorar_sinais IS 'Marcada à mão para a coleta automática de sinais, mesmo sem negócio nem cadência (ADR 0066).';
ALTER TABLE public.workspace_settings ADD COLUMN IF NOT EXISTS teto_sinais_mes INTEGER NOT NULL DEFAULT 2000 CHECK (teto_sinais_mes >= 0);
COMMENT ON COLUMN public.workspace_settings.teto_sinais_mes IS 'Créditos por mês que a coleta automática de sinais pode gastar (0 = desligada). ADR 0066.';

-- Conta monitorada: marcada à mão, com negócio ativo, ou com contato numa cadência ativa.
CREATE OR REPLACE FUNCTION internal.conta_monitorada(p_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE((SELECT a.monitorar_sinais FROM public.accounts a WHERE a.id = p_account_id), false)
      OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.account_id = p_account_id AND o.status = 'ativa')
      OR EXISTS (SELECT 1 FROM public.cadence_enrollments e
                  JOIN public.contacts c ON c.id = e.contact_id
                 WHERE c.account_id = p_account_id AND e.status = 'ativa');
$$;
REVOKE ALL ON FUNCTION internal.conta_monitorada(UUID) FROM PUBLIC, anon, authenticated;

-- Créditos que a coleta automática de sinais já gastou (ou reservou) neste mês, no horário de Brasília.
CREATE OR REPLACE FUNCTION internal.signal_gasto_mes(p_workspace_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(sum(d.credits_per_account), 0)::integer
    FROM internal.signal_runs sr JOIN public.signal_definitions d ON d.id = sr.signal_id
   WHERE sr.workspace_id = p_workspace_id AND sr.estado IN ('reservada', 'ok', 'sem_novidade')
     AND sr.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
$$;
REVOKE ALL ON FUNCTION internal.signal_gasto_mes(UUID) FROM PUBLIC, anon, authenticated;

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

-- Marcar (ou desmarcar) uma conta para a coleta de sinais. Mesma regra de editar conta: gestores; BDR só as dele.
CREATE OR REPLACE FUNCTION public.account_set_monitoring(p_workspace_id UUID, p_member_id UUID, p_account_id UUID, p_monitorar BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role TEXT;
  v_dono UUID;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Membro não pertence a este workspace.' USING ERRCODE = '42501'; END IF;
  SELECT owner_member_id INTO v_dono FROM public.accounts WHERE id = p_account_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada neste workspace.' USING ERRCODE = '42501'; END IF;
  IF v_role = 'bdr' AND v_dono IS DISTINCT FROM p_member_id THEN
    RAISE EXCEPTION 'BDR só mexe nas contas em que é o responsável.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.accounts SET monitorar_sinais = COALESCE(p_monitorar, false) WHERE id = p_account_id;
  RETURN jsonb_build_object('monitorar', COALESCE(p_monitorar, false));
END;
$$;
REVOKE ALL ON FUNCTION public.account_set_monitoring(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_set_monitoring(UUID, UUID, UUID, BOOLEAN) TO authenticated, service_role;

-- Teto mensal de sinais: só C-level e superadmin (é regra de créditos).
CREATE OR REPLACE FUNCTION public.signal_budget_set(p_workspace_id UUID, p_member_id UUID, p_teto INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active';
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'clevel') THEN
    RAISE EXCEPTION 'Só o C-level e o superadmin mudam o teto de sinais.' USING ERRCODE = '42501';
  END IF;
  IF p_teto IS NULL OR p_teto < 0 OR p_teto > 1000000 THEN RAISE EXCEPTION 'O teto vai de 0 a 1.000.000 créditos.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.workspace_settings (workspace_id, teto_sinais_mes) VALUES (p_workspace_id, p_teto)
  ON CONFLICT (workspace_id) DO UPDATE SET teto_sinais_mes = EXCLUDED.teto_sinais_mes;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'sinais.teto_mudou', 'workspace', p_workspace_id::text, jsonb_build_object('teto', p_teto));
  RETURN jsonb_build_object('teto', p_teto);
END;
$$;
REVOKE ALL ON FUNCTION public.signal_budget_set(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signal_budget_set(UUID, UUID, INTEGER) TO authenticated, service_role;
