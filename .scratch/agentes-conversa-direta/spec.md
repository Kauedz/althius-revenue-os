# Conversar direto com cada agente, ensinar o agente e alimentá-lo com sinais

Status: ready-for-agent. Origem: pedido do Nan em 06/10/2026, vendo a tela do agente (aba Conversa) ainda como protótipo.

## Problem Statement

Na tela de cada agente (Zoe, Jax, Lia, Neo) a aba Conversa é uma encenação: respostas fixas, "Plano antes de ação sensível" e um botão "Aprovar plano" genéricos, e uma lista de conversas (Threads) de mentira. O dono não consegue clicar no agente e ter uma conversa só com ele, sem passar por um canal da equipe, para testá-lo, dar conhecimento mais profundo, pedir uma tarefa individual com as ferramentas dele (conectores, skills, Playbook, sinais). Também não consegue subir skills nem dar contexto ao agente, e a coleta de sinais pela internet (Apify) ainda cobre só 3 dos 16 sinais externos.

## Solution

Na aba Conversa de cada agente, o cliente tem conversas privadas e reais com aquele agente (várias, como "threads"): escreve, o agente responde pelo Hermes com o modelo real, usando o Playbook, as skills, os sinais e os conectores da pessoa. Nada de plano genérico: quando o agente propõe algo (tarefa, negócio, ação num app), a conversa mostra a proposta e leva à aprovação de verdade. Nas outras abas, o cliente sobe e edita skills, dá contexto (documentos) que o agente lê, publica o Playbook e vê quais conectores o agente usa. A coleta de sinais pela Apify cobre todos os sinais que dependem da internet.

## User Stories

1. Como C-level, quero abrir a página da Zoe e conversar só com ela, para testar o que ela sabe.
2. Como BDR, quero conversar com a Zoe ou a Lia sem criar canal, para pedir ajuda individual.
3. Como estrategista, quero ter várias conversas com o mesmo agente (threads), para separar assuntos.
4. Como usuário, quero ver "pensando…" enquanto o agente responde e a resposta aparecer sozinha, para não recarregar a tela.
5. Como usuário, quero que a conversa direta seja privada: só eu a vejo (nem os outros do cliente).
6. Como usuário, quero que o agente use na conversa o Playbook, as skills, os sinais e os conectores que eu conectei.
7. Como usuário, quero ver quando o agente fez uma proposta (aprovação) com link para aprová-la, em vez de um "plano" genérico.
8. Como usuário, quero dar título e arquivar conversas.
9. Como estrategista, quero subir uma skill (texto em markdown, colado ou de arquivo .md) para um agente, ligar, desligar e editar, para ensinar um procedimento.
10. Como estrategista, quero dar contexto ao agente (documentos de referência: ICP, objeções, preços, cases) para ele conhecer a empresa mais a fundo.
11. Como C-level, quero ver na aba Integrações quais apps o agente pode ler e quais mudanças ele pode propor, e quem já conectou.
12. Como C-level, quero que ferramentas que "podem apagar dados" só entrem como proposta com aviso claro na aprovação.
13. Como estrategista, quero que todos os agentes que usam sinais coletem os sinais da internet, com custo em créditos claro e sem número inventado.
14. Como C-level, quero ver na aba Sinais de cada agente o que foi coletado, quando e de qual fonte.

## Implementation Decisions

- **Conversa direta = canal privado de uma pessoa com um agente**, reaproveitando o harness, a fila, o Hermes e o crédito (2 créditos por lote). Tem um tipo próprio (`direto`) e **não aparece na lista de Canais**. Resposta sempre ligada (`always`). Quem mais pode ler: ninguém além da própria pessoa (decisão de privacidade por padrão; superadmin não lê).
- **Threads** são várias conversas diretas por pessoa e agente; o título nasce da primeira mensagem e pode ser mudado; arquivar esconde.
- **Regra de papel do harness continua**: BDR só aciona Zoe e Lia.
- **Estado da conversa** (mensagens e "o agente está respondendo") vem do banco; a tela atualiza sozinha enquanto há resposta pendente.
- **Aprovações do agente** aparecem na conversa como cartão com o título da aprovação e atalho para a tela de Aprovações; o "plano" do protótipo some no modo real.
- **Skills**: já existem no banco (`agent_skills`) e o agente as lê (`listar_habilidades`). Falta a tela e a gravação (subir, editar, ligar, desligar, versão), com permissão de estrategista e C-level.
- **Contexto do agente** (conhecimento): documentos de referência por agente (e opcionalmente do cliente inteiro), lidos por ferramenta de leitura, com limite de tamanho e isolamento por cliente.
- **Ferramentas destrutivas de apps**: liberadas só como proposta, com aviso explícito na aprovação, nunca em leitura (decisão recomendada, ADR 0058).
- **Sinais**: continuação do trabalho da Apify (ADR 0055): cada sinal externo vira uma receita com ator, adaptador, teste com Apify falsa e custo em créditos; nada inventado.
- Créditos, nunca dólar, em toda a tela.

## Testing Decisions

- Bom teste = comportamento externo: a pessoa escreve, o agente responde, a proposta aparece com link. Um assento: o ciclo do harness (já existe) mais a tela de Agentes com banco local e Hermes falso.
- Banco: pgTAP com isolamento entre dois clientes e entre duas pessoas do mesmo cliente (a conversa direta de uma não aparece para outra, nem para C-level).
- Tela: testes de tela com o banco local, no padrão de `agentes.tela.test.tsx` e `canais.tela.test.tsx`.
- Nenhum teste chama modelo real, Apify real nem app real.

## Out of Scope

- Voz, anexos de imagem e arquivos em geral na conversa.
- Agente que age sem aprovação (política automática).
- Marketplace de skills compartilhadas entre clientes.

## Further Notes

- ADRs: 0012 (custo de conversa), 0043, 0045, 0047, 0048, 0055, 0057, 0058. Uma ADR nova (0059) registrará a conversa direta e a privacidade dela.
