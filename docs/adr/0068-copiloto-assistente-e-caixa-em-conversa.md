# ADR 0068 — Copiloto como assistente separado (e Caixa de entrada em conversa)

Status: aceita
Data: 2026-10-07
Relacionadas: 0050 (gateway do modelo), 0059 (conversa direta com agente), 0064 (créditos pedidos à Althius), 0067 (papéis dos agentes). Spec: `.scratch/prospeccao-revenue/spec.md` (fatias 6 e 7)

## Contexto
O Copiloto criava uma "execução" (`copilot_request`, migrations 0089/0090) que nenhum serviço processava: o pedido ficava parado em Execuções. O Nan decidiu (07/10/2026): o Copiloto **não é agente da equipe** nem um dos 4; é um assistente separado que só ajuda a pessoa — responde dúvidas, explica números, leva à tela certa e, quando o pedido é trabalho, encaminha ao agente certo. Não gasta crédito com ação e não propõe nada sozinho.

## Decisão (fatia 6: Copiloto — migration 135)
1. **Conversa privada por pessoa** (`public.copilot_messages`): cada pessoa só lê a própria (nem o C-level lê a do BDR). Ninguém grava direto: a tela pergunta por `copilot_ask` (chave de envio: repetir não duplica).
2. **Serviço `copiloto`** (contêiner novo, `src/server/copiloto/`): pega as perguntas (`copilot_next`, que já entrega os **números lidos do banco agora**: contas, fit, negócios, aprovações, tarefas, sinais, prospecção, ICP e, só para gestores, créditos), chama o modelo pelo **mesmo gateway** dos agentes (chaves do cofre, reserva automática, uso registrado com o rótulo `copiloto`) e grava a resposta (`copilot_answer`).
3. **Encaminhar**: quando o pedido é trabalho, a resposta indica o agente (Zoe, Jax, Lia ou Neo) e a tela mostra **"Abrir conversa com <agente>"**, que abre a conversa direta (ADR 0059). O código do agente é um dos 4 (o banco recusa outro).
4. **Sem resposta do modelo** (sem cofre, sem modelo cadastrado, todos falharam), a pessoa vê **"Não consegui responder agora: <motivo>."** Nunca uma resposta inventada.
5. **Não é agente**: não tem `agent_code` próprio, não cria execução nem aprovação. As restrições de `agent_code` (4 agentes) não mudaram; só o registro de uso do modelo aceita o rótulo `copiloto`.
6. **Créditos: a conversa com o Copiloto é gratuita** para o cliente. Motivo: ele não faz trabalho (só explica e encaminha); o trabalho que gasta é feito pelos agentes, que já cobram. O custo do modelo é da Althius e fica medido no Uso global (`copiloto`). Para conter esse custo: **limite de 60 perguntas por pessoa por dia**. Se o custo real pesar, a mudança é cobrar o mínimo de "mensagem no chat" (2 créditos) por pergunta — decisão do Nan.
7. **Tela**: o painel do Copiloto mostra a conversa (pergunta, "O Copiloto está respondendo…", resposta), sem o plano encenado nem os exemplos do protótipo. A resposta chega sozinha (a tela confere a cada 2 s enquanto há pergunta sem resposta, por até 3 minutos).
8. `copilot_request` (0089/0090) continua no banco, mas a tela não o usa mais.

## Consequências
- Testes: pgTAP `00087_copiloto_assistente.sql` (35), serviço (`src/server/copiloto/`), serviço da tela e tela (`copiloto.tela.test.tsx`, reescrito: o antigo testava a execução que ninguém processava).
- `docker-compose.yml` ganhou o contêiner `copiloto` (`docker/Dockerfile.copiloto`); o gateway exporta `conversar` para o Copiloto reaproveitar a mesma lógica (sem abrir rota nova).

## Limites conhecidos
- O Copiloto não navega sozinho para uma tela: ele diz onde fica (a lista de telas vai no texto do sistema).
- Não foi testado contra um modelo real neste ambiente (sem chave); a cadeia foi testada com modelo falso.
