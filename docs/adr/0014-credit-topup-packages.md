# ADR 0014: Standardized Linear Credit Top-Up Pricing Structure

## Context
Two conflicting credit top-up tables were documented: a tiered BRL package model (2,000 to 25,000 credits) and a linear retail pricing model (10,000 to 100,000 credits at US$ 0.005/credit).

## Decision
The platform adopts the linear retail package structure reflected in the v18 UI: top-ups range from 10,000 credits ($50) up to 100,000 credits ($500) based on the standard commercial conversion rate of US$ 0.005 per credit. BRL currency conversions are performed dynamically at payment checkout based on current exchange rates.

## Consequences
- Ensures predictable unit economics and eliminates inconsistent volume discounts at the base ledger level.
- Keeps client-facing top-up math completely intuitive.
