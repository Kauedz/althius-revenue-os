-- ==============================================================================
-- Migration: 20261002000118_coleta_de_sinais_pessoas.sql
-- Coleta de sinais, ticket 02 (ADR 0055): sinais sobre PESSOAS (troca de cargo do decisor e posts do decisor).
-- - a conta guarda o nome e o endereço da empresa no LinkedIn (o filtro de vagas usa o nome como o LinkedIn escreve);
-- - o pedido de coleta leva os contatos com LinkedIn (decisores primeiro) e o retrato anterior de cada um;
-- - o retrato (cargo e empresa atuais) só é guardado depois que a execução termina, e só de contatos da própria conta;
-- - conta sem contato com LinkedIn não é pedida para sinais de pessoas (não reserva crédito à toa).
-- ==============================================================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS linkedin_company_name TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS linkedin_company_url TEXT;
COMMENT ON COLUMN public.accounts.linkedin_company_name IS 'Nome da empresa como o LinkedIn escreve (ex.: Magalu, não Magazine Luiza). Usado nos filtros de coleta; vazio = usa o nome da conta.';
COMMENT ON COLUMN public.accounts.linkedin_company_url IS 'Endereço da página da empresa no LinkedIn.';

ALTER TABLE internal.signal_recipes ADD COLUMN IF NOT EXISTS requer_contato_linkedin BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN internal.signal_recipes.requer_contato_linkedin IS 'Sinal de pessoas: só pede conta que tenha contato com LinkedIn.';

-- Retrato anterior de cada contato (por conta e sinal), para detectar mudança. Nunca lido por usuário.
CREATE TABLE IF NOT EXISTS internal.signal_snapshots (
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  dados JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, account_id, chave)
);
COMMENT ON TABLE internal.signal_snapshots IS 'Retrato anterior (ex.: cargo e empresa atuais do contato) para o coletor comparar. Só sistema.';
ALTER TABLE internal.signal_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.signal_snapshots FROM PUBLIC, anon, authenticated;

-- O pedido de coleta agora leva o LinkedIn da conta e os contatos (substitui a função da migration 117, mesma assinatura).
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
           rec.fontes, rec.requer_contato_linkedin,
           COALESCE(s.frequency, d.frequency) AS frequencia, internal.signal_periodo(COALESCE(s.frequency, d.frequency)) AS periodo
      FROM internal.signal_recipes rec
      JOIN public.signal_definitions d ON d.id = rec.signal_id
      JOIN public.accounts a ON a.status = 'ativa'
      LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = a.workspace_id AND s.signal_id = d.id
     WHERE rec.enabled AND COALESCE(s.enabled, d.default_on)
       AND (NOT rec.requer_contato_linkedin OR EXISTS (
             SELECT 1 FROM public.contacts c JOIN public.contact_channels ch ON ch.contact_id = c.id AND ch.type = 'linkedin'
              WHERE c.account_id = a.id AND c.workspace_id = a.workspace_id))
     ORDER BY a.workspace_id, a.id
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
            jsonb_build_object('signal_code', r.code, 'account_id', r.account_id, 'periodo', r.periodo, 'coleta_key', v_chave))
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

    -- Sinais de pessoas: até 5 contatos com LinkedIn da própria conta (decisor, campeão, influenciador) e o retrato anterior.
    -- O endereço vai COMO FOI CADASTRADO: o identificador do perfil diferencia maiúsculas e minúsculas no LinkedIn.
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
REVOKE ALL ON FUNCTION public.signal_collect_next(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signal_collect_next(INTEGER) TO service_role;

-- Guarda o retrato de cada contato depois da execução concluída. Só aceita contato da própria conta.
CREATE OR REPLACE FUNCTION public.signal_snapshot_save(p_run_id UUID, p_snapshots JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_run internal.signal_runs;
  v_item JSONB;
  v_n INTEGER := 0;
BEGIN
  SELECT * INTO v_run FROM internal.signal_runs WHERE id = p_run_id;
  IF NOT FOUND OR v_run.estado NOT IN ('ok', 'sem_novidade') THEN
    RETURN jsonb_build_object('acao', 'ignorado');
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_snapshots, '[]'::jsonb)) LOOP
    CONTINUE WHEN NULLIF(v_item->>'chave', '') IS NULL OR jsonb_typeof(v_item->'dados') IS DISTINCT FROM 'object';
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id::text = v_item->>'chave' AND c.account_id = v_run.account_id AND c.workspace_id = v_run.workspace_id);
    INSERT INTO internal.signal_snapshots (signal_id, account_id, workspace_id, chave, dados)
    VALUES (v_run.signal_id, v_run.account_id, v_run.workspace_id, v_item->>'chave', v_item->'dados')
    ON CONFLICT (signal_id, account_id, chave) DO UPDATE SET dados = EXCLUDED.dados, updated_at = now();
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('acao', 'salvo', 'salvos', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.signal_snapshot_save(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signal_snapshot_save(UUID, JSONB) TO service_role;

-- Receitas (desligadas): decisor mudou de cargo/empresa e posts do decisor. Atores conferidos em 06/10/2026.
INSERT INTO internal.signal_recipes (signal_id, enabled, requer_contato_linkedin, fontes)
SELECT d.id, false, true, '[{"fonte":"apify","ator":"harvestapi/linkedin-profile-scraper","teto_usd":0.05,"max_itens":5}]'::jsonb
  FROM public.signal_definitions d WHERE d.code = 'troca_cargo'
ON CONFLICT (signal_id) DO NOTHING;
INSERT INTO internal.signal_recipes (signal_id, enabled, requer_contato_linkedin, fontes)
SELECT d.id, false, true, '[{"fonte":"apify","ator":"harvestapi/linkedin-profile-posts","teto_usd":0.04,"max_itens":15}]'::jsonb
  FROM public.signal_definitions d WHERE d.code = 'posts_decisor'
ON CONFLICT (signal_id) DO NOTHING;
