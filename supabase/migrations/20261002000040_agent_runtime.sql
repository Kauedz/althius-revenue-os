-- ==============================================================================
-- Migration: 20261002000040_agent_runtime.sql
-- Porta do Hermes Agent (ADR 0024): cada agente de cada workspace recebe um token que
-- só abre aquele workspace. O servidor MCP da Althius guarda apenas esse token (nunca a
-- chave de sistema), então um contêiner de cliente comprometido não alcança outro cliente.
-- O agente lista contatos e PROPÕE mudanças; a mudança só acontece quando um humano aprova.
-- ==============================================================================

-- 1. Idempotência das propostas: a mesma chave nunca cria duas aprovações.
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS approvals_idempotency_uq
  ON public.approvals (workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Tokens dos agentes (só o hash fica no banco; o token aparece uma única vez, na criação).
CREATE TABLE IF NOT EXISTS public.agent_runtime_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
COMMENT ON TABLE public.agent_runtime_tokens IS 'Token de cada agente (Hermes Agent) por workspace. member_id = quem responde pelo agente e aparece como solicitante das propostas.';
COMMENT ON COLUMN public.agent_runtime_tokens.token_hash IS 'sha256 do token. O token em texto puro nunca é guardado.';

ALTER TABLE public.agent_runtime_tokens ENABLE ROW LEVEL SECURITY;
-- Sem políticas: ninguém além do sistema lê ou grava esta tabela.
REVOKE ALL ON TABLE public.agent_runtime_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agent_runtime_tokens TO service_role;

-- 3. Criar token (ação de sistema).
CREATE OR REPLACE FUNCTION public.agent_runtime_token_create(p_workspace_id UUID, p_agent_code TEXT, p_member_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_token TEXT;
  v_id UUID;
BEGIN
  IF p_agent_code IS NULL OR p_agent_code NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN
    RAISE EXCEPTION 'Agente desconhecido: só comercial, marketing, copy e revops.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active'
      AND role IN ('superadmin', 'estrategista', 'clevel')
  ) THEN
    RAISE EXCEPTION 'Quem responde pelo agente precisa ser superadmin, estrategista ou C-level ativo deste workspace.' USING ERRCODE = '22023';
  END IF;
  v_token := 'alt_agente_' || encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.agent_runtime_tokens (workspace_id, agent_code, member_id, token_hash)
  VALUES (p_workspace_id, p_agent_code, p_member_id, encode(digest(v_token, 'sha256'), 'hex'))
  RETURNING id INTO v_id;
  PERFORM public.audit_write(p_workspace_id, NULL, 'agente.token_criado', 'agent_runtime_token', v_id::text,
    jsonb_build_object('agente', p_agent_code, 'responsavel_member_id', p_member_id));
  RETURN v_token;
END;
$$;

-- 4. Quem é o dono do token (uso interno das funções abaixo).
CREATE OR REPLACE FUNCTION public.agent_runtime_resolve(p_token TEXT)
RETURNS public.agent_runtime_tokens
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v public.agent_runtime_tokens%ROWTYPE;
BEGIN
  SELECT t.* INTO v
  FROM public.agent_runtime_tokens t
  JOIN public.workspace_members wm ON wm.id = t.member_id AND wm.status = 'active'
  WHERE t.token_hash = encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex') AND t.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token do agente inválido ou revogado.' USING ERRCODE = '28000';
  END IF;
  RETURN v;
END;
$$;

-- 5. Ferramenta: contatos do workspace do token (só leitura).
CREATE OR REPLACE FUNCTION public.agent_list_contacts(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.agent_runtime_tokens%ROWTYPE;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(x.contato ORDER BY x.empresa, x.nome)
    FROM (
      SELECT a.name AS empresa, c.name AS nome,
             jsonb_build_object('id', c.id, 'nome', c.name, 'cargo', c.job_title, 'papel_compra', c.buying_role,
                                'empresa', a.name, 'segmento', a.segment) AS contato
      FROM public.contacts c
      JOIN public.accounts a ON a.id = c.account_id AND a.workspace_id = c.workspace_id
      WHERE c.workspace_id = v.workspace_id
      ORDER BY a.name, c.name
      LIMIT 500
    ) x
  ), '[]'::jsonb);
END;
$$;

-- 6. Ferramenta: propor mudança de cargo de um contato. Não altera nada: cria aprovação "Alteração de CRM".
CREATE OR REPLACE FUNCTION public.agent_propose_update(
  p_token TEXT, p_contact_id UUID, p_field TEXT, p_value TEXT, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v public.agent_runtime_tokens%ROWTYPE;
  v_valor TEXT := NULLIF(trim(COALESCE(p_value, '')), '');
  v_motivo TEXT := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_chave TEXT := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  v_nome TEXT;
  v_atual TEXT;
  v_empresa TEXT;
  v_payload JSONB;
  v_id UUID;
  v_status TEXT;
BEGIN
  v := public.agent_runtime_resolve(p_token);

  IF p_field IS DISTINCT FROM 'cargo' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Campo não pode ser alterado pelo agente.');
  END IF;
  IF v_valor IS NULL OR length(v_valor) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Informe o novo valor (até 200 caracteres).');
  END IF;
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Explique o motivo da mudança.');
  END IF;
  IF v_chave IS NULL OR length(v_chave) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Chave de idempotência obrigatória (até 200 caracteres).');
  END IF;

  SELECT id, status INTO v_id, v_status FROM public.approvals WHERE workspace_id = v.workspace_id AND idempotency_key = v_chave;
  IF FOUND THEN
    IF v_status = 'pendente' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
    END IF;
    RETURN jsonb_build_object('ok', false, 'erro', format('Esta mesma proposta já foi decidida (%s).', v_status), 'approval_id', v_id);
  END IF;

  SELECT c.name, c.job_title, a.name INTO v_nome, v_atual, v_empresa
  FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
  WHERE c.id = p_contact_id AND c.workspace_id = v.workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Contato não encontrado neste workspace.');
  END IF;

  v_payload := jsonb_build_object('acao', 'atualizar_contato', 'contact_id', p_contact_id, 'campo', 'job_title', 'de', v_atual, 'para', v_valor);
  BEGIN
    INSERT INTO public.approvals (
      workspace_id, category, approval_type, agent_code, title, reason, impact, preview,
      requested_by_member_id, status, payload_json, payload_hash, idempotency_key, history
    ) VALUES (
      v.workspace_id, 'operacao', 'crm', v.agent_code,
      format('Atualizar cargo de %s (%s)', v_nome, v_empresa),
      left(v_motivo, 500),
      'Altera 1 contato no CRM depois da aprovação.',
      format('Cargo de %s: %s → %s', v_nome, COALESCE(v_atual, '(vazio)'), v_valor),
      v.member_id, 'pendente', v_payload, encode(digest(v_payload::text, 'sha256'), 'hex'), v_chave,
      jsonb_build_array(to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' Proposta pelo agente ' || initcap(v.agent_code))
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Duas chamadas simultâneas com a mesma chave: vale a primeira.
    SELECT id INTO v_id FROM public.approvals WHERE workspace_id = v.workspace_id AND idempotency_key = v_chave;
    RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
  END;

  PERFORM public.audit_write(v.workspace_id, NULL, 'agente.proposta_criada', 'approval', v_id::text,
    v_payload || jsonb_build_object('agente', v.agent_code));
  RETURN jsonb_build_object('ok', true, 'status', 'aguardando_aprovacao', 'approval_id', v_id);
END;
$$;

-- 7. Aprovada a proposta, a plataforma aplica (se o dado não mudou desde o pedido).
CREATE OR REPLACE FUNCTION public.approvals_aplicar_proposta_agente()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_atual TEXT;
  v_hora TEXT := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  v_contato UUID;
BEGIN
  IF NEW.payload_json->>'acao' IS DISTINCT FROM 'atualizar_contato' OR NEW.payload_json->>'campo' IS DISTINCT FROM 'job_title' THEN
    RETURN NEW;
  END IF;
  v_contato := (NEW.payload_json->>'contact_id')::uuid;
  SELECT job_title INTO v_atual FROM public.contacts WHERE id = v_contato AND workspace_id = NEW.workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: o contato não existe mais');
    RETURN NEW;
  END IF;
  IF v_atual IS DISTINCT FROM NEW.payload_json->>'de' THEN
    NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança não aplicada: o cargo foi alterado depois do pedido');
    RETURN NEW;
  END IF;
  UPDATE public.contacts SET job_title = NEW.payload_json->>'para', updated_at = now() WHERE id = v_contato;
  NEW.history := NEW.history || jsonb_build_array(v_hora || ' Mudança aplicada no CRM');
  PERFORM public.audit_write(NEW.workspace_id,
    (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = NEW.decided_by_member_id),
    'agente.proposta_aplicada', 'contact', v_contato::text, NEW.payload_json);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_aplicar_proposta_agente ON public.approvals;
CREATE TRIGGER approvals_aplicar_proposta_agente
  BEFORE UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status = 'aprovado')
  EXECUTE FUNCTION public.approvals_aplicar_proposta_agente();

-- 8. Permissões (ADR 0023). As duas ferramentas aceitam chamada só com o token: quem não tem
-- um token válido recebe erro 28000. O servidor MCP usa a chave pública + token, nunca service_role.
REVOKE ALL ON FUNCTION public.agent_runtime_token_create(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_runtime_resolve(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_contacts(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_propose_update(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_aplicar_proposta_agente() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.agent_runtime_token_create(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_runtime_resolve(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_contacts(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_propose_update(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
