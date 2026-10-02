# 03: Créditos: Carteiras (Franquia Mensal + Recarga), Reserva e Liquidação

**What to build:** Dual-wallet credit ledger supporting recurring monthly allowance (10.000 credits expiring each billing cycle) and top-up wallet (90-day expiration). Supports transactional reserve (+25% hold), consume, and release operations, FEFO debit prioritization, auto-topup thresholds, and public retail display at 1 credit = US$ 0.005.

**Blocked by:** 02: Função de Política do Hermes: As 4 Checagens, Auditoria e Notificações

**Status:** completed

- [x] Schema `credit_wallets` updated with monthly allowance expiration and top-up expiration tracking
- [x] Stored procedures for `reserve_credits`, `consume_credits`, and `release_credits` with strict idempotency
- [x] FEFO balance deduction consuming credits that expire earlier
- [x] Configuration in `workspace_settings` for `credit_mode` (`auto`, `approval`), `approval_threshold`, `monthly_credit_limit`, and auto-topup settings
- [x] Automated tests testing reserve hold, partial release, and auto-topup trigger
