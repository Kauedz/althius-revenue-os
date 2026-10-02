# 20: Motor e Tabela de Supressão Central LGPD (workspace_suppression_list)

**What to build:**
Tabela central imutável de supressão por workspace e middleware de validação pré-contato: impede ativamente que e-mails, domínios ou contas inteiras sejam reativados por novos scrapings ou recebam e-mails de cadências após manifestação de opt-out ou solicitação de descadastro.

**Blocked by:** 18: Pipeline de Dados 3 Camadas (raw_records, deduplicação e accounts/contacts)

**Status:** ready-for-agent

- [ ] Criação da tabela `public.workspace_suppression_list` com escopos `email`, `domain`, `contact` e `account`.
- [ ] Middleware de verificação que intercepta a criação de `leads` e o agendamento de e-mails em cadências.
- [ ] Registros de supressão nunca são excluídos do banco, preservando histórico de conformidade com a LGPD.
- [ ] Teste de bloqueio: contato cujo domínio está na supressão é descartado automaticamente durante a qualificação com log explicativo.
