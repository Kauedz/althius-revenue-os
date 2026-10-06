-- ==============================================================================
-- Migration: 20261002000123_agente_acoes_nos_apps.sql
-- Agentes conectados, ticket 05 (ADR 0058): o agente PROPÕE uma ação num app conectado; vira uma aprovação de operação
-- (C-level ou estrategista decide); só depois de aprovada o executor roda a ação UMA vez, com o acesso de quem pediu.
--  - O banco guarda a ação aprovada (internal.integration_actions) e entrega ao executor com `SKIP LOCKED`.
--  - Execução no máximo uma vez: marcada "executando" ANTES de tocar no app; se travar, vira "falhou" e nunca é repetida
--    sozinha (repetir poderia criar o mesmo registro duas vezes no app do cliente).
--  - Recusada = cancelada. Nada é executado sem a aprovação.
-- Funções de sistema: só service_role (ADR 0023). Quem valida que a ferramenta existe e ESCREVE é o serviço de integrações,
-- que fala com o servidor do app; o banco valida só o formato e o contexto.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS internal.integration_actions (
  approval_id UUID PRIMARY KEY REFERENCES public.approvals(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  integracao TEXT NOT NULL,
  ferramenta TEXT NOT NULL,
  argumentos JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'executando', 'feita', 'falhou', 'cancelada')),
  resumo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
COMMENT ON TABLE internal.integration_actions IS 'Ações de agentes em apps conectados: a proposta aprovada espera aqui o executor. Argumentos podem ter dados do cliente: só o sistema lê.';
CREATE INDEX IF NOT EXISTS idx_integration_actions_status ON internal.integration_actions (status, created_at);
ALTER TABLE internal.integration_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal.integration_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE internal.integration_actions TO service_role;

CREATE OR REPLACE FUNCTION public.integration_agent_propose(
  p_token TEXT, p_integracao TEXT, p_ferramenta TEXT, p_app_nome TEXT, p_argumentos JSONB, p_reason TEXT, p_idempotency_key TEXT, p_conta TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_ctx JSONB;
  v_pessoa UUID;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_app TEXT := left(COALESCE(NULLIF(btrim(p_app_nome), ''), p_integracao), 60);
  v_conta TEXT := left(COALESCE(NULLIF(btrim(p_conta), ''), 'conta conectada'), 120);
  v_payload JSONB;
  v_res JSONB;
  v_nome_pessoa TEXT;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  v_ctx := public.integration_agent_context(p_token);
  v_pessoa := NULLIF(v_ctx->>'requester_member_id', '')::uuid;
  IF v_pessoa IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma pessoa pediu agora, então não há em nome de quem agir.'); END IF;
  IF p_integracao IS NULL OR p_integracao !~ '^[a-z0-9]{2,30}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'App inválido.'); END IF;
  IF p_ferramenta IS NULL OR p_ferramenta !~ '^[A-Za-z0-9_.:-]{1,100}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nome de ferramenta inválido.'); END IF;
  IF p_argumentos IS NULL OR jsonb_typeof(p_argumentos) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Os argumentos precisam ser um objeto.'); END IF;
  IF length(p_argumentos::text) > 8000 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Os argumentos passam de 8000 caracteres.'); END IF;
  IF v_motivo IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da ação.'); END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).'); END IF;

  SELECT COALESCE(wm.job_title, wm.role) INTO v_nome_pessoa FROM public.workspace_members wm WHERE wm.id = v_pessoa;
  v_payload := jsonb_build_object('acao', 'integracao_acao', 'integracao', p_integracao, 'ferramenta', p_ferramenta,
                                  'argumentos', p_argumentos, 'em_nome_de', v_pessoa, 'conta', v_conta);
  v_res := internal.agente_propor(v, 'operacao', 'execucao',
    format('Ação no %s: %s', v_app, p_ferramenta), v_motivo,
    format('Executa "%s" no %s (conta %s), em nome de quem pediu, depois da aprovação. Só roda uma vez.', p_ferramenta, v_app, v_conta),
    left(format('%s com %s', p_ferramenta, p_argumentos::text), 400),
    v_payload, v_chave, 0);
  IF COALESCE((v_res->>'ok')::boolean, false) THEN
    INSERT INTO internal.integration_actions (approval_id, workspace_id, member_id, agent_code, integracao, ferramenta, argumentos)
    VALUES ((v_res->>'approval_id')::uuid, v.workspace_id, v_pessoa, v.agent_code, p_integracao, p_ferramenta, p_argumentos)
    ON CONFLICT (approval_id) DO NOTHING;
  END IF;
  RETURN v_res;
END;
$$;

-- O executor pede a próxima ação aprovada. Recusadas viram "cancelada"; travadas em "executando" viram "falhou" e NUNCA
-- são repetidas (a ação já pode ter acontecido no app). No máximo uma por chamada.
CREATE OR REPLACE FUNCTION public.integration_action_claim()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a internal.integration_actions;
BEGIN
  UPDATE internal.integration_actions a SET status = 'cancelada', finished_at = now()
   WHERE a.status = 'aguardando' AND EXISTS (SELECT 1 FROM public.approvals ap WHERE ap.id = a.approval_id AND ap.status = 'rejeitado');

  FOR v_a IN
    SELECT * FROM internal.integration_actions a
     WHERE a.status = 'executando' AND a.started_at < now() - interval '10 minutes' FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE internal.integration_actions SET status = 'falhou', finished_at = now(),
           resumo = 'Interrompida no meio. Não foi repetida para não executar duas vezes: confira no app e peça de novo se for preciso.'
     WHERE approval_id = v_a.approval_id;
    INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
    VALUES (v_a.workspace_id, v_a.member_id, 'agent_action_failed', 'A ação no app foi interrompida',
            'A ação "' || v_a.ferramenta || '" foi interrompida e não foi repetida. Confira no app antes de pedir de novo.', 'approval', v_a.approval_id);
  END LOOP;

  SELECT a.* INTO v_a FROM internal.integration_actions a
    JOIN public.approvals ap ON ap.id = a.approval_id AND ap.status = 'aprovado'
   WHERE a.status = 'aguardando'
   ORDER BY a.created_at
   LIMIT 1 FOR UPDATE OF a SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE internal.integration_actions SET status = 'executando', started_at = now() WHERE approval_id = v_a.approval_id;
  RETURN jsonb_build_object('approval_id', v_a.approval_id, 'workspace_id', v_a.workspace_id, 'member_id', v_a.member_id, 'agent_code', v_a.agent_code,
                            'integracao', v_a.integracao, 'ferramenta', v_a.ferramenta, 'argumentos', v_a.argumentos);
END;
$$;

CREATE OR REPLACE FUNCTION public.integration_action_finish(p_approval_id UUID, p_ok BOOLEAN, p_resumo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_a internal.integration_actions;
BEGIN
  SELECT * INTO v_a FROM internal.integration_actions WHERE approval_id = p_approval_id FOR UPDATE;
  -- Só quem está "executando" conclui; o que já terminou não muda (idempotente).
  IF NOT FOUND OR v_a.status <> 'executando' THEN RETURN; END IF;
  UPDATE internal.integration_actions SET status = CASE WHEN p_ok THEN 'feita' ELSE 'falhou' END, finished_at = now(), resumo = left(COALESCE(p_resumo, ''), 500)
   WHERE approval_id = p_approval_id;
  INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
  VALUES (v_a.workspace_id, v_a.member_id, CASE WHEN p_ok THEN 'agent_action_done' ELSE 'agent_action_failed' END,
          CASE WHEN p_ok THEN 'Ação no app concluída' ELSE 'A ação no app falhou' END,
          '"' || v_a.ferramenta || '": ' || left(COALESCE(p_resumo, ''), 300), 'approval', p_approval_id);
  PERFORM public.audit_write(v_a.workspace_id, NULL, 'agente_acao_integracao_concluida', 'approval', p_approval_id::text,
    jsonb_build_object('agente', v_a.agent_code, 'em_nome_de', v_a.member_id, 'integracao', v_a.integracao, 'ferramenta', v_a.ferramenta, 'resultado', CASE WHEN p_ok THEN 'ok' ELSE 'erro' END));
END;
$$;

REVOKE ALL ON FUNCTION public.integration_agent_propose(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_action_claim() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.integration_action_finish(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_agent_propose(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_action_claim() TO service_role;
GRANT EXECUTE ON FUNCTION public.integration_action_finish(UUID, BOOLEAN, TEXT) TO service_role;
