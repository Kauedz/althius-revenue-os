# 08: Confirmar e ligar os "provavelmente"

**What to build:** confirmar o metadado OAuth de Calendly, Otter.ai, tl;dv e Clay (e achar o endereço do Clay) e ligar os que aceitam registro automático. Gong só quando sair do preview fechado. Fireflies e Fathom ficam "Em breve" até haver OAuth oficial.

**Blocked by:** 01.

**Status:** feito (06/10/2026). Calendly e Otter.ai: registro automático confirmado e liberados. tl;dv: o servidor RECUSOU o registro (só aceita domínios que ele autoriza antes), segue Em breve. Clay: só existe como programa local (`clay mcp`), sem login para terceiros, segue Em breve.

## Critérios
- [ ] Cada um confirmado lendo `/.well-known/oauth-authorization-server` do servidor, com a data registrada em `docs/integracoes/servidores-mcp.md`.
