-- ==============================================================================
-- Migration: 20261002000024_fix_settings_own_scope.sql
-- "Minha conta, notificações e aparência" (settings.own) é "Sim" para os 4 papéis
-- no documento de papéis e no front v18; o seed da 0008 gravou "Só o seu" (own).
-- Verificado por src/app/matriz.test.ts (matriz do banco x matriz do front).
-- ==============================================================================

UPDATE public.role_permissions
SET scope = 'all'
WHERE capability_key = 'settings.own' AND scope = 'own';
