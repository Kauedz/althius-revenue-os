# 01: Desacoplamento da UI do Buzz e Remoção de Bindings Nostr/Rust

**What to build:**
O frontend React/TypeScript da aplicação deve carregar e rodar de forma 100% autônoma no navegador via Vite, totalmente limpo de dependências do protocolo Nostr (`@nostr-dev-kit`, `nostr-tools`) e sem chamadas ao relay Rust ou runtime do Tauri, preservando intactos o design system Tailwind, componentes Radix/shadcn e o layout de sidebars e chat.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Todas as dependências e imports de Nostr e Tauri foram removidos; projeto reestruturado com React 19 + Tailwind v4 + Supabase client.
- [x] O comando de build do frontend (`npm run build`) executa com zero erros de compilação ou tipos pendentes (`tsc && vite build` concluído).
- [x] O layout básico de casca visual (Sidebar, Topbar com seletor de Workspace e medidor de créditos, área de conteúdo e Copiloto) implementado em `src/App.tsx`.
- [x] Zero conexões ou referências a relays Nostr externos.
