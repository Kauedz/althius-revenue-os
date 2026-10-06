# Conectores: o que existe de verdade para cada um dos 37 do catálogo

Data: 06/10/2026. Complementa a pesquisa do protótipo (`AppAlthius/.scratch/conexoes-funcionais/pesquisa-conectores-mcp-todos.md`, de 02/10, que cobriu 20 apps). Aqui o catálogo inteiro (37, vindo de `window.ALTHIUS_CONECTORES`) com o **nível de evidência** de cada linha. Nada foi inventado: o que não consegui confirmar está marcado.

## Como ler
- **Verificado hoje** = li o metadado OAuth do próprio servidor (`/.well-known/oauth-authorization-server`) e confirmei se aceita registro automático do cliente (RFC 7591) e PKCE.
- **Pesquisa na web** = a documentação oficial ou páginas de terceiros dizem que existe; o metadado não confere comigo ainda.
- **Registro automático**: a Althius conecta sem cadastrar app no fornecedor. **App registrado**: a Althius precisa criar um app (Client ID e Secret) no portal do fornecedor antes; isso é tarefa do Nan.

## Resumo por situação

### A. Podem funcionar já pelo mecanismo genérico (registro automático verificado hoje)
| Conector | Servidor | Evidência |
| --- | --- | --- |
| Notion | `https://mcp.notion.com/mcp` | Verificado hoje: registro automático, PKCE S256 |
| Apollo.io | `https://mcp.apollo.io/mcp` | Verificado hoje: registro automático, PKCE S256, 70 escopos |
| Pipedrive | `https://mcp.pipedrive.ai/mcp` | Verificado hoje: registro automático, PKCE S256 e plain, 12 escopos |
| Granola | `https://mcp.granola.ai/mcp` | Verificado hoje: registro automático, PKCE S256 |
| Confluence (Atlassian Rovo) | `https://mcp.atlassian.com/v1/mcp` | Verificado hoje: registro automático, PKCE; um servidor cobre Jira, Confluence e outros |
| Lusha (não está no catálogo) | `https://mcp.lusha.com` | Verificado hoje: registro automático; a pesquisa antiga dizia que só Claude/ChatGPT; **não confirmado** que serve a terceiros |

### B. Existem, mas a Althius precisa registrar um app (tarefa do Nan)
| Conector | Servidor | Evidência |
| --- | --- | --- |
| HubSpot | `https://mcp.hubspot.com` | Verificado hoje: **sem** registro automático; precisa do MCP Auth App (limite de 25 instalações enquanto não estiver no marketplace) |
| Slack | `https://mcp.slack.com/mcp` | Verificado hoje: sem registro automático; precisa de app Slack |
| Zoom | `https://mcp.zoom.us/mcp/zoom/streamable` | Verificado hoje: sem registro automático; precisa de app no Zoom Marketplace |
| Google Sheets, Google Calendar, Google Drive, Gmail, Google Meet | endereços `*.googleapis.com` (Sheets e Calendar vieram da pesquisa antiga) | Pesquisa na web: exigem cliente OAuth no Google Cloud e **verificação do app pelo Google** (pode levar dias). Os endereços de Drive e Gmail **não confirmei** (as sondagens deram 404) |
| Meta Ads | `https://mcp.facebook.com/ads` | Pesquisa antiga: app de desenvolvedor Meta próprio. Sondagem de hoje deu 404 no endereço raiz; **não confirmado** |

### C. Provavelmente funcionam, falta confirmar
| Conector | O que sei |
| --- | --- |
| Calendly | O servidor `https://mcp.calendly.com` publica o servidor de autorização `calendly.com`; o metadado direto não foi lido. Pesquisa antiga: registro automático |
| Otter.ai | `https://mcp.otter.ai/mcp` (pesquisa na web); publica `otter.ai` como servidor de autorização; metadado direto não lido |
| tl;dv | Servidor oficial citado; autoriza por Keycloak próprio (`keycloak.tldv.io`); forma de registro **não confirmada** |
| Gong | Existe em **preview fechado** (só alguns clientes, atrás de flag beta), por usuário com OAuth e PKCE; só 3 ferramentas, todas de leitura em texto. Não serve a todos os clientes ainda |
| Clay | Pesquisa antiga: registro automático; endereço **não confirmado** |
| Fireflies.ai | A documentação mostra MCP por URL gerada com token da conta (chave), não OAuth para terceiros: **não serve** como conector genérico até haver OAuth |
| Fathom | Só servidores da comunidade; **sem servidor oficial confirmado** |

### D. Passam pela Caixa de entrada (Unipile), não por MCP
WhatsApp Business, Gmail (conta pessoal), Outlook (conta pessoal), Instagram e LinkedIn pessoal conectam como **contas de mensagem** na Caixa de entrada (já funcionam; só o e-mail foi testado com conta real). Os cartões do catálogo com esses nomes devem apontar para a Caixa, não virar OAuth MCP.

### E. Sem servidor oficial confirmado: ficam "Em breve" com o motivo
| Conector | Motivo |
| --- | --- |
| Salesforce, Dynamics 365 Sales, Zoho CRM, RD Station CRM, Microsoft Teams, SharePoint, Microsoft 365 | O servidor existe ou é preview, mas cada cliente precisa criar um app ou URL na própria conta/tenant (não há um app único da Althius). Exige desenho próprio |
| LinkedIn Ads, LinkedIn Sales Navigator, Google Ads | Sem servidor remoto oficial para terceiros (Google Ads só tem código aberto para hospedar) |
| Google Search Console, Google Analytics 4, Eventbrite, Kommo | Não encontrei servidor oficial |

## O que isso significa para o plano
1. **Primeira fatia (mecanismo genérico)**: construir uma vez o conector OAuth/MCP com registro automático e provar com **Notion** (verificado). Pelo mesmo mecanismo, **Apollo, Pipedrive, Granola e Confluence** passam a funcionar só adicionando o perfil de cada um.
2. **HubSpot** (o mais pesado na venda) exige que o Nan crie o **MCP Auth App** no portal de desenvolvedor do HubSpot e dê o Client ID e o Secret (guardados no cofre, nunca no chat). É um passo humano, e o código fica pronto antes.
3. **Slack, Zoom e Google** exigem app registrado; cada um tem seu processo (Google exige verificação).
4. **Salesforce, Dynamics, Zoho, RD Station, Teams** pedem um desenho diferente (app por cliente). Fica para depois de ter o genérico no ar.
5. O que não tem servidor oficial continua **"Em breve" com o motivo**: nunca simulamos conexão.

## Fontes (06/10/2026)
- Metadado OAuth lido direto dos servidores: `mcp.hubspot.com`, `mcp.notion.com`, `mcp.apollo.io`, `mcp.pipedrive.ai`, `mcp.slack.com`, `mcp.lusha.com`, `mcp.atlassian.com`, `mcp.granola.ai`, `mcp.zoom.us`.
- Atlassian: https://support.atlassian.com/atlassian-ai-gateway/docs/get-started-with-the-atlassian-remote-mcp-server/
- Zoom: https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/
- Gong: https://www.scalekit.com/blog/gong-mcp-vs-api e https://docs.aigateway.cequence.ai/docs/applications/business-operations/gong
- Otter.ai: https://mcpservers.org/remote-mcp-servers/otter-ai
- Granola: https://www.gamut.so/mcp/communication/granola
- Pesquisa do protótipo de 02/10/2026 para os demais.
