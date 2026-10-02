# ADR 0005: Personal OAuth Mailboxes for V1 Outreach

## Context
High-volume cold outbound email typically requires operating pools of burner domains, mailbox rotation, automated warmup schedules, and strict infrastructure monitoring to protect delivery reputation. However, Althius positions this product as a high-ticket managed service (fee of ~R$ 5,000/month) with consultative sales touches performed or supervised by human BDRs.

## Decision
For V1, outbound email sending relies on personal user-authenticated OAuth connections (Google Workspace and Microsoft 365) linked to legitimate seller accounts. Senders are governed by strict client-level daily throttles (e.g., 50–100 emails/day per mailbox) with randomized intervals. Dedicated cold outreach engines and rotating domain pools are deferred to Phase 2.

## Consequences
- Leverages existing primary corporate domain trust, achieving maximum inbox deliverability for strategic accounts without warming overhead.
- Protects clients from spam penalties by enforcing conservative sending ceilings.
- Limits daily outreach volume per seat, aligning with consultative account-based strategy rather than mass cold blast outreach.
