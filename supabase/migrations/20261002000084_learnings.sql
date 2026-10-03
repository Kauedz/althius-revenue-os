-- ==============================================================================
-- Migration: 20261002000084_learnings.sql
-- Aprendizados (ADR 0024, camada 3): o agente sugere; o estrategista (ou superadmin) aplica ou descarta.
-- C-level lê. Ninguém altera a tabela direto: só learning_decide.
-- ==============================================================================

ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS decided_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;
ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
COMMENT ON COLUMN public.learning_entries.impact IS 'Efeito medido (ex.: "+3,1 p.p.", "R$ 72 por lead").';

DROP POLICY IF EXISTS "Authorized members manage learning entries" ON public.learning_entries;
REVOKE INSERT, UPDATE, DELETE ON public.learning_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.learning_entries TO authenticated;
GRANT ALL ON public.learning_entries TO service_role;

CREATE OR REPLACE FUNCTION public.learning_decide(p_workspace_id UUID, p_member_id UUID, p_entry_id UUID, p_decisao TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_status TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não aplica aprendizados.');
  END IF;
  IF p_decisao IS NULL OR p_decisao NOT IN ('aplicada', 'descartada') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Decisão inválida.');
  END IF;
  SELECT status INTO v_status FROM public.learning_entries WHERE id = p_entry_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Aprendizado não encontrado.');
  END IF;
  IF v_status <> 'sugerida' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este aprendizado já foi decidido.');
  END IF;
  UPDATE public.learning_entries
  SET status = p_decisao, decided_by_member_id = p_member_id, decided_at = now(), updated_at = now()
  WHERE id = p_entry_id;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'aprendizado.' || p_decisao, 'learning_entry', p_entry_id::text, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'status', p_decisao);
END;
$$;
REVOKE ALL ON FUNCTION public.learning_decide(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_decide(UUID, UUID, UUID, TEXT) TO authenticated;

-- Mudança proposta no playbook (o que entra no rascunho quando a pessoa aplica).
ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS proposed_change TEXT;

-- Playbook: só funções gravam. Publicar cria versão nova (+0.1) e despublica as anteriores.
DROP POLICY IF EXISTS "Strategist manages agent playbooks" ON public.agent_playbooks;
REVOKE INSERT, UPDATE, DELETE ON public.agent_playbooks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agent_playbooks TO authenticated;
GRANT ALL ON public.agent_playbooks TO service_role;

CREATE OR REPLACE FUNCTION public.agent_playbook_publish(p_workspace_id UUID, p_member_id UUID, p_agent_code TEXT, p_conteudo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_atual TEXT;
  v_nova TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não publica playbook.');
  END IF;
  IF p_agent_code IS NULL OR p_agent_code NOT IN ('comercial', 'marketing', 'copy', 'revops') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Agente não encontrado.');
  END IF;
  IF COALESCE(trim(p_conteudo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O playbook não pode ficar vazio.');
  END IF;
  SELECT version INTO v_atual FROM public.agent_playbooks
  WHERE workspace_id = p_workspace_id AND agent_id = p_agent_code AND is_published
  FOR UPDATE;
  v_nova := CASE WHEN v_atual ~ '^[0-9]+(\.[0-9]+)?$' THEN to_char(v_atual::numeric + 0.1, 'FM999990.0') ELSE '1.0' END;
  UPDATE public.agent_playbooks SET is_published = false
  WHERE workspace_id = p_workspace_id AND agent_id = p_agent_code AND is_published;
  INSERT INTO public.agent_playbooks (workspace_id, agent_id, version, author_member_id, content_markdown, is_published)
  VALUES (p_workspace_id, p_agent_code, v_nova, p_member_id, p_conteudo, true);
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'playbook.publicado', 'agent_playbook', p_agent_code,
    jsonb_build_object('agente', p_agent_code, 'versao', v_nova));
  RETURN jsonb_build_object('ok', true, 'versao', v_nova);
END;
$$;
REVOKE ALL ON FUNCTION public.agent_playbook_publish(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_playbook_publish(UUID, UUID, TEXT, TEXT) TO authenticated;
