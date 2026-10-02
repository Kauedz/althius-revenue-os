# 11: Canais de Chat: #geral Obrigatório, Agentes por Canal e Cobrança de Créditos

**What to build:** Team chat infrastructure with mandatory `#geral` for all workspace members, customizable channels (`chat_channels`, `chat_channel_members`, `chat_channel_agents`), restricting agent interactions to channels where the agent is assigned, and debiting 2 credits per interaction on the caller's behalf.

**Blocked by:** 02: Função de Política do Hermes: As 4 Checagens, Auditoria e Notificações, 03: Créditos: Carteiras (Franquia Mensal + Recarga), Reserva e Liquidação

**Status:** completed

- [x] Tables `chat_channels`, `chat_channel_members`, and `chat_channel_agents` created
- [x] Seed script establishing `#geral` automatically in every workspace
- [x] Enforcement verifying that only agents assigned to a channel can respond
- [x] Hermes policy trigger debiting 2 credits on each agent message call
- [x] Tests verifying channel creation, `#geral` membership, and 2-credit deduction
