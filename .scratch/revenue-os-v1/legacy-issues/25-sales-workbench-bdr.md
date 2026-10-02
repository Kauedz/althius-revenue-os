# 25: Sales Workbench do BDR (Minhas Tarefas de Hoje e Painel Lead 360)

**What to build:**
O ambiente de trabalho operacional do BDR/SDR: lista priorizada de tarefas vencidas e do dia, visualizador da copy sugerida pela IA, botões de ação ("Aprovar e Enviar", "Editar Mensagem", "Adiar", "Descartar / Opt-out") e gaveta com o contexto 360 do Lead (dados da empresa, sinais encontrados, score explicável e histórico de toques).

**Blocked by:** 24: Builder Frontend de Cadências, Aprovação de Copy e Geração de Tasks

**Status:** ready-for-agent

- [ ] A tela lista exclusivamente tarefas atribuídas ao BDR logado (`assigned_member_id = auth.uid()`).
- [ ] Clicar em "Aprovar e Enviar" despacha a mensagem para a fila BullMQ e remove a tarefa da lista em tempo real via Supabase Realtime.
- [ ] O botão "Opt-out" cadastra automaticamente o contato na `workspace_suppression_list` e pausa a inscrição na cadência.
- [ ] O painel lateral Lead 360 exibe histórico de sinais, dores mapeadas do ICP e dados firmográficos consolidados.
- [ ] Teste de componente (Playwright) valida a aprovação e envio de uma tarefa da fila diária.
