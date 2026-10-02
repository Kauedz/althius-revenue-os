-- ==============================================================================
-- Migration: 20261002000002_extensions_and_conventions.sql
-- Ticket 03: Extensões, Conventions e Triggers de Auditoria no Postgres
-- ==============================================================================

-- 1. Enable required extensions in extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. Trigger function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS 
  'Trigger transversal para atualizar automaticamente a coluna updated_at com o timestamp UTC corrente.';
