# 01: Fila de enriquecimento e logo automático

**What to build:** colunas novas em `accounts`, a fila `internal.account_enrichments` (criada por gatilho ao inserir conta ou importar), reserva/cobrança/devolução de créditos por etapa e o serviço que roda a fila. Primeira etapa: **logo**. Com domínio, grava `logo_url` na hora (sem custo) e a tela de Contas passa a usar o `logo_url` salvo, em vez de depender de alguém digitar o site.

**Blocked by:** None.

**Status:** ready-for-agent

## Critérios
- [ ] Conta criada ou importada entra na fila sozinha; a mesma conta e etapa não entram duas vezes.
- [ ] Campo digitado à mão nunca é sobrescrito (origem por campo).
- [ ] Isolamento entre clientes (pgTAP).
- [ ] `npm run verificar` verde.
