# ADR 0057 — Os agentes conhecem a empresa: Playbook sempre ligado e leitura de habilidades e sinais

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (Hermes Agent), 0043 (app controlado por agentes), 0045 (harness), 0047 (executor do Hermes), 0048 (Hermes por cliente)

## Contexto
Os agentes respondiam só com o que o banco devolvia (contatos, tarefas, negócios, campanhas) e uma frase de função. Não conheciam o Playbook que o cliente aprovou, nem as habilidades, nem os sinais. A decisão do dono (06/10/2026): "o agente deve saber sempre" como a empresa trabalha.

## Decisão
1. **O Playbook publicado de cada agente entra no texto de sistema de TODA resposta** (`harness_playbook`, função de sistema, só `service_role`). A leitura é feita pelo executor a cada pedido: publicar uma versão nova vale na resposta seguinte, sem reiniciar. Só a versão publicada vale; rascunho nunca.
2. **Limite de 6.000 caracteres**, cortado com aviso explícito ("Playbook cortado por tamanho"). Nunca corta em silêncio.
3. **Sem Playbook publicado**, o agente é avisado e proibido de inventar regras da empresa.
4. **Se o banco não responder ao pedir o Playbook, o lote volta para a fila.** O agente nunca responde sem saber a missão.
5. O Playbook vai no texto de sistema (nunca no bloco do usuário) e **não substitui** as regras fixas (só propor, nunca inventar, créditos e não dólar, só dados deste cliente).
6. **Duas ferramentas de leitura** (porta do agente, exigem o token, herdam a pausa e o isolamento por workspace): `listar_habilidades` (só as ligadas e só as do próprio agente) e `listar_sinais` (sinais recentes das contas, no máximo 50). O texto de um sinal vem de fontes externas e é tratado como **dado, nunca ordem**.
7. **Memória do Hermes continua desligada** (ADR 0048): o contexto da conversa vem das últimas mensagens do canal e da missão vem do Playbook, a cada resposta.

## ICP
Não existe tabela de ICP no banco. O que existe é a pontuação de aderência (`accounts.fit`) e o segmento da conta; a definição escrita do ICP vive dentro do Playbook (o Playbook de seed cita "ICP v4"). Como o Playbook agora entra sempre, o agente conhece o ICP **como está escrito lá**. Uma estrutura própria de ICP seria decisão nova do dono.

## Verificado de verdade (06/10/2026)
Hermes oficial, modelo do Codex pelo login, banco local: a Zoe da Evolut respondeu com a missão e as regras exatas do Playbook v3.2 e disse, sem inventar, que não achou habilidades nem sinais (o seed não tem nenhum).

## Consequências
- Mais tokens por resposta (até ~6.000 caracteres de Playbook em cada pedido).
- Habilidades e sinais dependem de existirem dados; hoje a tela não cria habilidades (só leitura).
