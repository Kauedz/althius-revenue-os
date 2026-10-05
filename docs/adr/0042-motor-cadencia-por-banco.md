# ADR 0042: Motor de cadência decidido no banco, worker só repete o ciclo

## Contexto
O roteiro do PR 06 pedia "worker no `CADENCE_DISPATCHER`" (fila BullMQ) com desenho próprio (passo, espera, esperar evento, ramificação), estudando o Twenty (AGPL, nada copiado, ADR 0038).

## Decisão
1. **Quem decide mora no banco** (migration 0100): política Hermes, reserva e consumo de créditos, agente pausado, idempotência, pausa por resposta. Tudo em transação, com os testes pgTAP que o projeto já usa.
2. **O worker (`src/server/cadencia/`) só repete o ciclo**: `cadence_claim_due` → `cadence_prepare_step` → envio pelo provedor → `cadence_finish_step`. Ele pergunta ao banco o que venceu a cada 60 s, em vez de consumir uma fila no Redis. Motivos: a "fila" já é a tabela `cadence_enrollment_steps` com `scheduled_at`; cada passo é travado por `FOR UPDATE`, então dois workers não duplicam; e nenhum estado fica só na memória do Redis. A `CADENCE_DISPATCHER_QUEUE` do BullMQ continua definida para outros usos e não é consumida por este worker.
3. **Garantia de no máximo um envio por inscrição+passo.** O envio externo fica fora da transação, então são duas fases com a execução (`running`) como elo. Resultado incerto (rede, 5xx) não é reenviado: vira alerta no log (`cadencia_envio_incerto`). Reenviar às cegas mandaria duas mensagens a um cliente do cliente; não mandar só atrasa.
4. **Espera relativa:** o passo seguinte só recebe data (`scheduled_at = agora + delay_days`) quando o anterior termina.
5. **Passo automático com o envio automático desligado vira tarefa** (como o manual). Quem liga é o dono da inscrição (`cadences.auto`: BDR só nas próprias; ADR 0009).

## Fora deste PR (declarado)
- **Ramificação** ("se abriu o e-mail, vai para X") e "esperar evento" além da resposta do contato. Hoje o único evento que interrompe a cadência é a resposta (já tratada em `unipile_ingest_message`).
- Variáveis de texto (`{nome}`): o texto do passo vai como está escrito. Quem personaliza usa `custom_body` por inscrição.
- Reconciliação das execuções "incertas" (tela ou rotina que confere a caixa de saída e conclui à mão).
- Telas de Cadências ligadas ao banco (PR 08).

## Consequências
O banco concentra a regra, então qualquer outro canal futuro (um agente, uma tela) reaproveita as mesmas funções. O custo é que o ritmo mínimo de envio é o do ciclo (60 s).
