# 03: ICP estruturado (Jax)

**What to build:** Campos de ICP por workspace (setores/CNAE, porte, faturamento/capital, estados/cidades; cargos alvo já existem). A tela Estratégia mostra e edita; os agentes leem; a Zoe usa para montar as buscas. Edição pelo Jax é proposta com aprovação; gestor edita direto. Sem valores padrão inventados.

**Status:** feito (ADR 0067, migration 132).

## Critérios
- [x] campos estruturados por cliente, sem valor padrão
- [x] gestor edita na tela Estratégia; BDR não
- [x] o Jax propõe; só muda depois da aprovação
- [x] os agentes leem (ferramenta e contexto do harness)
- [x] isolamento entre clientes
