# 15: Estrutura e Studio de Estratégia (ICPs, Personas e Playbooks com Status draft)

**What to build:**
O módulo nobre de Estratégia de Receita onde o Estrategista Althius modela e versiona ICPs, matrizes de personas e playbooks de mensagens. Toda nova versão nasce como `draft` e requer aprovação explícita antes de se tornar a tese ativa para o workspace.

**Blocked by:** 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime)

**Status:** ready-for-agent

- [ ] Criação das tabelas `public.icps`, `public.personas` e `public.agent_playbooks`.
- [ ] Interface do Studio de Estratégia permitindo editar critérios de inclusão/exclusão, cargos, dores e objeções.
- [ ] Botão de "Aprovar e Ativar Versão Oficial" acessível exclusivamente por membros com papel `strategist` ou `client_admin`.
- [ ] Teste de permissão valida que o BDR só consegue visualizar ICPs com status `active`.
