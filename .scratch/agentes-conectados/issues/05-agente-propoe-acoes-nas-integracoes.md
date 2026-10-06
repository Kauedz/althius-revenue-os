# 05: O agente propõe ações nas integrações

**What to build:** o agente pode propor uma ação num app conectado (por exemplo criar uma nota ou mover um negócio). A proposta vira uma aprovação mostrando app, conta e o que será feito; depois de aprovada, a ação roda uma única vez, com o acesso de quem pediu, e o resultado é registrado. Ação que gasta ou envia mensagem segue "quem paga decide".

**Blocked by:** 04.

**Status:** feito em 06/10/2026 (ADR 0058), com uma decisão pendente do dono (ferramentas destrutivas). Conferido de verdade até a proposta: a Zoe registrou "Ação no HubSpot: manage_segment" pendente. Falta o dono aprovar essa proposta na tela de Aprovações (como a Aline) e conferir a lista TESTE ALTHIUS no HubSpot. Testes de banco 00075 (44), executor (11), proposta (31 junto da leitura). Falta `npm run verificar` completo (apaga o banco local).

## Critérios
- [x] O agente nunca chama ferramenta de escrita diretamente, mesmo que o modelo tente.
- [x] Aprovar duas vezes ou repetir o pedido não executa duas vezes (chave de idempotência).
- [x] Aprovação mostra app, conta e ação com clareza; recusar não executa nada.
- [x] Auditoria da proposta, da aprovação e da execução.
- [x] ADR 0058 registra a ponte agente–integrações.
