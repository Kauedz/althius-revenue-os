# 01: Conversa direta e real com cada agente

**What to build:** na aba Conversa da página de cada agente, a pessoa tem conversas privadas (threads) só com aquele agente: cria, escreve, o agente responde pelo Hermes (modelo real), a resposta aparece sozinha, dá para renomear e arquivar. O texto fixo, o "plano antes de ação sensível" e o "Aprovar plano" do protótipo saem do modo real; propostas do agente aparecem como cartão com link para a aprovação. A conversa não aparece em Canais e só a própria pessoa a vê.

**Blocked by:** None (can start immediately).

**Status:** feito e conferido de verdade em 06/10/2026 (ADR 0059): a Zoe respondeu numa conversa direta, com o Hermes real, dizendo que é privada e citando o Playbook. Banco 00076 (40), tela (4), serviço (9). Falta renomear na tela e `npm run verificar` completo (apaga o banco local).

## Critérios
- [x] Conversa direta é um canal privado de uma pessoa e um agente (tipo próprio), com resposta sempre ligada; some da lista de Canais.
- [x] Privacidade: nem outra pessoa do cliente, nem C-level, nem superadmin leem a conversa (teste de banco com duas pessoas e dois clientes).
- [x] BDR só conversa com Zoe e Lia.
- [x] Várias conversas por pessoa e agente, com título (da primeira mensagem), renomear e arquivar.
- [x] A tela mostra o agente respondendo e atualiza sozinha; erro claro com "Tentar de novo", nunca resposta inventada.
- [x] As instruções do agente sabem que é uma conversa direta e privada com aquela pessoa.

## Passos do Nan
Abrir um agente, escrever e conferir que só você vê a conversa.
