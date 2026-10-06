-- ==============================================================================
-- Migration: 20261002000112_harness_executor.sql
-- PR 14: os agentes respondem de verdade. O harness (migration 0110) passa a pegar só os agentes que TÊM executor
-- registrado (p_only: lista de "workspace/agente"), e o lote traz o NOME de quem escreveu (e o papel), para o agente
-- saber com quem fala. Sem executor, o pedido espera na fila, sem gastar tentativa nem crédito.
-- A função antiga (4 parâmetros) é trocada pela nova (5 parâmetros, o último opcional): chamadas antigas continuam valendo.
-- ==============================================================================

-- Nome de quem escreveu (perfil do usuário do membro). Sem perfil, vazio: o agente trata como "alguém do time".
CREATE OR REPLACE FUNCTION internal.nome_do_membro(p_member_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NULLIF(btrim(p.name), '')
    FROM public.workspace_members wm JOIN public.profiles p ON p.id = wm.user_id
   WHERE wm.id = p_member_id;
$$;
REVOKE ALL ON FUNCTION internal.nome_do_membro(UUID) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.agent_harness_claim(INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.agent_harness_claim(
  p_quiet_seconds INTEGER DEFAULT 3, p_max_wait_seconds INTEGER DEFAULT 15, p_deadline_seconds INTEGER DEFAULT 300, p_limit INTEGER DEFAULT 5, p_only JSONB DEFAULT NULL)
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
    -- Só os agentes que têm executor registrado: sem ele o pedido espera na fila (nada de falhar e gastar tentativas).
    IF p_only IS NOT NULL AND NOT (p_only @> to_jsonb(v_c.workspace_id::text || '/' || v_c.agent_id)) THEN CONTINUE; END IF;
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
      'mensagens', (SELECT jsonb_agg(jsonb_build_object('id', m.id, 'autor_id', m.sender_member_id, 'autor', internal.nome_do_membro(m.sender_member_id), 'papel', (SELECT wm.role FROM public.workspace_members wm WHERE wm.id = m.sender_member_id), 'texto', m.content, 'em', m.created_at) ORDER BY m.created_at)
                      FROM public.agent_channel_queue q JOIN public.chat_messages m ON m.id = q.message_id WHERE q.id = ANY (v_ids)),
      'contexto', COALESCE((SELECT jsonb_agg(h.j ORDER BY h.em) FROM (
                      SELECT m.created_at AS em, jsonb_build_object('tipo', m.sender_type, 'autor_id', m.sender_member_id, 'autor', internal.nome_do_membro(m.sender_member_id), 'agente', m.sender_agent_id, 'texto', m.content, 'em', m.created_at) AS j
                        FROM public.chat_messages m
                       WHERE m.channel_id = v_c.channel_id AND m.sender_type IN ('member', 'agent')
                         AND m.id NOT IN (SELECT q.message_id FROM public.agent_channel_queue q WHERE q.id = ANY (v_ids))
                         AND m.created_at <= (SELECT max(m2.created_at) FROM public.agent_channel_queue q2 JOIN public.chat_messages m2 ON m2.id = q2.message_id WHERE q2.id = ANY (v_ids))
                       ORDER BY m.created_at DESC LIMIT 10) h), '[]'::jsonb)));
  END LOOP;
  RETURN v_saida;
END;
$$;


REVOKE ALL ON FUNCTION public.agent_harness_claim(INTEGER, INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_harness_claim(INTEGER, INTEGER, INTEGER, INTEGER, JSONB) TO service_role;
