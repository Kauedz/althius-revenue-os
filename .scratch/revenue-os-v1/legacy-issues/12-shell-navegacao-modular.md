# 12: Shell de Navegação Modular (Topbar, Sidebar e Copilot Sheet)

**What to build:**
A casca principal da interface do usuário do Revenue OS, integrando os componentes visuais do Buzz em um layout de módulos de negócio: Topbar com seletor de Workspace ativo e contador de créditos, Sidebar com ícones e rótulos dos módulos, e Drawer/Sheet lateral deslizante para invocar o Copiloto em qualquer tela.

**Blocked by:** 01: Desacoplamento da UI do Buzz e Remoção de Bindings Nostr/Rust

**Status:** ready-for-agent

- [ ] Topbar exibe nome do Workspace ativo, seletor de tenants do usuário e medidor de créditos disponível.
- [ ] Sidebar lista os módulos principais (*Início, Mercado, Sinais, Prospecção, Workbench, Cadências, Execuções, Aprovações, Integrações, Copiloto, Admin*).
- [ ] O drawer lateral do Copiloto abre e fecha com animação suave e sem recarregar o conteúdo da tela ativa.
- [ ] Teste de componente verifica a alternância de rotas e o estado de abertura do drawer.
