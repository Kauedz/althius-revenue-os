# Prospecção, sinais e créditos: a lógica de Revenue OS

Status: ready-for-agent (decisões do Nan em 07/10/2026, abaixo)
Relacionadas: ADR 0055 (coleta de sinais), 0060 (agente acha fontes), 0062 (enriquecimento), 0064 (créditos pedidos à Althius), 0065 (agente orquestra)

## O problema
1. A coleta de sinais roda para **todas** as contas ativas. Com 1.000 contas, os sinais comem os créditos e não sobra para prospectar empresas novas.
2. Não existe busca de empresas novas: o agente só trabalha com o que já está na base.
3. Não há ICP estruturado nem fit calculado; o TAM não existe.
4. O Copiloto cria uma "execução" que ninguém processa.
5. A Caixa de entrada é uma tabela; o Nan quer uma conversa por empresa, como um grupo.

## Decisões do Nan (07/10/2026)
- **A Althius opera junto com o cliente** (assessoria de receita: marketing, vendas, copy e tráfego pago feitos pela Althius). O cliente opera o BDR: contato, conversa, prospecção. A Althius mede o trabalho dele.
- **Os papéis dos 4 agentes:**
  - **Zoe — Prospectora.** A ÚNICA que prospecta: busca empresas e pessoas, sinais de busca e mapeamento do comitê.
  - **Jax — Estratégia e ICP.** Escreve, conversa e remodela o ICP pelo que já existe e pelo Playbook. Também cuida da mídia paga (lookalike quando houver Meta Ads).
  - **Lia — Copy e cadências.**
  - **Neo — RevOps.** Métricas e relatórios.
- **Não há ordem fixa de prospecção.** As duas lógicas são inversas e as duas valem:
  - **ICP primeiro.** Exemplo: "empresas de 10 a 20 pessoas, faturamento de R$ 1 a 5 milhões". Primeiro vêm Receita Federal e Google Maps, depois os sinais.
  - **Sinal primeiro.** Exemplos: "quem anuncia X no Meta Ads", "seguidores do concorrente Y". O sinal é a base inicial; depois vêm o enriquecimento (Receita, pessoas e contatos) e o mapeamento de quem decide (nem sempre é o dono).
- **O agente diz quanto custa antes de rodar** ("isso vai custar N créditos") e só roda quando a pessoa pede. O que ele traz cai na base como **candidatas**: a pessoa inclui ou exclui. **O crédito da busca é gasto mesmo que ela exclua.**
- **Só se enriquece o que entra.** A candidata não é enriquecida; quando é incluída, vira conta e aí sim entra no enriquecimento.
- **Sinais não rodam em todas as contas.** Só nas contas **monitoradas**, e com um **teto mensal de créditos para sinais**, para sobrar crédito para prospectar.
- **Fontes por nicho:** cada cliente tem fontes diferentes, como anúncios, SEO/GEO, importação, imóveis ou lojas de carro. O catálogo de fontes da Apify é aberto (ADR 0060): o agente acha a fonte e uma pessoa aprova.
- **B2C exige cuidado.** Seguidores de concorrente no Instagram são pessoas, não empresas. Esse tipo de fonte fica desligado por padrão, com aviso de LGPD, e só entra com aprovação explícita (ver a ADR 0062, telefones).
- **Futuro:** com o Meta Ads conectado, a base (200 mil a 500 mil empresas) vira público de lookalike por e-mail.

## Fatias (issues)
1. **Sinais com teto e só nas contas monitoradas.**
   - É monitorada a conta que tem negócio ativo, está numa cadência ativa ou foi marcada à mão.
   - Teto mensal de créditos para sinais por cliente.
   - Contas antigas não gastam nada sozinhas.
2. **Prospecção: buscas e candidatas.**
   - A Zoe estima, a pessoa pede e o serviço `prospeccao` roda a fonte da Apify com teto.
   - O que volta vira candidata; a pessoa inclui ou exclui; o crédito é cobrado por empresa encontrada.
   - As duas lógicas (ICP primeiro e sinal primeiro) são a mesma máquina: muda a fonte.
3. **ICP estruturado** (Jax): setores e CNAE, porte, faturamento, estados e cargos, ligados ao Playbook.
4. **Fit calculado:** aderência ao ICP, mais sinais recentes, mais dados completos. Atualiza sozinho.
5. **Papéis dos agentes na tela e nas ferramentas:** só a Zoe prospecta (conferido no banco); a descrição de cada agente muda.
6. **Copiloto assistente:** não é um agente da equipe; responde, explica e encaminha para o agente certo.
7. **Caixa de entrada em conversa:** uma conversa por empresa, com as mensagens de todas as pessoas dela. Cada mensagem mostra o canal (WhatsApp, LinkedIn, Instagram, e-mail). Responder pede a pessoa e o canal; a resposta automática da IA continua.
8. **Sinal que gera ação:** sinal forte em conta de fit alto vira proposta de próximo passo.
9. **Lookalike no Meta Ads** (depois do conector, ADR 0063).
