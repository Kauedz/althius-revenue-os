# 05: O agente propõe ações nas integrações

**What to build:** o agente pode propor uma ação num app conectado (por exemplo criar uma nota ou mover um negócio). A proposta vira uma aprovação mostrando app, conta e o que será feito; depois de aprovada, a ação roda uma única vez, com o acesso de quem pediu, e o resultado é registrado. Ação que gasta ou envia mensagem segue "quem paga decide".

**Blocked by:** 04.

**Status:** ready-for-agent

## Critérios
- [ ] O agente nunca chama ferramenta de escrita diretamente, mesmo que o modelo tente.
- [ ] Aprovar duas vezes ou repetir o pedido não executa duas vezes (chave de idempotência).
- [ ] Aprovação mostra app, conta e ação com clareza; recusar não executa nada.
- [ ] Auditoria da proposta, da aprovação e da execução.
- [ ] ADR 0058 registra a ponte agente–integrações.
