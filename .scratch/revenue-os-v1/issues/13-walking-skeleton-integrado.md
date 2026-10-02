# 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime)

**What to build:**
O marco integrador de conclusão da Fase 0: um usuário navega até a aplicação, efetua login via Supabase Auth, tem seu workspace carregado com RLS ativo, visualiza a interface modular e recebe um evento de teste via Supabase Realtime no Copiloto.

**Blocked by:** 07: Estrutura de Migrations Versionadas e Seeds Mínimos de Teste, 10: Configuração de Publicação Seletiva no Supabase Realtime, 12: Shell de Navegação Modular (Topbar, Sidebar e Copilot Sheet)

**Status:** ready-for-agent

- [ ] Fluxo completo de login, carregamento de sessão e redirecionamento para o workspace padrão.
- [ ] O usuário consegue trocar de workspace pelo Topbar, e o estado da aplicação atualiza imediatamente.
- [ ] Um evento disparado no backend aparece instantaneamente na interface sem necessidade de refresh manual.
- [ ] Teste E2E (Playwright) valida o ciclo completo de login, troca de tenant e recebimento de evento em tempo real.
