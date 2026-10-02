# ADR 0016: WhatsApp Automated Cadence Dispatch Scoped to CRM Contacts

## Context
WhatsApp outreach operates directly through the salesperson's personal WhatsApp account connected via Unipile. Aggressive automated outreach creates severe risks of carrier spam bans and phone number suspension.

## Decision
Automated WhatsApp sending in cadences is strictly restricted to verified CRM contacts (`contact_channels`). Sending requires explicit workspace activation by a C-level executive, is capped by a hard daily limit per sender (default: 25/day), and is executed only during standard local business hours.

## Consequences
- Mitigates the risk of Meta phone number bans for client sales teams.
- Preserves consultative relationship quality over spammy mass messaging.
