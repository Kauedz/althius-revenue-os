# Agentes que conversam, conhecem a empresa e usam as integrações

Status: ready-for-agent. Decisões do Nan (06/10/2026): A = modelo pelo login do Codex (provedor openai-codex, modelo luna) só para teste, chave de API em produção; B = o acesso do app é o de quem fez o pedido no canal; C = o Playbook publicado entra sempre em toda resposta (o Hermes mantém o contexto da conversa).

## Problem Statement

Hoje o Nan não consegue conversar com um agente de verdade: o caminho canal → fila → Hermes → resposta foi provado só com um modelo de IA de mentira, e neste ambiente não há Hermes nem modelo registrados. Mesmo quando responderem, os agentes (Zoe, Jax, Lia, Neo) só enxergam contatos, tarefas, negócios e campanhas; não leem o Playbook, as habilidades, o ICP nem os sinais, então não "conhecem a empresa", e a especialidade de cada um se resume a uma frase de função. E as integrações que acabamos de ligar (HubSpot, Notion e as demais) ficam fora do alcance deles: o agente não consegue consultar nem pedir nada nesses apps.

## Solution

O Nan escreve num canal da equipe e o agente responde com um modelo de IA real, trabalhando com o que a empresa definiu (o Playbook publicado do agente, as habilidades, o perfil de cliente ideal e os sinais), com instruções de especialidade próprias de cada agente. Quando a pergunta exigir dados de um app conectado (por exemplo, um negócio no HubSpot), o agente consulta o app com o acesso de uma pessoa da equipe que conectou aquela conta. Qualquer mudança em um app é só proposta: vira uma aprovação, e só depois de aprovada é executada. Nada é inventado: se o agente não achar, diz "não sei" e o que faltou.

## User Stories

1. Como dono do produto, quero escrever num canal e receber a resposta de um agente com um modelo de IA de verdade, para saber se o produto entrega o que prometemos.
2. Como dono do produto, quero rodar isso no meu computador com um comando documentado, para testar sem servidor.
3. Como dono do produto, quero escolher qual modelo de IA responde e onde fica a chave (no cofre), para controlar o custo.
4. Como superadmin, quero ver quanto cada conversa custou em tokens, para precificar.
5. Como C-level, quero que o agente use o Playbook que aprovamos, para ele falar e agir como a nossa empresa.
6. Como estrategista, quero que, ao publicar uma nova versão do Playbook, o agente passe a usar a nova versão na conversa seguinte, sem reiniciar nada.
7. Como C-level, quero que o agente conheça nosso perfil de cliente ideal, para priorizar as contas certas.
8. Como BDR, quero perguntar à Zoe quais sinais recentes uma conta teve, para abordar na hora certa.
9. Como BDR, quero que a Lia escreva a mensagem usando o tom e as regras do Playbook de copy, para não ter que corrigir sempre.
10. Como C-level, quero que cada agente tenha instruções de especialidade (prospecção, mídia, copy, operação de receita) revisadas por mim, para confiar no nível das respostas.
11. Como C-level, quero que o agente diga "não sei" quando faltar dado, para não tomar decisão em cima de número inventado.
12. Como BDR, quero perguntar à Zoe sobre um negócio que está no HubSpot e receber a resposta com os dados reais de lá.
13. Como C-level, quero que o agente use só o acesso de uma pessoa que realmente conectou o app, para a permissão ser a mesma que ela já tem.
14. Como C-level, quero que o agente avise quando ninguém conectou o app que ele precisaria, para eu conectar.
15. Como estrategista, quero que o agente só leia, por padrão, nos apps conectados, para nada mudar sem eu saber.
16. Como C-level, quero que qualquer mudança num app (criar nota, mover negócio, atualizar contato) vire uma aprovação, para eu decidir antes de acontecer.
17. Como C-level, quero ver na aprovação exatamente o que será feito, em qual app e com qual conta, para aprovar com segurança.
18. Como superadmin, quero que cada uso de um app por um agente fique registrado na auditoria (quem pediu, qual app, qual ferramenta, resultado), para investigar depois.
19. Como cliente, quero que o agente nunca misture dados de outro cliente, nem o acesso de outro cliente a um app.
20. Como superadmin, quero que o agente nunca veja token nem segredo de um app, para um erro do modelo não vazar credencial.
21. Como C-level, quero poder pausar um agente e ele parar de usar apps também.
22. Como C-level, quero que ação que gasta dinheiro ou envia mensagem continue exigindo aprovação de C-level, mesmo vindo de um app.
23. Como BDR, quero que a resposta do agente cite de qual fonte veio o dado (Althius, HubSpot, Notion), para eu saber onde conferir.
24. Como superadmin, quero que uma ferramenta de app que escreve nunca rode sem aprovação, mesmo que o modelo tente chamá-la direto.
25. Como dono do produto, quero ver no teste de ponta a ponta uma conversa inteira com ferramenta de integração, para provar que a ponte funciona sem chamar app real nos testes.

## Implementation Decisions

- **Três frentes, em fatias verticais**: (1) conversa real e local; (2) conhecimento da empresa e especialidade; (3) ponte com as integrações (leitura primeiro, depois ação com aprovação).
- **Frente 1:** reaproveita o executor do Hermes, o gateway do modelo e o provisionamento por cliente já existentes (ADRs 0047, 0048, 0050). O que falta é o modelo real e o registro dos executores no ambiente local. Duas rotas para o modelo: chave de API no cofre (produção) ou a assinatura do Codex só para teste (ADR 0051). Decisão pendente do Nan.
- **Frente 2:** o Playbook publicado de cada agente entra automaticamente nas instruções de cada pedido (com limite de tamanho). Habilidades, perfil de cliente ideal e sinais ficam disponíveis por ferramentas de leitura (leitura, nunca escrita), seguindo o padrão `agent_*` com token do agente e isolamento por workspace. Onde mora o ICP no banco ainda precisa ser confirmado; se não existir, o ticket diz isso e não inventa.
- **Especialidade:** um texto de especialidade por agente, versionado no repositório, escrito como rascunho para o Nan revisar. Não é promessa de domínio: é conduta e método.
- **Frente 3, leitura:** uma rota no serviço de webhooks, autenticada pelo token do agente (não pelo login de uma pessoa), que lista e chama só as ferramentas **somente leitura** (marcadas `readOnlyHint`) do servidor oficial do app, usando o acesso de uma pessoa que conectou o app. Qual pessoa: decisão pendente (recomendado: quem fez o pedido no canal).
- **Frente 3, ação:** o agente não chama ferramenta que escreve. Ele **propõe** a ação (app, ferramenta, parâmetros); isso vira uma aprovação; ao ser aprovada, a ação é executada uma vez (chave de idempotência) com o acesso de quem pediu, e o resultado é registrado. Ações que gastam crédito ou enviam mensagem seguem a regra "quem paga decide".
- **Segredos:** token do app nunca sai do serviço de webhooks; o agente e o modelo só recebem o resultado da ferramenta. O token do agente não consegue ler token de app.
- **Auditoria:** todo uso de app por agente grava na auditoria encadeada (quem: agente, em nome de quem, app, ferramenta, resultado resumido, sem valores sensíveis).
- **Créditos, nunca dólar** em tudo o que o agente responde (ADR 0021).

## Testing Decisions

- Um bom teste verifica comportamento externo: dado um pedido no canal, o que o agente responde, quais propostas nascem e o que fica na auditoria. Não testa detalhes internos.
- **Assento mais alto (um só):** o ciclo do harness — mensagem no canal → fila → executor → resposta/proposta — com Hermes e modelo falsos e servidores de app falsos. Já existe esse ciclo nos testes do harness e no script de ponta a ponta; as três frentes entram nele.
- Testes menores por ferramenta nova: Vitest para o MCP e a rota; pgTAP para toda função de banco nova, incluindo isolamento entre dois workspaces e o bloqueio quando o agente está pausado.
- **Nenhum teste chama modelo real nem app real.** A conferência real é feita pelo Nan com uma conversa local (Passos do Nan de cada ticket).
- Arte anterior: `harness.test.ts`, `prompts.test.ts`, `althius.test.ts`, `rotas-hubspot.test.ts` (servidor de app falso) e `scripts/agentes/teste-ponta-a-ponta.mjs`.

## Out of Scope

- Agente que age sozinho sem aprovação (fatia E da ADR 0043: política automática).
- Envio real de mensagens por agente antes da homologação da Unipile.
- Conectores novos ou apps que ainda não conectam (Slack, Zoom, Google etc.).
- Treinar ou ajustar um modelo; usamos modelos de provedores.
- Memória de longo prazo do agente entre conversas além do que o Hermes já oferece.

## Further Notes

- Modelo de IA e quem paga a chave é decisão do dono (ADR 0047/0050).
- ADRs a respeitar: 0021, 0023, 0024, 0043, 0045, 0047, 0048, 0050, 0051, 0056. Uma ADR nova (0057) registrará a ponte agente–integrações.
- O que não sei e os tickets devem confirmar: onde o ICP está guardado; se as ferramentas de leitura de cada app são mesmo marcadas como somente leitura pelo servidor oficial (o Notion e o HubSpot listaram ferramentas, mas não conferi as marcas).
