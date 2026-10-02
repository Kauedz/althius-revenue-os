# 11: Harness de Testes pgTAP para RLS e Isolamento de Tenants

**What to build:**
Suíte formal de testes automatizados de segurança no nível do banco via pgTAP, executando asserções exaustivas de concessão e negação (allow/deny) por papel e por tabela, validando que o isolamento multi-tenant não possui brechas antes de qualquer entrega de feature.

**Blocked by:** 06: Políticas RLS Base por Tabela no Schema public, 07: Estrutura de Migrations Versionadas e Seeds Mínimos de Teste

**Status:** completed

- [x] Suíte formal de testes pgTAP criada em `supabase/tests/database/00011_rls_security_suite.sql`.
- [x] Testes negativos de segurança: BDR tentando criar membros, consultas anônimas e violações de fronteira cross-tenant.
- [x] Testes de isolamento do schema `internal` garantindo que `anon` e `authenticated` recebem erro 42501 (permissão negada).
- [x] Testes positivos de autorização para `client_admin` no próprio workspace.
