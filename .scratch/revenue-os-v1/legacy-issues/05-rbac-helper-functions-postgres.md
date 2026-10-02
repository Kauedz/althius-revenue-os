# 05: Helper Functions de Resolução de Papel e RBAC no Postgres

**What to build:**
Funções SQL de alta performance no Postgres (`SECURITY DEFINER` e `STABLE`) para resolver os workspaces acessíveis e o papel operacional do usuário conectado em tempo de execução via `auth.uid()`.

**Blocked by:** 04: Autenticação e Membership Multi-Tenant por Workspace

**Status:** completed

- [x] Criação da função `public.current_workspace_member()` que retorna `(workspace_id, role)` para o `auth.uid()` da sessão atual.
- [x] Criação da função `public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])` para validação rápida em queries de RLS.
- [x] Usuários com status inativo (`status != 'active'`) são desconsiderados pela função de resolução de acesso.
- [x] Teste pgTAP em `supabase/tests/database/00004_rbac_helper_functions.sql` validando resolução dinâmica de papel e rejeição de membro suspenso.
