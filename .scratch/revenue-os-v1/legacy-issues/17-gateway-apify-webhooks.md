# 17: Gateway Apify, Dispatch de Coletas, Webhook Callback e Conciliação

**What to build:**
Serviço de integração com o Apify: worker do BullMQ que lê a chave mestre do schema `internal.master_provider_keys`, dispara a execução do Actor no Apify configurando webhook de retorno, atualiza a execução para `running_external` e desocupa o worker imediatamente, com rotina de fallback de reconciliação para checagem periódica.

**Blocked by:** 16: Ledger de Créditos, Wallet, Reserva Preventiva (+25%) e Liquidação

**Status:** ready-for-agent

- [ ] Job no BullMQ dispara Actor no Apify passando payload e webhook seguro com HMAC token.
- [ ] Endpoint `/webhooks/apify` valida a assinatura do webhook e enfileira o job de finalização com o dataset ID e custo real em US$.
- [ ] O custo real é convertido internamente (200 créditos = US$ 1.00) e gravado em `internal.provider_cost_events`, liquidando a transação no ledger do workspace.
- [ ] Teste de ponta a ponta simulando webhook do Apify finalizando a coleta com sucesso e estornando reserva em caso de falha.
