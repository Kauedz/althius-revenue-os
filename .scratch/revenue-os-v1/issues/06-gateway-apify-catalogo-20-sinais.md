# 06: Gateway do Apify com Catálogo de 20 Sinais e Eventos

**What to build:** Apify data gateway running behind central platform credentials in schema `internal`, managing `signal_definitions` (20 catalog signals mapped to capabilities), `workspace_signal_settings`, and `signal_events` that update account temperature and location.

**Blocked by:** 03: Créditos: Carteiras (Franquia Mensal + Recarga), Reserva e Liquidação, 05: Contas, Contatos, Contact Channels e Extrator de Logo

**Status:** completed

- [x] Tables `signal_definitions`, `workspace_signal_settings`, and `signal_events` created
- [x] Seed script inserting the 20 canonical signals mapped to capabilities, costs, and owner agents
- [x] Gateway function calculating run cost (credits_per_account × accounts), holding 25% credit reserve, running actor, and updating account temperature
- [x] Integration tests verifying Apify key secrecy and signal event persistence
