# ADR 0015: Dual-Wallet Credit Lifecycle (Allowance vs. Top-Up Expiration)

## Context
Workspaces receive a recurring monthly credit allocation as part of their service retainer, but can also purchase additional on-demand top-ups.

## Decision
Credits are managed in two distinct logical pools per workspace:
1. **Monthly Allowance (`monthly_allowance`)**: 10,000 credits allocated at the beginning of each billing cycle that reset and expire at cycle end.
2. **Top-Up Wallet (`topup_wallet`)**: Purchased credits valid for 90 days from the date of purchase.
The credit deduction engine operates on a First-Expiring, First-Out (FEFO) basis to maximize client value while preserving recurring subscription economics.

## Consequences
- Prevents unbounded accumulation of unused retainer credits while providing reasonable validity for paid top-ups.
- Matches the Blueprint ledger architecture and provides the frontend with precise expiration dates.
