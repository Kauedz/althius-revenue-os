-- ==============================================================================
-- Migration: 20261002000142_playbook_so_de_agente_que_existe.sql
-- Correção pequena (ADR 0069). `harness_playbook` devolvia o ICP do cliente para QUALQUER código de agente, até para um
-- agente que não existe, assim que o cliente tinha ICP. Agora o ICP só acompanha os 4 agentes fixos (comercial, marketing,
-- copy, revops); código desconhecido volta a devolver nada. Apareceu quando o seed da Evolut ganhou um ICP de demonstração.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.harness_playbook(p_workspace_id UUID, p_agent_code TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH p AS (
    SELECT p.version, p.content_markdown FROM public.agent_playbooks p
     WHERE p.workspace_id = p_workspace_id AND p.agent_id = p_agent_code AND p.is_published LIMIT 1
  ), i AS (
    SELECT internal.icp_texto(s.icp) AS texto FROM public.workspace_settings s WHERE s.workspace_id = p_workspace_id
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM p) THEN jsonb_build_object('versao', (SELECT version FROM p),
      'conteudo', concat_ws(E'\n\n', (SELECT content_markdown FROM p), (SELECT texto FROM i)))
    WHEN p_agent_code IN ('comercial', 'marketing', 'copy', 'revops') AND (SELECT texto FROM i) IS NOT NULL
      THEN jsonb_build_object('versao', 'icp', 'conteudo', (SELECT texto FROM i))
  END;
$$;
