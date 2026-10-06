# Spec: Conexões funcionais (integrações do catálogo)

**Status:** ready-for-agent

**Frente:** Integrações. Hoje os 37 conectores do catálogo aparecem "Em breve" (ADR 0054). Esta spec faz os que têm servidor oficial passarem a funcionar de verdade.
Pesquisa do que existe de verdade, conector por conector: [`docs/integracoes/servidores-mcp.md`](../../docs/integracoes/servidores-mcp.md).
Base reaproveitada do protótipo: `AppAlthius/.scratch/conexoes-funcionais/spec.md` (62 histórias) e `AppAlthius/supabase/functions/_shared/integracoes/*`, `integration-connect|callback|tools`, `_shared/integration-access.ts`, `_shared/envio-ao-crm.ts`.
Regras: `AGENTS.md` (nunca inventar dado; GRANT explícito; RLS por workspace; segredo nunca no navegador; nenhum teste chama API real).

## Problem Statement

O cliente não consegue ligar as ferramentas que já usa (HubSpot, Notion, Apollo, Pipedrive...). Todo cartão do catálogo é "Em breve". Sem as conexões não há Sincronização de contas e contatos, nem "Enviar ao CRM", nem agentes lendo o CRM do cliente.

## Solution

Cada pessoa autorizada conecta a **própria conta** de um app, como se conecta um app ao Claude: um botão, o consentimento no próprio app e o estado real da conexão. Por baixo a Althius é cliente MCP do **servidor MCP oficial** do app (OAuth 2.1 com PKCE). Um **mecanismo genérico** serve a todos os apps; cada app é só um **perfil** (endereço do servidor, forma de registro do cliente). Quem não tem servidor oficial continua "Em breve" **com o motivo**.

## Decisões (adaptadas deste projeto)

1. **Quem conecta:** quem tem a capacidade `integrations.connect` (superadmin, estrategista, C-level; BDR não). Não criamos papel nem capacidade nova.
2. **Sem passo de "habilitar".** A primeira conexão bem-sucedida num workspace habilita a integração ali (e fixa o portal do app, como o portal do HubSpot). Retirar a integração desconecta todos os acessos do workspace e **não apaga** conta, contato nem vínculo.
3. **Cada acesso é da pessoa.** Ninguém usa o acesso de outro, nem o superadmin. Token nunca chega ao navegador nem a log.
4. **Tokens cifrados** com a chave mestra (`COFRE_CHAVE_MESTRA`, o mesmo cofre da ADR 0049), em tabela do schema `internal` sem acesso de usuário. O cliente OAuth obtido por registro automático também fica cifrado.
5. **Onde roda:** rotas no serviço Node `webhooks` (atrás do Caddy), como o cofre e a conexão de contas de mensagem. Quem confere o login e a capacidade é o banco, com o JWT da pessoa.
6. **Perfil por integração** (`src/server/integracoes/perfis.ts`): servidor MCP, forma de registro (`automatico`, `app_registrado`), escopos, ferramentas de leitura e escrita, e o motivo de estar "Em breve". Entrada de perfil nova = conector novo, sem mudar mecanismo.
7. **App registrado** (HubSpot, Slack, Zoom, Google...): o Client ID e o Secret vêm do cofre (provedor novo), cadastrados pelo superadmin na tela Fornecedores. Sem eles o cartão mostra "Precisa configurar", nunca finge conectar.
8. **Canais de mensagem pela Unipile, no mesmo catálogo.** WhatsApp, Gmail, Outlook, Instagram e LinkedIn conectam pela Unipile direto do cartão (sem OAuth MCP e sem conector novo). Ver ADR 0056, item 9.
9. **Experiência do cliente:** só clicar em Conectar e fazer login no app. O cadastro do app do fornecedor (quando exigido) é feito uma vez pela Althius.
10. **Créditos, nunca dólar** continua valendo; nenhuma tela de cliente mostra custo de fornecedor.

## Fatias (um PR por ticket)

| # | Ticket | Entrega |
| --- | --- | --- |
| 01 | Mecanismo genérico de conexão (banco + backend) | Tabelas, OAuth/MCP com registro automático, conectar/desconectar/listar ferramentas por API, provado com um servidor MCP falso e perfil do Notion |
| 02 | Tela de Conexões real | Cartões com estado real (Disponível, Conectado, Precisa reconectar, Precisa configurar, Em breve), botão Conectar/Gerenciar, retorno do consentimento |
| 03 | Mais perfis de registro automático | Apollo, Pipedrive, Granola, Confluence (confirmar cada um com uma conexão real) |
| 04 | HubSpot | App registrado no cofre, perfil, trava de portal, ferramentas de leitura |
| 05 | Sincronização do HubSpot | Companies viram contas; contacts viram contatos; regras do protótipo (só lê, respeita responsável, vazio não apaga) |
| 06 | Enviar ao CRM | HubSpot, Pipedrive e RD Station (do protótipo, `envio-ao-crm.ts`) |
| 07 | Apps com registro pelo Nan | Slack, Zoom, Google (Sheets, Calendar, Drive) |
| 08 | Confirmar e ligar os "provavelmente" | Calendly, Otter.ai, tl;dv, Clay |
| 09 | Apps por cliente | Salesforce, Dynamics, Zoho, RD Station, Teams (desenho próprio) |

## Testing Decisions
- pgTAP: RLS, GRANT explícito, isolamento entre workspaces, acesso de uma pessoa nunca lido por outra, tentativa de conexão de uso único e com prazo.
- Vitest: cliente OAuth/MCP contra um **servidor MCP falso** (descoberta, registro automático, PKCE, troca e renovação de token, chamada de ferramenta); rotas HTTP; nenhuma chamada real.
- Validação manual com servidor real (Notion) quando o Nan puder autorizar a própria conta.

## Out of Scope
- Canais de mensagem (e-mail, WhatsApp, LinkedIn, Instagram): seguem pela Unipile na Caixa de entrada.
- Qualquer conector sem servidor oficial confirmado.

## Further Notes
Os conectores só mudam de "Em breve" para disponível quando o perfil dele passa no teste com o servidor falso **e** foi verificado contra o servidor real. Um PR por conector novo (ADR 0054, item 4).
