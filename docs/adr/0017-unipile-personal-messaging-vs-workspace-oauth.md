# ADR 0017: Unipile Unified Personal Messaging Engine vs. Workspace OAuth

## Context
Earlier backend specifications proposed distinct connectors for Gmail API, Microsoft Graph API, and WhatsApp Cloud API, while requiring direct LinkedIn scraping. This resulted in fragmented session management, distinct webhook endpoints, and severe maintenance burden.

## Decision
The platform adopts **Unipile** as the single unified communication backbone across all 4 interaction channels (LinkedIn, WhatsApp, Instagram, and E-mail). Connections are personal to each team member (`messaging_accounts`), authenticated via Unipile's hosted connection assistant. Workspace-level OAuth connections (Google, Microsoft) in the Integration Hub are reserved strictly for organizational resources (calendar event booking and knowledge sync).

## Consequences
- Radically simplifies messaging infrastructure to a single API and single webhook receiver.
- Hides provider identity from end users while providing reliable session persistence and QR-code reconnection flows.
