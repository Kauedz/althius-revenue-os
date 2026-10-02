# ADR 0005: Personal OAuth Mailboxes for V1 Outreach

> **Status:** Superseded by [ADR 0017](./0017-unipile-personal-messaging-vs-workspace-oauth.md)

## Context
High-volume cold outbound email typically requires operating pools of burner domains, mailbox rotation, automated warmup schedules, and strict infrastructure monitoring to protect delivery reputation. However, Althius positions this product as a high-ticket managed service with consultative sales touches performed or supervised by human BDRs.

## Decision
For V1, outbound email sending initially planned separate personal user-authenticated OAuth connections (Google Workspace and Microsoft 365).

## Superseded
With the adoption of the unified Unipile messaging engine (ADR 0017), personal email accounts (Google, Microsoft, IMAP) are connected via Unipile's hosted auth per member, unifying email with WhatsApp, LinkedIn, and Instagram under a single conversational backbone. Workspace-level Google/Microsoft connections in the Hub are reserved for calendar scheduling and knowledge sync.
