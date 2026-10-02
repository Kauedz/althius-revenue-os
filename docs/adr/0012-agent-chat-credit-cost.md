# ADR 0012: Agent Chat and Copilot Interaction Pricing Model

## Context
Earlier blueprint drafts suggested bundling conversational agent interactions into a flat monthly retainer fee, while the v18 UI and business rules charge credits for LLM-driven interactions.

## Decision
Conversational interactions with agents or the Copilot consume 2 credits per message exchange. Message drafts and task outlines prepared by agents consume 2 credits. High-volume autonomous workflows (enrichment, scraping, sending) continue to charge their specified higher unit rates.

## Consequences
- Protects the platform against unbounded LLM inference consumption while keeping conversational costs negligible (2 credits = US$ 0.01).
- Matches the exact pricing rules displayed in the v18 interface.
