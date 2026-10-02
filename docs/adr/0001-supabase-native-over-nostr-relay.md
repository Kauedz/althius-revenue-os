# ADR 0001: Supabase Native over Nostr Relay

## Context
The application UI and interaction model are adapted from `block/buzz`, which relies on an embedded Rust relay (`buzz-relay`) communicating via the decentralized Nostr protocol. However, our product is a managed B2B Revenue Operating System requiring strict multi-tenant Row Level Security (RLS), relational data integrity across campaigns and cadences, and ACID ledger guarantees for internal credit wallets.

## Decision
We replace the Nostr/Rust relay with a native Supabase architecture (PostgreSQL, Supabase Auth, and Supabase Realtime). The frontend UI components, styling, and messaging UX from Buzz are preserved, but all communication, state subscriptions, and presence are re-wired to Supabase Realtime and Postgres changes.

## Consequences
- Eliminates the operational overhead of running Rust, Nostr relays, Redis, and MinIO in production.
- Enables unified database migrations, transactional consistency between chat actions and operational records, and native Postgres RLS.
- Strips decentralized cryptographic identity concepts from the user model in favor of standard enterprise multi-tenant workspace memberships.
