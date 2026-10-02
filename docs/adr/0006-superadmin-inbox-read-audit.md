# ADR 0006: Superadmin Inbox Read Access Governed by Audit Trail

## Context
Client conversational data in the Unified Inbox contains confidential customer interactions. Superadmins occasionally require access for diagnostic support, compliance reviews, or incident investigation.

## Decision
Superadmins possess read access (`inbox.read` = `l`) across workspace inboxes. However, every inspection of an inbox conversation by a Superadmin automatically triggers an immutable audit log entry recording the member ID, target conversation, timestamp, and support session context.

## Consequences
- Balances platform operational support needs with strict privacy governance.
- Ensures all administrative inspections are fully auditable by client leadership.
