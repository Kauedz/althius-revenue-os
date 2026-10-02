# 21: Conexão e Gerenciamento de Mailboxes Pessoais e Limites de Envio

**What to build:**
Módulo do Hub de Integrações para conexão de caixas de envio corporativas (Gmail / Outlook) via OAuth 2.0 PKCE, armazenando os tokens cifrados no schema `internal.connection_secrets` e controlando contadores de envio diário e métricas de saúde da mailbox.

**Blocked by:** 13: Walking Skeleton Integrado (Login, Workspace, Shell e Realtime), 14: Discovery e Spike Técnico de OAuth para Google Workspace e Microsoft 365

**Status:** ready-for-agent

- [ ] Criação da tabela `public.email_mailboxes` e `internal.connection_secrets`.
- [ ] Fluxo de conexão de conta na interface gerando link OAuth e salvando tokens com criptografia.
- [ ] Monitoramento de saúde: status muda para `throttled` se a taxa de bounce do dia ultrapassar 4% ou se o limite diário configurado for atingido.
- [ ] Teste de isolamento de segredo: consulta via PostgREST na tabela `email_mailboxes` não retorna tokens nem refresh tokens.
