# ADR 0056 — Integrações do catálogo: conexão por OAuth no servidor MCP oficial

Status: aceita
Data: 2026-10-06
Relacionadas: 0054 (conectores "Em breve"), 0049 (cofre de chaves), 0023 (segurança do banco), 0021 (créditos, nunca dólar), 0055 (coleta de sinais)

## Contexto
Os 37 conectores do catálogo apareciam "Em breve" (ADR 0054) porque nenhum existia. O protótipo AppAlthius já tinha um mecanismo de conexão por OAuth no servidor MCP oficial de cada app. Em 06/10/2026 li direto o metadado OAuth de 9 servidores (`docs/integracoes/servidores-mcp.md`): Notion, Apollo, Pipedrive, Granola e Atlassian aceitam registro automático do cliente; HubSpot, Slack e Zoom exigem um app registrado pela Althius.

## Decisão
1. **Um mecanismo genérico, um perfil por app.** O cliente OAuth 2.1 com PKCE S256 (descoberta RFC 9728/8414, registro automático RFC 7591, indicador de recurso RFC 8707) e o cliente MCP (Streamable HTTP, JSON ou SSE) foram portados do protótipo, com os testes dele. Cada conector é só um perfil em `src/server/integracoes/perfis.ts`. Conector sem perfil `disponivel` continua "Em breve" **com o motivo**; nunca se simula conexão.
2. **Quem conecta:** a capacidade `integrations.connect` que já existe na matriz (superadmin, estrategista, C-level; BDR não). A conferência é do banco (`integration_conferir`, com o login da pessoa). Não há passo separado de "habilitar": a primeira conexão bem-sucedida habilita a integração no workspace e **fixa o portal** do app (ex.: o portal do HubSpot); conta de outro portal é recusada.
3. **O acesso é da pessoa.** Nenhuma função devolve o acesso de outra; o superadmin também não o usa. Tokens e o segredo do cliente ficam **cifrados** (AES-256-GCM, a chave mestra do cofre da ADR 0049) em `internal.integration_accesses`, sem nenhuma permissão para usuário. A tela só vê o próprio estado, a própria conta do app e quantas pessoas conectaram (`integration_estado`).
4. **Tentativa de conexão de uso único**: o `state` só é guardado como resumo SHA-256, vale 10 minutos, uma vez, e só se a pessoa ainda pode conectar. Retorno forjado, repetido ou vencido volta para a tela com o motivo, sem guardar nada. O verificador PKCE fica cifrado.
5. **Renovação automática** do token (o refresh token novo é gravado); token recusado marca "precisa reconectar".
6. **Retirar a integração** apaga os acessos e as tentativas e **não apaga** conta, contato, vínculo nem interação.
7. **Onde roda:** rotas `/integracoes/*` no serviço Node `webhooks`, atrás do Caddy. Sem `COFRE_CHAVE_MESTRA`, `SITE_URL` e `ANON_KEY`, as integrações ficam desligadas com aviso no log.
8. **Código com o Node daqui:** o Node roda TypeScript sem transformação, então o código portado não usa "propriedades de parâmetro" em classes.

## O que NÃO faz (próximos tickets)
- A tela de Conexões (ticket 02): hoje as rotas existem e estão testadas, mas o botão ainda não as chama.
- HubSpot (ticket 04): precisa que o dono crie o MCP Auth App e guarde Client ID e Secret no cofre.
- Sincronização, Enviar ao CRM e os demais apps (tickets 05 a 09).

## Verificação
Testes com servidores falsos (OAuth e MCP) e banco falso, mais um teste contra o banco local. Prova manual em 06/10/2026 contra o **Notion real**: descoberta, registro automático e link de consentimento com PKCE funcionam. Falta uma conexão autorizada por uma pessoa (precisa da tela e do site no ar).
