-- ==============================================================================
-- Migration: 20261002000108_ultimo_contato.sql
-- PR 11: "Último contato" de cada conta, calculado das NOSSAS mensagens (caixa de entrada): nada é digitado à mão e
-- nada é inventado. Conta sem mensagem não aparece na visão (a tela mostra "Sem contato ainda").
-- A visão roda com o poder de QUEM CONSULTA (security_invoker): a RLS das conversas já decide quem vê o quê.
-- Estrategista e C-level veem o workspace todo; BDR vê só as conversas das PRÓPRIAS contas de mensagem; outro
-- workspace nunca. Mensagem de grupo não existe aqui (só entra contato do CRM, migration 0014).
-- ==============================================================================

CREATE OR REPLACE VIEW public.account_last_contact
WITH (security_invoker = true) AS
SELECT
  c.workspace_id,
  c.account_id,
  max(m.created_at) AS last_contact_at,
  max(m.created_at) FILTER (WHERE m.direction = 'in') AS last_inbound_at,
  max(m.created_at) FILTER (WHERE m.direction = 'out') AS last_outbound_at,
  (array_agg(m.direction ORDER BY m.created_at DESC, m.id))[1] AS last_direction,
  (array_agg(c.channel ORDER BY m.created_at DESC, m.id))[1] AS last_channel
FROM public.messages m
JOIN public.conversations c ON c.id = m.conversation_id
GROUP BY c.workspace_id, c.account_id;

COMMENT ON VIEW public.account_last_contact IS 'Último contato por conta, das mensagens da caixa de entrada. Respeita a RLS de quem consulta (BDR só vê o das próprias conversas).';

REVOKE ALL ON public.account_last_contact FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_last_contact TO authenticated, service_role;
