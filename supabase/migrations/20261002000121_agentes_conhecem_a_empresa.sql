-- ==============================================================================
-- Migration: 20261002000121_agentes_conhecem_a_empresa.sql
-- Agentes conectados, ticket 02: os agentes passam a conhecer a empresa.
--  1. harness_playbook: o SISTEMA (harness) lê o Playbook publicado do agente para colocá-lo em toda resposta.
--     Só a versão publicada vale; rascunho nunca. Função de sistema: só service_role (ADR 0023).
--  2. agent_list_skills / agent_list_signals: ferramentas de LEITURA do agente (porta do agente, ADR 0024: aceitam anon,
--     mas exigem o token; o token também confere pausa e isolamento por workspace em agent_runtime_resolve).
-- Nada é escrito por estas funções. Textos de sinais são dados externos: a ferramenta avisa o modelo de que não são ordens.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.harness_playbook(p_workspace_id UUID, p_agent_code TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('versao', p.version, 'conteudo', p.content_markdown)
  FROM public.agent_playbooks p
  WHERE p.workspace_id = p_workspace_id AND p.agent_id = p_agent_code AND p.is_published
  LIMIT 1;
$$;

-- Habilidades LIGADAS do próprio agente, no próprio workspace do token.
CREATE OR REPLACE FUNCTION public.agent_list_skills(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'nome', s.name, 'versao', s.version, 'conteudo', s.content_markdown) ORDER BY s.name)
    FROM public.agent_skills s
    WHERE s.workspace_id = v.workspace_id AND s.agent_id = v.agent_code AND s.enabled
  ), '[]'::jsonb);
END;
$$;

-- Sinais recentes (mais novos primeiro) das contas do workspace do token; filtro opcional por conta; no máximo 50.
CREATE OR REPLACE FUNCTION public.agent_list_signals(p_token TEXT, p_account_id UUID DEFAULT NULL, p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  v_limite INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(x.linha ORDER BY x.detectado DESC)
    FROM (
      SELECT e.detected_at AS detectado,
             jsonb_build_object('conta_id', a.id, 'conta', a.name, 'sinal', d.name, 'codigo', d.code, 'fonte', d.source_label,
                                'detectado_em', e.detected_at, 'aquecimento', e.temperature_bump, 'detalhe', left(e.payload::text, 600)) AS linha
      FROM public.signal_events e
      JOIN public.signal_definitions d ON d.id = e.signal_id
      JOIN public.accounts a ON a.id = e.account_id
      WHERE e.workspace_id = v.workspace_id AND (p_account_id IS NULL OR e.account_id = p_account_id)
      ORDER BY e.detected_at DESC
      LIMIT v_limite
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.harness_playbook(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_skills(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_list_signals(TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.harness_playbook(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_skills(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_list_signals(TEXT, UUID, INTEGER) TO anon, authenticated, service_role;
