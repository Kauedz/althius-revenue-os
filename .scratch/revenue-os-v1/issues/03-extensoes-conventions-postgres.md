# 03: Extensões, Conventions e Triggers de Auditoria no Postgres

**What to build:**
Configuração de extensões essenciais do PostgreSQL (`uuid-ossp`, `pgcrypto`) e triggers utilitários que padronizam a geração de IDs únicos e a atualização automática das colunas `updated_at` em todas as tabelas do sistema.

**Blocked by:** 02: Bootstrap do Supabase e Separação dos Schemas public e internal

**Status:** completed

- [x] Extensões `uuid-ossp` e `pgcrypto` configuradas no schema `extensions`.
- [x] Função trigger transversal `handle_updated_at()` implementada para manter timestamps UTC consistentes.
- [x] Teste pgTAP em `supabase/tests/database/00002_extensions_and_conventions.sql` validando avanço automático de `updated_at`.
