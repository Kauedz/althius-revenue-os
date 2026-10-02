# 10: Campanhas por Canal e Relatórios de Dados Reais (Views Agregadas)

**What to build:** Campaigns per channel (`linkedin_ads`, `meta_ads`, `google_ads`, `organico`, `evento`, `seo_geo`) and real-time aggregated reporting database views reading actual data from Pipeline, Cadences, Campaigns, and Credits, replacing static mock figures in the UI.

**Blocked by:** 08: Cadências: Passos Automáticos e Manuais, Tarefas e Envio Unipile, 09: Pipeline: 3 Motions, Quadros, 6 Etapas Fixas e Sincronização CRM

**Status:** completed

- [x] Table `campaigns` updated with `channel_type` and lead association
- [x] Materialized or regular views aggregating revenue funnel metrics across all 3 motions
- [x] Real-time aggregation of active cadence conversion rates and outreach volume
- [x] Analytics endpoint exposing the exact payload expected by `fonte/component.js.html`
- [x] Automated tests asserting consistent mathematical totals between raw deals and reporting views
