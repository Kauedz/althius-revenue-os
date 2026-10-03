-- ==============================================================================
-- Migration: 20261002000081_agent_proposal_notify.sql
-- Quando um agente (Hermes Agent) cria uma proposta, quem decide operação naquele workspace
-- (C-level e estrategista ativos) recebe notificação. Superadmin não é avisado de cada workspace.
-- Só aprovações criadas pela porta do agente (agent_code + chave de idempotência) passam por aqui.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.approvals_avisar_proposta_agente()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_agente TEXT := CASE NEW.agent_code
    WHEN 'comercial' THEN 'Agente Comercial'
    WHEN 'marketing' THEN 'Agente de Marketing'
    WHEN 'copy' THEN 'Agente de Copy'
    WHEN 'revops' THEN 'Agente de RevOps'
  END;
BEGIN
  INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
  SELECT NEW.workspace_id, wm.id, 'approval_required',
         v_agente || ' pede aprovação: ' || NEW.title,
         COALESCE(NEW.preview, NEW.reason),
         'approval', NEW.id
  FROM public.workspace_members wm
  WHERE wm.workspace_id = NEW.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS approvals_avisar_proposta_agente ON public.approvals;
CREATE TRIGGER approvals_avisar_proposta_agente
  AFTER INSERT ON public.approvals
  FOR EACH ROW WHEN (NEW.agent_code IS NOT NULL AND NEW.idempotency_key IS NOT NULL)
  EXECUTE FUNCTION public.approvals_avisar_proposta_agente();

REVOKE ALL ON FUNCTION public.approvals_avisar_proposta_agente() FROM PUBLIC, anon, authenticated;
