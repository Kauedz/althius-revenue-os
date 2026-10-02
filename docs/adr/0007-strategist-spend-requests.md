# ADR 0007: Strategist Spend Authority Scoped to Requests

## Context
Estrategistas (Althius GTM operators) design campaigns, formulate ICPs, and configure paid signals and ad media, but do not own client capital.

## Decision
Estrategistas cannot directly approve financial spending (`approvals.spend` = `q`, `credits.buy` = `q`). Any action incurring media budget, purchasing credits, or exceeding execution credit thresholds automatically produces an approval request directed to C-level or Superadmin.

## Consequences
- Protects client funds while empowering strategistas to propose optimal media and data strategies.
- Enforces the universal rule: "Quem paga decide o gasto".
