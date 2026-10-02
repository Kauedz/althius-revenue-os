# 16: Ledger de Créditos, Wallet, Reserva Preventiva (+25%) e Liquidação

**What to build:**
Subsistema financeiro de créditos no banco e backend: carteira de créditos (`credit_wallets`), ledger imutável (`credit_transactions`) com operações atômicas de concessão (`grant`), bloqueio preventivo (`reserve` de +25%), liquidação (`consume`), liberação de excedente (`release`) e estorno (`refund`).

**Blocked by:** 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime)

**Status:** ready-for-agent

- [ ] Criação das tabelas `public.credit_wallets` e `public.credit_transactions`.
- [ ] Função Postgres transacional para efetuar reserva: verifica `available_credits`, decrementa do disponível e incrementa `reserved_credits`.
- [ ] Se o saldo for insuficiente, a reserva falha controladamente permitindo transição para `pending_credits`.
- [ ] Função Postgres de liquidação debita o custo real em créditos, zera a reserva associada e grava o saldo resultante no ledger.
- [ ] Teste unitário de concorrência com 5 transações simultâneas garantindo integridade de saldo (zero saldo negativo acidental).
