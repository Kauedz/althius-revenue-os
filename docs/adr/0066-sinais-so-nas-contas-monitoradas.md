# ADR 0066 — Sinais só nas contas monitoradas, com teto mensal

Status: aceita
Data: 2026-10-07
Relacionadas: 0055 (coleta de sinais), 0060 (agente acha a fonte), 0064 (créditos pedidos à Althius). Spec: `.scratch/prospeccao-revenue/spec.md`

## Contexto
A coleta automática de sinais rodava para **todas** as contas ativas, toda semana. Com 1.000 contas, isso gasta o crédito do cliente e não sobra para prospectar empresas novas (alerta do Nan, 07/10/2026).

## Decisão
1. **A coleta automática só roda nas contas monitoradas.** É monitorada a conta que:
   - tem **negócio ativo** no Pipeline; ou
   - tem contato numa **cadência ativa**; ou
   - foi **marcada à mão** (`accounts.monitorar_sinais`), pelo botão "Monitorar sinais" na ficha da conta.

   Conta antiga e parada não gasta nada sozinha. Quando ela volta a ser trabalhada (negócio ou cadência), passa a ser monitorada sem ninguém fazer nada.
2. **Teto mensal de créditos de sinais por cliente** (`workspace_settings.teto_sinais_mes`, padrão 2.000; 0 desliga os sinais automáticos). A coleta não reserva crédito que passe do teto; o mês é o de Brasília. Só C-level e superadmin mudam o teto (`signal_budget_set`), porque é regra de créditos.
3. O teto vale só para a coleta **automática**. O teste de fonte feito pelo agente (ADR 0060), a prospecção e o enriquecimento têm os próprios limites.
4. Mesma regra de editar conta para marcar o monitoramento: gestores, e o BDR só nas contas dele (`account_set_monitoring`).

## Consequências
- Os testes de coleta (00069, 00070, 00077) marcam as contas de teste como monitoradas.
- A tela mostra o botão na ficha da conta ("Monitorar sinais" ou "Parar de monitorar"). A dica explica que contas com negócio ou cadência já são monitoradas.

## Limites conhecidos
- **O teto ainda não tem tela**: muda por `signal_budget_set` (função do banco). A tela de Créditos deve ganhar o campo.
- A página de Sinais ainda não mostra quantos créditos de sinais já foram gastos no mês.
- Contas monitoradas à mão ficam assim até alguém desmarcar.
