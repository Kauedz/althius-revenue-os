-- ==============================================================================
-- Migration: 20261002000062_accounts_mutation.sql
-- Mutação de contas e importação com regra de duplicidade (ADR 0037).
-- ==============================================================================

-- 1. Colunas de duplicidade em public.accounts e índice canônico
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Remove constraint estrita global para permitir marcar duplicadas na importação (nunca apaga)
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS uq_workspace_account_domain;

-- Garante que no mesmo workspace só existe UMA conta canônica ativa com o mesmo domínio
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_account_domain_canonical
  ON public.accounts (workspace_id, domain)
  WHERE is_duplicate = FALSE;

CREATE INDEX IF NOT EXISTS idx_accounts_workspace_domain
  ON public.accounts (workspace_id, domain);

-- 2. Função RPC para criar conta
CREATE OR REPLACE FUNCTION public.create_account(
  p_workspace_id UUID,
  p_member_id UUID,
  p_name TEXT,
  p_domain TEXT,
  p_state_uf TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_temperature INT DEFAULT 1,
  p_owner_member_id UUID DEFAULT NULL
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_role TEXT;
  v_nova public.accounts;
BEGIN
  -- ADR 0023: validação do membro chamador
  PERFORM public.assert_caller_is_member(p_member_id);

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE id = p_member_id AND workspace_id = p_workspace_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence a este workspace.' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('superadmin', 'estrategista', 'clevel') THEN
    RAISE EXCEPTION 'Apenas gestores podem criar novas contas.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.accounts (
    workspace_id, name, domain, state_uf, city, temperature, owner_member_id
  ) VALUES (
    p_workspace_id,
    p_name,
    lower(trim(p_domain)),
    p_state_uf,
    p_city,
    COALESCE(p_temperature, 1),
    p_owner_member_id
  )
  RETURNING * INTO v_nova;

  RETURN v_nova;
END;
$func$;

-- 3. Função RPC para editar conta respeitando accounts.edit (BDR só edita a sua)
CREATE OR REPLACE FUNCTION public.update_account(
  p_account_id UUID,
  p_member_id UUID,
  p_name TEXT,
  p_domain TEXT,
  p_state_uf TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_temperature INT DEFAULT 1,
  p_owner_member_id UUID DEFAULT NULL
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_acc public.accounts;
  v_role TEXT;
  v_atualizada public.accounts;
BEGIN
  -- ADR 0023: validação do membro chamador
  PERFORM public.assert_caller_is_member(p_member_id);

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id;
  IF v_acc IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE id = p_member_id AND workspace_id = v_acc.workspace_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence ao workspace da conta.' USING ERRCODE = '42501';
  END IF;

  -- Regra accounts.edit: BDR tem escopo 'own'
  IF v_role = 'bdr' AND (v_acc.owner_member_id IS NULL OR v_acc.owner_member_id <> p_member_id) THEN
    RAISE EXCEPTION 'BDR só pode editar as contas em que é o responsável.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.accounts
  SET name = COALESCE(p_name, name),
      domain = COALESCE(lower(trim(p_domain)), domain),
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

-- 4. Função RPC para importar lista de contas (duplicidade marcada, nunca apaga)
CREATE OR REPLACE FUNCTION public.import_accounts(
  p_workspace_id UUID,
  p_member_id UUID,
  p_contas JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
BEGIN
  -- ADR 0023: validação do membro chamador
  PERFORM public.assert_caller_is_member(p_member_id);

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE id = p_member_id AND workspace_id = p_workspace_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro não pertence a este workspace.' USING ERRCODE = '42501';
  END IF;

  -- accounts.import: BDR tem escopo 'none'
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
    v_domain := lower(trim(COALESCE(v_elem->>'domain', '')));
    v_uf := trim(COALESCE(v_elem->>'state_uf', ''));
    v_city := trim(COALESCE(v_elem->>'city', ''));

    IF v_domain = '' THEN
      CONTINUE;
    END IF;

    -- Localiza se já existe conta canônica ativa com esse domínio no workspace
    SELECT id INTO v_orig_id
    FROM public.accounts
    WHERE workspace_id = p_workspace_id
      AND domain = v_domain
      AND is_duplicate = FALSE
    LIMIT 1;

    IF v_orig_id IS NOT NULL THEN
      -- Importação marca duplicidade, NUNCA apaga nem sobrescreve
      INSERT INTO public.accounts (
        workspace_id, name, domain, state_uf, city, is_duplicate, duplicate_of_id
      ) VALUES (
        p_workspace_id, v_name, v_domain, v_uf, v_city, TRUE, v_orig_id
      );
      v_duplicadas := v_duplicadas + 1;
    ELSE
      INSERT INTO public.accounts (
        workspace_id, name, domain, state_uf, city, is_duplicate
      ) VALUES (
        p_workspace_id, v_name, v_domain, v_uf, v_city, FALSE
      );
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'criadas', v_criadas,
    'duplicadas', v_duplicadas
  );
END;
$func$;

-- 5. Privilégios restritos (ADR 0023)
REVOKE ALL ON FUNCTION public.create_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.create_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.update_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.update_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.import_accounts(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_accounts(UUID, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.import_accounts(UUID, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.import_accounts(UUID, UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';