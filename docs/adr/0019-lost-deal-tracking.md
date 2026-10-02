# ADR 0019: Lost Deal Lifecycle and Stage Archival

## Context
The canonical pipeline across all 3 motions features exactly 6 active stages ending in `ganho` (100%), with no dedicated column for lost deals on the Kanban board.

## Decision
Marking an opportunity as lost requires selecting a loss reason (`loss_reason`). The deal's status is updated to `perdido`, recorded in `opportunity_stage_history`, and the card is archived from the active Kanban view. Lost opportunities remain accessible in list views and feed conversion funnel reports for the RevOps agent.

## Consequences
- Keeps Kanban boards clean, focused solely on active revenue pipeline and won deals.
- Preserves complete data fidelity for cohort analysis and loss reason reporting.
