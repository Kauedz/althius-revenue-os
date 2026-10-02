# 23: Modelo e Engine de Cadência e Inscrição de Leads

**What to build:**
Subsistema de cadências no banco e backend: modelagem de cadências (`cadences` e `cadence_steps`), lógica de avaliação de elegibilidade e inscrição de contatos qualificados em `cadence_enrollments`, controlando o avanço de etapas por intervalos de dias (`delay_days`).

**Blocked by:** 15: Estrutura e Studio de Estratégia (ICPs, Personas e Playbooks com Status draft), 18: Pipeline de Dados 3 Camadas (raw_records, deduplicação e accounts/contacts), 22: Dispatcher Assíncrono de E-mails com Jitter Estocástico e Validação de Supressão

**Status:** ready-for-agent

- [ ] Criação das tabelas `public.cadences`, `public.cadence_steps` e `public.cadence_enrollments`.
- [ ] Serviço de inscrição vincula um `lead` qualificado a uma cadência ativa, definindo o `next_action_at` com base no delay da etapa 1.
- [ ] A máquina de estados da inscrição suporta transições para `active`, `paused`, `replied`, `booked` e `opted_out`.
- [ ] Teste de progressão de cadência: inscrição de 3 leads avança corretamente para o step 1 na data de agendamento.
