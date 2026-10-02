# 19: Motor de Execuções e Aprovações com State Machine e pending_credits

**What to build:**
Motor de orquestração de missões operacionais e fila de aprovações (*Human-in-the-Loop*): controla o ciclo de vida de execuções (`executions` e `execution_steps`), gerencia a máquina de estados completa (incluindo `pending_credits`) e bloqueia etapas que exigem autorização humana via hash SHA-256 de payload.

**Blocked by:** 16: Ledger de Créditos, Wallet, Reserva Preventiva (+25%) e Liquidação, 18: Pipeline de Dados 3 Camadas (raw_records, deduplicação e accounts/contacts)

**Status:** ready-for-agent

- [ ] Criação das tabelas `public.executions`, `public.execution_steps` e `public.approvals`.
- [ ] Execuções com saldo insuficiente entram no estado `pending_credits`, notificando os administradores do workspace.
- [ ] Etapas de alto risco geram registros em `approvals` e travam a execução até aprovação de um membro autorizado.
- [ ] Se o payload da ação pendente for editado, o hash anterior é invalidado e o approval anterior expira (`status = 'expired'`).
- [ ] Teste de máquina de estados valida a transição determinística entre todos os estados de execução e aprovação.
