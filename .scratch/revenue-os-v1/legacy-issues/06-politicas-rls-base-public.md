# 06: Políticas RLS Base por Tabela no Schema public

**What to build:**
Habilitação obrigatória de Row Level Security (RLS) e aplicação de políticas de isolamento por `workspace_id` em todas as tabelas operacionais expostas pelo schema `public`, garantindo que um usuário autenticado nunca visualize ou altere dados de outro tenant.

**Blocked by:** 05: Helper Functions de Resolução de Papel e RBAC no Postgres

**Status:** completed

- [x] Todas as tabelas operacionais em `public` possuem RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- [x] Criação de política genérica de leitura `tenant_isolation_select` baseada na função `current_workspace_member()`.
- [x] Criação de políticas de escrita restritas por papel (atualização de workspace e membros restrita a administradores).
- [x] Teste pgTAP em `supabase/tests/database/00005_base_rls_policies.sql` comprovando isolamento cross-tenant e rejeição de update por BDR.
