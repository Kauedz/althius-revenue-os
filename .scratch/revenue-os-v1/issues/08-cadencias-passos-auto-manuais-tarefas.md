# 08: Cadências: Passos Automáticos e Manuais, Tarefas e Envio Unipile

**What to build:** Multi-channel cadences with automated steps (email, WhatsApp) and manual steps (LinkedIn, Instagram, call), task generation with "Enviar agora" button, automatic pausing upon contact reply, and per-contact customization via `cadence_enrollment_steps`.

**Blocked by:** 03: Créditos: Carteiras (Franquia Mensal + Recarga), Reserva e Liquidação, 07: Unipile: Contas de Mensagem, Webhook e Filtro Só-CRM

**Status:** completed

- [x] Tables `cadences`, `cadence_steps`, `cadence_enrollments`, and `cadence_enrollment_steps` created/updated
- [x] Table `tasks` updated with channel, contact, assignee, due date, status, and note
- [x] Scheduler dispatching automatic steps via Unipile (4 credits) and scheduling manual steps as tasks on due date
- [x] "Enviar agora" endpoint allowing manual step dispatch directly from the task interface
- [x] Tests verifying cadence pause upon incoming message and BDR task assignment
