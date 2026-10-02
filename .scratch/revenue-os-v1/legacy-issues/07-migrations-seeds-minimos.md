# 07: Estrutura de Migrations Versionadas e Seeds Mínimos de Teste

**What to build:**
Automação de ciclo de vida do banco com Supabase CLI: estrutura de migrações versionadas e script determinístico de seeds com 2 workspaces, 4 usuários representativos (superadmin, estrategista, admin e BDR) e configurações de teste para viabilizar desenvolvimento local e CI.

**Blocked by:** 06: Políticas RLS Base por Tabela no Schema public

**Status:** completed

- [x] Diretório `supabase/migrations/` organizado com migrations 01 a 05 numeradas e ordenadas.
- [x] Script `supabase/seed.sql` contendo 2 workspaces ("Empresa Alfa" e "Empresa Beta"), 4 perfis de teste e multiplicadores de precificação em `internal`.
- [x] Estrutura pronta para execução determinística local e CI.
