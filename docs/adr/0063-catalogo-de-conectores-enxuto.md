# ADR 0063 — Catálogo de conectores enxuto

Status: aceita
Data: 2026-10-06
Relacionadas: 0054 (conectores "Em breve"), 0056 (integrações do catálogo), 0058 (agentes e integrações)

## Contexto
O catálogo de Integrações tinha 37 conectores, herdados do protótipo. Só 13 conectam de verdade; os outros 24 eram "Em breve" (com o motivo escrito), e vários não têm sequer um servidor oficial para a Althius usar (Google Ads, LinkedIn Ads, Search Console, Analytics 4, Eventbrite). Isso poluía a tela e prometia o que o produto não entrega. O Nan pediu (06/10/2026) para tirar o que não existe e manter só o que importa.

## Decisão
1. **Ficam 16 conectores**:
   - **CRM:** HubSpot e Pipedrive (conectam), RD Station CRM (**Em breve**: cada cliente gera a própria URL e o token).
   - **Mensagens:** WhatsApp Business, Instagram, Gmail, Outlook e LinkedIn Sales Navigator (pela conta de mensagem, como na ADR 0056).
   - **Agenda:** Google Calendar (**Em breve**: vai usar a conta Google já conectada; falta construir).
   - **Conhecimento, reuniões e dados:** Notion, Confluence, Granola, Otter.ai, Apollo.io e Calendly (conectam).
   - **Mídia paga:** Meta Ads (**Em breve**, ver item 3).
2. **Saem 21**, que não conectam e não foram pedidos: Salesforce, Dynamics 365 Sales, Zoho CRM, Slack, Microsoft Teams, Microsoft 365, SharePoint, Zoom, Google Meet, Google Drive, Google Sheets, Gong, Fireflies, Fathom, tl;dv, Clay, Google Ads, LinkedIn Ads, Google Search Console, Google Analytics 4 e Eventbrite. Para trazer um de volta: reincluir o id na lista da regra "catálogo de conectores" em `scripts/v18/patches.mjs` e criar o perfil em `src/server/integracoes/perfis.ts`, com a ADR do conector (regra 4 da ADR 0054).
3. **Meta Ads fica "Em breve"**, com o motivo: a conexão oficial da Meta aceita login direto (metadado OAuth lido em 06/10/2026: registro automático de cliente e PKCE `S256`), mas falta construir a criação e a ativação de campanhas, sempre com a aprovação do C-level (verba é gasto). O que ainda não foi confirmado está em `docs/integracoes/servidores-mcp.md`.
4. **A IA do workspace continua lendo todas as integrações conectadas** (ADR 0058). Nada mudou ali. Dois "Em breve" que o Nan quer (RD Station e Google Agenda) só entram na leitura dos agentes quando virarem conectores de verdade.
5. **Como a mudança é feita:** o catálogo vem do design (`althius-frontend-v18/fonte/module.js`). Uma regra em `scripts/v18/patches.mjs` filtra a lista e as categorias, e falha alto se o design deixar de trazer um dos 16. O teste `perfis.test.ts` agora compara os perfis com o catálogo já ajustado (`src/v18/module.js`).
6. **Telas que citavam conectores que saíram:** os cartões de canal de Campanhas ligavam cada canal (LinkedIn Ads, Google Ads, Orgânico, Evento, SEO/GEO) a esses conectores e mostravam o código cru (`liads`, `gads`...). Agora só citam conector que existe; o canal continua, porque é como a campanha é classificada. As permissões de integração do Jax (Google Ads, LinkedIn Ads) e do Neo (Google Sheets) no protótipo também saíram.

## Consequências
- A rota `/integracoes/iniciar` responde 404 (não 409 "em breve") para quem pedir um conector removido.
- A página de Integrações passa de 37 para 16 cartões. Os "disponíveis para conectar" continuam 13.
- O modo demonstração também mostra o catálogo enxuto (a regra vale para os dois modos).
