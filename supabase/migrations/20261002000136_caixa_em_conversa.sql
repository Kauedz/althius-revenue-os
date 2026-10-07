-- ==============================================================================
-- Migration: 20261002000136_caixa_em_conversa.sql
-- Caixa de entrada em conversa (spec .scratch/prospeccao-revenue, fatia 7; ADR 0068). A tela agrupa as conversas por
-- EMPRESA (lendo as tabelas de sempre, com as regras de visibilidade de sempre). Aqui fica o RESPONDER: a pessoa escolhe
-- a pessoa e o canal (não é grupo de verdade) e a resposta sai pelo CAMINHO DE ENVIO QUE JÁ EXISTE:
--   - a mesma política (hermes_evaluate_action: papel, dono do dado, aprovação, créditos);
--   - o mesmo preço e a mesma reserva do envio da cadência (4 créditos; +25% de folga do cofre);
--   - o mesmo serviço que envia as cadências (`cadencia`, pelo canal de mensagens) pega, envia e conclui; no máximo um
--     envio por resposta (chave de idempotência); a mensagem entra na conversa.
-- Regras: só quem conectou a conta responde por ela (gestores leem, mas não falam pela conta do BDR); só conversas com
-- contatos do CRM (as conversas já nascem filtradas); LinkedIn e Instagram ainda não enviam pelo nosso canal: a tela diz.
-- A resposta automática da IA continua como está (cadência/harness).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inbox_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 4000),
  assunto TEXT,
  estado TEXT NOT NULL DEFAULT 'reservada' CHECK (estado IN ('reservada', 'enviando', 'enviada', 'falhou')),
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  chave TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviada_em TIMESTAMPTZ,
  CONSTRAINT uq_inbox_reply_chave UNIQUE (member_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_inbox_replies_fila ON public.inbox_replies (estado, created_at);
COMMENT ON TABLE public.inbox_replies IS 'Respostas escritas na Caixa de entrada (ADR 0068). Saem pelo serviço de envio da cadência.';
ALTER TABLE public.inbox_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cada pessoa lê as próprias respostas" ON public.inbox_replies;
CREATE POLICY "Cada pessoa lê as próprias respostas" ON public.inbox_replies FOR SELECT TO authenticated
  USING (member_id IN (SELECT wm.id FROM public.workspace_members wm WHERE wm.user_id = auth.uid() AND wm.status = 'active'));
REVOKE ALL ON public.inbox_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inbox_replies TO authenticated;
GRANT ALL ON public.inbox_replies TO service_role;

-- Tela: responder numa conversa (a pessoa e o canal são os da conversa escolhida).
CREATE OR REPLACE FUNCTION public.inbox_reply(p_workspace_id UUID, p_member_id UUID, p_conversation_id UUID, p_texto TEXT, p_assunto TEXT, p_chave TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v RECORD;
  c public.conversations;
  v_conta public.messaging_accounts;
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_chave TEXT := NULLIF(btrim(COALESCE(p_chave, '')), '');
  v_id UUID;
  v_destino TEXT;
  v_gate JSONB;
  v_exec UUID;
  v_res JSONB;
  v_custo CONSTANT INTEGER := 4;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  IF v_texto = '' OR length(v_texto) > 4000 THEN RAISE EXCEPTION 'Escreva a resposta (até 4.000 caracteres).' USING ERRCODE = '22023'; END IF;
  IF v_chave IS NULL OR length(v_chave) > 100 THEN RAISE EXCEPTION 'Chave de envio inválida.' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_id FROM public.inbox_replies WHERE member_id = p_member_id AND chave = v_chave;
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'id', v_id); END IF;

  SELECT * INTO v FROM internal.conversa_do_membro(p_workspace_id, p_member_id, p_conversation_id);
  IF NOT FOUND OR NOT v.visivel THEN RETURN jsonb_build_object('ok', false, 'erro', 'Conversa não encontrada.'); END IF;
  IF NOT v.dono THEN RETURN jsonb_build_object('ok', false, 'erro', 'Só quem conectou esta conta responde por ela. Peça a essa pessoa ou responda pela sua conta.'); END IF;
  SELECT * INTO c FROM public.conversations WHERE id = p_conversation_id;
  IF c.channel NOT IN ('email', 'whatsapp') THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('Responder pelo %s ainda não é possível por aqui: responda pelo app e a mensagem aparece nesta conversa.',
      CASE c.channel WHEN 'linkedin' THEN 'LinkedIn' WHEN 'instagram' THEN 'Instagram' ELSE c.channel END));
  END IF;
  SELECT * INTO v_conta FROM public.messaging_accounts WHERE id = c.messaging_account_id;
  IF v_conta.status IS DISTINCT FROM 'connected' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sua conta deste canal está desconectada. Reconecte na Caixa de entrada.');
  END IF;
  SELECT cc.value_normalized INTO v_destino FROM public.contact_channels cc
   WHERE cc.contact_id = c.contact_id AND cc.workspace_id = c.workspace_id
     AND cc.type = ANY (CASE c.channel WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['whatsapp', 'phone'] END)
   ORDER BY CASE cc.type WHEN 'phone' THEN 2 ELSE 1 END, cc."position" LIMIT 1;
  IF v_destino IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'O contato não tem este canal cadastrado no CRM.'); END IF;

  -- A mesma política de qualquer envio (papel, dono do dado, aprovação, créditos).
  v_gate := public.hermes_evaluate_action(p_workspace_id, p_member_id, 'inbox.connect', p_member_id, v_custo, false,
    'Resposta na Caixa de entrada: ' || v.nome_contato, jsonb_build_object('acao', 'resposta_caixa', 'conversation_id', p_conversation_id, 'chave', v_chave));
  IF COALESCE((v_gate->>'allowed')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_gate->>'reason', 'O envio não foi autorizado.'), 'status', v_gate->>'status');
  END IF;
  v_exec := (v_gate->>'execution_id')::uuid;
  v_id := gen_random_uuid();
  v_res := public.credit_reserve(p_workspace_id, v_exec, v_custo, 'Reserva: resposta na Caixa de entrada', 'resposta:' || v_id || ':reserve');
  IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
    UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
    RETURN jsonb_build_object('ok', false, 'erro', 'Saldo de créditos insuficiente para enviar. Peça créditos à Althius.');
  END IF;
  UPDATE public.executions SET status = 'running', title = 'Resposta para ' || v.nome_contato, execution_type = 'Mensagem manual', campaign_name = 'Caixa de entrada',
         reserved_credits = (v_res->>'reserved_amount')::int, progress = 10,
         metadata_json = metadata_json || jsonb_build_object('inbox_reply_id', v_id, 'conversation_id', p_conversation_id, 'channel', c.channel)
   WHERE id = v_exec;
  INSERT INTO public.inbox_replies (id, workspace_id, member_id, conversation_id, texto, assunto, estado, execution_id, reserved_credits, chave)
  VALUES (v_id, p_workspace_id, p_member_id, p_conversation_id, v_texto, NULLIF(left(btrim(COALESCE(p_assunto, '')), 200), ''), 'reservada', v_exec,
          (v_res->>'reserved_amount')::int, v_chave);
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- Serviço `cadencia`: pega as respostas reservadas (uma vez só) com o que precisa para enviar.
CREATE OR REPLACE FUNCTION public.inbox_reply_claim(p_limit INTEGER DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_destino TEXT;
BEGIN
  FOR r IN
    SELECT x.*, c.channel, c.contact_id, ma.unipile_account_id
      FROM public.inbox_replies x
      JOIN public.conversations c ON c.id = x.conversation_id
      JOIN public.messaging_accounts ma ON ma.id = c.messaging_account_id
     WHERE x.estado = 'reservada'
     ORDER BY x.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 20))
     FOR UPDATE OF x SKIP LOCKED
  LOOP
    SELECT cc.value_normalized INTO v_destino FROM public.contact_channels cc
     WHERE cc.contact_id = r.contact_id AND cc.workspace_id = r.workspace_id
       AND cc.type = ANY (CASE r.channel WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['whatsapp', 'phone'] END)
     ORDER BY CASE cc.type WHEN 'phone' THEN 2 ELSE 1 END, cc."position" LIMIT 1;
    UPDATE public.inbox_replies SET estado = 'enviando' WHERE id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'execution_id', r.execution_id, 'channel', r.channel, 'recipient', v_destino, 'subject', r.assunto, 'body', r.texto,
      'unipile_account_id', r.unipile_account_id, 'idempotency_key', 'resposta:' || r.id));
  END LOOP;
  RETURN v_out;
END;
$$;

-- Serviço `cadencia`: enviada (cobra e coloca na conversa) ou falhou (devolve e avisa). Idempotente.
CREATE OR REPLACE FUNCTION public.inbox_reply_finish(p_id UUID, p_ok BOOLEAN, p_external_message_id TEXT, p_error TEXT, p_external_chat_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  x public.inbox_replies;
  c public.conversations;
  v_conta public.messaging_accounts;
BEGIN
  SELECT * INTO x FROM public.inbox_replies WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR x.estado <> 'enviando' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  SELECT * INTO c FROM public.conversations WHERE id = x.conversation_id;
  IF p_ok THEN
    PERFORM public.credit_consume(x.workspace_id, x.execution_id, 4, x.reserved_credits, 'Resposta na Caixa de entrada', 'resposta:' || x.id || ':consume');
    UPDATE public.executions SET status = 'completed', actual_credits = 4, progress = 100, processed_count = 1, valid_count = 1 WHERE id = x.execution_id;
    SELECT * INTO v_conta FROM public.messaging_accounts WHERE id = c.messaging_account_id;
    INSERT INTO public.messages (workspace_id, conversation_id, direction, external_message_id, text, sent_by)
    VALUES (x.workspace_id, x.conversation_id, 'out',
            CASE WHEN p_external_message_id IS NOT NULL THEN v_conta.unipile_account_id || ':' || p_external_message_id ELSE 'resposta:' || x.id END,
            x.texto, 'member')
    ON CONFLICT (external_message_id) DO NOTHING;
    UPDATE public.conversations SET last_message_at = now(), unread = false WHERE id = x.conversation_id;
    UPDATE public.inbox_replies SET estado = 'enviada', enviada_em = now(), erro = NULL WHERE id = x.id;
    PERFORM public.audit_write(x.workspace_id, (SELECT user_id FROM public.workspace_members WHERE id = x.member_id), 'caixa.resposta_enviada', 'conversation', x.conversation_id::text,
      jsonb_build_object('canal', c.channel));
    RETURN jsonb_build_object('acao', 'enviada');
  END IF;
  PERFORM public.credit_consume(x.workspace_id, x.execution_id, 0, x.reserved_credits, 'Liberação: resposta não enviada', 'resposta:' || x.id || ':release');
  UPDATE public.executions SET status = 'failed', progress = 100,
         errors = errors || jsonb_build_array(jsonb_build_object('erro', COALESCE(left(p_error, 300), 'falha no envio'))) WHERE id = x.execution_id;
  UPDATE public.inbox_replies SET estado = 'falhou', erro = COALESCE(left(p_error, 300), 'falha no envio') WHERE id = x.id;
  INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
  VALUES (x.workspace_id, x.member_id, 'resposta_falhou', 'Sua resposta não foi enviada',
          'O canal de mensagens recusou o envio. Nada foi cobrado. Confira a conexão da sua conta e envie de novo.', 'conversation', x.conversation_id);
  RETURN jsonb_build_object('acao', 'falhou');
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_reply(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_reply(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_reply_claim(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inbox_reply_finish(UUID, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_reply_claim(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.inbox_reply_finish(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO service_role;
