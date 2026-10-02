# 09: Setup de Auditoria Imutável (audit_logs) e Telemetria

**What to build:**
Tabela append-only imutável de trilha de auditoria (`audit_logs`) e interceptor server-side para registrar todas as ações críticas da plataforma (alterações de papel, aprovações, exclusões e acessos a dados sensíveis) com identificação do autor, IP e user agent.

**Blocked by:** 04: Autenticação e Membership Multi-Tenant por Workspace, 05: Helper Functions de Resolução de Papel e RBAC no Postgres

**Status:** completed

- [x] Criação da tabela `public.audit_logs` com trigger Postgres bloqueando expressamente qualquer tentativa de `UPDATE` ou `DELETE`.
- [x] Módulo server-side de logging auditado em `src/server/audit.ts` injetando metadados de ator, papel, ação e diff.
- [x] Teste pgTAP em `supabase/tests/database/00006_audit_logs.sql` validando que UPDATE e DELETE disparam exceção P0001 (imutabilidade estrita).
