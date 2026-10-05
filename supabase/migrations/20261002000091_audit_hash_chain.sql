-- ==============================================================================
-- Migration: 20261002000091_audit_hash_chain.sql
-- Auditoria encadeada por hash (ADR 0038, primeira peça do "ferro velho").
--
-- Peça portada do block/buzz, crate buzz-audit (Apache-2.0), arquivos hash.rs e
-- service.rs: corrente por tenant, posição sequencial, trava por tenant e
-- codificação TLV (tag + tamanho + valor) para que bytes não "mudem de campo".
-- Adaptada para Postgres puro: o cálculo roda num gatilho, então nenhuma tela,
-- agente ou worker consegue gravar um hash falso. Ver THIRD_PARTY_NOTICES.md.
--
-- O que muda:
--   * audit_logs ganha seq, prev_hash, hash e hash_version;
--   * cada workspace tem a própria corrente (seq 1, 2, 3...);
--   * public.audit_verify_chain(workspace) aponta a primeira linha adulterada;
--   * a tela Saúde do superadmin mostra "Auditoria íntegra".
-- O que não detecta: apagar as ÚLTIMAS linhas (não há linha seguinte para acusar).
-- Para isso, a âncora periódica do topo da corrente fica como próxima fatia.
-- ==============================================================================

-- 1. Colunas novas (nulas até o preenchimento das linhas antigas)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS seq BIGINT,
  ADD COLUMN IF NOT EXISTS prev_hash BYTEA,
  ADD COLUMN IF NOT EXISTS hash BYTEA,
  ADD COLUMN IF NOT EXISTS hash_version SMALLINT;

COMMENT ON COLUMN public.audit_logs.seq IS 'Posição da linha na corrente do workspace (1, 2, 3...). Calculada pelo banco.';
COMMENT ON COLUMN public.audit_logs.prev_hash IS 'Hash da linha anterior do mesmo workspace. Nulo só na primeira.';
COMMENT ON COLUMN public.audit_logs.hash IS 'SHA-256 da linha (codificação TLV v1). Calculado pelo banco; quem grava não escolhe.';
COMMENT ON COLUMN public.audit_logs.hash_version IS 'Versão da codificação do hash. 1 = althius:audit:v1.';

-- 2. Codificação TLV: 1 byte de tag + 8 bytes de tamanho (big-endian) + valor.
--    Campo ausente (nulo) é omitido; campo vazio mantém a tag com tamanho zero.
CREATE OR REPLACE FUNCTION internal.audit_tlv(p_tag INTEGER, p_valor BYTEA)
RETURNS BYTEA
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_valor IS NULL THEN '\x'::bytea
              ELSE pg_catalog.set_byte('\x00'::bytea, 0, p_tag) || pg_catalog.int8send(pg_catalog.length(p_valor)::bigint) || p_valor
         END;
$$;

CREATE OR REPLACE FUNCTION internal.audit_tlv_texto(p_tag INTEGER, p_valor TEXT)
RETURNS BYTEA
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT internal.audit_tlv(p_tag, pg_catalog.convert_to(p_valor, 'UTF8'));
$$;

-- 3. Hash de uma linha. A mesma função serve para gravar e para verificar.
--    created_at entra em UTC com microssegundos fixos (precisão do TIMESTAMPTZ);
--    jsonb entra pelo texto do jsonb, que já sai com as chaves em ordem fixa.
CREATE OR REPLACE FUNCTION internal.audit_calcular_hash(p_linha public.audit_logs)
RETURNS BYTEA
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT extensions.digest(
    pg_catalog.convert_to('althius:audit:v1', 'UTF8') || '\x00'::bytea
    || internal.audit_tlv_texto(1, p_linha.workspace_id::text)
    || internal.audit_tlv(2, pg_catalog.int8send(p_linha.seq))
    || internal.audit_tlv_texto(3, p_linha.id::text)
    || internal.audit_tlv_texto(4, pg_catalog.to_char(p_linha.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
    || internal.audit_tlv_texto(5, p_linha.actor_user_id::text)
    || internal.audit_tlv_texto(6, p_linha.actor_member_id::text)
    || internal.audit_tlv_texto(7, p_linha.actor_role)
    || internal.audit_tlv_texto(8, p_linha.action)
    || internal.audit_tlv_texto(9, p_linha.entity_type)
    || internal.audit_tlv_texto(10, p_linha.entity_id::text)
    || internal.audit_tlv_texto(11, p_linha.old_values::text)
    || internal.audit_tlv_texto(12, p_linha.new_values::text)
    || internal.audit_tlv_texto(13, p_linha.ip_address)
    || internal.audit_tlv_texto(14, p_linha.user_agent)
    || internal.audit_tlv(15, p_linha.prev_hash),
    'sha256');
$$;

REVOKE ALL ON FUNCTION internal.audit_tlv(INTEGER, BYTEA) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.audit_tlv_texto(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.audit_calcular_hash(public.audit_logs) FROM PUBLIC, anon, authenticated;

-- 4. Linhas antigas entram na corrente na ordem em que foram gravadas.
--    Única vez em que a trava de imutabilidade é desligada, dentro desta migration.
ALTER TABLE public.audit_logs DISABLE TRIGGER block_audit_log_mutation;
DO $$
DECLARE
  v_linha public.audit_logs;
  v_ws UUID := NULL;
  v_seq BIGINT := 0;
  v_prev BYTEA := NULL;
BEGIN
  FOR v_linha IN SELECT * FROM public.audit_logs ORDER BY workspace_id, created_at, id LOOP
    IF v_ws IS DISTINCT FROM v_linha.workspace_id THEN
      v_ws := v_linha.workspace_id; v_seq := 0; v_prev := NULL;
    END IF;
    v_seq := v_seq + 1;
    v_linha.seq := v_seq;
    v_linha.prev_hash := v_prev;
    v_linha.hash_version := 1;
    v_linha.hash := internal.audit_calcular_hash(v_linha);
    UPDATE public.audit_logs
       SET seq = v_linha.seq, prev_hash = v_linha.prev_hash, hash = v_linha.hash, hash_version = 1
     WHERE id = v_linha.id;
    v_prev := v_linha.hash;
  END LOOP;
END;
$$;
ALTER TABLE public.audit_logs ENABLE TRIGGER block_audit_log_mutation;

ALTER TABLE public.audit_logs
  ALTER COLUMN seq SET NOT NULL,
  ALTER COLUMN hash SET NOT NULL,
  ALTER COLUMN hash_version SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_logs_workspace_seq ON public.audit_logs (workspace_id, seq);

-- 5. Gatilho: toda linha nova entra na ponta da corrente do workspace dela.
--    A trava é por workspace: um cliente nunca espera pelo outro.
CREATE OR REPLACE FUNCTION internal.audit_encadear()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_seq BIGINT;
  v_prev BYTEA;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('althius_audit:' || NEW.workspace_id::text, 0));
  SELECT l.seq, l.hash INTO v_seq, v_prev
    FROM public.audit_logs l
   WHERE l.workspace_id = NEW.workspace_id
   ORDER BY l.seq DESC
   LIMIT 1;
  NEW.seq := COALESCE(v_seq, 0) + 1;
  NEW.prev_hash := v_prev;
  NEW.hash_version := 1;
  NEW.created_at := COALESCE(NEW.created_at, pg_catalog.now());
  NEW.hash := internal.audit_calcular_hash(NEW);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.audit_encadear() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_encadear ON public.audit_logs;
CREATE TRIGGER audit_logs_encadear
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION internal.audit_encadear();

-- 6. Verificação: percorre a corrente do workspace e aponta a primeira quebra.
--    Motivos: linha_faltando (buraco na sequência), corrente_rompida (aponta para
--    a anterior errada) e conteudo_alterado (o hash não bate com a linha).
CREATE OR REPLACE FUNCTION public.audit_verify_chain(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_linha public.audit_logs;
  v_esperado BIGINT := 1;
  v_prev BYTEA := NULL;
  v_total BIGINT := 0;
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

  RETURN jsonb_build_object('integra', true, 'linhas', v_total, 'primeira_quebra', NULL, 'motivo', NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_verify_chain(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_verify_chain(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.audit_verify_chain(UUID) IS
  'Confere a corrente de auditoria do workspace. Devolve integra, linhas, primeira_quebra e motivo. Só superadmin ou backend.';

-- 7. Saúde da plataforma: nova verificação "Auditoria íntegra".
--    Mesmo corpo da 0087, com uma linha a mais no fim.
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
    FROM (SELECT DISTINCT workspace_id FROM public.audit_logs) w
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
