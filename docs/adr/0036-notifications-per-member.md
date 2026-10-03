# ADR 0036: Notificações isoladas por membro e marcação como lida

## Contexto
A tabela `public.notifications` existia no schema desde a migration 000009 com política de leitura isolada por membro (`recipient_member_id`), mas o front lia dados estáticos do protótipo (`NOTIFICATIONS` em `data.js`), e não havia política nem RPC para os membros marcarem suas notificações como lidas no banco de dados.

## Decisão
1. **Permissão de UPDATE na tabela `public.notifications`**:
   - Política RLS `Members can mark their own notifications as read` para `authenticated`, permitindo atualizar somente notificações onde `recipient_member_id` pertence a `auth.uid()`.
2. **Função `public.mark_notifications_read(p_member_id UUID, p_notification_id UUID DEFAULT NULL)`**:
   - `SECURITY DEFINER`, executando `public.assert_caller_is_member(p_member_id)` (ADR 0023).
   - Atualiza `read_at = now()` para o membro chamado. Se `p_notification_id` for informado, atualiza apenas ela; se for NULL, marca todas as pendentes daquele membro.
   - Fechada por padrão (`REVOKE ALL`), liberada com `GRANT EXECUTE` somente para `authenticated`.
3. **Serviço `src/app/servicos/notificacoes.ts`**:
   - `listarNotificacoes(cliente, workspaceId, membroId)`: lê notificações ativas ordenadas por `created_at DESC` e formata para a tupla `[titulo, texto, quando, id, lida]`.
   - `marcarNotificacoesComoLidas(cliente, membroId, notificationId?)`: chama a RPC e persiste a leitura no banco.
4. **Integração no front v18 (`AlthiusApp.ts`)**:
   - `D.notificationService.list()` ligado a `carregarNotificacoes()`.
   - `marcarLidas` no `renderVals()` persiste a leitura no banco e atualiza o estado local.

## Consequências
- Cada membro enxerga estritamente as suas notificações.
- A contagem de não lidas e a ação de marcar como lida refletem no banco de dados e persistem entre recarregamentos.