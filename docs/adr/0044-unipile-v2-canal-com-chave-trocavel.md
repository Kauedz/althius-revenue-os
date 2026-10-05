# ADR 0044 — Unipile v2 como canal, com chave trocável

Status: aceita
Data: 2026-10-05
Relacionadas: 0041 (Docker), 0042 (motor de cadência), 0043 (agentes)

## Contexto
O primeiro código da Unipile (PRs 04–06) foi escrito sem acesso à documentação, assumindo a API antiga (v1: endereço próprio por conta `DSN`, rotas `/api/v1/...`, cabeçalho fixo `Unipile-Auth`). O dono já tinha um protótipo (repositório `Kauedz/Althius`) rodando com a **API v2** em conta real: conectar e-mail, receber webhook, receber e enviar e-mail. A v2 é diferente em quase tudo.

## Decisão
1. Passamos para a **v2** (`https://api.unipile.com`, cabeçalho `X-API-KEY`), com os formatos que já funcionaram no protótipo:
   - Conectar: `POST /v2/auth/link` com `expires_on`, `redirect_uri`, `state` (id do pedido no nosso banco) e `providers` ou `account_id` (reconectar).
   - Enviar e-mail: `POST /v2/{conta}/emails/send`; WhatsApp: `POST /v2/{conta}/chats/send` (**não confirmado**).
   - Webhook único `/webhooks/unipile`, assinado por HMAC-SHA256 (`unipile-signature: t=…,v0=…`, janela de 5 minutos) com o segredo que a Unipile gera ao criar o endpoint. Eventos `account.*`, `email.new`, `message.new`, `relation.new`.
2. **A Unipile é só um canal.** Endereço e chave ficam em `src/server/unipile/config.ts` e são **lidos a cada uso**. Trocar a chave = `npm run docker:chave-unipile` (grava no `.env`, recria só `webhooks` e `cadencia`). Nenhum dado do CRM depende da chave. A origem da chave pode mudar no futuro (tela do superadmin, cofre) mexendo só nesse arquivo.
3. Sai a rota `/webhooks/unipile/conta` e o endereço de retorno assinado por nós: o pedido agora volta no `state`, e a autenticidade vem da assinatura da Unipile. O dono da conta continua vindo do pedido no banco, nunca do aviso.
4. Mantidas as regras: sem chave não existe envio simulado; 4xx é recusa definitiva, 5xx/408/429/rede é incerto e nunca reenvia sozinho; log nunca mostra remetente nem texto; só contato do CRM entra.

## Consequências
- Confirmado no protótipo: conexão, assinatura, avisos de conta, e-mail recebido e enviado. **Sem teste real ainda:** WhatsApp, LinkedIn e Instagram (envio e recebimento) e o nome de provedor `instagram`. Cada campo incerto está marcado "NÃO CONFIRMADO" no código, em constantes de uma linha.
- Não há mais `UNIPILE_DSN`. Quem tinha o `.env` antigo precisa do segredo novo do webhook (o antigo `Unipile-Auth` não vale mais).
- `src/server/providers/unipile.ts` (esqueleto antigo, v1, não usado) fica para remoção quando o dono confirmar.
- Bounce de e-mail (`email.new.bounce`) é reconhecido e ignorado por enquanto.
