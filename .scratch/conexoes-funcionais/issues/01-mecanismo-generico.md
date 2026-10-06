# 01: Mecanismo genérico de conexão (banco e backend)

**What to build:** o miolo que todo conector usa. Banco: integrações do workspace, acessos por pessoa (tokens cifrados), tentativas de conexão (uso único, com prazo), cliente OAuth obtido por registro automático. Backend: cliente OAuth/MCP (descoberta RFC 9728 e 8414, registro automático RFC 7591, PKCE S256, troca e renovação de token) e rotas para iniciar a conexão, receber o retorno, desconectar, retirar a integração e listar as ferramentas do servidor. Provado com um servidor MCP falso e com o perfil do Notion.

**Blocked by:** None.

**Status:** in-progress

## Pode mexer

- Migration nova (próxima: `20261002000119`) com as tabelas, as funções do sistema e o pgTAP.
- `src/server/integracoes/` (novo): perfis, cliente OAuth, cliente MCP, rotas, servidor MCP falso para teste.
- Montagem das rotas no serviço `webhooks` e `docker/Caddyfile`.
- `docs/adr/` com a decisão do mecanismo.

## Não mexa

- Em `src/v18/*.generated.*` e na tela (ticket 02).
- Nas rotas e funções da conexão de contas de mensagem (Unipile).
- Em migrations já commitadas.

## Critérios

- [ ] Só quem tem `integrations.connect` inicia conexão (BDR recusado); a conferência é do banco.
- [ ] O retorno do OAuth só vale com `state` de uma tentativa pendente, dentro do prazo, de uma pessoa ainda ativa no workspace, uma única vez.
- [ ] Token e segredo do cliente ficam cifrados e nunca voltam em resposta, log ou erro.
- [ ] Cada pessoa vê só o próprio acesso; ninguém lê o de outro (nem superadmin pela tela).
- [ ] Renovação de token automática; token recusado marca "precisa reconectar".
- [ ] Desconectar e retirar a integração não apagam contas, contatos nem vínculos.
- [ ] Isolamento entre workspaces testado.
- [ ] `npm run verificar` verde.

## Passos do Nan

Nenhum neste ticket (só código e testes). A conexão real com o Notion acontece quando o Nan autorizar a própria conta, depois do ticket 02.
