-- ==============================================================================
-- Migration: 20261002000117_coleta_de_sinais.sql
-- Coleta de sinais (spec .scratch/coleta-de-sinais, ticket 01, ADR 0055).
-- O banco decide o que coletar, reserva e cobra crédito, não repete o mesmo período e grava os eventos sem repetir o
-- mesmo acontecimento. O serviço Node (src/server/sinais) só busca o dado fora e entrega o resultado.
-- Receitas (atores e custo real do fornecedor) ficam em `internal`: só o sistema e o superadmin enxergam.
-- ==============================================================================

-- 1. Receita de cada sinal: lista ordenada de fontes. Nasce DESLIGADA; o superadmin liga quando as chaves estiverem no cofre.
CREATE TABLE IF NOT EXISTS internal.signal_recipes (
  signal_id UUID PRIMARY KEY REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  fontes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fontes) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE internal.signal_recipes IS 'Receita de coleta por sinal (ator da Apify ou fonte pública, entrada e teto). Só sistema e superadmin. Nasce desligada.';
ALTER TABLE internal.signal_recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.signal_recipes FROM PUBLIC, anon, authenticated;

-- 2. Execução de coleta: uma por conta + sinal + período. A chave única é a idempotência.
CREATE TABLE IF NOT EXISTS internal.signal_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.signal_definitions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'reservada' CHECK (estado IN ('reservada', 'ok', 'sem_novidade', 'erro', 'sem_saldo')),
  tentativas INTEGER NOT NULL DEFAULT 1,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  itens INTEGER,
  custo_usd NUMERIC(14, 6) CHECK (custo_usd IS NULL OR custo_usd >= 0),
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT uq_signal_run_periodo UNIQUE (signal_id, account_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_signal_runs_workspace ON internal.signal_runs (workspace_id, created_at DESC);
COMMENT ON TABLE internal.signal_runs IS 'Uma coleta por conta, sinal e período. custo_usd é o custo real do fornecedor: só superadmin vê (ADR 0021).';
ALTER TABLE internal.signal_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.signal_runs FROM PUBLIC, anon, authenticated;

-- 3. O mesmo acontecimento não vale duas vezes: chave do acontecimento no evento.
ALTER TABLE public.signal_events ADD COLUMN IF NOT EXISTS event_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_events_chave
  ON public.signal_events (workspace_id, account_id, signal_id, event_key) WHERE event_key IS NOT NULL;

-- 4. Período da frequência: diário = dia, semanal = semana ISO, mensal = mês.
CREATE OR REPLACE FUNCTION internal.signal_periodo(p_frequencia TEXT)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE p_frequencia
    WHEN 'diario' THEN to_char(now(), 'YYYY-MM-DD')
    WHEN 'mensal' THEN to_char(now(), 'YYYY-MM')
    ELSE to_char(now(), 'IYYY-"W"IW')
  END;
$$;
REVOKE ALL ON FUNCTION internal.signal_periodo(TEXT) FROM PUBLIC, anon, authenticated;

-- 5. A tela descobre quais sinais já coletam de verdade (sem ver ator nem custo).
CREATE OR REPLACE FUNCTION public.signal_codes_com_coleta()
RETURNS TEXT[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(array_agg(d.code ORDER BY d.code), '{}'::text[])
    FROM internal.signal_recipes r JOIN public.signal_definitions d ON d.id = r.signal_id
   WHERE r.enabled;
$$;
REVOKE ALL ON FUNCTION public.signal_codes_com_coleta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signal_codes_com_coleta() TO authenticated, service_role;

-- 6. Interruptor do superadmin (a tela do superadmin liga e desliga a coleta de cada sinal).
CREATE OR REPLACE FUNCTION public.admin_signal_recipe_set(p_code TEXT, p_enabled BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM internal.exigir_superadmin();
  SELECT d.id INTO v_id FROM public.signal_definitions d JOIN internal.signal_recipes r ON r.signal_id = d.id WHERE d.code = p_code;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este sinal ainda não tem receita de coleta.' USING ERRCODE = '22023';
  END IF;
  UPDATE internal.signal_recipes SET enabled = COALESCE(p_enabled, false), updated_at = now() WHERE signal_id = v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_signal_recipe_set(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_signal_recipe_set(TEXT, BOOLEAN) TO authenticated, service_role;

-- 7. O coletor pede trabalho: o banco escolhe as contas, reserva o crédito e devolve só o que precisa para buscar.
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
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('signal_collect_next'));
  FOR r IN
    SELECT a.id AS account_id, a.name AS account_name, a.domain AS account_domain, a.workspace_id,
           d.id AS signal_id, d.code, d.name AS signal_name, d.credits_per_account, d.agent_code, d.capability_code,
           rec.fontes, COALESCE(s.frequency, d.frequency) AS frequencia, internal.signal_periodo(COALESCE(s.frequency, d.frequency)) AS periodo
      FROM internal.signal_recipes rec
      JOIN public.signal_definitions d ON d.id = rec.signal_id
      JOIN public.accounts a ON a.status = 'ativa'
      LEFT JOIN public.workspace_signal_settings s ON s.workspace_id = a.workspace_id AND s.signal_id = d.id
     WHERE rec.enabled AND COALESCE(s.enabled, d.default_on)
     ORDER BY a.workspace_id, a.id
  LOOP
    EXIT WHEN v_n >= GREATEST(1, COALESCE(p_limit, 20));
    SELECT * INTO v_prev FROM internal.signal_runs WHERE signal_id = r.signal_id AND account_id = r.account_id AND periodo = r.periodo FOR UPDATE;
    IF FOUND THEN
      -- Já existe: só volta se deu erro ou faltou saldo, passado um tempo, e no máximo 3 tentativas.
      CONTINUE WHEN NOT (v_prev.estado IN ('erro', 'sem_saldo') AND v_prev.tentativas < 3 AND v_prev.updated_at < now() - interval '1 hour');
    END IF;

    -- Quem responde pela execução: o C-level (quem paga decide), senão o estrategista.
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

    v_n := v_n + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'run_id', v_run, 'workspace_id', r.workspace_id, 'account_id', r.account_id, 'account_name', r.account_name,
      'account_domain', r.account_domain, 'signal_code', r.code, 'signal_name', r.signal_name,
      'credits', r.credits_per_account, 'periodo', r.periodo, 'frequencia', r.frequencia, 'fontes', r.fontes));
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.signal_collect_next(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signal_collect_next(INTEGER) TO service_role;

-- 8. Entrega do resultado: cobra o crédito do sinal e grava os acontecimentos novos (sem repetir).
CREATE OR REPLACE FUNCTION public.signal_collect_finish(p_run_id UUID, p_eventos JSONB, p_itens INTEGER, p_custo_usd NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_run internal.signal_runs;
  v_def public.signal_definitions;
  v_conta public.accounts;
  v_ev JSONB;
  v_chave TEXT;
  v_id UUID;
  v_novos INTEGER := 0;
  v_quando TIMESTAMPTZ;
  v_cobranca TEXT;
BEGIN
  SELECT * INTO v_run FROM internal.signal_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.estado <> 'reservada' THEN
    RETURN jsonb_build_object('acao', 'ignorado');
  END IF;
  IF p_custo_usd IS NOT NULL AND p_custo_usd < 0 THEN
    RAISE EXCEPTION 'Custo inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_def FROM public.signal_definitions WHERE id = v_run.signal_id;
  SELECT * INTO v_conta FROM public.accounts WHERE id = v_run.account_id;
  v_cobranca := 'sinal:' || v_def.code || ':' || v_run.account_id || ':' || v_run.periodo || ':a' || v_run.tentativas;

  FOR v_ev IN SELECT * FROM jsonb_array_elements(COALESCE(p_eventos, '[]'::jsonb)) LOOP
    v_chave := NULLIF(trim(COALESCE(v_ev->>'chave', '')), '');
    CONTINUE WHEN v_chave IS NULL OR NULLIF(trim(COALESCE(v_ev->>'texto', '')), '') IS NULL;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.signal_events e WHERE e.workspace_id = v_run.workspace_id AND e.account_id = v_run.account_id AND e.signal_id = v_run.signal_id AND e.event_key = v_chave);
    v_quando := COALESCE(NULLIF(v_ev->>'quando', '')::timestamptz, now());
    IF v_novos = 0 THEN
      -- O primeiro acontecimento novo esquenta a conta uma vez (e pode avisar "sinal quente").
      v_id := public.process_signal_event(v_run.workspace_id, v_run.signal_id, v_run.account_id, v_run.execution_id,
        left(v_ev->>'texto', 300), jsonb_build_object('texto', left(v_ev->>'texto', 300), 'evidencia', left(COALESCE(v_ev->>'evidencia', ''), 2000), 'fonte', left(COALESCE(v_ev->>'fonte', ''), 200)), 1);
      UPDATE public.signal_events SET event_key = v_chave, detected_at = v_quando WHERE id = v_id;
    ELSE
      INSERT INTO public.signal_events (workspace_id, signal_id, account_id, execution_id, payload, temperature_bump, detected_at, event_key)
      VALUES (v_run.workspace_id, v_run.signal_id, v_run.account_id, v_run.execution_id,
        jsonb_build_object('texto', left(v_ev->>'texto', 300), 'evidencia', left(COALESCE(v_ev->>'evidencia', ''), 2000), 'fonte', left(COALESCE(v_ev->>'fonte', ''), 200)),
        0, v_quando, v_chave);
    END IF;
    v_novos := v_novos + 1;
  END LOOP;

  IF v_def.credits_per_account > 0 THEN
    PERFORM public.credit_consume(v_run.workspace_id, v_run.execution_id, v_def.credits_per_account, v_run.reserved_credits, 'Coleta do sinal ' || v_def.name, v_cobranca || ':consume');
  END IF;
  UPDATE public.executions SET status = 'completed', actual_credits = v_def.credits_per_account, progress = 100, processed_count = COALESCE(p_itens, 0), valid_count = v_novos
   WHERE id = v_run.execution_id;
  UPDATE internal.signal_runs
     SET estado = CASE WHEN v_novos > 0 THEN 'ok' ELSE 'sem_novidade' END, itens = COALESCE(p_itens, 0), custo_usd = p_custo_usd,
         mensagem = NULL, finished_at = now(), updated_at = now()
   WHERE id = p_run_id;
  RETURN jsonb_build_object('acao', 'concluido', 'eventos_novos', v_novos);
END;
$$;
REVOKE ALL ON FUNCTION public.signal_collect_finish(UUID, JSONB, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signal_collect_finish(UUID, JSONB, INTEGER, NUMERIC) TO service_role;

-- 9. Falha de coleta: devolve o crédito, registra o motivo e nunca cria evento.
CREATE OR REPLACE FUNCTION public.signal_collect_fail(p_run_id UUID, p_mensagem TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_run internal.signal_runs;
  v_code TEXT;
BEGIN
  SELECT * INTO v_run FROM internal.signal_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.estado <> 'reservada' THEN
    RETURN jsonb_build_object('acao', 'ignorado');
  END IF;
  SELECT code INTO v_code FROM public.signal_definitions WHERE id = v_run.signal_id;
  IF v_run.reserved_credits > 0 THEN
    PERFORM public.credit_consume(v_run.workspace_id, v_run.execution_id, 0, v_run.reserved_credits, 'Liberação: coleta do sinal falhou',
      'sinal:' || v_code || ':' || v_run.account_id || ':' || v_run.periodo || ':a' || v_run.tentativas || ':release');
  END IF;
  UPDATE public.executions SET status = 'failed', progress = 100,
         errors = errors || jsonb_build_array(jsonb_build_object('erro', COALESCE(left(p_mensagem, 300), 'falha na coleta')))
   WHERE id = v_run.execution_id;
  UPDATE internal.signal_runs SET estado = 'erro', mensagem = COALESCE(left(p_mensagem, 300), 'falha na coleta'), finished_at = now(), updated_at = now()
   WHERE id = p_run_id;
  RETURN jsonb_build_object('acao', 'falhou');
END;
$$;
REVOKE ALL ON FUNCTION public.signal_collect_fail(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signal_collect_fail(UUID, TEXT) TO service_role;

-- 10. Receita do sinal de vagas (desligada). Ator principal e reserva, confirmados em 06/10/2026 (docs/sinais/atores-por-sinal.md).
INSERT INTO internal.signal_recipes (signal_id, enabled, fontes)
SELECT d.id, false, '[
  {"fonte":"apify","ator":"valig/linkedin-jobs-scraper","teto_usd":0.05,"max_itens":25},
  {"fonte":"apify","ator":"curious_coder/linkedin-jobs-scraper","teto_usd":0.1,"max_itens":25,"reserva":true}
]'::jsonb
FROM public.signal_definitions d WHERE d.code = 'vagas_cargo'
ON CONFLICT (signal_id) DO NOTHING;
