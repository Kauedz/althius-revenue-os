# ADR 0045 — Harness de canal para os agentes

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (Hermes Agent), 0038 (peças do Buzz), 0012 (custo do chat com agente), 0001 (Supabase no lugar do relay)

## Contexto
Hoje, chamar um agente num canal só cria um pedido ("a resposta chega aqui quando terminar") e nada responde. Falta o meio do caminho entre os canais (migration 0088) e o Hermes Agent: uma fila, uma ordem e uma garantia de que o pedido não se perde nem responde duas vezes.

## Decisão
O estado fica no Postgres (migration 0110); o Hermes Agent só consome pelo executor (`src/server/agentes/harness.ts`).
1. **Uma fila por canal** (`agent_channel_queue`). Entra na fila só depois da política Hermes (papel, dono, aprovação, créditos).
2. **Um pedido por vez por agente** em cada workspace (índice único em `agent_channel_runs`). Agente pausado pelo cliente não roda.
3. **Mensagens próximas agrupadas:** o lote sai quando o canal fica em silêncio por 3 s (ou espera 15 s) e leva tudo o que está pendente (até 50) de uma vez. Custo: 2 créditos por lote, não por mensagem.
4. **Batimento de vida:** o executor avisa a cada 20 s. Sem aviso por 90 s (ou passado o prazo de 300 s), o lote é recolhido e volta para a fila.
5. **Política de resposta por agente e canal** (`chat_channel_agents.reply_policy`): `mention` (padrão, só quando chamado), `owner` (mensagens de quem criou o canal) ou `always` (toda mensagem de pessoa). Agente nunca responde a agente nem a aviso do sistema. BDR só aciona Zoe e Lia. Quem gerencia o canal escolhe (`chat_set_agent_policy`).
6. **Falha:** espera de 5 s dobrando, até 300 s; 10 falhas = pedido perdido, com aviso no canal e na auditoria. Créditos reservados são liberados a cada falha.
7. **Nada inventado:** sem executor configurado, os pedidos esperam na fila. Não existe resposta de mentira.

## Consequências
- Quem tem política `always` gasta 2 créditos por lote de mensagens: o dono do canal decide isso conscientemente.
- O executor real (Hermes) entrou na ADR 0047: o serviço `agentes` roda `rodarCicloHarness` com o executor do Hermes e só pega agentes que têm executor registrado.
- A tela de canais ainda não mostra nem muda a política; hoje se muda pela função `chat_set_agent_policy`.
- Peça vinda do Buzz (desenho, sem cópia de código): ver `THIRD_PARTY_NOTICES.md`, seção 3.
