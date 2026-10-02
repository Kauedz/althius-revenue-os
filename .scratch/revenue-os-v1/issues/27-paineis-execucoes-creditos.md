# 27: Painéis Operacionais de Execuções, Aprovações e Carteira de Créditos

**What to build:**
Telas de acompanhamento operacional e governança para o Estrategista e Client Admin:
1. *Aba Execuções:* timeline visual com etapas de cada run, itens processados, status em tempo real e logs sanitizados.
2. *Aba Aprovações:* cards de itens pendentes de aprovação com botão de autorização/rejeição e justificativa.
3. *Aba Carteira de Créditos:* extrato transparente do ledger com saldo disponível, reservado e histórico de consumos em créditos comerciais (sem expor dólares, chaves ou custos reais).

**Blocked by:** 16: Ledger de Créditos, Wallet, Reserva Preventiva (+25%) e Liquidação, 19: Motor de Execuções e Aprovações com State Machine e pending_credits, 25: Sales Workbench do BDR (Minhas Tarefas de Hoje e Painel Lead 360)

**Status:** ready-for-agent

- [ ] Tela de Execuções exibe status ao vivo via Supabase Realtime, permitindo cancelar ou retentar jobs falhos.
- [ ] Tela de Aprovações permite aprovar ou rejeitar uma ação pendente, atualizando o hash de auditoria.
- [ ] Tela de Créditos exibe extrato imutável de transações do workspace com medidor visual de franquia restante.
- [ ] Teste de DOM verifica que nenhuma informação confidencial (nomes de Actors Apify, custos em US$ ou margens) existe no payload ou no HTML renderizado para o cliente.
