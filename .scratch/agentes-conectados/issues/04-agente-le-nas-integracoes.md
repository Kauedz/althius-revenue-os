# 04: O agente lê nas integrações

**What to build:** o agente consulta os apps conectados (HubSpot, Notion e os demais liberados) só com ferramentas de leitura, usando o acesso de quem fez o pedido no canal. Se essa pessoa não conectou o app, o agente avisa que precisa conectar. A resposta diz de qual fonte veio cada dado. Também lista o estado das conexões.

**Blocked by:** 02.

**Status:** feito e conferido de verdade em 06/10/2026 (ADR 0058): a Zoe leu o nome do portal no HubSpot real, com o acesso da Aline, e a escrita foi recusada. Testes de banco 00074 (23), servidor, MCP e rotas. Falta `npm run verificar` completo (apaga o banco local).

## Critérios
- [x] Rota no servidor de integrações autenticada pelo token do agente (não pelo login de uma pessoa); o token de app nunca chega ao agente nem ao modelo.
- [x] Só ferramentas marcadas como somente leitura pelo servidor do app; se a marca não existir, a ferramenta não é oferecida.
- [x] Uso gravado na auditoria (agente, em nome de quem, app, ferramenta).
- [x] Teste de isolamento entre dois workspaces e agente pausado bloqueado.
- [x] Teste de ponta a ponta com app falso; nenhum app real chamado em teste.

## Passos do Nan
Perguntar à Zoe, no canal, por um negócio que existe no seu HubSpot de teste.
