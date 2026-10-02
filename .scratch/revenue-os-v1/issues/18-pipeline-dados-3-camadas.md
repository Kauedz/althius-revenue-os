# 18: Pipeline de Dados 3 Camadas (raw_records, deduplicação e accounts/contacts)

**What to build:**
Engine de transformação e resolução de identidade: consome datasets de coletas ou importações, salva os payloads originais em `raw_records` (imutável), executa normalização de domínios/telefones/CNPJs e promove registros únicos e deduplicados para `accounts` e `contacts`.

**Blocked by:** 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime), 17: Gateway Apify, Dispatch de Coletas, Webhook Callback e Conciliação

**Status:** ready-for-agent

- [ ] Criação das tabelas `public.raw_records`, `public.accounts` e `public.contacts`.
- [ ] Ingestão de dados brutos vinculada ao `execution_id` mantendo o JSON original inalterado.
- [ ] Regra de deduplicação por domínio normalizado em contas e e-mail normalizado em contatos.
- [ ] Teste de carga: inserção de 500 `raw_records` com 100 duplicações resulta em exatamente 400 `accounts` criadas, sem corrupção de dados existentes.
