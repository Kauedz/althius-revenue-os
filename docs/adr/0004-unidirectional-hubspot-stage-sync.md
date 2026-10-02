# ADR 0004: Unidirectional HubSpot Stage Sync for V1

## Context
Full bidirectional CRM synchronization introduces complex conflict resolution, distributed race conditions, field-mapping overrides, and webhook loops. For V1 of the managed Revenue OS, our primary objective is to prove commercial value: generating qualified leads, booking meetings, and converting pipeline.

## Decision
For V1, CRM integration is restricted exclusively to HubSpot via a unidirectional outbound push triggered by major commercial milestones:
1. Contact & Company Sync: Pushed when an account/contact reaches verified qualification.
2. Deal & Activity Sync: Pushed when a lead responds positively, books a meeting, or is converted into an active opportunity.

## Consequences
- The Revenue OS acts as the primary operational engine; HubSpot serves as the system of record.
- Eliminates circular webhook sync and race conditions in initial delivery.
- Bidirectional updates, stage mirroring, and multi-CRM support (Pipedrive, Salesforce, RD Station) are deferred to subsequent phases.
