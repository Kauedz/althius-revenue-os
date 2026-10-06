# 01: Mecanismo genérico de conexão (banco e backend)

**What to build:** o miolo que todo conector usa. Banco: integrações do workspace, acessos por pessoa (tokens cifrados), tentativas de conexão (uso único, com prazo), cliente OAuth obtido por registro automático. Backend: cliente OAuth/MCP (descoberta RFC 9728 e 8414, registro automático RFC 7591, PKCE S256, troca e renovação de token) e rotas para iniciar a conexão, receber o retorno, desconectar, retirar a integração e listar as ferramentas do servidor. Provado com um servidor MCP falso e com o perfil do Notion.

**Blocked by:** None.

**Status:** done

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

- [x] Só quem tem `integrations.connect` inicia conexão (BDR recusado); a conferência é do banco.
- [x] O retorno do OAuth só vale com `state` de uma tentativa pendente, dentro do prazo, de uma pessoa ainda ativa no workspace, uma única vez.
- [x] Token e segredo do cliente ficam cifrados e nunca voltam em resposta, log ou erro.
- [x] Cada pessoa vê só o próprio acesso; ninguém lê o de outro (nem superadmin pela tela).
- [x] Renovação de token automática; token recusado marca "precisa reconectar".
- [x] Desconectar e retirar a integração não apagam contas, contatos nem vínculos.
- [x] Isolamento entre workspaces testado.
- [ ] `npm run verificar` verde. **Pendente:** banco (68 arquivos, 1.708 verificações), tipos e build passam; no front as mesmas 8 falhas de ambiente de antes (6 do executor do Hermes por rede local, 1 de permissão 0600 do Windows, 1 de tela do aprendizado), que falham igual sem este ticket.

## Comments

- Provado contra o **Notion real** em 06/10/2026: descoberta, registro automático e link de consentimento com PKCE (sem autorizar nenhuma conta). Falta uma conexão autorizada por uma pessoa, que depende da tela (ticket 02) e do site no ar.
- Código e testes portados do protótipo (26 testes de OAuth e MCP) mais 22 de rotas, 6 do servidor e 5 contra o banco local; o teste de banco 00071.
- Decisão: sem passo de "habilitar" (a primeira conexão habilita e fixa o portal). Ver ADR 0056.

## Passos do Nan

Nenhum neste ticket (só código e testes). A conexão real com o Notion acontece quando o Nan autorizar a própria conta, depois do ticket 02.
