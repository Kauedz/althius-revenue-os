# ADR 0011: Migration of Client Admin Role Identifier to 'clevel'

## Context
Previous iterations referred to the client executive role variously as `client_admin`, `owner`, or `cliente`. The business specification and v18 frontend standardize the terminology to "C-level".

## Decision
The backend canonical role identifier is officially `clevel`. Database schemas, RLS policies, helper functions, and seeds use `clevel`. To maintain compatibility with existing frontend demo code referencing `cliente`, an alias mapping is provided in the API layer.

## Consequences
- Eliminates ambiguous naming between legacy "client admin" and modern "C-level".
- Establishes a clean, consistent identifier across Postgres enum/text checks and TypeScript contracts.
