# ADR 0003: Three-Tier Data Ingestion Pipeline

## Context
Data collection from scrapers, webhooks, and crawlers produces high-volume, variable-quality, and potentially dirty records. If incoming data were written directly to operational sales tables, sales representatives (BDRs) would be overwhelmed by unqualified leads, duplicate entries, and noise, breaking the focus of the Sales Workbench.

## Decision
We enforce a strict 3-tier data lifecycle:
1. `raw_records`: Immutable staging area tied to an `execution_id`, preserving original vendor payloads exactly as received.
2. `accounts` & `contacts`: Canonical, deduplicated business entities promoted only after entity resolution, normalization, and exclusion checks.
3. `leads`, `cadence_enrollments` & `tasks`: Actionable commercial records created only when contacts qualify against an active ICP. BDRs interact solely with assigned `tasks`.

## Consequences
- Scraping runs with thousands of records cannot contaminate active sales pipelines.
- Deduplication and identity resolution run before CRM persistence or cadence enrolment.
- Re-enrichment or reprocessing can be safely executed against historical raw records without external web scraping expenses.
