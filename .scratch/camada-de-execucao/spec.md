# Camada de execução das ferramentas do agente

Status: fatia 1 implementada (06/10/2026). ADR 0061. Estudo: `docs/reverse-engineering/gemini-cli/`.

## Feito
`src/server/mcp/execucao.ts` (política, laço, prazo, nova tentativa só em leitura, erro tipado, corte, evento), ligado em `src/server/mcp/althius.ts` e `principal.ts`. Erros tipados em `src/server/mcp/ferramentas.ts` e `src/server/sinais/loja-apify.ts`. Testes em `src/server/mcp/execucao.test.ts`.

## Testes
Vitest com manipuladores falsos e o servidor MCP de verdade em memória: ferramenta sem política bloqueada; política = lista de ferramentas; tipo bate com readOnlyHint; leitura repete só falha passageira; proposta/ação nunca repetem; prazo; laço na 5ª chamada igual; corte 20/80; evento sem argumentos nem conteúdo.
