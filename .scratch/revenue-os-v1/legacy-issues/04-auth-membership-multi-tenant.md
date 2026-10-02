# 04: Autenticação e Membership Multi-Tenant por Workspace

**What to build:**
Estrutura de dados e relacionamento multi-tenant que conecta os usuários autenticados (`auth.users`) aos workspaces da organização através da tabela `workspace_members`, permitindo que um mesmo usuário pertença a múltiplos workspaces com papéis e status independentes.

**Blocked by:** 03: Extensões, Conventions e Triggers de Auditoria no Postgres

**Status:** completed

- [x] Criação da tabela `public.workspaces` com campos `id`, `name`, `slug`, `status` e `settings_json`.
- [x] Criação da tabela `public.workspace_members` com vínculo entre `user_id` e `workspace_id`, com chave composta única `(workspace_id, user_id)` e campo `role`.
- [x] Um usuário convidado para múltiplos workspaces consegue ter papel de `client_admin` em um e `bdr` em outro sem conflito de permissões.
- [x] Teste pgTAP em `supabase/tests/database/00003_workspaces_and_members.sql` validando inserção, multi-tenancy e integridade referencial.
