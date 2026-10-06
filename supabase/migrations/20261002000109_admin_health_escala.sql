-- ==============================================================================
-- Migration: 20261002000109_admin_health_escala.sql
-- Correção de desempenho: a saúde da plataforma (admin_health, migration 0092) conferia a corrente de auditoria
-- uma vez por LINHA da auditoria em vez de uma vez por cliente (o filtro era empurrado para dentro do UNION).
-- Medido: 179 linhas em 8 clientes levavam 9,7 s e batiam no limite de 8 s da API; agora leva milissegundos.
-- O corpo é o mesmo da 0092; muda só a forma de montar a lista de clientes.
-- ==============================================================================

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
  -- MATERIALIZED: sem isso o Postgres empurra o filtro para dentro do UNION e confere a corrente UMA VEZ POR LINHA
  -- da auditoria (não por cliente); com algumas centenas de linhas a tela estourava o limite de 8 s.
  WITH clientes AS MATERIALIZED (
    SELECT workspace_id FROM public.audit_logs UNION SELECT workspace_id FROM public.audit_anchors
  )
  SELECT count(*) INTO v_auditoria
    FROM clientes w
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
