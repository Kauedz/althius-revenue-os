# ADR 0023: Funções do banco fechadas por padrão; quem chama em nome de um membro precisa ser ele

## Contexto
Em 2026-10-02 a verificação mostrou que as 19 funções `SECURITY DEFINER` do schema `public` eram executáveis por qualquer um pela API (`/rest/v1/rpc`), inclusive sem login. Isso permitia, entre outros: consumir ou reservar créditos de qualquer workspace, escrever na auditoria, injetar mensagem como se viesse do webhook de mensagens, aprovar gasto passando o id de um C-level e ler o funil de outro cliente.

## Decisão (migration 0023)
- `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated` em todas as funções do `public`, inclusive a regra padrão global do Postgres para funções futuras. Toda função nova precisa de `GRANT` explícito.
- Liberadas para quem está logado só as ações de tela: `approval_decide`, `hermes_evaluate_action`, `task_send_now`, `send_channel_agent_message`, `get_revenue_funnel_summary` e `log_superadmin_inbox_access`. Os helpers usados pela RLS seguem liberados.
- Funções de sistema (créditos, auditoria, webhooks, coleta) só para `service_role` (Edge Functions e workers do Hermes).
- `public.assert_caller_is_member(membro)`: quando há usuário no JWT, o membro informado precisa ser da pessoa logada (erro 42501). Chamadas do backend, sem usuário no JWT, passam.
- `get_revenue_funnel_summary` só lê workspace de que a pessoa é membro (ou superadmin).

## Consequências
- Protegido por `supabase/tests/database/00020_rpc_security.sql`.
- O backend (Hermes, webhooks do provedor de mensagens, coleta) precisa usar `service_role` para essas funções. O front nunca chama créditos diretamente: pede ao Hermes.
