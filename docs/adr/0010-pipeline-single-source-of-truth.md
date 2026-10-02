# ADR 0010: Althius as Canonical Authority for Pipeline Stage Transitions

## Context
When opportunities exist both in Althius and in an external CRM (HubSpot, Pipedrive), concurrent modifications to deal stages can create conflicting states.

## Decision
Althius serves as the single source of truth for opportunity stage transitions within active motions. Moves in Althius immediately update the canonical database, record an entry in `opportunity_stage_history`, and trigger the RevOps agent to push updates outward to connected CRMs. Inbound CRM updates are processed asynchronously with timestamp-based conflict reconciliation favoring Althius on collisions.

## Consequences
- Maintains absolute integrity over the 6 canonical stages across SLG, MLG, and PLG motions.
- Guarantees accurate historical reporting and win probability projections.
