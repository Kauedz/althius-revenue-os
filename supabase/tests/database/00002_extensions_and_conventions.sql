-- ==============================================================================
-- Test: 00002_extensions_and_conventions.sql
-- Verifies Ticket 03 - Postgres extensions and updated_at trigger
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Verify extensions
SELECT has_extension('uuid-ossp', 'Extensão uuid-ossp deve estar instalada');
SELECT has_extension('pgcrypto', 'Extensão pgcrypto deve estar instalada');

-- 2. Verify trigger function existence
SELECT has_function('public', 'handle_updated_at', 'Função trigger public.handle_updated_at deve existir');

-- 3. Test functional behavior of handle_updated_at
CREATE TABLE public._test_trigger_probe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_probe_updated_at
  BEFORE UPDATE ON public._test_trigger_probe
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public._test_trigger_probe (id, title, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Initial', '2020-01-01 00:00:00+00');

UPDATE public._test_trigger_probe 
SET title = 'Updated' 
WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT isnt(
  (SELECT updated_at FROM public._test_trigger_probe WHERE id = '00000000-0000-0000-0000-000000000001'),
  '2020-01-01 00:00:00+00'::timestamptz,
  'updated_at deve avançar automaticamente após UPDATE'
);

SELECT * FROM finish();
ROLLBACK;