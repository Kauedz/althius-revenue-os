# 14: Discovery e Spike Técnico de OAuth para Google Workspace e Microsoft 365

**What to build:**
Spike técnico de validação antecipada dos fluxos OAuth com consent screen, renovação atômica de refresh tokens, escopos mínimos (`gmail.send`, `Mail.Send`) e limites de cota de API para Google e Microsoft, garantindo viabilidade do envio antes da implementação da engine de outbound.

**Blocked by:** 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime)

**Status:** ready-for-agent

- [ ] Protótipo funcional executa consentimento OAuth com Google e Microsoft salvando access/refresh tokens criptografados.
- [ ] Rotina de refresh atômico testada antes da expiração de 1 hora do token do Google.
- [ ] Documentação dos limites de envio (2.000 destinatários/dia Google Workspace e 10.000 destinatários/dia Microsoft 365).
- [ ] Validação dos escopos de envio sem exigir permissão invasiva de leitura de e-mails pessoais.
