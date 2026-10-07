-- ==============================================================================
-- Migration: 20261002000140_caixa_linkedin_instagram.sql
-- ADR 0069. A Caixa de entrada passa a RESPONDER também pelo LinkedIn e pelo Instagram. O jeito é diferente do e-mail e do
-- WhatsApp: não se manda mensagem nova para um número ou e-mail; responde-se DENTRO da conversa que já existe (a Unipile
-- recebe o id do chat), pela conta da pessoa que a conectou. Mesma política, mesmo preço e mesma reserva de créditos
-- (4 créditos). Proteção da conta de quem conectou: no máximo 50 respostas por dia nesses dois canais, por pessoa.
-- Começar conversa nova no LinkedIn (convite, InMail) NÃO entra aqui: é decisão de produto separada (ADR 0069).
-- ==============================================================================

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
  IF c.channel NOT IN ('email', 'whatsapp', 'linkedin', 'instagram') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Canal sem envio por aqui.');
  END IF;
  -- LinkedIn e Instagram: só se responde DENTRO da conversa que já existe (o contato escreveu primeiro ou já há conversa).
  -- Limite por pessoa por dia para não parecer robô e proteger a conta de quem conectou.
  IF c.channel IN ('linkedin', 'instagram') AND (
       SELECT count(*) FROM public.inbox_replies x JOIN public.conversations k ON k.id = x.conversation_id
        WHERE x.member_id = p_member_id AND k.channel IN ('linkedin', 'instagram') AND x.created_at > now() - interval '1 day') >= 50 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Limite de 50 respostas por dia no LinkedIn e no Instagram, para proteger a sua conta. Continue amanhã ou responda pelo app.');
  END IF;
  SELECT * INTO v_conta FROM public.messaging_accounts WHERE id = c.messaging_account_id;
  IF v_conta.status IS DISTINCT FROM 'connected' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sua conta deste canal está desconectada. Reconecte na Caixa de entrada.');
  END IF;
  SELECT cc.value_normalized INTO v_destino FROM public.contact_channels cc
   WHERE cc.contact_id = c.contact_id AND cc.workspace_id = c.workspace_id
     AND cc.type = ANY (CASE c.channel WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['whatsapp', 'phone'] END)
   ORDER BY CASE cc.type WHEN 'phone' THEN 2 ELSE 1 END, cc."position" LIMIT 1;
  IF c.channel IN ('linkedin', 'instagram') THEN v_destino := c.external_chat_id; END IF;
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

CREATE OR REPLACE FUNCTION public.inbox_reply_claim(p_limit INTEGER DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_destino TEXT;
BEGIN
  FOR r IN
    SELECT x.*, c.channel, c.contact_id, c.external_chat_id, ma.unipile_account_id
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
    IF r.channel IN ('linkedin', 'instagram') THEN v_destino := r.external_chat_id; END IF;
    UPDATE public.inbox_replies SET estado = 'enviando' WHERE id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'execution_id', r.execution_id, 'channel', r.channel, 'recipient', v_destino, 'chat_id', r.external_chat_id, 'subject', r.assunto, 'body', r.texto,
      'unipile_account_id', r.unipile_account_id, 'idempotency_key', 'resposta:' || r.id));
  END LOOP;
  RETURN v_out;
END;
$$;
