-- ==============================================================================
-- Migration: 20261002000110_canais_agentes_harness.sql
-- PR 12: "harness" de canal para os agentes (desenho do Buzz, crates/buzz-acp: queue.rs, filter.rs, pool.rs).
-- Fica entre os canais (chat_channels, migration 0088) e o Hermes Agent. O estado fica no Postgres (ADR 0024).
--
--   * uma fila por canal: cada pedido a um agente entra na fila do canal;
--   * um pedido por vez por agente (por workspace): enquanto ele trabalha, os outros esperam;
--   * mensagens próximas são agrupadas: o lote só sai quando o canal "sossega" (ou depois de uma espera máxima) e leva
--     tudo o que está pendente do canal para o agente de uma vez (até 50), como o Buzz;
--   * batimento de vida: o executor avisa que está vivo; sem aviso (ou passado o prazo), o pedido volta para a fila;
--   * política de quando o agente responde: 'mention' (só quando chamado), 'owner' (mensagens de quem criou o canal)
--     ou 'always' (toda mensagem de pessoa). Agente nunca responde a agente nem a aviso do sistema (sem laço);
--   * tentativas: espera de 5 s dobrando a cada falha, no máximo 300 s; 10 falhas = pedido perdido (aviso no canal).
-- Créditos: o pedido continua passando pela política Hermes (papel, dono, aprovação, créditos). O lote reserva os
-- créditos de UM pedido e consome no fim; falhou, libera. Agente pausado pelo cliente não roda (o lote espera).
-- Não há resposta inventada: sem executor, os pedidos esperam na fila.
-- ==============================================================================

ALTER TABLE public.chat_channel_agents ADD COLUMN IF NOT EXISTS reply_policy TEXT NOT NULL DEFAULT 'mention'
  CHECK (reply_policy IN ('mention', 'owner', 'always'));
COMMENT ON COLUMN public.chat_channel_agents.reply_policy IS 'Quando o agente responde neste canal: mention (só quando chamado), owner (mensagens de quem criou o canal) ou always (toda mensagem de pessoa).';

-- ---------------------------------------------------------------- tabelas (só o sistema acessa)
CREATE TABLE IF NOT EXISTS public.agent_channel_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  status TEXT NOT NULL DEFAULT 'in_flight' CHECK (status IN ('in_flight', 'done', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 1,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  error TEXT
);
-- Um pedido por vez por agente (por workspace).
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_channel_runs_in_flight ON public.agent_channel_runs (workspace_id, agent_id) WHERE status = 'in_flight';

CREATE TABLE IF NOT EXISTS public.agent_channel_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('comercial', 'marketing', 'copy', 'revops')),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_flight', 'done', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id UUID REFERENCES public.agent_channel_runs(id) ON DELETE SET NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_channel_queue UNIQUE (channel_id, agent_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_agent_channel_queue_pending ON public.agent_channel_queue (status, next_attempt_at, created_at);

ALTER TABLE public.agent_channel_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_channel_queue ENABLE ROW LEVEL SECURITY;
-- Sem política: ninguém lê nem escreve direto. Tudo passa pelas funções abaixo.
REVOKE ALL ON public.agent_channel_runs, public.agent_channel_queue FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.agent_channel_queue IS 'Fila de pedidos aos agentes, uma por canal (harness, PR 12). Só o sistema acessa.';
COMMENT ON TABLE public.agent_channel_runs IS 'Lotes em andamento ou terminados, com batimento de vida (harness, PR 12). Só o sistema acessa.';

-- ---------------------------------------------------------------- entrada na fila
CREATE OR REPLACE FUNCTION internal.harness_enfileirar(p_workspace_id UUID, p_channel_id UUID, p_agent TEXT, p_message_id UUID, p_execution_id UUID)
RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.agent_channel_queue (workspace_id, channel_id, agent_id, message_id, execution_id)
  VALUES (p_workspace_id, p_channel_id, p_agent, p_message_id, p_execution_id)
  ON CONFLICT (channel_id, agent_id, message_id) DO NOTHING;
  -- Teto de 500 pedidos esperando por canal e agente: o mais antigo cai primeiro (como no Buzz).
  UPDATE public.agent_channel_queue SET status = 'dead', last_error = 'fila cheia: pedido mais antigo descartado'
   WHERE id IN (
     SELECT id FROM public.agent_channel_queue
      WHERE channel_id = p_channel_id AND agent_id = p_agent AND status = 'pending'
      ORDER BY created_at DESC OFFSET 500);
END;
$$;
REVOKE ALL ON FUNCTION internal.harness_enfileirar(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Chama o agente no canal: política Hermes (papel, dono, aprovação, créditos); autorizado, o pedido entra na fila.
CREATE OR REPLACE FUNCTION internal.chat_chamar_agente(p_workspace_id UUID, p_member_id UUID, p_channel_id UUID, p_slug TEXT, p_agente TEXT, p_texto TEXT, p_message_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_nome TEXT := internal.nome_agente(p_agente);
  v_hermes JSONB;
BEGIN
  v_hermes := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'agents.chat', NULL, 2, false,
    'Pedido no #' || p_slug || ' para ' || v_nome, jsonb_build_object('channel_id', p_channel_id, 'agente', p_agente, 'mensagem', p_texto));
  IF NOT COALESCE((v_hermes->>'allowed')::boolean, false) THEN
    INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
    VALUES (p_workspace_id, p_channel_id, 'system', 'O pedido para ' || v_nome || ' não foi enviado: ' || COALESCE(v_hermes->>'reason', 'pedido não autorizado.'));
    RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'status', v_hermes->>'status');
  END IF;
  UPDATE public.executions SET agent_code = p_agente, title = 'Pedido no #' || p_slug || ': ' || left(p_texto, 80),
         execution_type = 'Conversa no canal', campaign_name = '#' || p_slug
   WHERE id = (v_hermes->>'execution_id')::uuid;
  PERFORM internal.harness_enfileirar(p_workspace_id, p_channel_id, p_agente, p_message_id, (v_hermes->>'execution_id')::uuid);
  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content, metadata)
  VALUES (p_workspace_id, p_channel_id, 'system', 'Pedido enviado para ' || v_nome || '. A resposta chega aqui quando terminar.',
          jsonb_build_object('execution_id', v_hermes->>'execution_id'));
  RETURN jsonb_build_object('ok', true, 'agente', p_agente, 'execution_id', v_hermes->>'execution_id');
END;
$$;
REVOKE ALL ON FUNCTION internal.chat_chamar_agente(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- chat_send: igual à da migration 0095 (nomes novos; mensagem, agente chamado por nome, avisos), mais a política de resposta de cada
-- agente do canal: 'owner' e 'always' chamam o agente sem precisar mencionar. Cada chamada passa pela política Hermes.
CREATE OR REPLACE FUNCTION public.chat_send(p_workspace_id UUID, p_member_id UUID, p_slug TEXT, p_texto TEXT, p_resposta JSONB, p_agente TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_nome TEXT := internal.nome_agente(p_agente);
  v_msg UUID;
  v_dono UUID;
  v_ag RECORD;
  v_r JSONB;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.canal_do_membro(p_workspace_id, p_member_id, p_slug);
  IF NOT FOUND OR NOT v.participa THEN RETURN jsonb_build_object('ok', false, 'erro', 'Canal não encontrado.'); END IF;
  IF v_texto = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Escreva a mensagem.'); END IF;
  IF length(v_texto) > 4000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Mensagem longa demais (até 4.000 caracteres).'); END IF;
  IF p_agente IS NOT NULL THEN
    IF v_nome IS NULL OR NOT EXISTS (SELECT 1 FROM public.chat_channel_agents a WHERE a.channel_id = v.id AND a.agent_id = p_agente) THEN
      RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_nome, 'O agente') || ' não participa de #' || p_slug || '.');
    END IF;
    IF v.papel = 'bdr' AND p_agente NOT IN ('comercial', 'copy') THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'BDR conversa com ' || internal.nome_agente('comercial') || ' e ' || internal.nome_agente('copy') || '.');
    END IF;
  END IF;

  INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, sender_member_id, content, metadata)
  VALUES (p_workspace_id, v.id, 'member', p_member_id, v_texto,
          CASE WHEN p_resposta IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('resp', p_resposta) END)
  RETURNING id INTO v_msg;

  -- Política de resposta: agentes do canal que respondem sem ser mencionados.
  SELECT created_by INTO v_dono FROM public.chat_channels WHERE id = v.id;
  FOR v_ag IN
    SELECT a.agent_id FROM public.chat_channel_agents a
     WHERE a.channel_id = v.id AND a.agent_id IS DISTINCT FROM p_agente
       AND (a.reply_policy = 'always' OR (a.reply_policy = 'owner' AND v_dono IS NOT DISTINCT FROM p_member_id))
       AND NOT (v.papel = 'bdr' AND a.agent_id NOT IN ('comercial', 'copy'))
     ORDER BY a.agent_id
  LOOP
    PERFORM internal.chat_chamar_agente(p_workspace_id, p_member_id, v.id, p_slug, v_ag.agent_id, v_texto, v_msg);
  END LOOP;

  IF p_agente IS NULL THEN
    IF position('@' IN v_texto) > 0 AND NOT EXISTS (SELECT 1 FROM public.chat_channel_agents a WHERE a.channel_id = v.id) THEN
      INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
      VALUES (p_workspace_id, v.id, 'system', 'Nenhum agente participa de #' || p_slug || '. Adicione um em Pessoas e agentes.');
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_r := internal.chat_chamar_agente(p_workspace_id, p_member_id, v.id, p_slug, p_agente, v_texto, v_msg);
  RETURN v_r;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_send(UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_send(UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- Quem gerencia o canal escolhe quando cada agente responde.
CREATE OR REPLACE FUNCTION public.chat_set_agent_policy(p_workspace_id UUID, p_member_id UUID, p_slug TEXT, p_agente TEXT, p_politica TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v FROM internal.canal_do_membro(p_workspace_id, p_member_id, p_slug);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Canal não encontrado.'); END IF;
  IF NOT v.gerencia THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só quem criou o canal ou um gestor muda quando o agente responde.'); END IF;
  IF p_politica IS NULL OR p_politica NOT IN ('mention', 'owner', 'always') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Política inválida (use mention, owner ou always).'); END IF;
  UPDATE public.chat_channel_agents SET reply_policy = p_politica WHERE channel_id = v.id AND agent_id = p_agente;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Este agente não participa do canal.'); END IF;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'chat.agent_policy_changed', 'chat_channel', v.id::text, jsonb_build_object('agente', p_agente, 'politica', p_politica));
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.chat_set_agent_policy(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_set_agent_policy(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------- falha e nova tentativa
-- Libera os créditos, devolve os pedidos à fila com espera crescente e, na 10ª falha, desiste e avisa no canal.
CREATE OR REPLACE FUNCTION internal.harness_falhar(p_run_id UUID, p_erro TEXT)
RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_run public.agent_channel_runs;
  v_perdidos INTEGER;
BEGIN
  SELECT * INTO v_run FROM public.agent_channel_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.status <> 'in_flight' THEN RETURN; END IF;
  IF v_run.execution_id IS NOT NULL AND v_run.reserved_credits > 0 THEN
    PERFORM public.credit_consume(v_run.workspace_id, v_run.execution_id, 0, v_run.reserved_credits, 'Liberação: pedido ao agente falhou', 'chatrun:' || p_run_id || ':release');
  END IF;
  UPDATE public.agent_channel_runs SET status = 'failed', finished_at = now(), error = left(COALESCE(p_erro, 'falha'), 300) WHERE id = p_run_id;
  WITH u AS (
    UPDATE public.agent_channel_queue
       SET attempts = attempts + 1, last_error = left(COALESCE(p_erro, 'falha'), 300), run_id = NULL,
           status = CASE WHEN attempts + 1 >= 10 THEN 'dead' ELSE 'pending' END,
           next_attempt_at = now() + make_interval(secs => least(5 * power(2, attempts), 300))
     WHERE run_id = p_run_id AND status = 'in_flight'
    RETURNING status)
  SELECT count(*) FILTER (WHERE status = 'dead') INTO v_perdidos FROM u;
  IF v_perdidos > 0 THEN
    INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
    VALUES (v_run.workspace_id, v_run.channel_id, 'system', internal.nome_agente(v_run.agent_id) || ' não conseguiu responder depois de várias tentativas. Chame de novo.');
    UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'tentativas_esgotadas')) WHERE id = v_run.execution_id;
    PERFORM public.audit_write(v_run.workspace_id, NULL, 'agente.canal_pedido_perdido', 'chat_channel', v_run.channel_id::text, jsonb_build_object('agente', v_run.agent_id, 'run', p_run_id));
  ELSE
    UPDATE public.executions SET status = 'queued' WHERE id = v_run.execution_id AND status = 'running';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION internal.harness_falhar(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- funções do executor (só o sistema)
-- Pega os lotes prontos. Um por agente por vez; canal "sossegado" (sem mensagem nova há p_quiet_seconds) ou esperando
-- há mais de p_max_wait_seconds; agente pausado pelo cliente não roda; sem crédito, o pedido é descartado com aviso.
CREATE OR REPLACE FUNCTION public.agent_harness_claim(
  p_quiet_seconds INTEGER DEFAULT 3, p_max_wait_seconds INTEGER DEFAULT 15, p_deadline_seconds INTEGER DEFAULT 300, p_limit INTEGER DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_c RECORD;
  v_run UUID;
  v_ids UUID[];
  v_exec UUID;
  v_reserva JSONB;
  v_tentativa INTEGER;
  v_slug TEXT;
  v_saida JSONB := '[]'::jsonb;
  v_n INTEGER := 0;
BEGIN
  FOR v_c IN
    SELECT q.workspace_id, q.channel_id, q.agent_id
      FROM public.agent_channel_queue q
     WHERE q.status = 'pending' AND q.next_attempt_at <= now()
     GROUP BY q.workspace_id, q.channel_id, q.agent_id
    HAVING max(q.created_at) <= now() - make_interval(secs => p_quiet_seconds)
        OR min(q.created_at) <= now() - make_interval(secs => p_max_wait_seconds)
     ORDER BY min(q.created_at)
  LOOP
    EXIT WHEN v_n >= p_limit;
    IF EXISTS (SELECT 1 FROM public.agent_channel_runs r WHERE r.workspace_id = v_c.workspace_id AND r.agent_id = v_c.agent_id AND r.status = 'in_flight') THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.workspace_agents a WHERE a.workspace_id = v_c.workspace_id AND a.agent_code = v_c.agent_id AND a.estado = 'pausado') THEN CONTINUE; END IF;

    SELECT array_agg(x.id ORDER BY x.created_at) INTO v_ids FROM (
      SELECT q.id, q.created_at FROM public.agent_channel_queue q
       WHERE q.workspace_id = v_c.workspace_id AND q.channel_id = v_c.channel_id AND q.agent_id = v_c.agent_id
         AND q.status = 'pending' AND q.next_attempt_at <= now()
       ORDER BY q.created_at LIMIT 50 FOR UPDATE SKIP LOCKED) x;
    IF v_ids IS NULL THEN CONTINUE; END IF;

    SELECT q.execution_id, q.attempts + 1 INTO v_exec, v_tentativa FROM public.agent_channel_queue q WHERE q.id = v_ids[1];
    BEGIN
      INSERT INTO public.agent_channel_runs (workspace_id, channel_id, agent_id, attempt, execution_id, deadline_at)
      VALUES (v_c.workspace_id, v_c.channel_id, v_c.agent_id, v_tentativa, v_exec, now() + make_interval(secs => p_deadline_seconds))
      RETURNING id INTO v_run;
    EXCEPTION WHEN unique_violation THEN CONTINUE;
    END;

    -- Créditos de UM pedido para o lote inteiro (as mensagens agrupadas respondem juntas).
    IF v_exec IS NOT NULL THEN
      v_reserva := public.credit_reserve(v_c.workspace_id, v_exec, 2, 'Reserva: pedido ao agente no canal', 'chatrun:' || v_ids[1] || ':a' || v_tentativa || ':reserve');
      IF COALESCE((v_reserva->>'success')::boolean, false) IS NOT TRUE THEN
        UPDATE public.agent_channel_runs SET status = 'failed', finished_at = now(), error = 'saldo_insuficiente' WHERE id = v_run;
        UPDATE public.agent_channel_queue SET status = 'dead', last_error = 'saldo_insuficiente' WHERE id = ANY (v_ids);
        UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = ANY (SELECT q.execution_id FROM public.agent_channel_queue q WHERE q.id = ANY (v_ids));
        INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, content)
        VALUES (v_c.workspace_id, v_c.channel_id, 'system', internal.nome_agente(v_c.agent_id) || ' não respondeu: o saldo de créditos não cobre este pedido.');
        CONTINUE;
      END IF;
      UPDATE public.agent_channel_runs SET reserved_credits = (v_reserva->>'reserved_amount')::int WHERE id = v_run;
      UPDATE public.executions SET status = 'running', reserved_credits = (v_reserva->>'reserved_amount')::int WHERE id = v_exec;
    END IF;

    UPDATE public.agent_channel_queue SET status = 'in_flight', run_id = v_run WHERE id = ANY (v_ids);
    SELECT c.slug INTO v_slug FROM public.chat_channels c WHERE c.id = v_c.channel_id;
    v_n := v_n + 1;
    v_saida := v_saida || jsonb_build_array(jsonb_build_object(
      'run_id', v_run, 'workspace_id', v_c.workspace_id, 'channel_id', v_c.channel_id, 'canal', v_slug, 'agente', v_c.agent_id, 'tentativa', v_tentativa,
      'mensagens', (SELECT jsonb_agg(jsonb_build_object('id', m.id, 'autor_id', m.sender_member_id, 'texto', m.content, 'em', m.created_at) ORDER BY m.created_at)
                      FROM public.agent_channel_queue q JOIN public.chat_messages m ON m.id = q.message_id WHERE q.id = ANY (v_ids)),
      'contexto', COALESCE((SELECT jsonb_agg(h.j ORDER BY h.em) FROM (
                      SELECT m.created_at AS em, jsonb_build_object('tipo', m.sender_type, 'autor_id', m.sender_member_id, 'agente', m.sender_agent_id, 'texto', m.content, 'em', m.created_at) AS j
                        FROM public.chat_messages m
                       WHERE m.channel_id = v_c.channel_id AND m.sender_type IN ('member', 'agent')
                         AND m.id NOT IN (SELECT q.message_id FROM public.agent_channel_queue q WHERE q.id = ANY (v_ids))
                         AND m.created_at <= (SELECT max(m2.created_at) FROM public.agent_channel_queue q2 JOIN public.chat_messages m2 ON m2.id = q2.message_id WHERE q2.id = ANY (v_ids))
                       ORDER BY m.created_at DESC LIMIT 10) h), '[]'::jsonb)));
  END LOOP;
  RETURN v_saida;
END;
$$;

-- Batimento de vida: false = o lote já foi recolhido (sem aviso a tempo); o executor deve parar.
CREATE OR REPLACE FUNCTION public.agent_harness_heartbeat(p_run_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  UPDATE public.agent_channel_runs SET heartbeat_at = now() WHERE id = p_run_id AND status = 'in_flight' AND deadline_at > now();
  v_ok := FOUND;
  RETURN v_ok;
END;
$$;

-- Fim do lote. Idempotente: só o primeiro fim vale.
CREATE OR REPLACE FUNCTION public.agent_harness_finish(p_run_id UUID, p_ok BOOLEAN, p_reply TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.agent_channel_runs;
  v_reply TEXT := btrim(COALESCE(p_reply, ''));
  v_msg UUID;
BEGIN
  SELECT * INTO r FROM public.agent_channel_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'in_flight' THEN RETURN jsonb_build_object('action', 'unchanged'); END IF;

  IF COALESCE(p_ok, false) AND v_reply <> '' AND length(v_reply) <= 4000 THEN
    INSERT INTO public.chat_messages (workspace_id, channel_id, sender_type, sender_agent_id, content, metadata)
    VALUES (r.workspace_id, r.channel_id, 'agent', r.agent_id, v_reply,
            jsonb_build_object('run_id', p_run_id, 'respondeu_a', (SELECT jsonb_agg(q.message_id) FROM public.agent_channel_queue q WHERE q.run_id = p_run_id)))
    RETURNING id INTO v_msg;
    IF r.execution_id IS NOT NULL AND r.reserved_credits > 0 THEN
      PERFORM public.credit_consume(r.workspace_id, r.execution_id, 2, r.reserved_credits, 'Pedido ao agente no canal', 'chatrun:' || p_run_id || ':consume');
    END IF;
    UPDATE public.executions SET status = 'completed', actual_credits = 2, progress = 100
     WHERE id = r.execution_id;
    -- Os outros pedidos do lote respondem junto: concluídos sem custo extra.
    UPDATE public.executions SET status = 'completed', actual_credits = 0, progress = 100
     WHERE id IN (SELECT q.execution_id FROM public.agent_channel_queue q WHERE q.run_id = p_run_id) AND id IS DISTINCT FROM r.execution_id;
    UPDATE public.agent_channel_queue SET status = 'done' WHERE run_id = p_run_id AND status = 'in_flight';
    UPDATE public.agent_channel_runs SET status = 'done', finished_at = now() WHERE id = p_run_id;
    PERFORM public.audit_write(r.workspace_id, NULL, 'agente.canal_respondeu', 'chat_message', v_msg::text, jsonb_build_object('agente', r.agent_id, 'run', p_run_id));
    RETURN jsonb_build_object('action', 'answered', 'message_id', v_msg);
  END IF;

  PERFORM internal.harness_falhar(p_run_id, CASE WHEN COALESCE(p_ok, false) THEN 'resposta vazia ou longa demais' ELSE COALESCE(p_error, 'falha do executor') END);
  RETURN jsonb_build_object('action', 'failed');
END;
$$;

-- Recolhe lotes sem batimento de vida (ou passados do prazo): voltam para a fila.
CREATE OR REPLACE FUNCTION public.agent_harness_reap(p_heartbeat_timeout_seconds INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
  v_n INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.agent_channel_runs
     WHERE status = 'in_flight' AND (heartbeat_at < now() - make_interval(secs => p_heartbeat_timeout_seconds) OR deadline_at < now())
     ORDER BY started_at
  LOOP
    PERFORM internal.harness_falhar(v_id, 'sem batimento de vida');
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_harness_claim(INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_harness_heartbeat(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_harness_finish(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_harness_reap(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_harness_claim(INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_harness_heartbeat(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_harness_finish(UUID, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_harness_reap(INTEGER) TO service_role;
