# 04: Fit calculado de verdade

**What to build:** Nota de fit calculada no banco (sem IA, sem custo): aderência ao ICP, sinais recentes e dados completos, com o "por que esta nota". Recalcula quando a conta, os sinais ou o ICP mudam.

**Status:** feito (ADR 0067, migration 133).

## Critérios
- [x] calculado no banco, sem IA nem crédito: ICP + sinais recentes + dados completos
- [x] "por que esta nota" na ficha da conta
- [x] recalcula quando a conta, os sinais, as pessoas ou o ICP mudam
- [x] isolamento: o ICP de um cliente não mexe no fit do outro
- [ ] recálculo diário para sinais que envelhecem (pendente)
