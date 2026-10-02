# 28: Bateria de Testes de Integração e Validação do Fluxo Crítico Ponta a Ponta

**What to build:**
Suite automatizada de testes End-to-End (E2E) que valida a jornada completa e inegociável do Revenue OS: Estrategista cria e ativa um ICP $\rightarrow$ Dispara coleta no Apify com reserva no ledger $\rightarrow$ Ingestão normaliza e cria Contas e Contatos $\rightarrow$ Leads são inscritos em Cadência $\rightarrow$ BDR abre o Workbench, aprova a tarefa do dia e despacha o e-mail via mailbox OAuth $\rightarrow$ Resposta positiva simulada gera Oportunidade e sincroniza Deal com o HubSpot.

**Blocked by:** 26: Conector e Sync Unidirecional com HubSpot por Estágios de Qualificação, 27: Painéis Operacionais de Execuções, Aprovações e Carteira de Créditos

**Status:** ready-for-agent

- [ ] Teste E2E executa a jornada completa em ambiente de staging / CI sem intervenção manual.
- [ ] O saldo de créditos do workspace é auditado antes e depois: reserva $\rightarrow$ liquidação com precisão contábil.
- [ ] O opt-out funciona em teste de regressão: marcar opt-out bloqueia envios subsequentes imediatamente.
- [ ] Suíte passa com 100% de sucesso sem flakiness assíncrona.
