# 03: Resumo estruturado de conversa longa

**What to build:** quando a conversa direta (ADR 0059) passar do limite, guardar um "estado da tarefa" (objetivo, restrições, o que já se sabe, propostas feitas e status, próximo passo) em vez de cortar o histórico. Inspirado no `<state_snapshot>` do Gemini CLI (categorias.md §7), com a regra de descartar o resumo se ele ficar maior que o original.

**Blocked by:** conversa direta (ADR 0059).

**Status:** ready-for-agent
