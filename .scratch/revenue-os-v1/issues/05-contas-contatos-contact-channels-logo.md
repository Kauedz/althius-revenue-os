# 05: Contas, Contatos, Contact Channels e Extrator de Logo

**What to build:** Accounts, contacts, normalized `contact_channels` (up to 3 emails, 3 phones, WhatsApp, LinkedIn, Instagram per contact with unique workspace+type+value index), and backend website logo extractor (`apple-touch-icon`, `og:image`, favicon) stored in Supabase storage.

**Blocked by:** 01: Papéis, Matriz de 33 Capacidades e RLS Base

**Status:** completed

- [x] Tables `accounts` and `contacts` updated with `logo_url`, `temperature` (1-3 flames), `buying_role`, `linkedin_status`, `state_uf`, `lat`, `lng`
- [x] Table `contact_channels` created with uniqueness per workspace + type + normalized value
- [x] Backend edge function / utility to extract logo from company domain and persist to storage
- [x] RLS policies allowing BDR to edit only owned accounts (`accounts.edit` = `p`)
- [x] Tests verifying channel deduplication and BDR access restriction
