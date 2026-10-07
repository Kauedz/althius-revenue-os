-- ==============================================================================
-- Migration: 20261002000139_chamas_pelo_fit.sql
-- ADR 0069. As chamas da conta (a "temperatura" que a tela mostra) passam a sair da NOTA DE FIT, que já soma o perfil do ICP
-- (até 60), os sinais recentes (até 25) e os dados completos (até 15). Assim a chama e a nota nunca discordam:
--   fit de 70 a 100 = 3 chamas (Muito quente) · de 45 a 69 = 2 chamas (Quente) · até 44 = 1 chama (Aquecendo).
-- Não existe "fria": toda conta do cliente é uma empresa que vale a conversa; a menor chama é "Aquecendo".
-- Quem grava a conta não escolhe a chama: o banco recalcula junto com o fit (como já fazia com a nota).
-- ==============================================================================

CREATE OR REPLACE FUNCTION internal.chamas_do_fit(p_fit INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN COALESCE(p_fit, 0) >= 70 THEN 3 WHEN COALESCE(p_fit, 0) >= 45 THEN 2 ELSE 1 END;
$$;
REVOKE ALL ON FUNCTION internal.chamas_do_fit(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.accounts_calcula_fit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v JSONB := internal.fit_da_conta(NEW);
BEGIN
  NEW.fit := (v->>'nota')::int;
  NEW.fit_partes := v->'partes';
  NEW.fit_calculado_em := now();
  NEW.temperature := internal.chamas_do_fit(NEW.fit);
  RETURN NEW;
END;
$$;

-- As contas que já existem passam a ter a chama pela nota.
UPDATE public.accounts SET fit_calculado_em = now();
