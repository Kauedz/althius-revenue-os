# 03: Receita Federal pelo CNPJ (BrasilAPI)

**What to build:** com o CNPJ, consultar a BrasilAPI (`/api/cnpj/v1/<cnpj>`, grátis, já testada em `docs/sinais/atores-por-sinal.md`) e preencher razão social, nome fantasia, endereço, CEP, cidade, UF, telefone e e-mail da empresa, CNAE, porte e situação. Reserva: `minhareceita.org`. Espaçar os pedidos (uso justo).

**Blocked by:** 02 (ou CNPJ digitado à mão).

**Status:** ready-for-agent (depois da 01)

## Critérios
- [ ] Empresa baixada ou inapta fica marcada, sem esconder.
- [ ] BrasilAPI fora do ar = erro claro, crédito devolvido, nova tentativa depois.
- [ ] Também atende o sinal `receita_federal` (ticket 03 da coleta de sinais).
