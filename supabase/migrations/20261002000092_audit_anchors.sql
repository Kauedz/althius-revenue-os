-- ==============================================================================
-- Migration: 20261002000092_audit_anchors.sql
-- Âncora do topo da corrente de auditoria (ADR 0038, continuação da 0091).
--
-- A 0091 detecta linha alterada, linha apagada no meio e corrente rompida. Não detecta
-- apagar as ÚLTIMAS linhas: não existe linha seguinte para acusar o buraco.
-- Aqui, uma "foto" periódica do topo (posição + hash) de cada workspace fica guardada
-- numa tabela própria, também imutável. A verificação passa a acusar:
--   * topo_apagado      - a foto diz que existia a posição N e hoje a corrente é menor;
--   * ancora_divergente - a posição existe, mas o hash é outro (corrente reescrita com
--                         hashes recalculados).
--
-- Limite que continua valendo: a âncora mora no mesmo banco. Protege contra quem apaga
-- linhas de auditoria sem desligar as travas da tabela de âncoras também. Uma cópia
-- fora do banco (e o agendamento da foto) ficam para a próxima fatia.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  hash BYTEA NOT NULL,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_audit_anchors_workspace_seq UNIQUE (workspace_id, seq)
);

COMMENT ON TABLE public.audit_anchors IS
  'Foto periódica do topo da corrente de auditoria de cada workspace (posição e hash). Imutável. Só o banco acessa.';

-- RLS ligada e nenhuma política: tela e agentes não enxergam esta tabela (ADR 0023).
ALTER TABLE public.audit_anchors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_anchors FROM PUBLIC, anon, authenticated;

-- Imutável como o audit_logs. A única exceção é a remoção do workspace inteiro: a exclusão
-- em cascata dispara este gatilho de dentro de outro gatilho (profundidade 2).
CREATE OR REPLACE FUNCTION internal.audit_anchors_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_catalog.pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_anchors é imutável: UPDATE e DELETE são proibidos.';
END;
$$;
REVOKE ALL ON FUNCTION internal.audit_anchors_imutavel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_audit_anchor_mutation ON public.audit_anchors;
CREATE TRIGGER block_audit_anchor_mutation
  BEFORE UPDATE OR DELETE ON public.audit_anchors
  FOR EACH ROW
  EXECUTE FUNCTION internal.audit_anchors_imutavel();

-- Verificação: mesmo corpo da 0091, com a conferência da âncora no fim.
CREATE OR REPLACE FUNCTION public.audit_verify_chain(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_linha public.audit_logs;
  v_esperado BIGINT := 1;
  v_prev BYTEA := NULL;
  v_total BIGINT := 0;
  v_ancora public.audit_anchors;
  v_hash_na_posicao BYTEA;
BEGIN
  -- Pessoa logada: só o superadmin. Backend (sem usuário no JWT): liberado.
  IF auth.uid() IS NOT NULL THEN
    PERFORM internal.exigir_superadmin();
  END IF;

  FOR v_linha IN SELECT * FROM public.audit_logs WHERE workspace_id = p_workspace_id ORDER BY seq LOOP
    v_total := v_total + 1;
    IF v_linha.seq <> v_esperado THEN
      RETURN jsonb_build_object('integra', false, 'linhas', NULL, 'primeira_quebra', v_linha.seq, 'motivo', 'linha_faltando');
    END IF;
    IF v_linha.prev_hash IS DISTINCT FROM v_prev THEN
      RETURN jsonb_build_object('integra', false, 'linhas', NULL, 'primeira_quebra', v_linha.seq, 'motivo', 'corrente_rompida');
    END IF;
    IF v_linha.hash_version <> 1 OR internal.audit_calcular_hash(v_linha) IS DISTINCT FROM v_linha.hash THEN
      RETURN jsonb_build_object('integra', false, 'linhas', NULL, 'primeira_quebra', v_linha.seq, 'motivo', 'conteudo_alterado');
    END IF;
    v_prev := v_linha.hash;
    v_esperado := v_esperado + 1;
  END LOOP;

  -- Âncora mais recente: a corrente não pode ser menor nem diferente do que já foi fotografado.
  SELECT * INTO v_ancora FROM public.audit_anchors a WHERE a.workspace_id = p_workspace_id ORDER BY a.seq DESC LIMIT 1;
  IF FOUND THEN
    IF v_total < v_ancora.seq THEN
      RETURN jsonb_build_object('integra', false, 'linhas', NULL, 'primeira_quebra', v_total + 1, 'motivo', 'topo_apagado');
    END IF;
    SELECT l.hash INTO v_hash_na_posicao FROM public.audit_logs l WHERE l.workspace_id = p_workspace_id AND l.seq = v_ancora.seq;
    IF v_hash_na_posicao IS DISTINCT FROM v_ancora.hash THEN
      RETURN jsonb_build_object('integra', false, 'linhas', NULL, 'primeira_quebra', v_ancora.seq, 'motivo', 'ancora_divergente');
    END IF;
  END IF;

  RETURN jsonb_build_object('integra', true, 'linhas', v_total, 'primeira_quebra', NULL, 'motivo', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_verify_chain(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_verify_chain(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.audit_verify_chain(UUID) IS
  'Confere a corrente de auditoria do workspace e a âncora do topo. Devolve integra, linhas, primeira_quebra e motivo. Só superadmin ou backend.';

-- Foto do topo de cada workspace. Função de sistema (service_role): ninguém logado chama.
-- Idempotente: sem linha nova desde a última foto, não grava nada.
-- Nunca fotografa corrente quebrada: isso legitimaria a adulteração.
CREATE OR REPLACE FUNCTION public.audit_anchor_snapshot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ws UUID;
  v_topo public.audit_logs;
  v_novas INTEGER := 0;
  v_puladas INTEGER := 0;
  v_gravou INTEGER;
BEGIN
  FOR v_ws IN SELECT DISTINCT workspace_id FROM public.audit_logs LOOP
    IF (public.audit_verify_chain(v_ws)->>'integra')::boolean IS NOT TRUE THEN
      v_puladas := v_puladas + 1;
      CONTINUE;
    END IF;
    SELECT * INTO v_topo FROM public.audit_logs l WHERE l.workspace_id = v_ws ORDER BY l.seq DESC LIMIT 1;
    INSERT INTO public.audit_anchors (workspace_id, seq, hash) VALUES (v_ws, v_topo.seq, v_topo.hash)
      ON CONFLICT (workspace_id, seq) DO NOTHING;
    GET DIAGNOSTICS v_gravou = ROW_COUNT;
    v_novas := v_novas + v_gravou;
  END LOOP;
  RETURN jsonb_build_object('ancoradas', v_novas, 'puladas', v_puladas);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_anchor_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_anchor_snapshot() TO service_role;

COMMENT ON FUNCTION public.audit_anchor_snapshot() IS
  'Grava a âncora (posição e hash do topo) de cada workspace com corrente íntegra. Idempotente. Só backend (service_role).';

-- Saúde da plataforma: mesmo corpo da 0091; a única mudança é olhar também os workspaces
-- que têm âncora (corrente inteira apagada deixa de ter linhas e sumiria da conta).
CREATE OR REPLACE FUNCTION public.admin_health()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_falhas INTEGER; v_vencidas INTEGER; v_conexoes INTEGER; v_convites INTEGER; v_pausados INTEGER; v_chaves INTEGER;
  v_auditoria INTEGER;
BEGIN
  PERFORM internal.exigir_superadmin();
  SELECT count(*) INTO v_falhas FROM public.executions WHERE status = 'failed' AND updated_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_vencidas FROM public.approvals WHERE status = 'pendente' AND deadline_at < now();
  SELECT count(*) INTO v_conexoes FROM public.messaging_accounts WHERE status <> 'connected';
  SELECT count(*) INTO v_convites FROM public.workspace_invites WHERE status = 'pending' AND delivery_status <> 'sent';
  SELECT count(*) INTO v_pausados FROM public.workspace_agents WHERE estado = 'pausado';
  SELECT count(*) INTO v_chaves FROM public.agent_runtime_tokens WHERE revoked_at IS NULL;
  SELECT count(*) INTO v_auditoria
    FROM (SELECT workspace_id FROM public.audit_logs UNION SELECT workspace_id FROM public.audit_anchors) w
   WHERE (public.audit_verify_chain(w.workspace_id)->>'integra')::boolean IS NOT TRUE;
  RETURN jsonb_build_array(
    jsonb_build_object('nome', 'Banco de dados', 'status', 'OK', 'detalhe', 'Respondendo'),
    jsonb_build_object('nome', 'Execuções com falha (24 h)', 'status', CASE WHEN v_falhas = 0 THEN 'OK' WHEN v_falhas < 5 THEN 'Atenção' ELSE 'Falha' END, 'detalhe', v_falhas || ' execuções'),
    jsonb_build_object('nome', 'Aprovações vencidas', 'status', CASE WHEN v_vencidas = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_vencidas || ' aguardando decisão'),
    jsonb_build_object('nome', 'Conexões que precisam reconectar', 'status', CASE WHEN v_conexoes = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_conexoes || ' conexões'),
    jsonb_build_object('nome', 'Convites aguardando envio', 'status', CASE WHEN v_convites = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_convites || ' convites (conector de e-mail pendente)'),
    jsonb_build_object('nome', 'Agentes pausados pelos clientes', 'status', CASE WHEN v_pausados = 0 THEN 'OK' ELSE 'Atenção' END, 'detalhe', v_pausados || ' agentes'),
    jsonb_build_object('nome', 'Chaves de agente ativas', 'status', 'OK', 'detalhe', v_chaves || ' chaves'),
    jsonb_build_object('nome', 'Auditoria íntegra', 'status', CASE WHEN v_auditoria = 0 THEN 'OK' ELSE 'Falha' END,
      'detalhe', CASE WHEN v_auditoria = 0 THEN 'Corrente conferida em todos os clientes' ELSE v_auditoria || ' clientes com auditoria adulterada' END)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_health() TO authenticated;
