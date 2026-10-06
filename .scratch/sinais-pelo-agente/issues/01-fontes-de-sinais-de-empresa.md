# 01: O agente acha, testa e propõe fontes de sinais de empresa

**Status:** done (06/10/2026, ver spec e ADR 0060)

## Passos do Nan
1. Cadastrar uma chave da Apify em Fornecedores (ou `APIFY_TOKEN_1` no `.env`) e ter saldo de créditos no cliente de teste.
2. Recriar o MCP do Hermes (`npm run agentes:mcp`) e subir o serviço `webhooks` de novo (`npm run docker:subir`, ou o modo local de agentes).
3. No canal, pedir: "Lia, ache uma fonte para coletar notícias das minhas contas e teste na conta X". Conferir o teste, aprovar a proposta em Aprovações e ligar o sinal se estiver desligado.
