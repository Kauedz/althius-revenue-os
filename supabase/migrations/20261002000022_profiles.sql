-- ==============================================================================
-- Migration: 20261002000022_profiles.sql
-- Perfil de cada pessoa (nome, e-mail, foto) espelhado do login (auth.users).
-- O app precisa disso para mostrar o usuário logado e os membros do workspace.
-- Visibilidade: a própria pessoa, quem divide algum workspace com ela e o superadmin.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Identidade visível da pessoa (nome, e-mail, foto), espelhada de auth.users.';

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Cria ou atualiza o perfil sempre que um login é criado ou muda de e-mail/nome
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_profile
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_profile();

-- Perfis de logins já existentes
INSERT INTO public.profiles (id, name, email)
SELECT u.id, COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(COALESCE(u.email, ''), '@', 1)), COALESCE(u.email, '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pessoa vê o próprio perfil, de quem divide workspace e superadmin vê todos"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members outro
      JOIN public.current_workspace_member() eu ON eu.workspace_id = outro.workspace_id
      WHERE outro.user_id = public.profiles.id
    )
  );

CREATE POLICY "Pessoa edita o próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- O default do schema dá UPDATE em todas as colunas; o e-mail só muda pelo login (auth.users).
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (name, avatar_url) ON public.profiles TO authenticated;
