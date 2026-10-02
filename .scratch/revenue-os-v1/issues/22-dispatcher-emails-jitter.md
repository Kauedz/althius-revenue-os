# 22: Dispatcher Assíncrono de E-mails com Jitter Estocástico e Validação de Supressão

**What to build:**
Worker da fila `cadence-dispatcher-queue` que processa envios de mensagens de outbound de forma segura: consulta a supressão antes do envio, valida a cota restante da mailbox e aplica espaçamento estocástico (90 a 180 segundos entre disparos consecutivos da mesma conta) via Gmail API ou Microsoft Graph.

**Blocked by:** 20: Motor e Tabela de Supressão Central LGPD (workspace_suppression_list), 21: Conexão e Gerenciamento de Mailboxes Pessoais e Limites de Envio

**Status:** ready-for-agent

- [ ] Worker escuta jobs de envio e aborta imediatamente se o destinatário estiver na `workspace_suppression_list`.
- [ ] O envio respeita o limite diário da caixa (default 80 envios/dia), reagendando tarefas excedentes para o dia útil seguinte.
- [ ] Jitter estocástico aplicado: intervalo aleatório entre 90 e 180 segundos para simular comportamento humano natural.
- [ ] Teste automatizado com mock da API Gmail validando o espaçamento entre 5 envios programados.
