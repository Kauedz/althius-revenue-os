# 02: Prospecção: buscas e candidatas

**What to build:** A Zoe estima (não gasta), a pessoa pede e o serviço `prospeccao` roda a fonte da Apify com teto. O que volta vira candidata; a pessoa inclui (vira conta e entra no enriquecimento) ou exclui; cobra-se por empresa nova.

**Status:** feito (ADR 0067, migration 131).

## Critérios
- [x] estimar não gasta nada
- [x] rodar sem estimativa válida é recusado
- [x] reserva o máximo, cobra novas × preço e devolve o resto; falha devolve tudo
- [x] repetida não cobra nem duplica
- [x] excluir não devolve crédito
- [x] incluir cria conta com dados da fonte e entra no enriquecimento
- [x] isolamento entre dois workspaces
- [x] só a Zoe estima e roda
- [x] BDR não roda nem decide
- [x] nenhum teste chama a Apify real
