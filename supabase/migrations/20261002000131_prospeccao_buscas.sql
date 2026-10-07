-- ==============================================================================
-- Migration: 20261002000131_prospeccao_buscas.sql
-- Prospecção: buscas e candidatas (spec .scratch/prospeccao-revenue, fatia 2; ADR 0067).
-- Uma máquina só para as duas lógicas (ICP primeiro e sinal primeiro): muda a FONTE.
--  1. A Zoe (agente comercial, a única que prospecta) ESTIMA a busca: fonte, parâmetros e máximo de empresas.
--     Estimar não gasta nada; a estimativa vale 30 minutos.
--  2. Uma pessoa pede ("pode rodar") e a Zoe RODA a estimativa. Passa pelo portão de crédito de sempre
--     (hermes_credit_gate): acima do teto, do limite ou do saldo, vira aprovação de gasto do C-level.
--  3. O serviço `prospeccao` pega a busca (prospect_next), o banco RESERVA o crédito máximo, o serviço roda a fonte da
--     Apify com teto em dólar e entrega os itens (prospect_finish). Cobra-se só por empresa NOVA (repetida não cobra);
--     o resto da reserva volta. Falha devolve tudo (prospect_fail).
--  4. O que veio vira CANDIDATA. A pessoa inclui (vira conta, com os dados da fonte, e entra sozinha no enriquecimento)
--     ou exclui. O crédito da busca é gasto mesmo que ela exclua.
-- Fontes são DADO (internal.prospect_sources): entrada do ator com {{variáveis}} e um mapeamento de campos. Fonte de
-- pessoas (B2C, ex.: seguidores de concorrente) fica de fora (LGPD) até uma decisão explícita.
-- O custo real em dólar fica só em tabela interna.
-- ==============================================================================

-- 1. Fontes de prospecção. Superadmin muda por SQL ou migration; o cliente e o agente nunca veem o ator nem dólar.
CREATE TABLE IF NOT EXISTS internal.prospect_sources (
  code TEXT PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,59}$'),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  publico TEXT NOT NULL DEFAULT 'empresas' CHECK (publico IN ('empresas', 'pessoas')),
  ator TEXT NOT NULL CHECK (ator ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$'),
  entrada JSONB NOT NULL CHECK (jsonb_typeof(entrada) = 'object'),
  mapeamento JSONB NOT NULL CHECK (jsonb_typeof(mapeamento) = 'object'),
  parametros JSONB NOT NULL CHECK (jsonb_typeof(parametros) = 'array'),
  creditos_por_empresa INTEGER NOT NULL DEFAULT 1 CHECK (creditos_por_empresa >= 1),
  max_por_busca INTEGER NOT NULL DEFAULT 200 CHECK (max_por_busca BETWEEN 1 AND 1000),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE internal.prospect_sources IS 'Fontes de prospecção (ADR 0067): ator da Apify, entrada com {{variáveis}} e mapeamento dos campos. Dado, não código.';
COMMENT ON COLUMN internal.prospect_sources.publico IS 'empresas (B2B) ou pessoas (B2C). Fonte de pessoas não roda sem decisão explícita (LGPD).';
COMMENT ON COLUMN internal.prospect_sources.creditos_por_empresa IS 'Preço provisório por empresa NOVA encontrada (a medir com o custo real).';
ALTER TABLE internal.prospect_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.prospect_sources FROM PUBLIC, anon, authenticated;

-- Sementes (entradas conferidas na página oficial dos atores em 07/10/2026). Extras pagos do Google Maps desligados.
-- "parametros" diz o que a busca aceita; "filtro": true = aplicado depois, nos itens devolvidos (a fonte não filtra).
INSERT INTO internal.prospect_sources (code, nome, descricao, ator, entrada, mapeamento, parametros) VALUES
('google_maps', 'Google Maps',
 'Empresas de um ramo numa cidade, pelo Google Maps: nome, site, telefone, endereço e pin no mapa.',
 'compass/crawler-google-places',
 '{"searchStringsArray": ["{{busca}}"], "locationQuery": "{{local}}", "maxCrawledPlacesPerSearch": "{{max}}", "language": "pt-BR",
   "scrapeContacts": false, "maximumLeadsEnrichmentRecords": 0, "maxReviews": 0, "maxImages": 0, "scrapePlaceDetailPage": false}'::jsonb,
 '{"chave": "placeId", "prefixo_chave": "gmaps:", "nome": "title", "site": "website", "telefone": "phone", "endereco": "address",
   "cidade": "city", "uf": "state", "categoria": "categoryName", "lat": "location.lat|latitude", "lng": "location.lng|longitude",
   "fonte": "Google Maps", "precisao": "endereco", "dados": ["totalScore", "reviewsCount", "url"]}'::jsonb,
 '[{"nome": "busca", "obrigatorio": true, "descricao": "o que procurar, como no Google Maps (ex.: clínica odontológica)"},
   {"nome": "local", "obrigatorio": true, "descricao": "cidade, UF e país (ex.: Campinas, SP, Brasil)"}]'::jsonb),
('receita_cnae', 'Receita Federal (CNAE)',
 'Empresas ativas de um CNAE num estado (ou município), pela base pública da Receita Federal: CNPJ, porte, capital social, endereço e telefone. Não traz site.',
 'jungle_synthesizer/brazil-cnpj-receita-federal-crawler',
 '{"cnaes": ["{{cnae}}"], "states": ["{{uf}}"], "municipalities": ["{{municipio}}"], "situacaoCadastral": "ATIVA", "maxItems": "{{max}}"}'::jsonb,
 '{"chave": "cnpj", "prefixo_chave": "cnpj:", "nome": "nome_fantasia|nomeFantasia|razao_social|razaoSocial", "cnpj": "cnpj",
   "telefone": "telefone1|telefone_1|ddd_telefone_1|phone", "endereco": "endereco|logradouro|address", "cidade": "municipio|city",
   "uf": "uf|state", "categoria": "cnae_fiscal_descricao|cnaeDescricao|cnae_fiscal|cnae", "porte": "porte|porte_empresa",
   "capital_social": "capital_social|capitalSocial", "fonte": "Receita Federal",
   "dados": ["razao_social", "razaoSocial", "situacao_cadastral", "situacaoCadastral", "data_inicio_atividade", "dataInicioAtividade"]}'::jsonb,
 '[{"nome": "cnae", "obrigatorio": true, "descricao": "CNAE de 7 dígitos (ex.: 8630504)"},
   {"nome": "uf", "obrigatorio": true, "descricao": "sigla do estado (ex.: SP)"},
   {"nome": "municipio", "obrigatorio": false, "descricao": "código IBGE do município, 7 dígitos (opcional)"},
   {"nome": "porte", "obrigatorio": false, "filtro": true, "descricao": "portes aceitos, separados por vírgula: MICRO, EPP, DEMAIS (opcional)"},
   {"nome": "capital_min", "obrigatorio": false, "filtro": true, "descricao": "capital social mínimo em reais (opcional)"},
   {"nome": "capital_max", "obrigatorio": false, "filtro": true, "descricao": "capital social máximo em reais (opcional)"}]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 2. Buscas (o cliente lê; ninguém grava direto).
CREATE TABLE IF NOT EXISTS public.prospect_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  agent_code TEXT NOT NULL CHECK (agent_code IN ('comercial', 'marketing', 'copy', 'revops')),
  source_code TEXT NOT NULL REFERENCES internal.prospect_sources(code),
  titulo TEXT NOT NULL,
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_empresas INTEGER NOT NULL CHECK (max_empresas >= 1),
  creditos_estimados INTEGER NOT NULL CHECK (creditos_estimados >= 0),
  estado TEXT NOT NULL DEFAULT 'estimada'
    CHECK (estado IN ('estimada', 'aprovacao', 'pendente', 'reservada', 'concluida', 'sem_resultado', 'erro', 'cancelada')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  approval_id UUID REFERENCES public.approvals(id) ON DELETE SET NULL,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  creditos_cobrados INTEGER NOT NULL DEFAULT 0,
  encontradas INTEGER NOT NULL DEFAULT 0,
  repetidas INTEGER NOT NULL DEFAULT 0,
  fora_do_filtro INTEGER NOT NULL DEFAULT 0,
  mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_prospect_searches_ws ON public.prospect_searches (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_searches_fila ON public.prospect_searches (estado, updated_at);
COMMENT ON TABLE public.prospect_searches IS 'Buscas de prospecção da Zoe (ADR 0067). Só créditos; o custo real fica em internal.prospect_search_costs.';

-- 3. Candidatas: o que a busca trouxe e a pessoa ainda decide.
CREATE TABLE IF NOT EXISTS public.prospect_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  search_id UUID NOT NULL REFERENCES public.prospect_searches(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  nome TEXT NOT NULL,
  dominio TEXT,
  cnpj TEXT CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  cidade TEXT,
  uf TEXT,
  telefone TEXT,
  endereco TEXT,
  categoria TEXT,
  porte TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  fonte TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado TEXT NOT NULL DEFAULT 'candidata' CHECK (estado IN ('candidata', 'incluida', 'excluida')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  decidido_por_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prospect_candidate_chave UNIQUE (workspace_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_prospect_candidates_busca ON public.prospect_candidates (search_id);
CREATE INDEX IF NOT EXISTS idx_prospect_candidates_ws ON public.prospect_candidates (workspace_id, estado, created_at DESC);
COMMENT ON TABLE public.prospect_candidates IS 'Empresas que uma busca trouxe (ADR 0067). Candidata não é enriquecida; incluída vira conta.';

ALTER TABLE public.prospect_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros leem as buscas do workspace" ON public.prospect_searches;
CREATE POLICY "Membros leem as buscas do workspace" ON public.prospect_searches FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));
DROP POLICY IF EXISTS "Membros leem as candidatas do workspace" ON public.prospect_candidates;
CREATE POLICY "Membros leem as candidatas do workspace" ON public.prospect_candidates FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));
REVOKE ALL ON public.prospect_searches, public.prospect_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.prospect_searches, public.prospect_candidates TO authenticated;
GRANT ALL ON public.prospect_searches, public.prospect_candidates TO service_role;

-- 4. Custo real do fornecedor (dólar): só sistema e superadmin.
CREATE TABLE IF NOT EXISTS internal.prospect_search_costs (
  search_id UUID PRIMARY KEY REFERENCES public.prospect_searches(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  custo_usd NUMERIC(14, 6) NOT NULL DEFAULT 0 CHECK (custo_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE internal.prospect_search_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON internal.prospect_search_costs FROM PUBLIC, anon, authenticated;

-- 5. Auxiliares.
-- Site da empresa a partir do que a fonte trouxe. Perfil de rede social, WhatsApp ou link do Google não é site: nulo.
CREATE OR REPLACE FUNCTION internal.prospeccao_dominio(p_site TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v TEXT := public.normalize_domain(p_site);
  r TEXT;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  FOREACH r IN ARRAY ARRAY['instagram.com', 'facebook.com', 'fb.com', 'fb.me', 'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com',
                           'twitter.com', 'x.com', 'wa.me', 'whatsapp.com', 'linktr.ee', 'google.com', 'goo.gl', 'g.page', 'ifood.com.br'] LOOP
    IF v = r OR v LIKE '%.' || r THEN RETURN NULL; END IF;
  END LOOP;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION internal.prospeccao_dominio(TEXT) FROM PUBLIC, anon, authenticated;

-- Confere e normaliza os parâmetros de uma busca contra a fonte. Devolve {ok, parametros} ou {ok:false, erro}.
CREATE OR REPLACE FUNCTION internal.prospeccao_parametros(p_fonte internal.prospect_sources, p_parametros JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_in JSONB := COALESCE(p_parametros, '{}'::jsonb);
  v_out JSONB := '{}'::jsonb;
  v_def JSONB;
  v_nome TEXT;
  v_valor TEXT;
  v_aceitos TEXT[] := ARRAY(SELECT x->>'nome' FROM jsonb_array_elements(p_fonte.parametros) x);
  v_porte TEXT;
  v_n NUMERIC;
BEGIN
  IF jsonb_typeof(v_in) <> 'object' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Os parâmetros precisam ser um objeto (nome: valor).'); END IF;
  FOR v_nome IN SELECT jsonb_object_keys(v_in) LOOP
    IF NOT (v_nome = ANY (v_aceitos)) THEN
      RETURN jsonb_build_object('ok', false, 'erro', format('A fonte %s não tem o parâmetro "%s" (aceita: %s).', p_fonte.nome, v_nome, array_to_string(v_aceitos, ', ')));
    END IF;
  END LOOP;
  FOR v_def IN SELECT * FROM jsonb_array_elements(p_fonte.parametros) LOOP
    v_nome := v_def->>'nome';
    v_valor := NULLIF(btrim(COALESCE(v_in->>v_nome, '')), '');
    IF v_valor IS NULL THEN
      IF COALESCE((v_def->>'obrigatorio')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'erro', format('Falta o parâmetro "%s": %s.', v_nome, v_def->>'descricao'));
      END IF;
      CONTINUE;
    END IF;
    IF length(v_valor) > 200 THEN RETURN jsonb_build_object('ok', false, 'erro', format('O parâmetro "%s" passa de 200 caracteres.', v_nome)); END IF;
    CASE v_nome
      WHEN 'cnae' THEN
        v_valor := regexp_replace(v_valor, '[^0-9]', '', 'g');
        IF v_valor !~ '^[0-9]{7}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'O CNAE tem 7 dígitos (ex.: 8630504).'); END IF;
      WHEN 'uf' THEN
        v_valor := upper(v_valor);
        IF v_valor NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN
          RETURN jsonb_build_object('ok', false, 'erro', 'Use a sigla do estado (ex.: SP).');
        END IF;
      WHEN 'municipio' THEN
        v_valor := regexp_replace(v_valor, '[^0-9]', '', 'g');
        IF v_valor !~ '^[0-9]{7}$' THEN RETURN jsonb_build_object('ok', false, 'erro', 'O município é o código IBGE de 7 dígitos (ex.: 3509502).'); END IF;
      WHEN 'porte' THEN
        FOREACH v_porte IN ARRAY string_to_array(upper(regexp_replace(v_valor, '\s', '', 'g')), ',') LOOP
          IF v_porte NOT IN ('MICRO', 'EPP', 'DEMAIS') THEN RETURN jsonb_build_object('ok', false, 'erro', 'Porte aceita só MICRO, EPP e DEMAIS, separados por vírgula.'); END IF;
        END LOOP;
        v_valor := upper(regexp_replace(v_valor, '\s', '', 'g'));
      WHEN 'capital_min', 'capital_max' THEN
        BEGIN v_n := replace(replace(v_valor, '.', ''), ',', '.')::numeric; EXCEPTION WHEN others THEN v_n := NULL; END;
        IF v_n IS NULL OR v_n < 0 THEN RETURN jsonb_build_object('ok', false, 'erro', format('"%s" é um valor em reais (só números).', v_nome)); END IF;
        v_valor := v_n::text;
      ELSE NULL;
    END CASE;
    v_out := v_out || jsonb_build_object(v_nome, v_valor);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'parametros', v_out);
END;
$$;
REVOKE ALL ON FUNCTION internal.prospeccao_parametros(internal.prospect_sources, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.so_a_zoe(p_agente public.agent_runtime_tokens)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_agente.agent_code = 'comercial' THEN NULL
              ELSE jsonb_build_object('ok', false, 'erro', 'Só a Zoe prospecta. Peça à Zoe (agente comercial).') END;
$$;
REVOKE ALL ON FUNCTION internal.so_a_zoe(public.agent_runtime_tokens) FROM PUBLIC, anon, authenticated;

-- 6. Porta do agente (ADR 0024: só com o token).
CREATE OR REPLACE FUNCTION public.agent_prospect_sources(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('codigo', f.code, 'nome', f.nome, 'descricao', f.descricao, 'parametros', f.parametros,
             'creditos_por_empresa', f.creditos_por_empresa, 'max_por_busca', f.max_por_busca) ORDER BY f.code)
      FROM internal.prospect_sources f WHERE f.ativo AND f.publico = 'empresas'), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_prospect_estimate(p_token TEXT, p_source_code TEXT, p_parametros JSONB, p_max_empresas INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  f internal.prospect_sources;
  v_norm JSONB;
  v_creditos INTEGER;
  v_id UUID;
  v_titulo TEXT;
  v_pessoa UUID;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF internal.so_a_zoe(v) IS NOT NULL THEN RETURN internal.so_a_zoe(v); END IF;
  SELECT * INTO f FROM internal.prospect_sources WHERE code = p_source_code AND ativo;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Fonte não encontrada (veja prospeccao_fontes).'); END IF;
  IF f.publico <> 'empresas' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta fonte traz PESSOAS (B2C), não empresas: pela LGPD ela só roda com decisão explícita da Althius.');
  END IF;
  IF p_max_empresas IS NULL OR p_max_empresas < 1 OR p_max_empresas > f.max_por_busca THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('Peça de 1 a %s empresas por busca nesta fonte.', f.max_por_busca));
  END IF;
  v_norm := internal.prospeccao_parametros(f, p_parametros);
  IF NOT (v_norm->>'ok')::boolean THEN RETURN v_norm; END IF;
  v_creditos := p_max_empresas * f.creditos_por_empresa;
  SELECT left(f.nome || ': ' || string_agg(value, ' · ' ORDER BY key), 160) INTO v_titulo FROM jsonb_each_text(v_norm->'parametros');
  v_pessoa := NULLIF(public.integration_agent_context(p_token)->>'requester_member_id', '')::uuid;
  INSERT INTO public.prospect_searches (workspace_id, requested_by_member_id, agent_code, source_code, titulo, parametros, max_empresas, creditos_estimados)
  VALUES (v.workspace_id, v_pessoa, v.agent_code, f.code, COALESCE(v_titulo, f.nome), v_norm->'parametros', p_max_empresas, v_creditos)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'estimativa_id', v_id, 'fonte', f.nome, 'titulo', COALESCE(v_titulo, f.nome), 'max_empresas', p_max_empresas,
    'creditos', v_creditos, 'valida_ate', now() + interval '30 minutes',
    'aviso', format('Isso vai custar até %s créditos (%s por empresa nova; repetidas não cobram; o que não for achado volta). O crédito é gasto mesmo que a pessoa exclua candidatas depois. Diga o custo à pessoa e só rode depois que ela pedir.',
                    v_creditos, f.creditos_por_empresa));
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_prospect_run(p_token TEXT, p_estimativa_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
  s public.prospect_searches;
  v_pessoa UUID;
  v_papel TEXT;
  v_escopo TEXT;
  v_portao JSONB;
  v_estado TEXT;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  IF internal.so_a_zoe(v) IS NOT NULL THEN RETURN internal.so_a_zoe(v); END IF;
  SELECT * INTO s FROM public.prospect_searches WHERE id = p_estimativa_id AND workspace_id = v.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'Estimativa não encontrada: estime antes com prospeccao_estimar e diga o custo à pessoa.'); END IF;
  IF s.estado <> 'estimada' THEN RETURN jsonb_build_object('ok', false, 'erro', format('Esta busca já foi pedida (estado: %s).', s.estado), 'estado', s.estado); END IF;
  IF s.created_at < now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'A estimativa venceu (vale 30 minutos). Estime de novo e confirme o custo com a pessoa.');
  END IF;
  v_pessoa := NULLIF(public.integration_agent_context(p_token)->>'requester_member_id', '')::uuid;
  IF v_pessoa IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma pessoa pediu agora: a busca gasta créditos e só roda a pedido de alguém.');
  END IF;
  SELECT wm.role, rp.scope INTO v_papel, v_escopo FROM public.workspace_members wm
    LEFT JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = 'prospecting.approve'
   WHERE wm.id = v_pessoa AND wm.workspace_id = v.workspace_id AND wm.status = 'active';
  IF v_escopo IS DISTINCT FROM 'all' THEN
    RETURN jsonb_build_object('ok', false, 'erro', CASE WHEN v_papel = 'bdr'
      THEN 'Quem pediu é BDR: a busca gasta créditos e precisa do pedido de um gestor (C-level ou estrategista).'
      ELSE 'Quem pediu não pode rodar prospecção neste cliente.' END);
  END IF;

  v_portao := public.hermes_credit_gate(v.workspace_id, v_pessoa, 'prospecting.approve', s.creditos_estimados, true, 'Prospecção: ' || s.titulo,
    jsonb_build_object('acao', 'prospeccao', 'search_id', s.id, 'creditos', s.creditos_estimados));
  IF v_portao IS NULL THEN
    v_estado := 'pendente';
  ELSIF v_portao->>'status' = 'requires_approval' THEN
    v_estado := 'aprovacao';
  ELSE
    RETURN jsonb_build_object('ok', false, 'erro', COALESCE(v_portao->>'reason', 'O pedido de créditos foi recusado.'));
  END IF;
  UPDATE public.prospect_searches SET estado = v_estado, requested_by_member_id = v_pessoa, approval_id = NULLIF(v_portao->>'approval_id', '')::uuid,
         mensagem = CASE WHEN v_estado = 'aprovacao' THEN v_portao->>'reason' END, updated_at = now()
   WHERE id = s.id;
  PERFORM public.audit_write(v.workspace_id, NULL, 'prospeccao_pedida', 'prospect_search', s.id::text,
    jsonb_build_object('agente', v.agent_code, 'em_nome_de', v_pessoa, 'fonte', s.source_code, 'creditos', s.creditos_estimados, 'estado', v_estado));
  RETURN jsonb_build_object('ok', true, 'estado', v_estado, 'creditos', s.creditos_estimados,
    'mensagem', CASE WHEN v_estado = 'pendente' THEN 'Busca na fila. As empresas aparecem como candidatas na página Prospecção.'
                     ELSE COALESCE(v_portao->>'reason', 'A busca foi para aprovação de gasto do C-level.') END);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_prospect_searches(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.agent_runtime_tokens;
BEGIN
  v := public.agent_runtime_resolve(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', s.id, 'titulo', s.titulo, 'fonte', s.source_code, 'estado', s.estado,
             'max_empresas', s.max_empresas, 'creditos_estimados', s.creditos_estimados, 'creditos_cobrados', s.creditos_cobrados,
             'encontradas', s.encontradas, 'repetidas', s.repetidas, 'fora_do_filtro', s.fora_do_filtro, 'mensagem', s.mensagem,
             'candidatas_sem_decisao', (SELECT count(*) FROM public.prospect_candidates c WHERE c.search_id = s.id AND c.estado = 'candidata'),
             'criada_em', s.created_at) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM public.prospect_searches WHERE workspace_id = v.workspace_id ORDER BY created_at DESC LIMIT 20) s), '[]'::jsonb);
END;
$$;

-- 7. Aprovação de gasto decidida: aprovada entra na fila; recusada (ou com ajustes) é cancelada.
CREATE OR REPLACE FUNCTION internal.approvals_decide_prospeccao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.prospect_searches
     SET estado = CASE WHEN NEW.status = 'aprovado' THEN 'pendente' ELSE 'cancelada' END,
         mensagem = CASE WHEN NEW.status = 'aprovado' THEN NULL ELSE 'O gasto não foi aprovado.' END, updated_at = now()
   WHERE id = (NEW.payload_json->>'search_id')::uuid AND workspace_id = NEW.workspace_id AND estado = 'aprovacao';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.approvals_decide_prospeccao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS approvals_decide_prospeccao ON public.approvals;
CREATE TRIGGER approvals_decide_prospeccao AFTER UPDATE OF status ON public.approvals
  FOR EACH ROW WHEN (OLD.status = 'pendente' AND NEW.status <> 'pendente' AND NEW.payload_json->>'acao' = 'prospeccao')
  EXECUTE FUNCTION internal.approvals_decide_prospeccao();

-- 8. Serviço: pega as buscas na fila, reserva o crédito máximo e cria a execução (aparece em Prospecção e Execuções).
--    Falha volta a tentar depois de 30 minutos, até 3 vezes.
CREATE OR REPLACE FUNCTION public.prospect_next(p_limit INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r RECORD;
  v_out JSONB := '[]'::jsonb;
  v_exec UUID;
  v_res JSONB;
  v_chave TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('prospect_next'));
  FOR r IN
    SELECT s.*, f.nome AS fonte_nome, f.ator, f.entrada, f.mapeamento
      FROM public.prospect_searches s JOIN internal.prospect_sources f ON f.code = s.source_code
     WHERE s.estado = 'pendente' OR (s.estado = 'erro' AND s.tentativas BETWEEN 1 AND 2 AND s.updated_at < now() - interval '30 minutes')
     ORDER BY s.created_at
     LIMIT GREATEST(1, COALESCE(p_limit, 5))
     FOR UPDATE OF s SKIP LOCKED
  LOOP
    IF r.requested_by_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.id = r.requested_by_member_id AND wm.status = 'active') THEN
      UPDATE public.prospect_searches SET estado = 'erro', tentativas = 3, mensagem = 'Quem pediu a busca não está mais ativo no cliente.', updated_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    v_chave := 'prosp:' || r.id || ':a' || (r.tentativas + 1);
    INSERT INTO public.executions (workspace_id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, metadata_json)
    VALUES (r.workspace_id, 'comercial', 'prospecting.search', 'pending', r.requested_by_member_id, r.creditos_estimados,
            jsonb_build_object('prospeccao_id', r.id, 'fonte', r.source_code, 'prospeccao_key', v_chave))
    RETURNING id INTO v_exec;
    v_res := public.credit_reserve(r.workspace_id, v_exec, r.creditos_estimados, 'Reserva: prospecção ' || r.titulo, v_chave || ':reserve');
    IF COALESCE((v_res->>'success')::boolean, false) IS NOT TRUE THEN
      UPDATE public.executions SET status = 'failed', errors = jsonb_build_array(jsonb_build_object('erro', 'saldo_insuficiente')) WHERE id = v_exec;
      UPDATE public.prospect_searches SET estado = 'erro', tentativas = 3, execution_id = v_exec,
             mensagem = 'Saldo de créditos insuficiente para a busca. Peça créditos à Althius e peça a busca de novo.', updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;
    UPDATE public.executions SET status = 'running', execution_type = 'Lista', progress = 10, reserved_credits = (v_res->>'reserved_amount')::int,
           title = 'Prospecção: ' || r.titulo
     WHERE id = v_exec;
    UPDATE public.prospect_searches SET estado = 'reservada', tentativas = r.tentativas + 1, execution_id = v_exec,
           reserved_credits = (v_res->>'reserved_amount')::int, mensagem = NULL, updated_at = now()
     WHERE id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'search_id', r.id, 'workspace_id', r.workspace_id, 'titulo', r.titulo, 'parametros', r.parametros, 'max_empresas', r.max_empresas,
      'teto_usd', internal.signal_teto_usd(r.creditos_estimados),
      'fonte', jsonb_build_object('codigo', r.source_code, 'nome', r.fonte_nome, 'ator', r.ator, 'entrada', r.entrada, 'mapeamento', r.mapeamento)));
  END LOOP;
  RETURN v_out;
END;
$$;

-- 9. Entrega: os itens já vêm no formato comum ({chave, nome, site, cnpj, telefone, endereco, cidade, uf, categoria, porte,
--    capital_social, lat, lng, dados}). Repetida (já candidata, já conta pelo site ou pelo CNPJ) não entra nem cobra;
--    fora do filtro do ICP (porte, capital) também não. Cobra por nova, até o máximo pedido; o resto da reserva volta.
CREATE OR REPLACE FUNCTION public.prospect_finish(p_search_id UUID, p_itens JSONB, p_custo_usd NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.prospect_searches;
  f internal.prospect_sources;
  it JSONB;
  v_chave TEXT;
  v_nome TEXT;
  v_dominio TEXT;
  v_cnpj TEXT;
  v_portes TEXT[];
  v_cap_min NUMERIC;
  v_cap_max NUMERIC;
  v_cap NUMERIC;
  v_novas INTEGER := 0;
  v_repetidas INTEGER := 0;
  v_fora INTEGER := 0;
  v_total INTEGER := 0;
  v_cobrar INTEGER;
  v_id UUID;
BEGIN
  SELECT * INTO s FROM public.prospect_searches WHERE id = p_search_id FOR UPDATE;
  IF NOT FOUND OR s.estado <> 'reservada' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF p_custo_usd IS NOT NULL AND p_custo_usd < 0 THEN RAISE EXCEPTION 'Custo inválido.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO f FROM internal.prospect_sources WHERE code = s.source_code;
  v_portes := CASE WHEN s.parametros ? 'porte' THEN string_to_array(s.parametros->>'porte', ',') END;
  v_cap_min := NULLIF(s.parametros->>'capital_min', '')::numeric;
  v_cap_max := NULLIF(s.parametros->>'capital_max', '')::numeric;

  FOR it IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_itens) = 'array' THEN p_itens ELSE '[]'::jsonb END) LOOP
    v_total := v_total + 1;
    CONTINUE WHEN jsonb_typeof(it) <> 'object';
    v_chave := NULLIF(left(btrim(COALESCE(it->>'chave', '')), 200), '');
    v_nome := NULLIF(left(btrim(COALESCE(it->>'nome', '')), 200), '');
    CONTINUE WHEN v_chave IS NULL OR v_nome IS NULL;
    EXIT WHEN v_novas >= s.max_empresas;
    -- Filtro do ICP (a fonte não filtra): sem o dado, não passa.
    IF v_portes IS NOT NULL AND NOT (upper(btrim(COALESCE(it->>'porte', ''))) = ANY (v_portes)) THEN v_fora := v_fora + 1; CONTINUE; END IF;
    IF v_cap_min IS NOT NULL OR v_cap_max IS NOT NULL THEN
      BEGIN v_cap := NULLIF(it->>'capital_social', '')::numeric; EXCEPTION WHEN others THEN v_cap := NULL; END;
      IF v_cap IS NULL OR (v_cap_min IS NOT NULL AND v_cap < v_cap_min) OR (v_cap_max IS NOT NULL AND v_cap > v_cap_max) THEN v_fora := v_fora + 1; CONTINUE; END IF;
    END IF;
    v_dominio := internal.prospeccao_dominio(it->>'site');
    v_cnpj := internal.enrichment_valor('cnpj', it->'cnpj') #>> '{}';
    IF (v_dominio IS NOT NULL AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.workspace_id = s.workspace_id AND public.normalize_domain(a.domain) = v_dominio))
       OR (v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.workspace_id = s.workspace_id AND a.cnpj = v_cnpj))
       OR (v_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.prospect_candidates c WHERE c.workspace_id = s.workspace_id AND c.cnpj = v_cnpj)) THEN
      v_repetidas := v_repetidas + 1;
      CONTINUE;
    END IF;
    v_id := NULL;
    INSERT INTO public.prospect_candidates (workspace_id, search_id, chave, nome, dominio, cnpj, cidade, uf, telefone, endereco, categoria, porte, lat, lng, fonte, dados)
    VALUES (s.workspace_id, s.id, v_chave, v_nome, v_dominio, v_cnpj,
            NULLIF(left(btrim(COALESCE(it->>'cidade', '')), 120), ''),
            internal.enrichment_valor('state_uf', it->'uf') #>> '{}',
            NULLIF(left(btrim(COALESCE(it->>'telefone', '')), 40), ''),
            NULLIF(left(btrim(COALESCE(it->>'endereco', '')), 300), ''),
            NULLIF(left(btrim(COALESCE(it->>'categoria', '')), 120), ''),
            NULLIF(left(upper(btrim(COALESCE(it->>'porte', ''))), 40), ''),
            (internal.enrichment_valor('lat', it->'lat') #>> '{}')::double precision,
            (internal.enrichment_valor('lng', it->'lng') #>> '{}')::double precision,
            COALESCE(f.mapeamento->>'fonte', f.nome),
            CASE WHEN jsonb_typeof(it->'dados') = 'object' AND length((it->'dados')::text) <= 4000 THEN it->'dados' ELSE '{}'::jsonb END)
    ON CONFLICT (workspace_id, chave) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN v_repetidas := v_repetidas + 1; CONTINUE; END IF;
    v_novas := v_novas + 1;
  END LOOP;

  v_cobrar := LEAST(v_novas * f.creditos_por_empresa, s.creditos_estimados);
  PERFORM public.credit_consume(s.workspace_id, s.execution_id, v_cobrar, s.reserved_credits,
    CASE WHEN v_cobrar > 0 THEN 'Prospecção: ' || s.titulo ELSE 'Liberação: prospecção sem empresa nova' END,
    'prosp:' || s.id || ':a' || s.tentativas || ':consume');
  UPDATE public.executions SET status = 'completed', progress = 100, actual_credits = v_cobrar, valid_count = v_novas, processed_count = v_total
   WHERE id = s.execution_id;
  UPDATE public.prospect_searches SET estado = CASE WHEN v_novas > 0 THEN 'concluida' ELSE 'sem_resultado' END, creditos_cobrados = v_cobrar,
         encontradas = v_novas, repetidas = v_repetidas, fora_do_filtro = v_fora, finished_at = now(), updated_at = now()
   WHERE id = s.id;
  INSERT INTO internal.prospect_search_costs (search_id, workspace_id, custo_usd) VALUES (s.id, s.workspace_id, COALESCE(p_custo_usd, 0))
  ON CONFLICT (search_id) DO UPDATE SET custo_usd = internal.prospect_search_costs.custo_usd + EXCLUDED.custo_usd, updated_at = now();
  PERFORM public.audit_write(s.workspace_id, NULL, 'prospeccao_concluida', 'prospect_search', s.id::text,
    jsonb_build_object('novas', v_novas, 'repetidas', v_repetidas, 'fora_do_filtro', v_fora, 'creditos', v_cobrar));
  RETURN jsonb_build_object('acao', 'concluido', 'novas', v_novas, 'repetidas', v_repetidas, 'fora_do_filtro', v_fora, 'creditos', v_cobrar);
END;
$$;

-- 10. Falha: devolve o crédito; tenta de novo mais tarde (prospect_next). Nunca grava candidata.
CREATE OR REPLACE FUNCTION public.prospect_fail(p_search_id UUID, p_mensagem TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.prospect_searches;
  v_msg TEXT := COALESCE(NULLIF(left(btrim(COALESCE(p_mensagem, '')), 300), ''), 'Falha na busca.');
BEGIN
  SELECT * INTO s FROM public.prospect_searches WHERE id = p_search_id FOR UPDATE;
  IF NOT FOUND OR s.estado <> 'reservada' THEN RETURN jsonb_build_object('acao', 'ignorado'); END IF;
  IF s.reserved_credits > 0 THEN
    PERFORM public.credit_consume(s.workspace_id, s.execution_id, 0, s.reserved_credits, 'Liberação: prospecção falhou', 'prosp:' || s.id || ':a' || s.tentativas || ':release');
  END IF;
  UPDATE public.executions SET status = 'failed', progress = 100, errors = errors || jsonb_build_array(jsonb_build_object('erro', v_msg)) WHERE id = s.execution_id;
  UPDATE public.prospect_searches SET estado = 'erro', mensagem = v_msg, reserved_credits = 0, updated_at = now() WHERE id = s.id;
  RETURN jsonb_build_object('acao', 'falhou');
END;
$$;

-- 11. A pessoa decide (tela). Incluir = vira conta pela mesma regra de create_account (site normalizado; site que já é
--     conta só liga), com os dados que a fonte trouxe marcados com a origem (não viram "manuais"). Sem site, não vira
--     conta: a tela pede o site (`p_dominios`: {"id da candidata": "site"}); site digitado por uma pessoa é manual.
CREATE OR REPLACE FUNCTION public.prospect_candidates_decide(p_workspace_id UUID, p_member_id UUID, p_ids UUID[], p_acao TEXT, p_dominios JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  c public.prospect_candidates;
  v_digitado TEXT;
  v_dominio TEXT;
  v_conta UUID;
  v_fontes JSONB;
  v_em TEXT := now()::text;
  v_precisao TEXT;
  v_incluidas INTEGER := 0;
  v_ligadas INTEGER := 0;
  v_sem_site INTEGER := 0;
  v_excluidas INTEGER := 0;
  v_campo TEXT;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT rp.scope INTO v_escopo FROM public.workspace_members wm
    JOIN public.role_permissions rp ON rp.role_id = wm.role AND rp.capability_key = 'prospecting.approve'
   WHERE wm.id = p_member_id AND wm.workspace_id = p_workspace_id AND wm.status = 'active';
  IF v_escopo IS DISTINCT FROM 'all' THEN
    RAISE EXCEPTION 'Só gestores do cliente (C-level ou estrategista) incluem ou excluem candidatas.' USING ERRCODE = '42501';
  END IF;
  IF p_acao IS NULL OR p_acao NOT IN ('incluir', 'excluir') THEN RAISE EXCEPTION 'Ação inválida (incluir ou excluir).' USING ERRCODE = '22023'; END IF;

  FOR c IN SELECT * FROM public.prospect_candidates
            WHERE workspace_id = p_workspace_id AND id = ANY (COALESCE(p_ids, '{}')) AND estado <> 'incluida' FOR UPDATE LOOP
    IF p_acao = 'excluir' THEN
      UPDATE public.prospect_candidates SET estado = 'excluida', decidido_por_member_id = p_member_id, decidido_em = now() WHERE id = c.id;
      v_excluidas := v_excluidas + 1;
      CONTINUE;
    END IF;
    v_digitado := CASE WHEN jsonb_typeof(p_dominios) = 'object' THEN public.normalize_domain(p_dominios->>c.id::text) END;
    v_dominio := COALESCE(v_digitado, c.dominio);
    IF v_dominio IS NULL THEN v_sem_site := v_sem_site + 1; CONTINUE; END IF;
    SELECT a.id INTO v_conta FROM public.accounts a WHERE a.workspace_id = p_workspace_id AND public.normalize_domain(a.domain) = v_dominio LIMIT 1;
    IF FOUND THEN
      UPDATE public.prospect_candidates SET estado = 'incluida', account_id = v_conta, dominio = v_dominio, decidido_por_member_id = p_member_id, decidido_em = now() WHERE id = c.id;
      v_ligadas := v_ligadas + 1;
      CONTINUE;
    END IF;
    v_precisao := CASE WHEN c.lat IS NOT NULL AND c.lng IS NOT NULL THEN
                    (SELECT f.mapeamento->>'precisao' FROM public.prospect_searches s JOIN internal.prospect_sources f ON f.code = s.source_code WHERE s.id = c.search_id) END;
    v_fontes := '{}'::jsonb;
    FOREACH v_campo IN ARRAY ARRAY['cnpj', 'telefone', 'endereco', 'city', 'state_uf', 'lat', 'lng', 'localizacao_precisao', 'domain'] LOOP
      CONTINUE WHEN v_campo = 'domain' AND v_digitado IS NOT NULL;
      CONTINUE WHEN (CASE v_campo WHEN 'cnpj' THEN c.cnpj WHEN 'telefone' THEN c.telefone WHEN 'endereco' THEN c.endereco WHEN 'city' THEN c.cidade
                       WHEN 'state_uf' THEN c.uf WHEN 'lat' THEN c.lat::text WHEN 'lng' THEN c.lng::text WHEN 'localizacao_precisao' THEN v_precisao
                       ELSE v_dominio END) IS NULL;
      v_fontes := v_fontes || jsonb_build_object(v_campo, jsonb_build_object('fonte', c.fonte, 'em', v_em));
    END LOOP;
    -- Dado vindo da fonte não é "manual" (ADR 0062): a marca vale só para esta escrita.
    PERFORM set_config('althius.enriquecimento', 'on', true);
    INSERT INTO public.accounts (workspace_id, name, domain, status, state_uf, city, cnpj, telefone, endereco, lat, lng, localizacao_precisao, fontes, campos_manuais)
    VALUES (p_workspace_id, c.nome, v_dominio, 'ativa', c.uf, c.cidade, c.cnpj, c.telefone, c.endereco, c.lat, c.lng, v_precisao, v_fontes,
            CASE WHEN v_digitado IS NOT NULL THEN ARRAY['name', 'domain'] ELSE ARRAY['name'] END)
    RETURNING id INTO v_conta;
    PERFORM set_config('althius.enriquecimento', 'off', true);
    UPDATE public.prospect_candidates SET estado = 'incluida', account_id = v_conta, dominio = v_dominio, decidido_por_member_id = p_member_id, decidido_em = now() WHERE id = c.id;
    v_incluidas := v_incluidas + 1;
  END LOOP;

  IF v_incluidas + v_ligadas + v_excluidas > 0 THEN
    PERFORM public.audit_write(p_workspace_id, (SELECT user_id FROM public.workspace_members WHERE id = p_member_id), 'prospeccao_candidatas_decididas', 'prospect_candidate', NULL,
      jsonb_build_object('acao', p_acao, 'incluidas', v_incluidas, 'ligadas', v_ligadas, 'excluidas', v_excluidas, 'sem_site', v_sem_site));
  END IF;
  RETURN jsonb_build_object('incluidas', v_incluidas, 'ligadas', v_ligadas, 'sem_site', v_sem_site, 'excluidas', v_excluidas);
END;
$$;

-- 12. Permissões (ADR 0023). Porta do agente: só com o token (ADR 0024). Fila: só o serviço. Decisão: tela.
REVOKE ALL ON FUNCTION public.agent_prospect_sources(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_prospect_estimate(TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_prospect_run(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_prospect_searches(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_prospect_sources(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_prospect_estimate(TEXT, TEXT, JSONB, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_prospect_run(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_prospect_searches(TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prospect_next(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prospect_finish(UUID, JSONB, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prospect_fail(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prospect_next(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.prospect_finish(UUID, JSONB, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.prospect_fail(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.prospect_candidates_decide(UUID, UUID, UUID[], TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_candidates_decide(UUID, UUID, UUID[], TEXT, JSONB) TO authenticated, service_role;
