-- ==============================================================================
-- Migration: 20261002000111_aprovacao_por_link.sql
-- PR 13: aprovação por link de uso único (desenho do Buzz: workflow_approvals / buzz-db store/workflow.rs).
-- Uso: o C-level aprova um gasto pelo celular, abrindo um link, sem entrar no sistema.
--   * o banco guarda SÓ o hash do token (sha256); o token em si aparece uma única vez, para quem emite o link;
--   * o link tem prazo (5 min a 24 h) e vale UMA vez (aprovar ou rejeitar);
--   * mudou o conteúdo da aprovação depois da emissão? O link morre ("conteúdo mudou"), combinando com o payload_hash;
--   * o link é de UMA aprovação e UM decisor: não decide outra aprovação nem de outro workspace;
--   * a decisão passa pela MESMA função da tela (approval_decide): "quem paga decide o gasto" continua valendo (só
--     C-level e superadmin decidem gasto), a integridade do conteúdo é conferida e os efeitos (verba, tarefa...) se aplicam;
--   * decidida por outro caminho (tela), a aprovação revoga todos os links dela.
-- Exceção de segurança documentada (ADR 0023, como a porta do agente da ADR 0024): ver e decidir pelo link aceitam
-- chamada sem login, porque o próprio token é a prova. Emitir e revogar links é só do sistema (service_role).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.approval_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  decider_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  decision TEXT CHECK (decision IN ('aprovado', 'rejeitado')),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_links_approval ON public.approval_links (approval_id) WHERE used_at IS NULL AND revoked_at IS NULL;
ALTER TABLE public.approval_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.approval_links FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.approval_links IS 'Links de aprovação de uso único. Só o hash do token é guardado. Só o sistema acessa (RLS sem política).';

-- Quem pode decidir cada categoria (igual ao approval_decide).
CREATE OR REPLACE FUNCTION internal.link_decisor_valido(p_workspace_id UUID, p_member_id UUID, p_categoria TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active'
       AND wm.role = ANY (CASE WHEN p_categoria = 'gasto' THEN ARRAY['superadmin', 'clevel'] ELSE ARRAY['superadmin', 'clevel', 'estrategista'] END));
$$;
REVOKE ALL ON FUNCTION internal.link_decisor_valido(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- emitir (só o sistema)
CREATE OR REPLACE FUNCTION public.approval_link_issue(p_approval_id UUID, p_decider_member_id UUID, p_ttl_minutes INTEGER DEFAULT 60)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.approvals;
  v_token TEXT;
  v_id UUID;
  v_exp TIMESTAMPTZ;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes < 5 OR p_ttl_minutes > 1440 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'prazo_invalido', 'erro', 'O prazo do link vai de 5 minutos a 24 horas.');
  END IF;
  SELECT * INTO a FROM public.approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'status', 'aprovacao_inexistente', 'erro', 'Aprovação não encontrada.'); END IF;
  IF a.status <> 'pendente' THEN RETURN jsonb_build_object('ok', false, 'status', 'ja_decidida', 'erro', 'Esta aprovação já foi decidida.'); END IF;
  IF NOT internal.link_decisor_valido(a.workspace_id, p_decider_member_id, a.category) THEN
    RETURN jsonb_build_object('ok', false, 'status', 'decisor_invalido',
      'erro', CASE WHEN a.category = 'gasto' THEN 'Só C-level ou superadmin do mesmo workspace decide gasto.' ELSE 'Decisor inválido para esta aprovação.' END);
  END IF;
  IF a.payload_hash IS DISTINCT FROM encode(extensions.digest(a.payload_json::text, 'sha256'), 'hex') THEN
    RETURN jsonb_build_object('ok', false, 'status', 'conteudo_alterado', 'erro', 'O conteúdo desta aprovação não confere mais com o registrado.');
  END IF;
  IF (SELECT count(*) FROM public.approval_links l WHERE l.approval_id = a.id AND l.used_at IS NULL AND l.revoked_at IS NULL AND l.expires_at > now()) >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'links_demais', 'erro', 'Já existem 5 links ativos para esta aprovação.');
  END IF;

  v_token := 'alt_aprov_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_exp := now() + make_interval(mins => p_ttl_minutes);
  INSERT INTO public.approval_links (workspace_id, approval_id, decider_member_id, token_hash, payload_hash, expires_at)
  VALUES (a.workspace_id, a.id, p_decider_member_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), a.payload_hash, v_exp)
  RETURNING id INTO v_id;
  PERFORM public.audit_write(a.workspace_id, NULL, 'approval.link_issued', 'approval', a.id::text,
    jsonb_build_object('link_id', v_id, 'decisor', p_decider_member_id, 'expira_em', v_exp));
  -- O token em texto aparece SÓ aqui, para quem vai entregar o link. Nunca mais.
  RETURN jsonb_build_object('ok', true, 'token', v_token, 'link_id', v_id, 'expires_at', v_exp);
END;
$$;

CREATE OR REPLACE FUNCTION public.approval_link_revoke(p_approval_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'revogado_pelo_sistema'
   WHERE approval_id = p_approval_id AND used_at IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Decidida por qualquer caminho (tela, link, agente), a aprovação mata os links que sobraram.
CREATE OR REPLACE FUNCTION public.approvals_revogar_links()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'aprovacao_decidida'
   WHERE approval_id = NEW.id AND used_at IS NULL AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS approvals_revogar_links ON public.approvals;
CREATE TRIGGER approvals_revogar_links
  AFTER UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status <> 'pendente')
  EXECUTE FUNCTION public.approvals_revogar_links();

-- ---------------------------------------------------------------- achar o link pelo token (interno)
-- Devolve a linha do link só se está de pé: existe, não usado, não revogado, não vencido, aprovação ainda pendente,
-- conteúdo igual ao da emissão e decisor ainda válido. Qualquer outra coisa vira um status, sem vazar detalhe.
CREATE OR REPLACE FUNCTION internal.link_conferir(p_token TEXT, p_travar BOOLEAN)
RETURNS TABLE (status TEXT, link_id UUID, approval_id UUID, decider_member_id UUID)
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  l public.approval_links;
  a public.approvals;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 200 THEN RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF p_travar THEN
    SELECT * INTO l FROM public.approval_links WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') FOR UPDATE;
  ELSE
    SELECT * INTO l FROM public.approval_links WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  END IF;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid, NULL::uuid; RETURN; END IF;
  IF l.used_at IS NOT NULL THEN RETURN QUERY SELECT 'used'::text, l.id, l.approval_id, l.decider_member_id; RETURN; END IF;
  IF l.revoked_at IS NOT NULL THEN RETURN QUERY SELECT 'revoked'::text, l.id, l.approval_id, l.decider_member_id; RETURN; END IF;
  IF l.expires_at <= now() THEN RETURN QUERY SELECT 'expired'::text, l.id, l.approval_id, l.decider_member_id; RETURN; END IF;
  SELECT * INTO a FROM public.approvals ap WHERE ap.id = l.approval_id AND ap.workspace_id = l.workspace_id;
  IF NOT FOUND OR a.status <> 'pendente' THEN
    UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'aprovacao_decidida' WHERE id = l.id;
    RETURN QUERY SELECT 'decided'::text, l.id, l.approval_id, l.decider_member_id; RETURN;
  END IF;
  IF l.payload_hash IS DISTINCT FROM a.payload_hash OR a.payload_hash IS DISTINCT FROM encode(extensions.digest(a.payload_json::text, 'sha256'), 'hex') THEN
    UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'conteudo_alterado' WHERE id = l.id;
    PERFORM public.audit_write(l.workspace_id, NULL, 'approval.link_content_changed', 'approval', a.id::text, jsonb_build_object('link_id', l.id));
    RETURN QUERY SELECT 'content_changed'::text, l.id, l.approval_id, l.decider_member_id; RETURN;
  END IF;
  IF NOT internal.link_decisor_valido(l.workspace_id, l.decider_member_id, a.category) THEN
    UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'decisor_invalido' WHERE id = l.id;
    RETURN QUERY SELECT 'decider_invalid'::text, l.id, l.approval_id, l.decider_member_id; RETURN;
  END IF;
  RETURN QUERY SELECT 'ok'::text, l.id, l.approval_id, l.decider_member_id;
END;
$$;
REVOKE ALL ON FUNCTION internal.link_conferir(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- ver e decidir (a prova é o token)
CREATE OR REPLACE FUNCTION public.approval_link_preview(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c RECORD;
  a public.approvals;
  l public.approval_links;
BEGIN
  SELECT * INTO c FROM internal.link_conferir(p_token, false);
  IF c.status <> 'ok' THEN RETURN jsonb_build_object('ok', false, 'status', c.status); END IF;
  SELECT * INTO a FROM public.approvals WHERE id = c.approval_id;
  SELECT * INTO l FROM public.approval_links WHERE id = c.link_id;
  -- Só o que a pessoa precisa para decidir. Nenhum id interno, nenhum conteúdo bruto.
  RETURN jsonb_build_object('ok', true, 'status', 'ok',
    'titulo', a.title, 'categoria', a.category, 'motivo', a.reason, 'impacto', a.impact, 'previa', a.preview,
    'creditos', a.estimated_credits, 'agente', a.agent_code, 'expira_em', l.expires_at,
    'decisor_papel', (SELECT wm.role FROM public.workspace_members wm WHERE wm.id = l.decider_member_id));
END;
$$;

-- search_path com `extensions`: approval_decide (migration 0025) chama digest() sem qualificar e herda o caminho de quem chama.
CREATE OR REPLACE FUNCTION public.approval_link_decide(p_token TEXT, p_decision TEXT, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  c RECORD;
  a public.approvals;
  v_r JSONB;
  v_claims TEXT := current_setting('request.jwt.claims', true);
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('aprovado', 'rejeitado') THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_decision');
  END IF;
  SELECT * INTO c FROM internal.link_conferir(p_token, true);
  IF c.status <> 'ok' THEN RETURN jsonb_build_object('ok', false, 'status', c.status); END IF;
  SELECT * INTO a FROM public.approvals WHERE id = c.approval_id;

  -- O link vale pelo token, não por quem está logado no navegador: tira o login da conta só durante a decisão (a
  -- conferência "o membro é quem está logado" do approval_decide olharia para outra pessoa) e devolve no fim.
  PERFORM set_config('request.jwt.claims', '', true);
  -- A mesma função da tela: papel, "quem paga decide o gasto", hash do conteúdo, notificação, auditoria e efeitos.
  v_r := public.approval_decide(c.approval_id, c.decider_member_id, p_decision, a.payload_json,
    left('Decidido pelo link de aprovação.' || COALESCE(' ' || NULLIF(btrim(p_notes), ''), ''), 500));
  PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
  IF COALESCE((v_r->>'success')::boolean, false) IS NOT TRUE THEN
    UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'decisao_recusada' WHERE id = c.link_id AND used_at IS NULL;
    RETURN jsonb_build_object('ok', false, 'status', COALESCE(v_r->>'status', 'recusada'));
  END IF;

  UPDATE public.approval_links SET used_at = now(), decision = p_decision WHERE id = c.link_id;
  UPDATE public.approval_links SET revoked_at = now(), revoked_reason = 'aprovacao_decidida' WHERE approval_id = c.approval_id AND id <> c.link_id AND used_at IS NULL AND revoked_at IS NULL;
  PERFORM public.audit_write(a.workspace_id,
    (SELECT wm.user_id FROM public.workspace_members wm WHERE wm.id = c.decider_member_id),
    'approval.link_used', 'approval', a.id::text, jsonb_build_object('link_id', c.link_id, 'decisao', p_decision));
  RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

-- ---------------------------------------------------------------- permissões (ADR 0023)
REVOKE ALL ON FUNCTION public.approval_link_issue(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_link_revoke(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approvals_revogar_links() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_link_preview(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approval_link_decide(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approval_link_issue(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.approval_link_revoke(UUID) TO service_role;
-- Exceção documentada: o token é a prova (sem token válido, nada acontece).
GRANT EXECUTE ON FUNCTION public.approval_link_preview(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approval_link_decide(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
