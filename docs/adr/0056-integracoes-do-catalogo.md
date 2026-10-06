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

9. **Canais de mensagem pela Unipile, no mesmo catálogo (decisão do dono, 06/10/2026).** WhatsApp, Gmail, Outlook, Instagram e LinkedIn **não** são conectores novos: o cartão do catálogo conecta pela Unipile (assistente hospedado), que já é o canal da Caixa de entrada. A rota `/integracoes/iniciar` repassa o pedido à conexão da Unipile (`webhooks/conexoes.ts`) com o provedor certo (`whatsapp`, `google`, `microsoft`, `instagram`, `linkedin`). A permissão é a da Caixa (`inbox.connect`, que o BDR também tem), conferida pelo banco dentro da conexão da Unipile; a de integrações (`integrations.connect`) não se aplica a esses cinco. Listar ferramentas, desconectar e retirar de um canal respondem 409 `canal_de_mensagens` (a gestão da conta fica na Caixa).
10. **Experiência do cliente:** o cliente só clica em Conectar e faz o login no app (como nos conectores do Claude). O que a Althius faz uma vez por fornecedor é o cadastro do app, quando o fornecedor o exige (HubSpot, Slack, Zoom, Google); nos de registro automático (Notion, Apollo, Pipedrive, Granola, Confluence) nem isso.

11. **A tela de Integrações** (ticket 02) mostra o estado real de cada cartão: os apps com servidor oficial e os cinco canais de mensagem têm botão **Conectar**; o resto fica "Em breve" **com o motivo escrito no cartão**. Conectado mostra "Conta: ..."; token recusado mostra "Precisa reconectar" e o botão Reconectar. Gerenciar oferece **Desconectar** (só o acesso da própria pessoa). Quando o app devolve a pessoa, a tela diz o resultado (`/?conexao=ok|erro&integracao=...`) e limpa o endereço; o resultado vem **antes do `#`** porque o roteador da tela lê o `#`.

## O que NÃO faz (próximos tickets)
- HubSpot (ticket 04): construído. O app (ID do cliente + Segredo) mora no cofre como tipo `integracao_app` (nome = código da integração), a conta é identificada e o portal fixado; sem identificar o portal a conexão é recusada. Falta o Segredo no cofre e o teste real do dono. A identificação do portal e o parâmetro `resource` não foram confirmados contra o HubSpot real.
- Sincronização, Enviar ao CRM e os demais apps (tickets 05 a 09).
- Agenda (Google Calendar e Outlook) pela Unipile: a documentação da Unipile confirma Gmail e Agenda do Google com credenciais dela (sem o dono registrar app no Google); falta construir e testar antes de ligar o cartão. Drive e Contatos do Google **não** estão confirmados na documentação oficial.
- Salesforce, Dynamics e Teams ficam "Em breve" por decisão do dono; RD Station e Zoho em avaliação (ver o guia).

## Verificação
Testes com servidores falsos (OAuth e MCP) e banco falso, mais um teste contra o banco local. Prova manual em 06/10/2026 contra o **Notion real**: descoberta, registro automático e link de consentimento com PKCE funcionam. Falta uma conexão autorizada por uma pessoa (precisa da tela e do site no ar).
