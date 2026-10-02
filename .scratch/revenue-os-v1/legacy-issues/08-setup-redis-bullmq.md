# 08: Setup de Infraestrutura Redis e Orquestrador de Filas BullMQ

**What to build:**
Camada de orquestração de background jobs em TypeScript (Node.js) com conexão ao Redis e definição tipada das 4 filas do sistema (`scraping-queue`, `enrichment-queue`, `cadence-dispatcher-queue`, `crm-sync-queue`), incluindo suporte a backoff exponencial, locks de concorrência e graceful shutdown.

**Blocked by:** 02: Bootstrap do Supabase e Separação dos Schemas public e internal

**Status:** completed

- [x] Módulo TypeScript inicializa conexão com Redis via IORedis em `src/server/redis.ts` com reconexão resiliente.
- [x] Criação das 4 filas tipadas (`scraping-queue`, `enrichment-queue`, `cadence-dispatcher-queue`, `crm-sync-queue`) com prefixo `revenue-os:` em `src/server/queues/definitions.ts`.
- [x] Classe base `BaseRevenueWorker` implementada em `src/server/queues/base-worker.ts` com telemetria, retries e graceful shutdown.
- [x] Compilação e tipagem TypeScript validadas em `npm run build` com 100% de sucesso.
