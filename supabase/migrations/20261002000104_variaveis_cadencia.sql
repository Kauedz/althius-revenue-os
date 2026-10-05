-- ==============================================================================
-- Migration: 20261002000104_variaveis_cadencia.sql
-- PR 10: variáveis nos textos das cadências ({{primeiro_nome}}, {{nome}}, {{empresa}}, {{cargo}}, {{cidade}}, {{uf}},
-- {{dominio}}, {{meu_nome}}). Implementação própria em SQL; a leitura do Twenty (MIT) fica a cargo da parte TypeScript.
--
-- Regras:
--   * Passo AUTOMÁTICO com variável sem dado (ou que não existe) BLOQUEIA o envio: nada é reservado nem enviado, o dono é
--     avisado uma vez e o passo tenta de novo mais tarde (segue sozinho quando o dado chegar). Nunca sai mensagem com {{...}}.
--   * Passo MANUAL (e automático com envio desligado) vira tarefa: o que falta aparece como [FALTA: cargo] e a nota começa
--     com um aviso, porque quem envia é uma pessoa.
--   * Quem monta o passo não consegue gravar variável que não existe (a mensagem lista as válidas).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cadence_variable_names()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT ARRAY['primeiro_nome', 'nome', 'empresa', 'cargo', 'cidade', 'uf', 'dominio', 'meu_nome'];
$$;
REVOKE ALL ON FUNCTION public.cadence_variable_names() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cadence_variable_names() TO authenticated, service_role;

-- Troca {{nome}} (maiúsculas e espaços não importam) pelos dados. Devolve o texto e a lista do que faltou (sem repetir, na ordem).
-- p_marcar_faltas = true troca o que faltou por [FALTA: nome]; false deixa o marcador no texto (quem chama decide não enviar).
CREATE OR REPLACE FUNCTION internal.resolver_variaveis(p_texto TEXT, p_vars JSONB, p_marcar_faltas BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_texto TEXT := p_texto;
  v_faltando TEXT[] := ARRAY[]::TEXT[];
  v_nomes TEXT[] := ARRAY[]::TEXT[];
  m TEXT[];
  v_nome TEXT;
  v_valor TEXT;
BEGIN
  IF p_texto IS NULL THEN
    RETURN jsonb_build_object('texto', NULL::TEXT, 'faltando', '[]'::jsonb);
  END IF;
  FOR m IN SELECT regexp_matches(p_texto, '\{\{\s*([A-Za-z_]+)\s*\}\}', 'g') LOOP
    v_nome := lower(m[1]);
    IF NOT (v_nome = ANY (v_nomes)) THEN v_nomes := v_nomes || v_nome; END IF;
  END LOOP;
  FOREACH v_nome IN ARRAY v_nomes LOOP
    v_valor := NULLIF(btrim(COALESCE(p_vars ->> v_nome, '')), '');
    IF v_valor IS NULL THEN
      v_faltando := v_faltando || v_nome;
      IF p_marcar_faltas THEN v_valor := '[FALTA: ' || v_nome || ']'; ELSE CONTINUE; END IF;
    END IF;
    -- o valor entra como texto puro (barra invertida e & não têm significado especial)
    v_texto := regexp_replace(v_texto, '\{\{\s*' || v_nome || '\s*\}\}', replace(replace(v_valor, '\', '\\'), '&', '\&'), 'gi');
  END LOOP;
  RETURN jsonb_build_object('texto', v_texto, 'faltando', to_jsonb(v_faltando));
END;
$$;
REVOKE ALL ON FUNCTION internal.resolver_variaveis(TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Dado de contato com "{{...}}" (importação suja) não pode virar marcador na mensagem: as chaves saem do valor.
CREATE OR REPLACE FUNCTION internal.limpar_vars(p_vars JSONB)
RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(jsonb_object_agg(k, CASE WHEN v IS NULL THEN NULL ELSE replace(replace(v, '{{', ''), '}}', '') END), '{}'::jsonb)
    FROM jsonb_each_text(p_vars) AS t(k, v);
$$;
REVOKE ALL ON FUNCTION internal.limpar_vars(JSONB) FROM PUBLIC, anon, authenticated;

-- Quem monta o passo não grava variável inexistente.
CREATE OR REPLACE FUNCTION internal.exigir_variaveis_validas(p_texto TEXT)
RETURNS VOID
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  m TEXT[];
BEGIN
  IF p_texto IS NULL THEN RETURN; END IF;
  FOR m IN SELECT regexp_matches(p_texto, '\{\{\s*([A-Za-z_]+)\s*\}\}', 'g') LOOP
    IF NOT (lower(m[1]) = ANY (public.cadence_variable_names())) THEN
      RAISE EXCEPTION 'Variável que não existe: {{%}}. Use: %.', m[1],
        (SELECT string_agg('{{' || x || '}}', ', ') FROM unnest(public.cadence_variable_names()) x) USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION internal.exigir_variaveis_validas(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cadence_add_step(
  p_workspace_id UUID, p_member_id UUID, p_cadence_id UUID, p_channel TEXT, p_mode TEXT, p_delay_days INTEGER, p_subject TEXT, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n INTEGER;
BEGIN
  PERFORM internal.cadencia_editavel(p_workspace_id, p_member_id, p_cadence_id, true);
  IF p_channel IS NULL OR p_channel NOT IN ('email', 'whatsapp', 'linkedin', 'instagram', 'call') THEN RAISE EXCEPTION 'Canal de passo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('auto', 'manual') THEN RAISE EXCEPTION 'Modo de passo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'auto' AND p_channel NOT IN ('email', 'whatsapp') THEN RAISE EXCEPTION 'Só e-mail e WhatsApp podem ser automáticos.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'auto' AND btrim(COALESCE(p_body, '')) = '' THEN RAISE EXCEPTION 'Passo automático precisa do texto da mensagem.' USING ERRCODE = '22023'; END IF;
  PERFORM internal.exigir_variaveis_validas(p_subject);
  PERFORM internal.exigir_variaveis_validas(p_body);
  IF p_delay_days IS NULL OR p_delay_days NOT BETWEEN 0 AND 90 THEN RAISE EXCEPTION 'A espera vai de 0 a 90 dias.' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(max(step_number), 0) + 1 INTO v_n FROM public.cadence_steps WHERE cadence_id = p_cadence_id;
  IF v_n > 12 THEN RAISE EXCEPTION 'Uma cadência tem no máximo 12 passos.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, subject, body, delay_days)
  VALUES (p_workspace_id, p_cadence_id, v_n, p_channel, p_mode, NULLIF(btrim(COALESCE(p_subject, '')), ''), NULLIF(btrim(COALESCE(p_body, '')), ''), p_delay_days);
  PERFORM public.audit_write(p_workspace_id, auth.uid(), 'cadence.step_added', 'cadence', p_cadence_id::text, jsonb_build_object('step', v_n, 'channel', p_channel, 'mode', p_mode));
  RETURN jsonb_build_object('action', 'added', 'step_number', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.cadence_prepare_step(p_enrollment_id UUID, p_step_number INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_e public.cadence_enrollments;
  v_s public.cadence_enrollment_steps;
  v_def public.cadence_steps;
  v_cad public.cadences;
  v_contato public.contacts;
  v_menor INTEGER;
  v_dono UUID;
  v_assunto TEXT;
  v_corpo TEXT;
  v_estado TEXT;
  v_provedores TEXT[];
  v_conta public.messaging_accounts;
  v_destino TEXT;
  v_gate JSONB;
  v_exec UUID;
  v_reserva JSONB;
  v_tarefa UUID;
  v_chave TEXT;
  v_custo CONSTANT INTEGER := 4;
  v_motivo TEXT;
  v_acct public.accounts;
  v_vars JSONB;
  v_res JSONB;
  v_faltando JSONB;
  v_lista TEXT;
  v_desconhecidas TEXT;
BEGIN
  SELECT * INTO v_e FROM public.cadence_enrollments WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND OR v_e.status <> 'ativa' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'enrollment_not_active');
  END IF;
  SELECT * INTO v_s FROM public.cadence_enrollment_steps WHERE enrollment_id = p_enrollment_id AND step_number = p_step_number FOR UPDATE;
  IF NOT FOUND OR v_s.status <> 'pendente' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'step_not_pending');
  END IF;
  SELECT min(step_number) INTO v_menor FROM public.cadence_enrollment_steps WHERE enrollment_id = p_enrollment_id AND status = 'pendente';
  IF v_menor <> p_step_number THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'not_next_step');
  END IF;
  IF v_s.scheduled_at IS NULL OR v_s.scheduled_at > now() THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'not_due');
  END IF;
  IF v_s.next_attempt_at IS NOT NULL AND v_s.next_attempt_at > now() THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'waiting_retry');
  END IF;
  SELECT * INTO v_cad FROM public.cadences WHERE id = v_e.cadence_id;
  IF v_cad.status <> 'ativa' THEN
    RETURN jsonb_build_object('action', 'skip', 'reason', 'cadence_not_active');
  END IF;
  SELECT * INTO v_def FROM public.cadence_steps WHERE cadence_id = v_e.cadence_id AND step_number = p_step_number;
  SELECT * INTO v_contato FROM public.contacts WHERE id = v_e.contact_id;
  v_dono := v_e.owner_member_id;
  v_assunto := COALESCE(v_s.custom_subject, v_def.subject);
  v_corpo := COALESCE(v_s.custom_body, v_def.body);

  -- Variáveis do texto ({{primeiro_nome}}, {{empresa}}...), com os dados do contato, da conta e do responsável.
  SELECT * INTO v_acct FROM public.accounts WHERE id = v_contato.account_id;
  v_vars := internal.limpar_vars(jsonb_build_object(
    'primeiro_nome', NULLIF(split_part(btrim(v_contato.name), ' ', 1), ''), 'nome', NULLIF(btrim(v_contato.name), ''),
    'empresa', NULLIF(btrim(v_acct.name), ''), 'cargo', NULLIF(btrim(v_contato.job_title), ''),
    'cidade', NULLIF(btrim(v_acct.city), ''), 'uf', NULLIF(btrim(v_acct.state_uf), ''), 'dominio', NULLIF(btrim(v_acct.domain), ''),
    'meu_nome', (SELECT NULLIF(btrim(pr.name), '') FROM public.workspace_members wm JOIN public.profiles pr ON pr.id = wm.user_id WHERE wm.id = v_dono)));
  v_chave := p_enrollment_id::text || ':' || p_step_number::text;

  -- Passo manual, ou automático com o envio automático desligado: vira tarefa do responsável, no dia.
  IF v_def.execution_mode = 'manual' OR NOT v_e.auto_send THEN
    IF v_dono IS NULL THEN
      PERFORM internal.cadence_pausar(p_enrollment_id, 'sem_responsavel', 'A cadência foi pausada porque a inscrição não tem responsável.');
      RETURN jsonb_build_object('action', 'blocked', 'reason', 'no_owner');
    END IF;
    IF v_s.task_id IS NULL THEN
      -- Tarefa: quem envia é uma pessoa, então o que falta aparece como [FALTA: ...] (nunca como {{...}}).
      v_res := internal.resolver_variaveis(v_corpo, v_vars, true);
      v_faltando := internal.resolver_variaveis(v_corpo, v_vars, false)->'faltando';
      v_corpo := v_res->>'texto';
      IF jsonb_array_length(v_faltando) > 0 THEN
        SELECT string_agg(x, ', ') INTO v_lista FROM jsonb_array_elements_text(v_faltando) x;
        v_corpo := 'Atenção: faltam dados do contato: ' || v_lista || '.' || E'\n' || v_corpo;
      END IF;
      INSERT INTO public.tasks (workspace_id, title, channel, account_id, contact_id, assignee_member_id, due_at, source, note)
      VALUES (v_e.workspace_id, format('%s · %s (passo %s)', v_cad.name, v_contato.name, p_step_number), v_def.channel, v_contato.account_id, v_e.contact_id, v_dono, now(), 'cadencia', v_corpo)
      RETURNING id INTO v_tarefa;
      UPDATE public.cadence_enrollment_steps SET task_id = v_tarefa, status = 'executado', executed_at = now() WHERE id = v_s.id;
      PERFORM internal.cadence_avancar(p_enrollment_id);
      RETURN jsonb_build_object('action', 'task_created', 'task_id', v_tarefa);
    END IF;
    RETURN jsonb_build_object('action', 'skip', 'reason', 'task_exists');
  END IF;

  -- Passo automático. Um envio por vez para a mesma inscrição+passo.
  IF EXISTS (SELECT 1 FROM public.executions WHERE metadata_json->>'cadence_key' = v_chave AND status = 'running') THEN
    RETURN jsonb_build_object('action', 'in_flight');
  END IF;
  IF v_dono IS NULL THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, 'sem_responsavel', 'A cadência foi pausada porque a inscrição não tem responsável.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'no_owner');
  END IF;

  -- Variável sem dado (ou desconhecida): NÃO envia, não reserva crédito, avisa o dono uma vez e tenta de novo mais tarde.
  v_res := internal.resolver_variaveis(v_assunto, v_vars, false);
  v_faltando := v_res->'faltando';
  v_assunto := v_res->>'texto';
  v_res := internal.resolver_variaveis(v_corpo, v_vars, false);
  v_faltando := (SELECT COALESCE(jsonb_agg(DISTINCT x ORDER BY x), '[]'::jsonb) FROM jsonb_array_elements_text(v_faltando || (v_res->'faltando')) x);
  v_corpo := v_res->>'texto';
  IF jsonb_array_length(v_faltando) > 0 THEN
    SELECT string_agg(x, ', ') INTO v_lista FROM jsonb_array_elements_text(v_faltando) x;
    SELECT string_agg(x, ', ') INTO v_desconhecidas FROM jsonb_array_elements_text(v_faltando) x WHERE x <> ALL (public.cadence_variable_names());
    v_motivo := 'variaveis_faltando: ' || v_lista;
    UPDATE public.cadence_enrollment_steps SET last_error = v_motivo, next_attempt_at = now() + interval '1 hour' WHERE id = v_s.id;
    IF v_s.last_error IS DISTINCT FROM v_motivo THEN
      INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
      VALUES (v_e.workspace_id, v_dono, 'cadencia_bloqueada', 'Um envio da cadência está esperando',
        format('O envio automático para %s está parado: %s Corrija e ele segue sozinho.', v_contato.name,
          CASE WHEN v_desconhecidas IS NULL THEN 'faltam dados do contato (' || v_lista || '). Preencha em Contas e leads.'
               ELSE 'o texto usa variável que não existe (' || v_desconhecidas || '). Corrija o passo da cadência.' END),
        'cadence_enrollment', p_enrollment_id);
    END IF;
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'missing_variables', 'variables', v_faltando);
  END IF;

  -- Agente que escreve e envia (Lia, copy) pausado pelo cliente: não envia, avisa uma vez, tenta de novo mais tarde.
  SELECT estado INTO v_estado FROM public.workspace_agents WHERE workspace_id = v_e.workspace_id AND agent_code = 'copy';
  v_motivo := NULL;
  IF v_estado = 'pausado' THEN
    v_motivo := 'agent_paused';
  ELSE
    v_provedores := CASE v_def.channel WHEN 'email' THEN ARRAY['google', 'microsoft', 'imap'] ELSE ARRAY[v_def.channel] END;
    SELECT * INTO v_conta FROM public.messaging_accounts
     WHERE member_id = v_dono AND workspace_id = v_e.workspace_id AND provider = ANY (v_provedores) AND status = 'connected'
     ORDER BY connected_at LIMIT 1;
    IF NOT FOUND THEN v_motivo := 'no_connected_account'; END IF;
  END IF;
  IF v_motivo IS NOT NULL THEN
    UPDATE public.cadence_enrollment_steps SET last_error = v_motivo, next_attempt_at = now() + interval '1 hour' WHERE id = v_s.id;
    IF v_s.last_error IS DISTINCT FROM v_motivo THEN
      INSERT INTO public.notifications (workspace_id, recipient_member_id, type, title, body, entity_type, entity_id)
      VALUES (v_e.workspace_id, v_dono, 'cadencia_bloqueada', 'Um envio da cadência está esperando',
        CASE v_motivo WHEN 'agent_paused' THEN 'O envio automático está parado porque a Lia está pausada. Quando ela voltar, o envio segue sozinho.'
                      ELSE 'O envio automático está parado porque você não tem uma conta conectada para este canal. Conecte na Caixa de entrada.' END,
        'cadence_enrollment', p_enrollment_id);
    END IF;
    RETURN jsonb_build_object('action', 'blocked', 'reason', v_motivo);
  END IF;

  -- Destinatário: e-mail, ou WhatsApp (e, na falta, o telefone do contato).
  SELECT cc.value_normalized INTO v_destino FROM public.contact_channels cc
   WHERE cc.contact_id = v_e.contact_id AND cc.workspace_id = v_e.workspace_id
     AND cc.type = ANY (CASE v_def.channel WHEN 'email' THEN ARRAY['email'] ELSE ARRAY['whatsapp', 'phone'] END)
   ORDER BY CASE cc.type WHEN 'phone' THEN 2 ELSE 1 END, cc."position" LIMIT 1;
  IF v_destino IS NULL THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, 'contato_sem_canal', 'A cadência foi pausada porque o contato não tem o canal deste passo cadastrado.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'contact_without_channel');
  END IF;

  -- Política Hermes (papel, dono do dado, aprovação, créditos). Negada: pausa e avisa; nada é enviado.
  v_gate := public.hermes_evaluate_action(v_e.workspace_id, v_dono, 'cadences.auto', v_dono, v_custo, false,
    format('Envio automático: %s · passo %s', v_cad.name, p_step_number),
    jsonb_build_object('cadence_key', v_chave, 'enrollment_id', p_enrollment_id, 'step_number', p_step_number));
  IF COALESCE((v_gate->>'allowed')::boolean, false) IS NOT TRUE THEN
    PERFORM internal.cadence_pausar(p_enrollment_id, COALESCE(v_gate->>'status', 'denied'),
      'O envio automático foi pausado: ' || COALESCE(v_gate->>'reason', 'a política não autorizou o envio.'));
    RETURN jsonb_build_object('action', 'blocked', 'reason', COALESCE(v_gate->>'status', 'denied'));
  END IF;
  v_exec := (v_gate->>'execution_id')::uuid;

  -- Reserva de créditos (+25% de folga). Sem saldo: a execução morre e a inscrição pausa.
  v_reserva := public.credit_reserve(v_e.workspace_id, v_exec, v_custo, 'Reserva: envio automático da cadência', v_chave || ':a' || (v_s.attempts + 1) || ':reserve');
  IF COALESCE((v_reserva->>'success')::boolean, false) IS NOT TRUE THEN
    UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
    PERFORM internal.cadence_pausar(p_enrollment_id, 'insufficient_credits', 'O envio automático foi pausado: o saldo de créditos não cobre este envio.');
    RETURN jsonb_build_object('action', 'blocked', 'reason', 'insufficient_credits');
  END IF;

  UPDATE public.executions
     SET status = 'running', agent_code = 'copy', title = format('Cadência %s · passo %s', v_cad.name, p_step_number),
         execution_type = 'Mensagem automática', campaign_name = v_cad.name, reserved_credits = (v_reserva->>'reserved_amount')::int,
         progress = 10,
         metadata_json = metadata_json || jsonb_build_object(
           'cadence_key', v_chave, 'cadence_attempt', v_chave || ':a' || (v_s.attempts + 1), 'enrollment_id', p_enrollment_id, 'step_number', p_step_number,
           'channel', v_def.channel, 'messaging_account_id', v_conta.id, 'contact_id', v_e.contact_id, 'body', v_corpo)
   WHERE id = v_exec;
  UPDATE public.cadence_enrollment_steps SET execution_id = v_exec, last_error = NULL WHERE id = v_s.id;

  RETURN jsonb_build_object('action', 'send', 'execution_id', v_exec, 'channel', v_def.channel, 'recipient', v_destino,
    'subject', v_assunto, 'body', v_corpo, 'unipile_account_id', v_conta.unipile_account_id, 'idempotency_key', v_chave || ':a' || (v_s.attempts + 1));
END;
$$;
