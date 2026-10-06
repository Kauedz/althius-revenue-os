# ADR 0059 — Conversa direta e privada com cada agente

Status: aceita
Data: 2026-10-06
Relacionadas: 0012 (custo da conversa), 0043, 0045 (harness de canal), 0047 (executor do Hermes), 0057 (conhecem a empresa), 0058 (apps conectados)

## Contexto
A aba Conversa da página de cada agente era uma encenação do protótipo (resposta fixa, "plano antes de ação sensível" e "Aprovar plano" genéricos, conversas de mentira). O dono quer clicar no agente e conversar só com ele, sem canal, para testá-lo e pedir tarefas individuais, com o Playbook, as skills, os sinais e os conectores dele.

## Decisão
1. **Conversa direta = canal de um tipo próprio (`direto`) com UMA pessoa e UM agente**, resposta sempre ligada (`always`). Reaproveita a fila, o harness, o Hermes, o modelo, o crédito (2 por lote) e as ferramentas. Nenhum motor novo.
2. **Privada de verdade:** a política de leitura de canais exclui o tipo `direto` de quem não participa. Nem estrategista, nem C-level, nem superadmin leem a conversa ou as mensagens (teste de banco com três papéis).
3. **Várias conversas por pessoa e agente (threads).** O título nasce da primeira mensagem (até 40 caracteres); renomear e arquivar são ações da dona da conversa. Arquivada some da lista.
4. **BDR só conversa com Zoe e Lia** (mesma regra do harness), conferida já ao abrir.
5. **Fora da lista de Canais:** a tela de Canais filtra por tipo.
6. **A tela fala a verdade:** as mensagens vêm do banco; enquanto a fila do agente não foi atendida aparece "pensando" e a tela busca de novo a cada 3 segundos, sozinha. Se o agente não responde (ciclo desligado, saldo, pausa), nada é inventado: a mensagem espera ou um aviso do sistema aparece. Falha ao enviar devolve o texto à caixa com aviso.
7. **O agente sabe onde está:** nas instruções, uma conversa direta é "privada, só entre vocês dois", e ele não repete o que foi dito para outras pessoas. As demais regras (só propor, nunca inventar, créditos e não dólar) continuam.
8. **O plano genérico do protótipo sai do modo real.** Propostas reais do agente viram aprovações pelo caminho de sempre (tela de Aprovações).

## Verificado de verdade (06/10/2026)
Hermes oficial e modelo do Codex: a Zoe respondeu numa conversa direta que ela é privada e citou o Playbook v3.2. Teste de banco 00076 (40 verificações, com privacidade entre três papéis), testes de tela e de serviço.

## Consequências
- Mensagens da conversa direta ficam no banco como as dos canais (retenção igual). Excluir o workspace as apaga junto.
- Ainda não há "renomear" na tela (a ação existe no banco); o título é o da primeira mensagem.
- Anexos e voz ficam fora.
