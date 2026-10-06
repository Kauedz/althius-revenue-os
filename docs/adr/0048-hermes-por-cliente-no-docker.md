# ADR 0048 — Hermes Agent por cliente, no Docker

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (Hermes Agent, um contêiner por cliente), 0041 (Docker), 0045 (harness), 0047 (executor do Hermes)

## Contexto
O executor (ADR 0047) já fala com o Hermes, mas alguém precisa montar o Hermes de cada cliente: tokens dos agentes, perfis, contêiner e registro. A ADR 0024 exige contêiner separado por cliente, sem ferramentas de terminal ou arquivos, e que o token do MCP só valha para o workspace do cliente.

## Decisão
1. **Um contêiner Hermes por cliente**, com a **imagem oficial** `nousresearch/hermes-agent` **fixada por digest** (v2026.9.24, `sha256:fca358f1…`). Para atualizar, troque `HERMES_IMAGEM` em `scripts/agentes/hermes-perfis.mjs` e rode o teste de ponta a ponta.
2. **Quatro perfis por contêiner** (`comercial`, `marketing`, `copy`, `revops`) mais o perfil padrão **fechado** (sem ferramentas, com chave aleatória que ninguém recebe). O ouvinte HTTP é o do perfil padrão (porta 8642, só na rede interna do Docker, **nenhuma porta publicada**); cada agente entra por `/p/<perfil>/v1` e **só abre com a chave do próprio perfil** (verificado: a chave do padrão ou de outro perfil dá 401; perfil inexistente dá 404).
3. **Cada perfil tem o seu token da Althius** (`alt_agente_…`, um por agente, só vale no workspace do cliente) e só o servidor MCP como fonte de dados. **Nenhuma ferramenta embutida** (terminal, arquivos, web, navegador, código, memória, delegação...). Verificado: com dois perfis de workspaces diferentes no mesmo contêiner, cada um leu só os dados do seu workspace.
4. **O MCP vai empacotado em um arquivo só** (`docker/hermes/mcp/mcp-althius.mjs`, gerado por `npm run agentes:mcp`), rodado com o Node que já vem na imagem do Hermes. O contêiner chega no banco por um **ouvinte interno do Caddy** (`http://web:8081/rest/v1`), que não é publicado.
5. **`npm run agentes:provisionar -- --workspace <uuid> --responsavel <membro> --slug <nome> --modelo-url <url> --modelo-nome <nome>`** (chave do modelo em `HERMES_MODELO_CHAVE` no `.env`) cria tudo isso e **registra os 4 executores** em `docker/agentes-executores.json`. Rodar de novo **não troca tokens nem chaves**. Arquivos com segredo ficam com permissão 0600; a pasta é entregue ao usuário 10000 do contêiner.
6. **`npm run docker:subir`** passa a incluir `docker/agentes-hermes.compose.yml` (gerado, fora do git) quando ele existe.
7. **Os perfis precisam existir quando o contêiner sobe.** Perfil acrescentado com o contêiner rodando não carrega o MCP até reiniciar: depois de mudar perfis, `docker compose restart hermes-<slug>`.

## Verificado de verdade (2026-10-06)
Contêiner oficial real, arquivos gerados pelo próprio script, banco e MCP reais (só o modelo de IA era de mentira): os 4 perfis subiram sozinhos, e `scripts/agentes/teste-ponta-a-ponta.mjs` passou para Zoe (comercial) e Lia (copy): canal → fila → harness → `/p/<perfil>/v1` → Hermes → MCP → banco → resposta no canal.

## Consequências
- **Falta o modelo de IA de verdade:** o provedor e quem paga a chave são decisão do dono. A chave entra por `HERMES_MODELO_CHAVE` e fica no `.env` do perfil (0600, nunca no git). Os agentes do mesmo cliente compartilham a máquina; como não têm terminal nem arquivos, não alcançam a chave dos outros perfis.
- **Dados do cliente no servidor:** as conversas e a memória do Hermes ficam em `docker/hermes/<slug>/data`. Excluir o cliente (LGPD) inclui apagar essa pasta e revogar os tokens (`agent_runtime_tokens`).
- **Custo de memória:** um contêiner por cliente; o consumo real só se sabe medindo no servidor.
- **Pendente:** tela para criar e revogar tokens e para ligar/desligar o Hermes de um cliente; rotação de chaves; limite de memória/CPU por contêiner.
