# 01: Modo plano do agente

**What to build:** para pedidos grandes ("monte a prospecção do trimestre"), o agente entra em modo plano: só ferramentas de leitura, escreve um plano numerado (passos, ferramentas, créditos estimados) e o plano vira uma aprovação. Aprovado, o agente segue o plano e marca cada passo. Inspirado no `plan.toml` + `exit_plan_mode` do Gemini CLI (docs/reverse-engineering/gemini-cli/categorias.md §3), imposto pela política (`execucao.ts`), não só pelo prompt.

**Blocked by:** None.

**Status:** needs-info

## Perguntas
Quem aprova o plano: quem pediu, ou sempre C-level/estrategista? O plano pode autorizar um teto de créditos para os passos?
