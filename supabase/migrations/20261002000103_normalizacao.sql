-- ==============================================================================
-- Migration: 20261002000103_normalizacao.sql
-- PR 09: normalização de domínio e e-mail no banco e deduplicação na importação de contas.
-- Implementação PRÓPRIA em SQL (o Twenty só tem a versão em TypeScript); o comportamento segue o que a ADR e os testes pedem:
--   www. e sem www., maiúsculas, http e https, porta, caminho, usuário na URL, ponto final, e-mail com nome.
-- Diferença consciente em relação ao TypeScript: o banco guarda o domínio com acento como está (não converte para punycode).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_valid_domain(p TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p IS NOT NULL AND length(p) BETWEEN 4 AND 253
     AND p ~ '^([a-z0-9¡-￿]([a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?\.)+([a-z¡-￿]{2,63}|xn--[a-z0-9-]{1,59})$';
$$;

CREATE OR REPLACE FUNCTION public.normalize_domain(p TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v TEXT := lower(btrim(COALESCE(p, '')));
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  v := replace(v, '\', '/');
  v := regexp_replace(v, '^([a-z][a-z0-9+.-]*:)?//', '');                 -- protocolo (ou "//")
  v := split_part(split_part(split_part(v, '/', 1), '?', 1), '#', 1);      -- sem caminho, consulta e âncora
  IF position('@' IN v) > 0 THEN v := substring(v FROM '[^@]*$'); END IF;   -- sem usuário:senha@ (e e-mail vira domínio)
  v := regexp_replace(v, ':[0-9]*$', '');                                  -- sem porta
  v := regexp_replace(v, '\.+$', '');                                      -- sem ponto final
  WHILE v LIKE 'www.%' LOOP v := substr(v, 5); END LOOP;                   -- sem www. (um ou vários)
  RETURN CASE WHEN public.is_valid_domain(v) THEN v ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_email(p TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v TEXT := btrim(COALESCE(p, ''));
  m TEXT[];
BEGIN
  IF v = '' THEN RETURN NULL; END IF;
  m := regexp_match(v, '<([^<>]*)>\s*$');                                  -- "Nome <e-mail>"
  IF m IS NOT NULL THEN v := m[1]; END IF;
  v := regexp_replace(v, '^mailto:', '', 'i');
  v := lower(btrim(btrim(v), '" '));
  IF length(v) <= 254 AND v ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]{1,64}@[^@]+$' AND public.is_valid_domain(split_part(v, '@', 2)) THEN
    RETURN v;
  END IF;
  RETURN NULL;
END;
$$;

-- Todos os e-mails de um texto ("Nome <a@x.com>, b@y.com; ..."), normalizados, sem repetir, na ordem em que aparecem.
CREATE OR REPLACE FUNCTION public.parse_email_list(p TEXT)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(array_agg(e ORDER BY primeira), ARRAY[]::TEXT[])
    FROM (
      SELECT e, min(ord) AS primeira
        FROM (
          SELECT public.normalize_email(m[1]) AS e, ord
            FROM regexp_matches(regexp_replace(COALESCE(p, ''), '"[^"]*"', ' ', 'g'),
                                '([A-Za-z0-9._%+''!#$&*/=?^`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g') WITH ORDINALITY AS t(m, ord)
        ) a
       WHERE e IS NOT NULL
       GROUP BY e
    ) b;
$$;

-- O canal de e-mail passa a entender "Nome <e-mail>". Valor que não é e-mail mantém o comportamento antigo (nunca vira nulo).
CREATE OR REPLACE FUNCTION public.normalize_channel_value(p_type TEXT, p_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_type = 'email' THEN
    RETURN COALESCE(public.normalize_email(p_value), lower(trim(p_value)));
  ELSIF p_type IN ('phone', 'whatsapp') THEN
    RETURN regexp_replace(p_value, '[^0-9]', '', 'g');
  ELSIF p_type = 'instagram' THEN
    RETURN lower(regexp_replace(trim(p_value), '^@', ''));
  ELSIF p_type = 'linkedin' THEN
    RETURN lower(trim(regexp_replace(p_value, '^https?:\/\/(www\.)?linkedin\.com\/in\/', '')));
  ELSE
    RETURN lower(trim(p_value));
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Logo pelo site: usa o domínio normalizado; site inválido não gera endereço.
CREATE OR REPLACE FUNCTION public.fetch_domain_logo(p_domain TEXT)
RETURNS TEXT AS $$
DECLARE
  v_dominio TEXT := public.normalize_domain(p_domain);
BEGIN
  IF v_dominio IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN format('https://img.logo.dev/%s?token=pk_anonymous&size=128', v_dominio);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Criar, editar e importar contas passam pelo mesmo normalizador (corpo igual ao da 0062, só a normalização do domínio muda).
CREATE OR REPLACE FUNCTION public.create_account(
  p_workspace_id UUID, p_member_id UUID, p_name TEXT, p_domain TEXT, p_state_uf TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL,
  p_temperature INT DEFAULT 1, p_owner_member_id UUID DEFAULT NULL
)
RETURNS public.accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE
  v_role TEXT;
  v_nova public.accounts;
  v_dominio TEXT := public.normalize_domain(p_domain);
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence a este workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('superadmin', 'estrategista', 'clevel') THEN
    RAISE EXCEPTION 'Apenas gestores podem criar novas contas.' USING ERRCODE = '42501';
  END IF;
  IF v_dominio IS NULL THEN
    RAISE EXCEPTION 'Domínio inválido: informe só o site da empresa, como empresa.com.br.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.accounts (workspace_id, name, domain, state_uf, city, temperature, owner_member_id)
  VALUES (p_workspace_id, p_name, v_dominio, p_state_uf, p_city, COALESCE(p_temperature, 1), p_owner_member_id)
  RETURNING * INTO v_nova;
  RETURN v_nova;
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_account(
  p_account_id UUID, p_member_id UUID, p_name TEXT, p_domain TEXT, p_state_uf TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL,
  p_temperature INT DEFAULT 1, p_owner_member_id UUID DEFAULT NULL
)
RETURNS public.accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE
  v_acc public.accounts;
  v_role TEXT;
  v_atualizada public.accounts;
  v_dominio TEXT := public.normalize_domain(p_domain);
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id;
  IF v_acc IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = v_acc.workspace_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence ao workspace da conta.' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'bdr' AND (v_acc.owner_member_id IS NULL OR v_acc.owner_member_id <> p_member_id) THEN
    RAISE EXCEPTION 'BDR só pode editar as contas em que é o responsável.' USING ERRCODE = '42501';
  END IF;
  IF p_domain IS NOT NULL AND btrim(p_domain) <> '' AND v_dominio IS NULL THEN
    RAISE EXCEPTION 'Domínio inválido: informe só o site da empresa, como empresa.com.br.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.accounts
  SET name = COALESCE(p_name, name),
      domain = COALESCE(v_dominio, domain),
      state_uf = COALESCE(p_state_uf, state_uf),
      city = COALESCE(p_city, city),
      temperature = COALESCE(p_temperature, temperature),
      owner_member_id = CASE WHEN v_role = 'bdr' THEN owner_member_id ELSE p_owner_member_id END,
      updated_at = now()
  WHERE id = p_account_id
  RETURNING * INTO v_atualizada;
  RETURN v_atualizada;
END;
$func$;

CREATE OR REPLACE FUNCTION public.import_accounts(p_workspace_id UUID, p_member_id UUID, p_contas JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE
  v_role TEXT;
  v_elem JSONB;
  v_domain TEXT;
  v_name TEXT;
  v_uf TEXT;
  v_city TEXT;
  v_orig_id UUID;
  v_total INT := 0;
  v_criadas INT := 0;
  v_duplicadas INT := 0;
  v_invalidas INT := 0;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT role INTO v_role FROM public.workspace_members WHERE id = p_member_id AND workspace_id = p_workspace_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence a este workspace.' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'bdr' THEN
    RAISE EXCEPTION 'BDR não tem permissão para importar lista de contas.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_contas) <> 'array' THEN
    RAISE EXCEPTION 'O parâmetro p_contas deve ser um array JSON.' USING ERRCODE = '22023';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_contas)
  LOOP
    v_total := v_total + 1;
    v_name := trim(COALESCE(v_elem->>'name', ''));
    v_domain := public.normalize_domain(v_elem->>'domain');
    v_uf := trim(COALESCE(v_elem->>'state_uf', ''));
    v_city := trim(COALESCE(v_elem->>'city', ''));

    -- Sem site ou com site que não é domínio: não entra, e a tela fica sabendo quantas foram.
    IF v_domain IS NULL THEN
      v_invalidas := v_invalidas + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_orig_id FROM public.accounts
     WHERE workspace_id = p_workspace_id AND domain = v_domain AND is_duplicate = FALSE LIMIT 1;

    IF v_orig_id IS NOT NULL THEN
      -- Importação marca duplicidade, NUNCA apaga nem sobrescreve
      INSERT INTO public.accounts (workspace_id, name, domain, state_uf, city, is_duplicate, duplicate_of_id)
      VALUES (p_workspace_id, v_name, v_domain, v_uf, v_city, TRUE, v_orig_id);
      v_duplicadas := v_duplicadas + 1;
    ELSE
      INSERT INTO public.accounts (workspace_id, name, domain, state_uf, city, is_duplicate)
      VALUES (p_workspace_id, v_name, v_domain, v_uf, v_city, FALSE);
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('total', v_total, 'criadas', v_criadas, 'duplicadas', v_duplicadas, 'invalidas', v_invalidas);
END;
$func$;

NOTIFY pgrst, 'reload schema';
