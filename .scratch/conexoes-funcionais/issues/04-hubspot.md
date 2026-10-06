# 04: HubSpot

**What to build:** perfil do HubSpot (`mcp.hubspot.com`, **sem** registro automático): o ID do cliente e o Segredo do MCP Auth App vêm do cofre (tipo novo "App de integração" na tela Fornecedores, nome da chave = `hubspot`); sem eles o cartão deixa conectar mas o servidor responde "precisa ser configurada pela Althius" (503) sem falar com o HubSpot. Primeiro acesso fixa o portal do workspace; conta de outro portal é recusada. Se o portal não puder ser identificado, a conexão é recusada (`portal_nao_identificado`). Ferramentas de leitura listadas.

**Blocked by:** 01 e 02.

**Status:** feito no código; falta só o Segredo no cofre e o teste real do Nan (ver abaixo).

## Critérios
- [x] Segredo do app só no cofre cifrado; nunca em `.env` do front nem em log (o log do servidor só tem NOMES dos campos do token).
- [x] Conectar uma conta de outro portal HubSpot é recusado com mensagem clara.
- [x] Teste com o servidor falso simulando o MCP Auth App (`rotas-hubspot.test.ts`, 14 testes).
- [ ] Teste real com a conta do Nan (precisa do Segredo no cofre e do site no ar).

## Feito
- Endereços reais do HubSpot (lidos em 06/10/2026): autorização `https://mcp.hubspot.com/oauth/authorize/user`, token `https://mcp.hubspot.com/oauth/v3/token`; PKCE S256; segredo no corpo (`client_secret_post`).
- Identificação do portal (**não confirmada contra o HubSpot real**): campos do token (`hub_id`/`portal_id`) → consulta `api.hubapi.com/oauth/v1/access-tokens/{token}` → ferramenta `get_user_details`. Se nada servir, recusa.
- `enviarRecurso: true` (parâmetro `resource` do OAuth) é palpite: se o HubSpot recusar, desligar no perfil.

## Passos do Nan
1. (feito) Criar o app no HubSpot. ID do app 56000583 e ID do cliente `1b69203f-e24e-4bce-990e-c9471504ed73` (não são segredos).
2. Na tela Fornecedores > Nova chave: tipo **App de integração**, nome `hubspot`, ID do cliente acima e o **Segredo do cliente** no campo da chave. Nunca no chat.
3. Conectar a própria conta pelo cartão do HubSpot e me dizer o resultado.
