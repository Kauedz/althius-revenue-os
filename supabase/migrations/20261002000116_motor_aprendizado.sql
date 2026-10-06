-- ==============================================================================
-- Migration: 20261002000116_motor_aprendizado.sql
-- Motor do aprendizado compartilhado entre contas (ADR 0052).
-- O que faz: olha os envios das cadências dos clientes que ACEITARAM, mede a taxa de resposta por segmento da conta,
-- canal e passo, guarda só os números agregados (sem cliente, sem texto, sem nome) e, quando um padrão é
-- estatisticamente melhor que a média, SUGERE (nunca aplica) para os clientes que têm contas daquele segmento e
-- ainda não fazem tão bem. Quem aplica é o estrategista, pelo fluxo de aprendizados que já existe.
-- Regras duras: mínimo de 3 clientes por padrão, nenhum cliente com mais da metade dos envios do padrão, quem
-- desligou sai dos números e perde a sugestão pendente na próxima rodada.
-- ==============================================================================

ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'local' CHECK (origem IN ('local', 'compartilhado'));
ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS chave_padrao TEXT;
COMMENT ON COLUMN public.learning_entries.origem IS 'local = aprendido pelos agentes do próprio cliente; compartilhado = veio do aprendizado entre contas (ADR 0052).';
COMMENT ON COLUMN public.learning_entries.chave_padrao IS 'segmento|canal|passo do padrão compartilhado: evita sugerir duas vezes (nem de novo depois de descartada).';
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_entries_chave ON public.learning_entries (workspace_id, chave_padrao) WHERE chave_padrao IS NOT NULL;

-- Só números agregados. Nenhuma coluna de cliente: nem o motor consegue dizer de quem veio cada número.
CREATE TABLE IF NOT EXISTS internal.learning_agregados (
  segmento TEXT NOT NULL,
  canal TEXT NOT NULL,
  passo INTEGER NOT NULL,
  envios INTEGER NOT NULL,
  respostas INTEGER NOT NULL,
  positivas INTEGER NOT NULL,
  workspaces INTEGER NOT NULL,
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (segmento, canal, passo)
);
COMMENT ON TABLE internal.learning_agregados IS 'Padrões agregados do aprendizado compartilhado (ADR 0052). Refeita a cada rodada; sem dado de cliente.';
ALTER TABLE internal.learning_agregados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.learning_agregados FROM PUBLIC, anon, authenticated;

-- Limite inferior (95%) da taxa verdadeira: com poucos envios ele fica baixo, então amostra pequena não vira padrão.
CREATE OR REPLACE FUNCTION internal.wilson_inferior(p_sucessos INTEGER, p_total INTEGER)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_total <= 0 THEN 0::numeric ELSE
    ((p_sucessos::numeric / p_total) + 1.9208 / p_total
      - 1.96 * sqrt(((p_sucessos::numeric / p_total) * (1 - p_sucessos::numeric / p_total) + 0.9604 / p_total) / p_total))
    / (1 + 3.8416 / p_total)
  END;
$$;

CREATE OR REPLACE FUNCTION internal.rotulo_do_canal(p_canal TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_canal WHEN 'email' THEN 'e-mail' WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'linkedin' THEN 'LinkedIn' WHEN 'instagram' THEN 'Instagram' ELSE p_canal END;
$$;

CREATE OR REPLACE FUNCTION internal.aprendizado_executar(p_k_min INTEGER, p_envios_min INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_baseline NUMERIC;
  v_contribuindo INTEGER;
  v_padroes INTEGER;
  v_novas INTEGER := 0;
  v_id UUID;
  r RECORD;
  v_taxa NUMERIC;
  v_chave TEXT;
  v_canal TEXT;
  v_evidencia TEXT;
BEGIN
  -- 1. Quem desligou perde as sugestões compartilhadas que ainda esperavam decisão (as já decididas ficam).
  DELETE FROM public.learning_entries e
   WHERE e.origem = 'compartilhado' AND e.status = 'sugerida'
     AND e.workspace_id NOT IN (SELECT workspace_id FROM internal.learning_workspaces_aceitos());

  -- 2. Cada envio de cadência (últimos 180 dias) de quem aceitou: segmento da conta, canal, passo e se teve resposta.
  DROP TABLE IF EXISTS pg_temp._aprend_g;
  CREATE TEMP TABLE _aprend_g ON COMMIT DROP AS
  SELECT m.workspace_id,
         lower(btrim(a.segment)) AS segmento,
         c.channel AS canal,
         s.step_number AS passo,
         count(*)::int AS envios,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.messages rr WHERE rr.conversation_id = m.conversation_id AND rr.direction = 'in'
                                          AND rr.created_at > m.created_at AND rr.created_at <= m.created_at + interval '14 days'))::int AS respostas,
         count(*) FILTER (WHERE c.intent = 'positiva' AND EXISTS (SELECT 1 FROM public.messages rr WHERE rr.conversation_id = m.conversation_id AND rr.direction = 'in'
                                          AND rr.created_at > m.created_at AND rr.created_at <= m.created_at + interval '14 days'))::int AS positivas
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    JOIN public.accounts a ON a.id = c.account_id
    JOIN public.cadence_enrollment_steps s ON s.execution_id = m.cadence_step_execution_id
   WHERE m.direction = 'out' AND m.cadence_step_execution_id IS NOT NULL
     AND m.created_at >= now() - interval '180 days'
     AND a.segment IS NOT NULL AND btrim(a.segment) <> ''
     AND m.workspace_id IN (SELECT workspace_id FROM internal.learning_workspaces_aceitos())
   GROUP BY m.workspace_id, lower(btrim(a.segment)), c.channel, s.step_number;

  SELECT sum(respostas)::numeric / NULLIF(sum(envios), 0), count(DISTINCT workspace_id) INTO v_baseline, v_contribuindo FROM _aprend_g;

  -- 3. Base agregada, refeita do zero (quem desligou some). Só entra padrão com clientes suficientes, envios suficientes
  --    e sem cliente dominante (nenhum com mais da metade dos envios), para ninguém "aparecer" nos números.
  TRUNCATE internal.learning_agregados;
  INSERT INTO internal.learning_agregados (segmento, canal, passo, envios, respostas, positivas, workspaces)
  SELECT segmento, canal, passo, sum(envios), sum(respostas), sum(positivas), count(*)
    FROM _aprend_g
   GROUP BY segmento, canal, passo
  HAVING count(*) >= p_k_min AND sum(envios) >= p_envios_min AND max(envios)::numeric / sum(envios) <= 0.5;
  SELECT count(*) INTO v_padroes FROM internal.learning_agregados;

  -- 4. Sugestões: padrão melhor que a média (com folga estatística) → clientes que aceitaram, têm conta ativa nesse
  --    segmento e ainda não fazem tão bem (ou nunca enviaram esse passo nesse canal).
  IF v_baseline IS NOT NULL THEN
    FOR r IN
      SELECT g.segmento, g.canal, g.passo, g.envios, g.respostas, g.workspaces, w.workspace_id,
             o.envios AS meus_envios, o.respostas AS minhas_respostas
        FROM internal.learning_agregados g
        JOIN LATERAL (SELECT DISTINCT a.workspace_id FROM public.accounts a
                       WHERE lower(btrim(a.segment)) = g.segmento AND a.status = 'ativa'
                         AND a.workspace_id IN (SELECT workspace_id FROM internal.learning_workspaces_aceitos())) w ON true
        LEFT JOIN _aprend_g o ON o.workspace_id = w.workspace_id AND o.segmento = g.segmento AND o.canal = g.canal AND o.passo = g.passo
       WHERE internal.wilson_inferior(g.respostas, g.envios) > v_baseline
    LOOP
      v_taxa := r.respostas::numeric / r.envios;
      IF COALESCE(r.meus_envios, 0) >= 10 AND r.minhas_respostas::numeric / r.meus_envios >= v_taxa THEN CONTINUE; END IF;
      v_chave := r.segmento || '|' || r.canal || '|' || r.passo;
      v_canal := internal.rotulo_do_canal(r.canal);
      v_evidencia := 'Média de resposta de todos os clientes que compartilham: ' || round(v_baseline * 100)::int || '%. '
        || CASE WHEN COALESCE(r.meus_envios, 0) > 0
                THEN 'Sua taxa hoje nesse passo e canal: ' || round(100.0 * r.minhas_respostas / r.meus_envios)::int || '% (' || r.meus_envios || ' envios).'
                ELSE 'Você ainda não enviou esse passo por esse canal para esse segmento.' END;
      INSERT INTO public.learning_entries (workspace_id, agent_id, suggestion_text, evidence, impact, proposed_change, origem, chave_padrao)
      VALUES (r.workspace_id, 'comercial',
        'Para contas do segmento "' || r.segmento || '", o passo ' || r.passo || ' por ' || v_canal || ' costuma funcionar melhor: '
          || round(v_taxa * 100)::int || '% de resposta (' || r.envios || ' envios em ' || r.workspaces || ' clientes, base anonimizada).',
        v_evidencia,
        round(v_taxa * 100)::int || '% de resposta',
        'Priorizar o passo ' || r.passo || ' por ' || v_canal || ' nas cadências para o segmento "' || r.segmento || '".',
        'compartilhado', v_chave)
      ON CONFLICT (workspace_id, chave_padrao) WHERE chave_padrao IS NOT NULL DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN
        v_novas := v_novas + 1;
        PERFORM public.audit_write(r.workspace_id, NULL, 'learning.shared_suggestion', 'learning_entry', v_id::text, jsonb_build_object('chave', v_chave));
      END IF;
      v_id := NULL;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('clientes_contribuindo', COALESCE(v_contribuindo, 0), 'padroes', v_padroes, 'sugestoes_novas', v_novas);
END;
$$;

-- Porta do sistema (o agendador chama). Os mínimos de proteção não podem ser baixados por quem chama.
CREATE OR REPLACE FUNCTION public.aprendizado_executar(p_k_min INTEGER DEFAULT 3, p_envios_min INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(p_k_min, 0) < 3 THEN
    RAISE EXCEPTION 'O mínimo é de 3 clientes por padrão.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_envios_min, 0) < 20 THEN
    RAISE EXCEPTION 'O mínimo é de 20 envios por padrão.' USING ERRCODE = '22023';
  END IF;
  RETURN internal.aprendizado_executar(p_k_min, p_envios_min);
END;
$$;

REVOKE ALL ON FUNCTION internal.wilson_inferior(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.rotulo_do_canal(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.aprendizado_executar(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aprendizado_executar(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprendizado_executar(INTEGER, INTEGER) TO service_role;
