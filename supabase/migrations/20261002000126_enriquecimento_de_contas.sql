-- ==============================================================================
-- Migration: 20261002000126_enriquecimento_de_contas.sql
-- Enriquecimento automático de contas e personas (ADR 0062, spec .scratch/enriquecimento-de-contas).
-- Toda conta criada ou importada entra sozinha numa fila de enriquecimento em duas etapas:
--   "empresa": site, logo, CNPJ (lido do site), Receita Federal (BrasilAPI) e localização;
--   "pessoas": até 5 personas do LinkedIn (cargos alvo do cliente), com foto, LinkedIn e telefones.
-- O banco escolhe, reserva o crédito e aplica o resultado; o serviço `enriquecimento` só busca fora (mesmo padrão da
-- coleta de sinais, ADR 0055). Falha devolve o crédito e nunca vira dado.
-- Regras:
--  - O que uma PESSOA digitou nunca é sobrescrito: cada campo editado à mão entra em `campos_manuais`.
--  - Cada dado guarda de onde veio e quando (`accounts.fontes`, `contact_channels.fonte/coletado_em`).
--  - LGPD: telefone de pessoa só com origem e data; lista de supressão por cliente (quem pediu para sair não volta).
--  - Créditos (decisão do Nan, 06/10/2026, a ajustar com o custo real): 5 por conta enriquecida, 2 por persona criada.
--    Etapa que não achou nada devolve a reserva.
-- ==============================================================================

-- 1. Dados da empresa na conta.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cnpj TEXT CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$'),
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS email_empresa TEXT,
  ADD COLUMN IF NOT EXISTS cnae TEXT,
  ADD COLUMN IF NOT EXISTS porte TEXT,
  ADD COLUMN IF NOT EXISTS situacao_cadastral TEXT,
  ADD COLUMN IF NOT EXISTS localizacao_precisao TEXT CHECK (localizacao_precisao IS NULL OR localizacao_precisao IN ('endereco', 'cep', 'cidade')),
  ADD COLUMN IF NOT EXISTS enriquecido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campos_manuais TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fontes JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.accounts.campos_manuais IS 'Campos que uma pessoa preencheu ou editou: o enriquecimento nunca os sobrescreve (ADR 0062).';
COMMENT ON COLUMN public.accounts.fontes IS 'De onde veio cada campo enriquecido e quando: {"campo": {"fonte": "...", "em": "..."}}.';

-- 2. Origem do contato e de cada canal (LGPD).
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
  CHECK (origem IN ('manual', 'importacao', 'enriquecimento', 'agente', 'crm'));
ALTER TABLE public.contact_channels
  ADD COLUMN IF NOT EXISTS fonte TEXT,
  ADD COLUMN IF NOT EXISTS coletado_em TIMESTAMPTZ;
COMMENT ON COLUMN public.contact_channels.fonte IS 'De onde veio o dado quando não foi digitado (ex.: LinkedIn, Receita Federal, site da empresa).';

-- 3. Cargos alvo (personas) do cliente. Padrão até o cliente configurar.
ALTER TABLE public.workspace_settings ADD COLUMN IF NOT EXISTS personas_alvo JSONB NOT NULL DEFAULT
  '[{"cargo":"CEO","papel":"decisor"},{"cargo":"Diretor","papel":"decisor"},{"cargo":"Sócio","papel":"decisor"},{"cargo":"Head","papel":"campeao"},{"cargo":"Gerente","papel":"influenciador"}]'::jsonb;
COMMENT ON COLUMN public.workspace_settings.personas_alvo IS 'Cargos que o enriquecimento procura no LinkedIn, com o papel na compra.';

-- 4. "Manual vence": toda escrita que não é do enriquecimento marca os campos mexidos como manuais.
CREATE OR REPLACE FUNCTION internal.accounts_marca_manual()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_campo TEXT;
  v_novo JSONB := to_jsonb(NEW);
  v_velho JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_manuais TEXT[] := COALESCE(NEW.campos_manuais, '{}');
BEGIN
  IF COALESCE(current_setting('althius.enriquecimento', true), '') = 'on' THEN RETURN NEW; END IF;
  FOREACH v_campo IN ARRAY ARRAY['name', 'domain', 'state_uf', 'city', 'cnpj', 'razao_social', 'nome_fantasia', 'endereco', 'cep',
                                 'telefone', 'email_empresa', 'lat', 'lng', 'logo_url', 'linkedin_company_name', 'linkedin_company_url'] LOOP
    IF NULLIF(btrim(COALESCE(v_novo->>v_campo, '')), '') IS NOT NULL AND (v_novo->v_campo) IS DISTINCT FROM (v_velho->v_campo)
       AND NOT (v_campo = ANY (v_manuais)) THEN
      v_manuais := v_manuais || v_campo;
    END IF;
  END LOOP;
  NEW.campos_manuais := v_manuais;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS accounts_marca_manual ON public.accounts;
CREATE TRIGGER accounts_marca_manual BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION internal.accounts_marca_manual();
REVOKE ALL ON FUNCTION internal.accounts_marca_manual() FROM PUBLIC, anon, authenticated;

-- 5. Preço de cada etapa (créditos). Superadmin muda por migration ou SQL; ninguém de cliente lê.
CREATE TABLE IF NOT EXISTS internal.enrichment_prices (
  etapa TEXT PRIMARY KEY CHECK (etapa IN ('empresa', 'pessoa')),
  creditos INTEGER NOT NULL CHECK (creditos >= 0)
);
INSERT INTO internal.enrichment_prices (etapa, creditos) VALUES ('empresa', 5), ('pessoa', 2) ON CONFLICT (etapa) DO NOTHING;
ALTER TABLE internal.enrichment_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.enrichment_prices FROM PUBLIC, anon, authenticated;

-- 6. Fila: uma linha por conta e etapa.
CREATE TABLE IF NOT EXISTS internal.account_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('empresa', 'pessoas')),
  estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'reservada', 'ok', 'sem_dado', 'erro', 'sem_saldo')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  creditos INTEGER,
  custo_usd NUMERIC(14, 6) CHECK (custo_usd IS NULL OR custo_usd >= 0),
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT uq_account_enrichment UNIQUE (account_id, etapa)
);
CREATE INDEX IF NOT EXISTS idx_account_enrichments_fila ON internal.account_enrichments (estado, updated_at);
COMMENT ON TABLE internal.account_enrichments IS 'Fila de enriquecimento por conta e etapa (ADR 0062). custo_usd é custo real do fornecedor: só sistema e superadmin.';
ALTER TABLE internal.account_enrichments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.account_enrichments FROM PUBLIC, anon, authenticated;

-- 7. Supressão (LGPD): identificadores de quem pediu para sair. O enriquecimento nunca recria essa pessoa.
CREATE TABLE IF NOT EXISTS internal.enrichment_suppressions (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'phone', 'whatsapp', 'linkedin', 'instagram')),
  valor_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, tipo, valor_normalizado)
);
ALTER TABLE internal.enrichment_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.enrichment_suppressions FROM PUBLIC, anon, authenticated;

-- 8. Conta nova (não duplicada) entra na fila sozinha (decisão do Nan: sempre automático).
CREATE OR REPLACE FUNCTION internal.accounts_enfileira_enriquecimento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.is_duplicate, false) OR NEW.status <> 'ativa' THEN RETURN NEW; END IF;
  INSERT INTO internal.account_enrichments (workspace_id, account_id, etapa)
  VALUES (NEW.workspace_id, NEW.id, 'empresa'), (NEW.workspace_id, NEW.id, 'pessoas')
  ON CONFLICT (account_id, etapa) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS accounts_enfileira_enriquecimento ON public.accounts;
CREATE TRIGGER accounts_enfileira_enriquecimento AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION internal.accounts_enfileira_enriquecimento();
REVOKE ALL ON FUNCTION internal.accounts_enfileira_enriquecimento() FROM PUBLIC, anon, authenticated;

-- 9. Pedir enriquecimento de contas que já existiam (ou de novo): gestores do cliente (C-level, estrategista, superadmin).
CREATE OR REPLACE FUNCTION public.account_enrichment_request(p_workspace_id UUID, p_member_id UUID, p_account_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role TEXT;
  v_n INTEGER := 0;
  v_k INTEGER;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id AND status = 'active';
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'estrategista', 'clevel') THEN
    RAISE EXCEPTION 'Só gestores do cliente pedem enriquecimento.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO internal.account_enrichments (workspace_id, account_id, etapa)
  SELECT a.workspace_id, a.id, e.etapa
    FROM public.accounts a CROSS JOIN (VALUES ('empresa'), ('pessoas')) AS e(etapa)
   WHERE a.workspace_id = p_workspace_id AND a.id = ANY (COALESCE(p_account_ids, '{}')) AND a.status = 'ativa' AND NOT COALESCE(a.is_duplicate, false)
  ON CONFLICT (account_id, etapa) DO UPDATE SET estado = 'pendente', tentativas = 0, mensagem = NULL, updated_at = now()
    WHERE internal.account_enrichments.estado IN ('ok', 'sem_dado', 'erro', 'sem_saldo');
  GET DIAGNOSTICS v_k = ROW_COUNT;
  v_n := v_k;
  RETURN v_n;
END;
$$;

-- 10. O serviço pede trabalho: o banco escolhe, reserva o crédito e devolve só o necessário.
--     "pessoas" só depois de "empresa" terminar (o CNPJ e o LinkedIn da empresa ajudam a achar as pessoas certas).
CREATE OR REPLACE FUNCTION public.enrichment_next(p_limit INTEGER DEFAULT 10)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_n INTEGER := 0;
  v_membro UUID;
  v_exec UUID;
  v_res JSONB;
  v_creditos INTEGER;
  v_preco_pessoa INTEGER := (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'pessoa');
  v_chave TEXT;
  v_extra JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('enrichment_next'));
  FOR r IN
    SELECT j.*, a.name AS conta_nome
      FROM internal.account_enrichments j
      JOIN public.accounts a ON a.id = j.account_id AND a.status = 'ativa'
     WHERE (j.estado = 'pendente' OR (j.estado IN ('erro', 'sem_saldo') AND j.tentativas < 3 AND j.updated_at < now() - interval '1 hour'))
       AND (j.etapa = 'empresa' OR EXISTS (SELECT 1 FROM internal.account_enrichments e2
                                            WHERE e2.account_id = j.account_id AND e2.etapa = 'empresa'
                                              AND (e2.estado IN ('ok', 'sem_dado') OR (e2.estado = 'erro' AND e2.tentativas >= 3))))
     ORDER BY j.etapa = 'pessoas', j.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 10))
     FOR UPDATE OF j SKIP LOCKED
  LOOP
    SELECT wm.id INTO v_membro FROM public.workspace_members wm
     WHERE wm.workspace_id = r.workspace_id AND wm.status = 'active' AND wm.role IN ('clevel', 'estrategista')
     ORDER BY CASE wm.role WHEN 'clevel' THEN 1 ELSE 2 END, wm.created_at LIMIT 1;
    IF v_membro IS NULL THEN
      UPDATE internal.account_enrichments SET estado = 'erro', tentativas = 3, mensagem = 'Cliente sem responsável ativo (C-level ou estrategista).', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;

    v_creditos := CASE r.etapa WHEN 'empresa' THEN (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'empresa') ELSE 5 * v_preco_pessoa END;
    v_chave := 'enriq:' || r.id || ':a' || (r.tentativas + 1);
    INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
    VALUES (r.workspace_id, 'comercial', CASE r.etapa WHEN 'empresa' THEN 'company_enrichment' ELSE 'person_enrichment' END, 'pending', v_membro, v_creditos,
            jsonb_build_object('account_id', r.account_id, 'etapa', r.etapa, 'enriquecimento_key', v_chave))
    RETURNING id INTO v_exec;
    v_res := CASE WHEN v_creditos > 0 THEN public.credit_reserve(r.workspace_id, v_exec, v_creditos, 'Reserva: enriquecimento (' || r.etapa || ') de ' || r.conta_nome, v_chave || ':reserve')
                  ELSE jsonb_build_object('success', true, 'reserved_amount', 0) END;
    IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
      UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
      UPDATE internal.account_enrichments SET estado = 'sem_saldo', execution_id = v_exec, mensagem = 'Saldo de créditos insuficiente para o enriquecimento.', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    UPDATE public.executions SET status = 'running', execution_type = 'Enriquecimento', progress = 10, reserved_credits = (v_res->>'reserved_amount')::int,
           title = CASE r.etapa WHEN 'empresa' THEN 'Enriquecer empresa: ' ELSE 'Achar personas: ' END || r.conta_nome
     WHERE id = v_exec;
    UPDATE internal.account_enrichments SET estado = 'reservada', tentativas = r.tentativas + 1, execution_id = v_exec,
           reserved_credits = (v_res->>'reserved_amount')::int, mensagem = NULL, updated_at = now()
     WHERE id = r.id;

    IF r.etapa = 'pessoas' THEN
      SELECT jsonb_build_object(
        'personas_alvo', COALESCE((SELECT ws.personas_alvo FROM public.workspace_settings ws WHERE ws.workspace_id = r.workspace_id),
                                  '[{"cargo":"CEO","papel":"decisor"},{"cargo":"Diretor","papel":"decisor"}]'::jsonb),
        'max_pessoas', 5,
        'ja_tem', (SELECT COALESCE(jsonb_agg(DISTINCT ch.value_normalized), '[]'::jsonb) FROM public.contact_channels ch
                     JOIN public.contacts c ON c.id = ch.contact_id
                    WHERE c.account_id = r.account_id AND ch.type = 'linkedin'),
        'contatos_na_conta', (SELECT count(*) FROM public.contacts c WHERE c.account_id = r.account_id))
        INTO v_extra;
    ELSE
      v_extra := '{}'::jsonb;
    END IF;

    v_n := v_n + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'job_id', r.id, 'etapa', r.etapa, 'workspace_id', r.workspace_id, 'creditos', v_creditos,
      'teto_usd', internal.signal_teto_usd(v_creditos),
      'conta', (SELECT jsonb_build_object('id', a.id, 'nome', a.name, 'dominio', a.domain, 'cnpj', a.cnpj, 'razao_social', a.razao_social,
                  'cidade', a.city, 'uf', a.state_uf, 'cep', a.cep, 'endereco', a.endereco, 'lat', a.lat, 'lng', a.lng,
                  'linkedin_nome', a.linkedin_company_name, 'linkedin_url', a.linkedin_company_url, 'campos_manuais', to_jsonb(a.campos_manuais))
                  FROM public.accounts a WHERE a.id = r.account_id)) || v_extra);
  END LOOP;
  RETURN v_out;
END;
$$;

-- Valida um valor de campo vindo de fora. Nulo = ignora.
CREATE OR REPLACE FUNCTION internal.enrichment_valor(p_campo TEXT, p_valor JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_t TEXT := NULLIF(btrim(COALESCE(p_valor #>> '{}', '')), '');
  v_n DOUBLE PRECISION;
BEGIN
  IF v_t IS NULL THEN RETURN NULL; END IF;
  CASE p_campo
    WHEN 'cnpj' THEN v_t := regexp_replace(v_t, '[^0-9]', '', 'g'); IF v_t !~ '^[0-9]{14}$' THEN RETURN NULL; END IF;
    WHEN 'cep' THEN v_t := regexp_replace(v_t, '[^0-9]', '', 'g'); IF v_t !~ '^[0-9]{8}$' THEN RETURN NULL; END IF;
    WHEN 'state_uf' THEN v_t := upper(v_t);
      IF v_t NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RETURN NULL; END IF;
    WHEN 'lat' THEN BEGIN v_n := v_t::double precision; EXCEPTION WHEN others THEN RETURN NULL; END;
      IF v_n < -34.5 OR v_n > 5.5 THEN RETURN NULL; END IF; RETURN to_jsonb(v_n);
    WHEN 'lng' THEN BEGIN v_n := v_t::double precision; EXCEPTION WHEN others THEN RETURN NULL; END;
      IF v_n < -74.5 OR v_n > -28.5 THEN RETURN NULL; END IF; RETURN to_jsonb(v_n);
    WHEN 'localizacao_precisao' THEN IF v_t NOT IN ('endereco', 'cep', 'cidade') THEN RETURN NULL; END IF;
    WHEN 'logo_url', 'linkedin_company_url' THEN IF v_t !~* '^https://' THEN RETURN NULL; END IF;
    ELSE NULL;
  END CASE;
  RETURN to_jsonb(left(v_t, 500));
END;
$$;
REVOKE ALL ON FUNCTION internal.enrichment_valor(TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- 11. Entrega do resultado. Empresa: aplica campos (manual vence; só preenche vazio ou o que já veio do enriquecimento).
--     Pessoas: cria até 5 contatos novos (sem repetir LinkedIn/e-mail, sem quem pediu para sair) e cobra por pessoa criada.
CREATE OR REPLACE FUNCTION public.enrichment_finish(p_job_id UUID, p_resultado JSONB, p_custo_usd NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  j internal.account_enrichments;
  a public.accounts;
  v_campo TEXT;
  v_valor JSONB;
  v_fonte TEXT;
  v_set JSONB := '{}'::jsonb;
  v_fontes JSONB;
  v_preenchidos INTEGER := 0;
  v_cobrar INTEGER := 0;
  p JSONB;
  t JSONB;
  v_contato UUID;
  v_li TEXT;
  v_criados INTEGER := 0;
  v_preco_pessoa INTEGER := (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'pessoa');
  v_pos INTEGER;
  v_papel TEXT;
  v_tel TEXT;
BEGIN
  SELECT * INTO j FROM internal.account_enrichments WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR j.estado <> 'reservada' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF p_custo_usd IS NOT NULL AND p_custo_usd < 0 THEN RAISE EXCEPTION 'Custo inválido.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.accounts WHERE id = j.account_id FOR UPDATE;
  PERFORM set_config('althius.enriquecimento', 'on', true);

  IF j.etapa = 'empresa' THEN
    v_fontes := a.fontes;
    FOREACH v_campo IN ARRAY ARRAY['domain', 'cnpj', 'razao_social', 'nome_fantasia', 'endereco', 'cep', 'city', 'state_uf', 'telefone', 'email_empresa',
                                   'cnae', 'porte', 'situacao_cadastral', 'lat', 'lng', 'localizacao_precisao', 'logo_url', 'linkedin_company_url', 'linkedin_company_name'] LOOP
      v_valor := internal.enrichment_valor(v_campo, (p_resultado->'campos')->v_campo);
      CONTINUE WHEN v_valor IS NULL;
      CONTINUE WHEN v_campo = ANY (a.campos_manuais);
      -- Só preenche vazio ou o que o próprio enriquecimento escreveu antes (nunca o que veio de outro lugar).
      CONTINUE WHEN NULLIF(btrim(COALESCE(to_jsonb(a)->>v_campo, '')), '') IS NOT NULL AND NOT (a.fontes ? v_campo);
      v_set := v_set || jsonb_build_object(v_campo, v_valor);
      v_fonte := left(COALESCE((p_resultado->'fontes')->>v_campo, 'enriquecimento'), 60);
      v_fontes := v_fontes || jsonb_build_object(v_campo, jsonb_build_object('fonte', v_fonte, 'em', now()));
      v_preenchidos := v_preenchidos + 1;
    END LOOP;
    IF v_preenchidos > 0 THEN
      UPDATE public.accounts x SET
        domain = COALESCE((v_set->>'domain'), x.domain),
        cnpj = COALESCE(v_set->>'cnpj', x.cnpj), razao_social = COALESCE(v_set->>'razao_social', x.razao_social),
        nome_fantasia = COALESCE(v_set->>'nome_fantasia', x.nome_fantasia), endereco = COALESCE(v_set->>'endereco', x.endereco),
        cep = COALESCE(v_set->>'cep', x.cep), city = COALESCE(v_set->>'city', x.city), state_uf = COALESCE(v_set->>'state_uf', x.state_uf),
        telefone = COALESCE(v_set->>'telefone', x.telefone), email_empresa = COALESCE(v_set->>'email_empresa', x.email_empresa),
        cnae = COALESCE(v_set->>'cnae', x.cnae), porte = COALESCE(v_set->>'porte', x.porte), situacao_cadastral = COALESCE(v_set->>'situacao_cadastral', x.situacao_cadastral),
        lat = COALESCE((v_set->>'lat')::double precision, x.lat), lng = COALESCE((v_set->>'lng')::double precision, x.lng),
        localizacao_precisao = COALESCE(v_set->>'localizacao_precisao', x.localizacao_precisao),
        logo_url = COALESCE(v_set->>'logo_url', x.logo_url), linkedin_company_url = COALESCE(v_set->>'linkedin_company_url', x.linkedin_company_url),
        linkedin_company_name = COALESCE(v_set->>'linkedin_company_name', x.linkedin_company_name),
        fontes = v_fontes, enriquecido_em = now()
       WHERE x.id = a.id;
      v_cobrar := j.reserved_credits;
      IF v_cobrar > 0 THEN v_cobrar := LEAST(v_cobrar, (SELECT creditos FROM internal.enrichment_prices WHERE etapa = 'empresa')); END IF;
    END IF;
  ELSE
    FOR p IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_resultado->'pessoas') = 'array' THEN p_resultado->'pessoas' ELSE '[]'::jsonb END) LOOP
      EXIT WHEN v_criados >= 5;
      CONTINUE WHEN NULLIF(btrim(COALESCE(p->>'nome', '')), '') IS NULL;
      v_li := CASE WHEN COALESCE(p->>'linkedin_url', '') ~* '^https://([a-z]{2,3}\.)?(www\.)?linkedin\.com/in/[^/?#]+' THEN
                     'https://www.linkedin.com/in/' || (regexp_match(p->>'linkedin_url', 'linkedin\.com/in/([^/?#]+)', 'i'))[1] END;
      CONTINUE WHEN v_li IS NULL;
      -- Já existe no cliente (mesmo LinkedIn) ou pediu para sair: não entra.
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.contact_channels ch WHERE ch.workspace_id = j.workspace_id AND ch.type = 'linkedin'
                              AND ch.value_normalized = public.normalize_channel_value('linkedin', v_li));
      CONTINUE WHEN EXISTS (SELECT 1 FROM internal.enrichment_suppressions s WHERE s.workspace_id = j.workspace_id AND s.tipo = 'linkedin'
                              AND s.valor_normalizado = public.normalize_channel_value('linkedin', v_li));
      v_papel := CASE WHEN p->>'papel' IN ('decisor', 'influenciador', 'campeao') THEN p->>'papel' ELSE 'influenciador' END;
      INSERT INTO public.contacts (workspace_id, account_id, name, job_title, buying_role, photo_url, owner_member_id, origem)
      VALUES (j.workspace_id, j.account_id, left(btrim(p->>'nome'), 160), NULLIF(left(btrim(COALESCE(p->>'cargo', '')), 160), ''), v_papel,
              CASE WHEN COALESCE(p->>'foto_url', '') ~* '^https://' THEN left(p->>'foto_url', 1000) END, a.owner_member_id, 'enriquecimento')
      RETURNING id INTO v_contato;
      INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position, fonte, coletado_em)
      VALUES (j.workspace_id, v_contato, 'linkedin', v_li, 1, 'LinkedIn', now())
      ON CONFLICT (workspace_id, type, value_normalized) DO NOTHING;
      v_pos := 0;
      FOR t IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'telefones') = 'array' THEN p->'telefones' ELSE '[]'::jsonb END) LOOP
        EXIT WHEN v_pos >= 3;
        CONTINUE WHEN length(regexp_replace(COALESCE(t->>'numero', ''), '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 13;
        -- Com ou sem o 55 do Brasil é o mesmo número.
        v_tel := regexp_replace(t->>'numero', '[^0-9]', '', 'g');
        v_tel := CASE WHEN v_tel ~ '^55' AND length(v_tel) IN (12, 13) THEN substr(v_tel, 3) ELSE v_tel END;
        CONTINUE WHEN EXISTS (SELECT 1 FROM internal.enrichment_suppressions s WHERE s.workspace_id = j.workspace_id AND s.tipo IN ('phone', 'whatsapp')
                                AND s.valor_normalizado IN (v_tel, '55' || v_tel));
        v_pos := v_pos + 1;
        INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position, fonte, coletado_em)
        VALUES (j.workspace_id, v_contato, 'phone', left(t->>'numero', 40), v_pos, left(COALESCE(t->>'fonte', 'enriquecimento'), 60), now())
        ON CONFLICT (workspace_id, type, value_normalized) DO NOTHING;
      END LOOP;
      v_pos := 0;
      FOR t IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'emails') = 'array' THEN p->'emails' ELSE '[]'::jsonb END) LOOP
        EXIT WHEN v_pos >= 3;
        CONTINUE WHEN COALESCE(t->>'email', '') !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$';
        CONTINUE WHEN EXISTS (SELECT 1 FROM internal.enrichment_suppressions s WHERE s.workspace_id = j.workspace_id AND s.tipo = 'email'
                                AND s.valor_normalizado = public.normalize_channel_value('email', t->>'email'));
        v_pos := v_pos + 1;
        INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position, fonte, coletado_em)
        VALUES (j.workspace_id, v_contato, 'email', left(t->>'email', 200), v_pos, left(COALESCE(t->>'fonte', 'enriquecimento'), 60), now())
        ON CONFLICT (workspace_id, type, value_normalized) DO NOTHING;
      END LOOP;
      v_criados := v_criados + 1;
    END LOOP;
    v_cobrar := LEAST(j.reserved_credits, v_criados * v_preco_pessoa);
    v_preenchidos := v_criados;
  END IF;

  PERFORM public.credit_consume(j.workspace_id, j.execution_id, v_cobrar, j.reserved_credits,
    CASE WHEN v_cobrar > 0 THEN 'Enriquecimento (' || j.etapa || ') de ' || a.name ELSE 'Liberação: enriquecimento sem dado novo' END,
    'enriq:' || j.id || ':a' || j.tentativas || ':consume');
  UPDATE public.executions SET status = 'completed', actual_credits = v_cobrar, progress = 100, valid_count = v_preenchidos,
         processed_count = GREATEST(v_preenchidos, CASE j.etapa WHEN 'empresa' THEN (SELECT count(*)::int FROM jsonb_object_keys(CASE WHEN jsonb_typeof(p_resultado->'campos') = 'object' THEN p_resultado->'campos' ELSE '{}'::jsonb END))
                                                         ELSE jsonb_array_length(CASE WHEN jsonb_typeof(p_resultado->'pessoas') = 'array' THEN p_resultado->'pessoas' ELSE '[]'::jsonb END) END)
   WHERE id = j.execution_id;
  UPDATE internal.account_enrichments SET estado = CASE WHEN v_preenchidos > 0 THEN 'ok' ELSE 'sem_dado' END, creditos = v_cobrar,
         custo_usd = p_custo_usd, finished_at = now(), updated_at = now()
   WHERE id = j.id;
  PERFORM public.audit_write(j.workspace_id, NULL, 'enriquecimento_concluido', 'account', j.account_id::text,
    jsonb_build_object('etapa', j.etapa, 'preenchidos', v_preenchidos, 'creditos', v_cobrar));
  -- A marca vale só para esta escrita: o que vier depois na mesma transação volta a contar como manual.
  PERFORM set_config('althius.enriquecimento', 'off', true);
  RETURN jsonb_build_object('acao', 'concluido', 'preenchidos', v_preenchidos, 'creditos', v_cobrar);
END;
$$;

-- 12. Falha: devolve o crédito; tenta de novo depois (até 3 vezes). Nunca grava dado.
CREATE OR REPLACE FUNCTION public.enrichment_fail(p_job_id UUID, p_mensagem TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  j internal.account_enrichments;
BEGIN
  SELECT * INTO j FROM internal.account_enrichments WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR j.estado <> 'reservada' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF j.reserved_credits > 0 THEN
    PERFORM public.credit_consume(j.workspace_id, j.execution_id, 0, j.reserved_credits, 'Liberação: enriquecimento falhou', 'enriq:' || j.id || ':a' || j.tentativas || ':release');
  END IF;
  UPDATE public.executions SET status = 'failed', progress = 100,
         errors = errors || jsonb_build_array(jsonb_build_object('erro', COALESCE(left(p_mensagem, 300), 'falha no enriquecimento')))
   WHERE id = j.execution_id;
  UPDATE internal.account_enrichments SET estado = 'erro', mensagem = COALESCE(left(p_mensagem, 300), 'falha no enriquecimento'), updated_at = now() WHERE id = j.id;
  RETURN jsonb_build_object('acao', 'falhou');
END;
$$;

-- 13. Pessoa pediu para sair (LGPD): apaga o contato e guarda os identificadores para nunca recriar.
CREATE OR REPLACE FUNCTION public.contact_suppress(p_contact_id UUID, p_member_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.contacts;
  v_role TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO c FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contato não encontrado.' USING ERRCODE = '22023'; END IF;
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = c.workspace_id AND status = 'active';
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'estrategista', 'clevel') THEN
    RAISE EXCEPTION 'Só gestores do cliente removem contatos a pedido.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO internal.enrichment_suppressions (workspace_id, tipo, valor_normalizado)
  SELECT ch.workspace_id, ch.type, ch.value_normalized FROM public.contact_channels ch WHERE ch.contact_id = c.id
  ON CONFLICT DO NOTHING;
  DELETE FROM public.contacts WHERE id = c.id;
  PERFORM public.audit_write(c.workspace_id, (SELECT user_id FROM public.workspace_members WHERE id = p_member_id), 'contato_removido_a_pedido', 'contact', c.id::text,
    jsonb_build_object('motivo', 'pedido do titular (LGPD)'));
END;
$$;

-- 14. Permissões (ADR 0023).
REVOKE ALL ON FUNCTION public.account_enrichment_request(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_enrichment_request(UUID, UUID, UUID[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.contact_suppress(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_suppress(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.enrichment_next(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enrichment_finish(UUID, JSONB, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enrichment_fail(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrichment_next(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.enrichment_finish(UUID, JSONB, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.enrichment_fail(UUID, TEXT) TO service_role;
