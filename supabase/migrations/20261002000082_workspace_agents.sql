-- ==============================================================================
-- Migration: 20261002000082_workspace_agents.sql
-- Tela Agentes no banco: situação dos 4 agentes fixos por workspace (ativo/pausado, autonomia,
-- responsável, capacidades). Pausar é o botão de emergência do cliente e vale também para o
-- Hermes Agent: agente pausado não passa pela porta da Althius (agent_runtime_resolve).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_agents (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  estado TEXT NOT NULL DEFAULT 'ativo' CHECK (estado IN ('ativo', 'pausado')),
  autonomia TEXT NOT NULL CHECK (autonomia IN ('Assistido', 'Supervisionado')),
  responsavel_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  caps JSONB NOT NULL,
  paused_at TIMESTAMPTZ,
  paused_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, agent_code)
);
COMMENT ON TABLE public.workspace_agents IS 'Situação de cada um dos 4 agentes fixos em cada workspace. Só funções gravam.';

ALTER TABLE public.workspace_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.workspace_agents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.workspace_agents TO authenticated;
GRANT ALL ON TABLE public.workspace_agents TO service_role;
CREATE POLICY "Membros leem os agentes do próprio workspace" ON public.workspace_agents
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id) OR public.is_superadmin());

-- Padrão do produto para cada agente (o mesmo do protótipo v18).
CREATE OR REPLACE FUNCTION internal.agentes_padrao()
RETURNS TABLE (agent_code TEXT, autonomia TEXT, caps JSONB)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  VALUES
    ('comercial', 'Assistido', '{"lerCrm": true, "escreverCrm": false, "pesquisar": true, "listas": true, "copy": false, "campanhas": false, "relatorios": true, "aprovacao": true}'::jsonb),
    ('marketing', 'Assistido', '{"lerCrm": false, "escreverCrm": false, "pesquisar": true, "listas": false, "copy": false, "campanhas": true, "relatorios": true, "aprovacao": true}'::jsonb),
    ('copy', 'Supervisionado', '{"lerCrm": true, "escreverCrm": false, "pesquisar": false, "listas": false, "copy": true, "campanhas": false, "relatorios": false, "aprovacao": true}'::jsonb),
    ('revops', 'Supervisionado', '{"lerCrm": true, "escreverCrm": true, "pesquisar": false, "listas": false, "copy": false, "campanhas": true, "relatorios": true, "aprovacao": true}'::jsonb)
$$;
REVOKE ALL ON FUNCTION internal.agentes_padrao() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.criar_agentes_do_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.workspace_agents (workspace_id, agent_code, autonomia, caps, responsavel_member_id)
  SELECT p_workspace_id, p.agent_code, p.autonomia, p.caps,
         (SELECT wm.id FROM public.workspace_members wm
          WHERE wm.workspace_id = p_workspace_id AND wm.role = 'estrategista' AND wm.status = 'active'
          ORDER BY wm.created_at, wm.id LIMIT 1)
  FROM internal.agentes_padrao() p
  ON CONFLICT (workspace_id, agent_code) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION internal.criar_agentes_do_workspace(UUID) FROM PUBLIC, anon, authenticated;

SELECT internal.criar_agentes_do_workspace(w.id) FROM public.workspaces w;

CREATE OR REPLACE FUNCTION internal.workspace_novo_cria_agentes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.criar_agentes_do_workspace(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.workspace_novo_cria_agentes() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workspace_novo_cria_agentes ON public.workspaces;
CREATE TRIGGER workspace_novo_cria_agentes AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION internal.workspace_novo_cria_agentes();

-- Estrategista que entra no workspace assume os agentes ainda sem responsável.
CREATE OR REPLACE FUNCTION internal.estrategista_assume_agentes()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.role = 'estrategista' AND NEW.status = 'active' THEN
    UPDATE public.workspace_agents SET responsavel_member_id = NEW.id, updated_at = now()
    WHERE workspace_id = NEW.workspace_id AND responsavel_member_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.estrategista_assume_agentes() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS estrategista_assume_agentes ON public.workspace_members;
CREATE TRIGGER estrategista_assume_agentes AFTER INSERT OR UPDATE OF role, status ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION internal.estrategista_assume_agentes();

-- Membro ativo do workspace e o escopo dele numa capacidade (NULL se não for membro).
CREATE OR REPLACE FUNCTION internal.escopo_do_membro(p_workspace_id UUID, p_member_id UUID, p_capability TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(rp.scope, 'none')
  FROM public.workspace_members wm
  LEFT JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = p_capability
  WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';
$$;
REVOKE ALL ON FUNCTION internal.escopo_do_membro(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Pausar / retomar (agents.pause).
CREATE OR REPLACE FUNCTION public.agent_set_paused(p_workspace_id UUID, p_member_id UUID, p_agent_code TEXT, p_pausar BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_estado TEXT := CASE WHEN p_pausar THEN 'pausado' ELSE 'ativo' END;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.pause');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não pausa agentes.');
  END IF;
  UPDATE public.workspace_agents
  SET estado = v_estado,
      paused_at = CASE WHEN p_pausar THEN now() END,
      paused_by_member_id = CASE WHEN p_pausar THEN p_member_id END,
      updated_at = now()
  WHERE workspace_id = p_workspace_id AND agent_code = p_agent_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Agente não encontrado.');
  END IF;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), CASE WHEN p_pausar THEN 'agente.pausado' ELSE 'agente.retomado' END,
    'workspace_agent', p_agent_code, jsonb_build_object('agente', p_agent_code));
  RETURN jsonb_build_object('ok', true, 'estado', v_estado);
END;
$$;

-- Ligar / desligar capacidades (agents.configure).
CREATE OR REPLACE FUNCTION public.agent_set_caps(p_workspace_id UUID, p_member_id UUID, p_agent_code TEXT, p_caps JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  v_escopo := internal.escopo_do_membro(p_workspace_id, p_member_id, 'agents.configure');
  IF v_escopo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você não participa deste workspace.');
  END IF;
  IF v_escopo NOT IN ('all', 'assigned') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Seu papel não configura agentes.');
  END IF;
  IF jsonb_typeof(p_caps) <> 'object' OR EXISTS (
       SELECT 1 FROM jsonb_each(p_caps) c
       WHERE c.key NOT IN ('lerCrm', 'escreverCrm', 'pesquisar', 'listas', 'copy', 'campanhas', 'relatorios', 'aprovacao')
          OR jsonb_typeof(c.value) <> 'boolean') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Capacidade desconhecida.');
  END IF;
  UPDATE public.workspace_agents SET caps = caps || p_caps, updated_at = now()
  WHERE workspace_id = p_workspace_id AND agent_code = p_agent_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Agente não encontrado.');
  END IF;
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'agente.capacidades', 'workspace_agent', p_agent_code, p_caps);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Resumo da tela: situação e números reais (RLS de quem chama vale em tudo).
CREATE OR REPLACE FUNCTION public.get_agents_overview(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'agent_code', a.agent_code,
    'estado', a.estado,
    'autonomia', a.autonomia,
    'responsavel', p.name,
    'caps', a.caps,
    'exec_ciclo', (SELECT count(*) FROM public.executions e
                   WHERE e.workspace_id = a.workspace_id AND e.agent_code = a.agent_code
                     AND e.created_at >= date_trunc('month', now())),
    'ultima_em', (SELECT max(e.created_at) FROM public.executions e
                  WHERE e.workspace_id = a.workspace_id AND e.agent_code = a.agent_code),
    'sucesso', (SELECT CASE WHEN count(*) FILTER (WHERE e.status IN ('completed', 'partial', 'failed')) = 0 THEN NULL
                       ELSE round(100.0 * count(*) FILTER (WHERE e.status = 'completed')
                                  / count(*) FILTER (WHERE e.status IN ('completed', 'partial', 'failed'))) END
                FROM public.executions e WHERE e.workspace_id = a.workspace_id AND e.agent_code = a.agent_code),
    'pendencias', (SELECT count(*) FROM public.approvals ap
                   WHERE ap.workspace_id = a.workspace_id AND ap.agent_code = a.agent_code AND ap.status = 'pendente')
  ) ORDER BY a.agent_code), '[]'::jsonb)
  FROM public.workspace_agents a
  LEFT JOIN public.workspace_members wm ON wm.id = a.responsavel_member_id
  LEFT JOIN public.profiles p ON p.id = wm.user_id
  WHERE a.workspace_id = p_workspace_id;
$$;

-- Botão de emergência vale para o Hermes Agent (substitui a versão da migration 0040).
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
  IF EXISTS (SELECT 1 FROM public.workspace_agents a
             WHERE a.workspace_id = v.workspace_id AND a.agent_code = v.agent_code AND a.estado = 'pausado') THEN
    RAISE EXCEPTION 'Agente pausado pelo cliente. Nada será feito até ele ser retomado.' USING ERRCODE = '55000';
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_set_paused(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_set_caps(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_agents_overview(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_runtime_resolve(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_paused(UUID, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_caps(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_overview(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_runtime_resolve(TEXT) TO service_role;
