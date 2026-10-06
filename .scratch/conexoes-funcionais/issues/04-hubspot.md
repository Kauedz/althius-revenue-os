# 04: HubSpot

**What to build:** perfil do HubSpot (`mcp.hubspot.com`, **sem** registro automático): Client ID e Secret do MCP Auth App vêm do cofre (provedor novo na tela Fornecedores); sem eles o cartão mostra "Precisa configurar". Primeiro acesso fixa o portal do workspace; conta de outro portal é recusada. Ferramentas de leitura listadas.

**Blocked by:** 01 e 02.

**Status:** ready-for-agent

## Critérios
- [ ] Segredos do app só no cofre cifrado; nunca em `.env` do front nem em log.
- [ ] Conectar uma conta de outro portal HubSpot é recusado com mensagem clara.
- [ ] Teste com o servidor falso simulando o MCP Auth App.

## Passos do Nan
1. No portal de desenvolvedor do HubSpot, criar um **MCP Auth App** (Development > MCP Auth Apps) com a URL de retorno que a Althius informar.
2. Colar o Client ID e o Secret na tela Fornecedores (cofre). Nunca no chat.
