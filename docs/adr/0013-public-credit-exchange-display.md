# ADR 0013: Display of Commercial Credit Value on User Interface

> **Substituída pela [ADR 0021](0021-credits-only-no-dollar-display.md)** em 2026-10-02: a plataforma não mostra dólar ao cliente.

## Context
Initial specifications proposed hiding all dollar currency equivalents from end users. However, the v18 UI displays the commercial purchase price (1 credit = US$ 0.005) to help customers reason about balance and spend.

## Decision
The public interface displays the commercial retail rate (1 credit = US$ 0.005, or 200 credits = US$ 1.00) and displays retail dollar valuations in balance statements. Internal wholesale supplier costs (Apify raw dollar run costs, LLM token wholesale prices) remain strictly secluded in the `internal` database schema and are only visible to `superadmin`.

## Consequences
- Provides transparency to clients on credit valuation without exposing supplier margins or wholesale negotiations.
- Strictly separates commercial pricing (public) from platform cost basis (internal).
