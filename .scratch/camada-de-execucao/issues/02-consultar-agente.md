# 02: Um agente consulta outro (subagente)

**What to build:** ferramenta `consultar_agente {agente, pergunta}`: roda o outro agente do mesmo cliente com só ferramentas de leitura, prazo (2 min) e limite de turnos, e devolve um resumo. Profundidade 1 (o consultado não consulta ninguém). Inspirado em `invoke_agent` + `complete_task` (categorias.md §8). Custo em créditos da conversa (ADR 0012).

**Blocked by:** None.

**Status:** needs-info

## Perguntas
Cobra créditos da consulta? Quem aparece como "quem pediu" para os apps conectados (ADR 0058)?
