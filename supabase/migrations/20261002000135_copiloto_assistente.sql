-- ==============================================================================
-- Migration: 20261002000135_copiloto_assistente.sql
-- Copiloto como assistente separado (spec .scratch/prospeccao-revenue, fatia 6; ADR 0068).
-- Antes, `copilot_request` (0089/0090) criava uma execução que nenhum serviço processava. Agora o Copiloto é uma
-- CONVERSA privada de cada pessoa com um assistente que:
--  - responde dúvidas sobre a plataforma e explica os números, LIDOS DO BANCO na hora (internal.copiloto_numeros);
--  - quando o pedido é trabalho, diz qual agente faz e encaminha (abre a conversa direta com ele, ADR 0059).
-- Não é agente da equipe (não tem agent_code próprio), não propõe nada, não cria execução e NÃO GASTA CRÉDITO
-- (decisão registrada na ADR 0068; limite de 60 perguntas por pessoa por dia, para conter o custo do modelo, que é da
-- Althius). O serviço `copiloto` pega a pergunta, chama o modelo pelo gateway (ADR 0050) e grava a resposta; sem
-- modelo, grava a verdade ("não consegui responder agora: ...").
-- `copilot_request` antigo continua existindo, mas a tela não o usa mais.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  autor TEXT NOT NULL CHECK (autor IN ('pessoa', 'copiloto')),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 4000),
  -- pergunta: pendente → processando → respondida | erro. Resposta do copiloto: respondida | erro.
  estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'processando', 'respondida', 'erro')),
  resposta_de UUID REFERENCES public.copilot_messages(id) ON DELETE CASCADE,
  encaminhar_para TEXT CHECK (encaminhar_para IS NULL OR encaminhar_para IN ('comercial', 'marketing', 'copy', 'revops')),
  chave TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_copilot_chave UNIQUE (member_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_conversa ON public.copilot_messages (member_id, workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_fila ON public.copilot_messages (estado, created_at) WHERE autor = 'pessoa';
COMMENT ON TABLE public.copilot_messages IS 'Conversa privada de cada pessoa com o Copiloto (ADR 0068). Não é agente; não gasta crédito.';

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cada pessoa lê só a própria conversa" ON public.copilot_messages;
CREATE POLICY "Cada pessoa lê só a própria conversa" ON public.copilot_messages FOR SELECT TO authenticated
  USING (member_id IN (SELECT wm.id FROM public.workspace_members wm WHERE wm.user_id = auth.uid() AND wm.status = 'active'));
REVOKE ALL ON public.copilot_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;

-- Os números que o Copiloto pode citar, lidos agora. BDR não vê saldo de créditos (é regra de quem paga).
CREATE OR REPLACE FUNCTION internal.copiloto_numeros(p_workspace_id UUID, p_member_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_papel TEXT := (SELECT role FROM public.workspace_members WHERE id = p_member_id);
  v JSONB;
BEGIN
  v := jsonb_build_object(
    'cliente', (SELECT name FROM public.workspaces WHERE id = p_workspace_id),
    'contas_ativas', (SELECT count(*) FROM public.accounts WHERE workspace_id = p_workspace_id AND status = 'ativa'),
    'contas_fit_70_ou_mais', (SELECT count(*) FROM public.accounts WHERE workspace_id = p_workspace_id AND status = 'ativa' AND fit >= 70),
    'negocios_ativos', (SELECT count(*) FROM public.opportunities WHERE workspace_id = p_workspace_id AND status = 'ativa'),
    'valor_negocios_ativos_reais', (SELECT COALESCE(sum(amount), 0) FROM public.opportunities WHERE workspace_id = p_workspace_id AND status = 'ativa'),
    'aprovacoes_pendentes', (SELECT count(*) FROM public.approvals WHERE workspace_id = p_workspace_id AND status = 'pendente' AND parent_approval_id IS NULL),
    'minhas_tarefas_abertas', (SELECT count(*) FROM public.tasks WHERE workspace_id = p_workspace_id AND assignee_member_id = p_member_id AND status <> 'concluida'),
    'minhas_tarefas_atrasadas', (SELECT count(*) FROM public.tasks WHERE workspace_id = p_workspace_id AND assignee_member_id = p_member_id AND status <> 'concluida' AND due_at < now()),
    'sinais_ultimos_7_dias', (SELECT count(*) FROM public.signal_events WHERE workspace_id = p_workspace_id AND detected_at > now() - interval '7 days'),
    'buscas_de_prospeccao_30_dias', (SELECT count(*) FROM public.prospect_searches WHERE workspace_id = p_workspace_id AND created_at > now() - interval '30 days'),
    'candidatas_sem_decisao', (SELECT count(*) FROM public.prospect_candidates WHERE workspace_id = p_workspace_id AND estado = 'candidata'),
    'icp', COALESCE(internal.icp_texto((SELECT icp FROM public.workspace_settings WHERE workspace_id = p_workspace_id)), 'não definido'),
    'agentes_pausados', COALESCE((SELECT jsonb_agg(agent_code) FROM public.workspace_agents WHERE workspace_id = p_workspace_id AND estado = 'pausado'), '[]'::jsonb));
  IF v_papel IN ('superadmin', 'estrategista', 'clevel') THEN
    v := v || jsonb_build_object(
      'saldo_creditos', (SELECT GREATEST(0, allowance_balance + topup_balance - reserved_balance) FROM public.credit_wallets WHERE workspace_id = p_workspace_id),
      'creditos_consumidos_no_mes', (SELECT monthly_consumed FROM public.credit_wallets WHERE workspace_id = p_workspace_id));
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION internal.copiloto_numeros(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Tela: a pessoa pergunta (só por ela mesma).
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
  IF (SELECT count(*) FROM public.copilot_messages WHERE member_id = p_member_id AND autor = 'pessoa' AND created_at > now() - interval '1 day') >= 60 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Limite de 60 perguntas ao Copiloto por dia. Para trabalho, fale direto com o agente.');
  END IF;
  INSERT INTO public.copilot_messages (workspace_id, member_id, autor, texto, estado, chave)
  VALUES (p_workspace_id, p_member_id, 'pessoa', v_texto, 'pendente', v_chave)
  ON CONFLICT (member_id, chave) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM public.copilot_messages WHERE member_id = p_member_id AND chave = v_chave; END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- Serviço: pega as perguntas (a que travou há mais de 5 minutos volta para a fila, até 3 vezes).
CREATE OR REPLACE FUNCTION public.copilot_next(p_limit INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT m.*, wm.role AS papel FROM public.copilot_messages m
      JOIN public.workspace_members wm ON wm.id = m.member_id AND wm.status = 'active'
     WHERE m.autor = 'pessoa'
       AND (m.estado = 'pendente' OR (m.estado = 'processando' AND m.updated_at < now() - interval '5 minutes' AND m.tentativas < 3))
     ORDER BY m.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 5))
     FOR UPDATE OF m SKIP LOCKED
  LOOP
    UPDATE public.copilot_messages SET estado = 'processando', tentativas = tentativas + 1, updated_at = now() WHERE id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'workspace_id', r.workspace_id, 'papel', r.papel, 'pergunta', r.texto,
      'numeros', internal.copiloto_numeros(r.workspace_id, r.member_id),
      'historico', COALESCE((SELECT jsonb_agg(jsonb_build_object('autor', h.autor, 'texto', left(h.texto, 1500)) ORDER BY h.created_at)
                               FROM (SELECT * FROM public.copilot_messages h
                                      WHERE h.member_id = r.member_id AND h.workspace_id = r.workspace_id AND h.created_at < r.created_at AND h.estado <> 'erro'
                                      ORDER BY h.created_at DESC LIMIT 10) h), '[]'::jsonb)));
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.copilot_answer(p_id UUID, p_texto TEXT, p_encaminhar TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.copilot_messages;
BEGIN
  IF p_encaminhar IS NOT NULL AND p_encaminhar NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN
    RAISE EXCEPTION 'Agente desconhecido: são só Zoe, Jax, Lia e Neo.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.copilot_messages WHERE id = p_id AND autor = 'pessoa' FOR UPDATE;
  IF NOT FOUND OR m.estado <> 'processando' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF NULLIF(btrim(COALESCE(p_texto, '')), '') IS NULL THEN RAISE EXCEPTION 'Resposta vazia.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.copilot_messages (workspace_id, member_id, autor, texto, estado, resposta_de, encaminhar_para)
  VALUES (m.workspace_id, m.member_id, 'copiloto', left(btrim(p_texto), 4000), 'respondida', m.id, p_encaminhar);
  UPDATE public.copilot_messages SET estado = 'respondida', updated_at = now() WHERE id = m.id;
  RETURN jsonb_build_object('acao', 'respondida');
END;
$$;

CREATE OR REPLACE FUNCTION public.copilot_fail(p_id UUID, p_motivo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.copilot_messages;
  v_motivo TEXT := COALESCE(NULLIF(regexp_replace(btrim(COALESCE(p_motivo, '')), '[.!]+$', ''), ''), 'falha inesperada');
BEGIN
  SELECT * INTO m FROM public.copilot_messages WHERE id = p_id AND autor = 'pessoa' FOR UPDATE;
  IF NOT FOUND OR m.estado <> 'processando' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  INSERT INTO public.copilot_messages (workspace_id, member_id, autor, texto, estado, resposta_de)
  VALUES (m.workspace_id, m.member_id, 'copiloto', left('Não consegui responder agora: ' || v_motivo || '.', 4000), 'erro', m.id);
  UPDATE public.copilot_messages SET estado = 'erro', updated_at = now() WHERE id = m.id;
  RETURN jsonb_build_object('acao', 'falhou');
END;
$$;

-- O uso do modelo pelo Copiloto entra no registro de uso com o rótulo "copiloto" (não é agente: nada de agent_code).
CREATE OR REPLACE FUNCTION public.llm_registrar_uso(
  p_workspace_id UUID, p_agente TEXT, p_rotulo TEXT, p_modelo TEXT, p_tokens_entrada INTEGER, p_tokens_saida INTEGER, p_custo_usd NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(p_tokens_entrada, -1) < 0 OR COALESCE(p_tokens_saida, -1) < 0 OR (p_custo_usd IS NOT NULL AND p_custo_usd < 0) THEN
    RAISE EXCEPTION 'Quantidade de uso inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_agente IS NULL OR p_agente NOT IN ('comercial', 'marketing', 'copy', 'revops', 'copiloto') THEN
    RAISE EXCEPTION 'Agente desconhecido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO internal.llm_uso (workspace_id, agente, rotulo, modelo, tokens_entrada, tokens_saida, custo_usd)
  VALUES (p_workspace_id, p_agente, left(COALESCE(p_rotulo, ''), 80), left(COALESCE(p_modelo, ''), 100), p_tokens_entrada, p_tokens_saida, p_custo_usd);
END;
$$;

REVOKE ALL ON FUNCTION public.copilot_ask(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copilot_ask(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.copilot_next(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.copilot_answer(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.copilot_fail(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_next(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.copilot_answer(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.copilot_fail(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.llm_registrar_uso(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.llm_registrar_uso(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, NUMERIC) TO service_role;
