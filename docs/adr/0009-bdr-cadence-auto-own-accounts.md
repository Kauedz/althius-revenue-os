# ADR 0009: BDR Scoped Authority for Automatic Cadence Dispatch

## Context
Cadence step execution can be automated (`email`, `whatsapp`) or manual (`linkedin`, `instagram`, `call`). Enabling automated sending consumes credits and dispatches communication from the sender's account.

## Decision
BDRs hold `own` authority (`cadences.auto` = `p`) to enable automated cadences strictly on accounts and contacts assigned to them (`owner_member_id` = self), subject to client-level throttle limits and monthly credit ceilings.

## Consequences
- Provides BDRs with operational speed without allowing indiscriminate dispatch across unassigned accounts.
- Prevents cross-operator interference in active cadences.
