# 07: Caixa de entrada em formato de conversa

**What to build:** Uma conversa por empresa (todas as pessoas dela, em ordem de tempo), canal e autor em cada mensagem; responder escolhendo pessoa e canal pelo caminho de envio atual; lista à esquerda, conversa à direita; mantém o filtro do CRM, o aviso de privacidade e a intenção.

**Status:** feito (ADR 0068, migration 136).

## Critérios
- [x] uma conversa por empresa, com as mensagens de todas as pessoas em ordem de tempo
- [x] canal, autor e intenção em cada mensagem
- [x] responder escolhendo pessoa e canal, pelo caminho de envio atual (política, créditos, serviço cadencia)
- [x] filtro do CRM, aviso de privacidade e resposta automática mantidos
- [x] lista e conversa lado a lado; no celular, uma tela por vez
- [x] testes de tela e de banco/serviço (isolamento entre workspaces)
- [ ] LinkedIn e Instagram enviando por aqui (o canal de mensagens ainda não envia nesses)
