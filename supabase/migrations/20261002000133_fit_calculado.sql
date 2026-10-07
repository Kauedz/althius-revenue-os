-- ==============================================================================
-- Migration: 20261002000133_fit_calculado.sql
-- Fit calculado de verdade (spec .scratch/prospeccao-revenue, fatia 4; ADR 0067). Até aqui `accounts.fit` era um número
-- fixo do seed. Agora o banco calcula, sem IA, sem API e sem crédito, de 0 a 100, em três partes:
--   1. Aderência ao ICP (até 60): só os critérios que o ICP do cliente define, com o mesmo peso cada:
--      setor (CNAE da conta na lista de CNAEs, ou o segmento/CNAE da conta citando um dos setores), porte (Receita) e
--      região (estado e, se houver, cidade). Sem o dado na conta, o critério não pontua ("sem dado"). Sem ICP, 0.
--   2. Sinais recentes (até 25): sinais dos últimos 30 dias (1 = 10, 2 = 18, 3 ou mais = 25).
--   3. Dados completos (até 15): site 2, CNPJ 5, endereço ou cidade 3, telefone 2, pelo menos uma pessoa mapeada 3.
-- `accounts.fit_partes` guarda o "por que esta nota". Recalcula quando a conta muda, quando chega ou sai sinal, quando
-- entra ou sai pessoa e quando o ICP do cliente muda. O fit não se escreve à mão.
-- ==============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS fit_partes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fit_calculado_em TIMESTAMPTZ;
COMMENT ON COLUMN public.accounts.fit IS 'Fit de 0 a 100, calculado pelo banco (ADR 0067): ICP até 60, sinais recentes até 25, dados completos até 15.';
COMMENT ON COLUMN public.accounts.fit_partes IS 'Por que esta nota: [{parte, pontos, max, motivo}] (ICP, sinais, dados).';

-- CNAE da conta só com os 7 dígitos ("8630504 - Atividade..." → 8630504; código sem o zero da frente ganha o zero).
CREATE OR REPLACE FUNCTION internal.fit_cnae(p_cnae TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN m IS NULL THEN NULL ELSE lpad(m, 7, '0') END
    FROM (SELECT (regexp_match(COALESCE(p_cnae, ''), '^\s*([0-9]{6,7})'))[1] AS m) x;
$$;
REVOKE ALL ON FUNCTION internal.fit_cnae(TEXT) FROM PUBLIC, anon, authenticated;

-- Porte da Receita nos três valores do ICP.
CREATE OR REPLACE FUNCTION internal.fit_porte(p_porte TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p IS NULL OR p = '' THEN NULL
    WHEN p LIKE 'MICRO%' OR p IN ('ME', '01', '1') THEN 'MICRO'
    WHEN p LIKE '%PEQUENO PORTE%' OR p IN ('EPP', '03', '3') THEN 'EPP'
    WHEN p LIKE 'DEMAIS%' OR p IN ('05', '5') THEN 'DEMAIS'
    ELSE p END
    FROM (SELECT upper(btrim(COALESCE(p_porte, ''))) AS p) x;
$$;
REVOKE ALL ON FUNCTION internal.fit_porte(TEXT) FROM PUBLIC, anon, authenticated;

-- A nota e as partes de uma conta (a linha pode ainda não estar gravada: vem do gatilho).
CREATE OR REPLACE FUNCTION internal.fit_da_conta(a public.accounts)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_icp JSONB := COALESCE((SELECT s.icp FROM public.workspace_settings s WHERE s.workspace_id = a.workspace_id), '{}'::jsonb);
  v_criterios INTEGER := 0;
  v_bateu INTEGER := 0;
  v_notas TEXT[] := '{}';
  v_icp_pontos INTEGER := 0;
  v_cnae TEXT := internal.fit_cnae(a.cnae);
  v_porte TEXT := internal.fit_porte(a.porte);
  v_texto TEXT := lower(COALESCE(a.segment, '') || ' ' || COALESCE(a.cnae, ''));
  v_ok BOOLEAN;
  v_sinais INTEGER;
  v_sinais_pontos INTEGER;
  v_dados INTEGER := 0;
  v_faltam TEXT[] := '{}';
  v_pessoas BOOLEAN;
BEGIN
  -- 1. ICP
  IF jsonb_typeof(v_icp->'cnaes') = 'array' OR jsonb_typeof(v_icp->'setores') = 'array' THEN
    v_criterios := v_criterios + 1;
    v_ok := (v_cnae IS NOT NULL AND v_icp->'cnaes' ? v_cnae)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_icp->'setores', '[]'::jsonb)) s WHERE btrim(v_texto) <> '' AND v_texto LIKE '%' || lower(s) || '%');
    IF v_ok THEN v_bateu := v_bateu + 1; v_notas := v_notas || 'setor sim'::text;
    ELSIF v_cnae IS NULL AND btrim(COALESCE(a.segment, '')) = '' THEN v_notas := v_notas || 'setor sem dado'::text;
    ELSE v_notas := v_notas || 'setor fora'::text; END IF;
  END IF;
  IF jsonb_typeof(v_icp->'portes') = 'array' THEN
    v_criterios := v_criterios + 1;
    IF v_porte IS NULL THEN v_notas := v_notas || 'porte sem dado'::text;
    ELSIF v_icp->'portes' ? v_porte THEN v_bateu := v_bateu + 1; v_notas := v_notas || 'porte sim'::text;
    ELSE v_notas := v_notas || 'porte fora'::text; END IF;
  END IF;
  IF jsonb_typeof(v_icp->'ufs') = 'array' OR jsonb_typeof(v_icp->'cidades') = 'array' THEN
    v_criterios := v_criterios + 1;
    IF a.state_uf IS NULL AND a.city IS NULL THEN v_notas := v_notas || 'região sem dado'::text;
    ELSIF (NOT (v_icp ? 'ufs') OR v_icp->'ufs' ? upper(COALESCE(a.state_uf, '')))
      AND (NOT (v_icp ? 'cidades') OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_icp->'cidades') c WHERE lower(btrim(c)) = lower(btrim(COALESCE(a.city, ''))))) THEN
      v_bateu := v_bateu + 1; v_notas := v_notas || 'região sim'::text;
    ELSE v_notas := v_notas || 'região fora'::text; END IF;
  END IF;
  IF v_criterios > 0 THEN v_icp_pontos := round(60.0 * v_bateu / v_criterios); END IF;

  -- 2. Sinais dos últimos 30 dias
  SELECT count(*) INTO v_sinais FROM public.signal_events e WHERE e.account_id = a.id AND e.detected_at > now() - interval '30 days';
  v_sinais_pontos := CASE WHEN v_sinais >= 3 THEN 25 WHEN v_sinais = 2 THEN 18 WHEN v_sinais = 1 THEN 10 ELSE 0 END;

  -- 3. Dados completos
  IF btrim(COALESCE(a.domain, '')) <> '' THEN v_dados := v_dados + 2; ELSE v_faltam := v_faltam || 'site'::text; END IF;
  IF a.cnpj IS NOT NULL THEN v_dados := v_dados + 5; ELSE v_faltam := v_faltam || 'CNPJ'::text; END IF;
  IF btrim(COALESCE(a.endereco, '')) <> '' OR btrim(COALESCE(a.city, '')) <> '' THEN v_dados := v_dados + 3; ELSE v_faltam := v_faltam || 'endereço'::text; END IF;
  IF btrim(COALESCE(a.telefone, '')) <> '' THEN v_dados := v_dados + 2; ELSE v_faltam := v_faltam || 'telefone'::text; END IF;
  v_pessoas := EXISTS (SELECT 1 FROM public.contacts c WHERE c.account_id = a.id);
  IF v_pessoas THEN v_dados := v_dados + 3; ELSE v_faltam := v_faltam || 'pessoas'::text; END IF;

  RETURN jsonb_build_object('nota', LEAST(100, v_icp_pontos + v_sinais_pontos + v_dados), 'partes', jsonb_build_array(
    jsonb_build_object('parte', 'ICP', 'pontos', v_icp_pontos, 'max', 60,
      'motivo', CASE WHEN v_criterios = 0 THEN 'ICP não definido (tela Estratégia)' ELSE array_to_string(v_notas, ', ') END),
    jsonb_build_object('parte', 'Sinais', 'pontos', v_sinais_pontos, 'max', 25,
      'motivo', CASE WHEN v_sinais = 0 THEN 'nenhum sinal nos últimos 30 dias' WHEN v_sinais = 1 THEN '1 sinal nos últimos 30 dias'
                     ELSE v_sinais || ' sinais nos últimos 30 dias' END),
    jsonb_build_object('parte', 'Dados', 'pontos', v_dados, 'max', 15,
      'motivo', CASE WHEN cardinality(v_faltam) = 0 THEN 'completos' ELSE 'falta ' || array_to_string(v_faltam, ', ') END)));
END;
$$;
REVOKE ALL ON FUNCTION internal.fit_da_conta(public.accounts) FROM PUBLIC, anon, authenticated;

-- Toda gravação da conta recalcula (inclusive quem tentar escrever o fit à mão).
CREATE OR REPLACE FUNCTION internal.accounts_calcula_fit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v JSONB := internal.fit_da_conta(NEW);
BEGIN
  NEW.fit := (v->>'nota')::int;
  NEW.fit_partes := v->'partes';
  NEW.fit_calculado_em := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.accounts_calcula_fit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS accounts_calcula_fit ON public.accounts;
CREATE TRIGGER accounts_calcula_fit BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION internal.accounts_calcula_fit();

-- Sinais e pessoas: "toca" a conta para recalcular.
CREATE OR REPLACE FUNCTION internal.fit_tocar_conta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN UPDATE public.accounts SET fit_calculado_em = now() WHERE id = NEW.account_id; END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.account_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN NEW.account_id END) THEN
    UPDATE public.accounts SET fit_calculado_em = now() WHERE id = OLD.account_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION internal.fit_tocar_conta() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS signal_events_fit ON public.signal_events;
CREATE TRIGGER signal_events_fit AFTER INSERT OR DELETE ON public.signal_events
  FOR EACH ROW EXECUTE FUNCTION internal.fit_tocar_conta();
DROP TRIGGER IF EXISTS contacts_fit ON public.contacts;
CREATE TRIGGER contacts_fit AFTER INSERT OR DELETE OR UPDATE OF account_id ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION internal.fit_tocar_conta();

-- ICP mudou: recalcula todas as contas daquele cliente (só dele).
CREATE OR REPLACE FUNCTION internal.fit_icp_mudou()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.icp IS DISTINCT FROM OLD.icp THEN
    UPDATE public.accounts SET fit_calculado_em = now() WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION internal.fit_icp_mudou() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workspace_settings_fit ON public.workspace_settings;
CREATE TRIGGER workspace_settings_fit AFTER UPDATE OF icp ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION internal.fit_icp_mudou();

-- As contas que já existem passam a ter a nota calculada.
UPDATE public.accounts SET fit_calculado_em = now();
