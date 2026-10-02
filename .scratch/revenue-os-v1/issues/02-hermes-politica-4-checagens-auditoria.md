# 02: Função de Política do Hermes: As 4 Checagens, Auditoria e Notificações

**What to build:** The universal Hermes policy engine function in Postgres (`hermes_evaluate_action`), evaluating: (1) Role capability key check, (2) Data owner check (`assigned` vs `own`), (3) Approval necessity check (`operacao` vs `gasto`), (4) Credit availability check. Emits entries to `executions`, `notifications`, and `audit_logs`.

**Blocked by:** 01: Papéis, Matriz de 33 Capacidades e RLS Base

**Status:** completed

- [x] Function `hermes_evaluate_action` created and callable by edge functions and database triggers
- [x] Table `notifications` created with recipient routing, entity reference, and read status
- [x] Audit trail triggers and event emission logging all decisions (including rejected actions)
- [x] Unit tests verifying all 4 rejection scenarios (missing key, data owner violation, pending approval, insufficient credits) and the successful authorized path
