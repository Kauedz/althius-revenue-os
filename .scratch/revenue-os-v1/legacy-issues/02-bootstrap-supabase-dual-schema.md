# 02: Bootstrap do Supabase e Separação dos Schemas public e internal

**What to build:**
Ambiente de banco de dados relacional PostgreSQL inicializado com dois schemas isolados: `public` (exposto à API REST/PostgREST para a aplicação frontend) e `internal` (estritamente privado para credenciais de upstream, chaves mestras e custos reais em dólar).

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Instância e configuração local do Supabase/PostgreSQL configurada e versionada em `supabase/config.toml`.
- [x] Schema `internal` criado via migration `20261002000001_bootstrap_schemas.sql` e expressamente omitido da configuração `api.schemas`.
- [x] REVOKE total de permissões de `public`, `anon` e `authenticated` no schema `internal` implementado na migration.
- [x] O schema `public` está configurado para acesso via PostgREST com RLS compulsório.
- [x] Testes de segurança em pgTAP criados em `supabase/tests/database/00001_dual_schema_isolation.sql`.
