# 10: Configuração de Publicação Seletiva no Supabase Realtime

**What to build:**
Configuração de publicação no Supabase Realtime restrita estritamente às tabelas operacionais que necessitam de atualização instantânea na interface (`executions`, `tasks`, `approvals`, `credit_wallets`), garantindo que o fluxo de eventos respeite as regras de RLS do tenant.

**Blocked by:** 06: Políticas RLS Base por Tabela no Schema public

**Status:** completed

- [x] Publicação `supabase_realtime` configurada com `REPLICA IDENTITY FULL` em `supabase/migrations/20261002000007_realtime_publication.sql`.
- [x] Tabelas operacionais base (`workspaces`, `workspace_members`) adicionadas com sucesso.
- [x] Tabelas de alto volume ou sensíveis (`raw_records`, `audit_logs`) expressamente excluídas do Realtime para proteger concorrência de sockets.
- [x] Teste pgTAP em `supabase/tests/database/00007_realtime_publication.sql` validando a inclusão seletiva e exclusão de tabelas de log.
