# 07: Unipile: Contas de Mensagem, Webhook e Filtro Só-CRM

**What to build:** Unified messaging infrastructure via Unipile per-person (`messaging_accounts`), hosted connect wizard handler, webhook receiver with secret header verification (`Unipile-Auth`), immediate 200 response + queue, and strict CRM-only privacy filter (discarding unknown senders and group chats without saving any metadata).

**Blocked by:** 05: Contas, Contatos, Contact Channels e Extrator de Logo

**Status:** completed

- [x] Table `messaging_accounts` created per member with status tracking and reconnection flow
- [x] Tables `conversations` and `messages` created with cascade deletion upon contact deletion
- [x] Webhook receiver Edge Function verifying `Unipile-Auth` header, responding 200 immediately, and queuing to BullMQ
- [x] Ingestion worker searching sender against `contact_channels`: if not found or group chat, silently discards with zero persistence; if found, saves message and pauses contact cadence
- [x] Automated tests testing discard of unknown contacts vs persistence of CRM contacts
