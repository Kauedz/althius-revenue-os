# ADR 0002: Dual-Schema Database Isolation (public vs internal)

## Context
The platform manages sensitive financial data, vendor API tokens (e.g., central Apify master account, OAuth refresh tokens), and internal compute/markup costs. Clients access the application frontend via Supabase's PostgREST API with a client-side publishable key and Row Level Security. Relying solely on RLS within the `public` schema creates severe risk of metadata exposure or accidental leakage if a policy is misconfigured.

## Decision
We segregate the database into two distinct schemas:
1. `public`: Houses tenant-facing operational tables (`workspaces`, `accounts`, `contacts`, `leads`, `cadences`, `executions`, `credit_wallets`, etc.), exposed via PostgREST and governed by strict RLS based on `workspace_id` and member roles.
2. `internal`: Houses provider credentials, real supplier costs (`provider_cost_events`), pricing multipliers, margins, and audit secrets. This schema is completely excluded from PostgREST exposure and is only accessible by server-side workers and Edge Functions using the privileged `service_role`.

## Consequences
- Upstream vendor secrets (Apify, LLMs) and profit margins can never be queried by the browser client, even under flawed RLS rules.
- Commercial credit prices remain decoupled from real underlying USD infrastructure costs.
- Server-side background jobs (BullMQ workers) must explicitly query the `internal` schema using elevated credentials.
