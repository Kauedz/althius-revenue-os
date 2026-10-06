# ADR 0060 — O agente acha, testa e propõe a fonte de cada sinal

Status: aceita (fatia 1: sinais de empresa)
Data: 2026-10-06
Relacionadas: 0021 (créditos, nunca dólar), 0024 (porta do agente), 0045 (harness), 0049 (cofre e rodízio da Apify), 0055 (coleta de sinais), 0058 (quem pediu)

## Contexto
Na ADR 0055, cada sinal precisava de uma receita escrita à mão: alguém escolhia o ator da Apify, uma IA escrevia o adaptador e o superadmin ligava. Com 16 sinais externos e sinais novos pedidos por cliente, isso não escala. O dono quer que o produto funcione como o Claude: com a chave da Apify no cofre e acesso à internet, **o agente pesquisa a melhor fonte para o sinal descrito, junta fontes se precisar e aprende**, sem alguém cadastrar ator por ator (pedido do Nan, 06/10/2026).

## Decisão
1. **O agente aprende uma vez e a coleta reaproveita.** O agente faz a parte inteligente (buscar, ler, testar, montar o mapeamento) e o resultado vira uma **receita** guardada. A coleta de todo dia continua sendo o serviço `sinais` (ADR 0055), barato e previsível, sem chamar o modelo a cada conta.
2. **Ferramentas novas do agente** (servidor MCP da Althius):
   - `sinais_catalogo`: o que existe, o que já coleta (equipe, cliente ou nada), créditos por conta e falhas recentes.
   - `sinais_buscar_fontes` e `sinais_detalhar_fonte`: a **loja pública** da Apify (sem chave e sem custo): uso, avaliação, % de execuções que deram certo, parâmetros da entrada, exemplo e leia-me.
   - `sinais_testar_fonte`: roda a fonte numa conta ativa do próprio cliente e devolve campos, amostra e os eventos que o mapeamento geraria.
   - `sinais_propor_receita`: propõe a receita (principal e até 2 de reserva). Vira **aprovação de operação** (C-level ou estrategista).
3. **A receita é só dado, nunca código.** A entrada usa as variáveis da conta (`{{empresa}}`, `{{dominio}}`, `{{site}}`, `{{linkedin_empresa}}`, `{{linkedin_url}}`, `{{dias}}`). O mapeamento aponta campos do item (`a.b.0.c`) e monta textos com `{{campo}}`. O adaptador genérico (`src/server/sinais/adaptadores/generico.ts`) lê isso.
4. **Vínculo obrigatório.** Cada fonte diz como o item prova que é da conta: `empresa` (nome igual ao da conta), `dominio` (site igual ao da conta, ou subdomínio) ou `entrada` (a própria entrada já é da conta). Na dúvida, o item não vira evento.
5. **Receita do cliente.** A receita aprovada vale **só naquele cliente** (`internal.signal_recipes_workspace`) e tem prioridade sobre a da equipe para o mesmo sinal. Nenhum cliente muda a coleta de outro.
6. **Dinheiro.**
   - O teste custa os créditos de uma coleta do sinal: cobrado se a fonte rodou, devolvido se falhou.
   - O teto em dólar de toda execução de receita do agente é **o que o cliente paga pela coleta** (`internal.signal_teto_usd`: créditos × R$ 0,0529 ÷ R$ 5,50). A coleta nunca custa mais do que cobra.
   - O agente nunca vê dólar: a loja aparece em créditos estimados e o "$" escrito pelo autor do ator sai do texto.
7. **Guarda-corpos.**
   - Testar exige uma pessoa pedindo (a rodada em andamento, ADR 0058). Limite de 30 testes por dia por cliente.
   - Propor exige um teste que deu certo (com itens) de **cada** ator, nos últimos 7 dias, no mesmo cliente.
   - A chave da Apify nunca sai do serviço: o teste roda em `/integracoes/agente/sinais/testar`, só na rede interna (o Caddy responde 404 nesse caminho).
8. **Fica com a equipe.** Os sinais de pessoas (troca de cargo, posts do decisor) e os internos continuam com a receita da equipe (adaptadores dedicados, ADR 0055).
9. **Habilidade "Fontes de sinais".** Fica nos 4 agentes de todo cliente, inclusive os novos, e é editável pelo cliente. É o passo a passo que o agente segue.

## Muda em relação à ADR 0055
- Item 2 da 0055 ("o cliente nunca vê ator"): para a receita **do próprio cliente**, o nome do ator aparece na proposta que ele aprova, porque está aprovando aquilo. A habilidade orienta o agente a falar da origem do dado ("LinkedIn Jobs") e não do fornecedor. Custo em dólar continua invisível.
- O ticket 05 de `.scratch/agentes-conversa-direta` (escrever à mão as receitas dos outros 13 sinais) passa a ser feito pelo agente com estas ferramentas.

## Limites conhecidos
- Sinais de pessoas ainda não são montados pelo agente (o genérico não compara retrato anterior).
- "Consertar sozinho" ainda é manual: o catálogo mostra `falhas_recentes` e a habilidade manda trocar a fonte, mas nada dispara o agente quando a coleta falha.
- O preço em créditos da loja é estimativa (plano mais caro da Apify). O custo real de cada teste e coleta fica em `internal` para o superadmin.
- O teto pode ser baixo para atores caros: o ator traz menos itens. É honesto: a fonte cara demais não cabe no preço do sinal.
- Preço do crédito (`src/app/precos.ts`) ainda é provisório. Se mudar, muda também `internal.signal_teto_usd` (migration nova).
