-- ==============================================================================
-- Migration: 20261002000083_my_account.sql
-- Configurações → Minha conta e Notificações gravam de verdade: cargo, telefone e preferências
-- no perfil da pessoa; foto no depósito "avatars" (cada pessoa só grava na própria pasta).
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferences_objeto CHECK (jsonb_typeof(preferences) = 'object'),
  ADD CONSTRAINT profiles_job_title_tamanho CHECK (job_title IS NULL OR length(job_title) <= 120),
  ADD CONSTRAINT profiles_phone_tamanho CHECK (phone IS NULL OR length(phone) <= 40);

COMMENT ON COLUMN public.profiles.preferences IS 'Preferências da pessoa (Configurações → Notificações), ex.: {"notif": true, "som": false}.';

GRANT UPDATE (job_title, phone, preferences) ON public.profiles TO authenticated;

-- Depósito de fotos de perfil. Público para leitura (a foto aparece para o time); escrita só na pasta <id da pessoa>/.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Pessoa grava a própria foto" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Pessoa troca a própria foto" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Pessoa apaga a própria foto" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Fotos de perfil são lidas pelo time" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
