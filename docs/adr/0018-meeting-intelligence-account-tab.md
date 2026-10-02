# ADR 0018: Meeting Intelligence Integrated as Contextual Account Tab

## Context
Initial blueprints featured a standalone top-level module for "Reuniões" and a dedicated recording capability. However, sales operators examine call transcripts, action items, and objections in the context of the account and buying committee they are actively working.

## Decision
Sales call intelligence (ingested from third-party meeting notetakers such as Granola, Gong, or Fireflies via webhook/API) is embedded as a contextual "Reuniões" tab within the Account 360 detail view. The RevOps Agent processes call transcripts to update deal health and objections without requiring a separate navigation module.

## Consequences
- Reduces interface fragmentation and keeps sales workflows centered around accounts and deals.
- Aligns with the v18 navigation structure while preserving deep conversational intelligence.
