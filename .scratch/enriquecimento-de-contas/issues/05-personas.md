# 05: Personas com foto do LinkedIn

**What to build:**
- Com os cargos das personas do ICP do cliente, buscar no LinkedIn as pessoas da empresa (Apify, por exemplo `harvestapi/linkedin-profile-search` com o filtro `currentCompanies`, já pesquisado em `docs/sinais/atores-por-sinal.md`).
- Criar os contatos: nome, cargo, papel na compra (decisor, influenciador, campeão, pelo cargo), LinkedIn em `contact_channels` e foto em `photo_url`.
- Deduplicar por LinkedIn e e-mail.
- Na tela da conta, usar o LinkedIn salvo (hoje o link é uma busca pelo nome).

**Blocked by:** 01 e as decisões 1 e 2.

**Status:** needs-info

## Critérios
- [ ] Só dado profissional público, com origem e data (LGPD).
- [ ] Pessoa que não é da empresa não entra (empresa atual tem que bater).
- [ ] Testes com fonte falsa.
