# ADR 0069 — Orçamento de coleta por cliente, chamas pelo fit e Caixa em todos os canais

Status: aceita
Data: 2026-10-07
Relacionadas: 0021 (créditos, nunca dólar), 0062 (enriquecimento), 0066 (sinais monitorados), 0067 (prospecção, ICP, fit), 0068 (Copiloto e Caixa em conversa). Esta ADR **substitui** o limite de 60 perguntas do Copiloto e a regra "LinkedIn e Instagram ainda não respondem", da 0068.

## Contexto
O cliente paga uma assinatura mensal fixa (valor combinado em contrato) e recebe créditos todo mês. A Althius paga, por cliente, a coleta (Apify), as mensagens (Unipile) e o modelo de IA. O custo da coleta não pode passar do que o cliente paga, mesmo que ele gaste todos os créditos. O Nan também pediu: Copiloto gratuito com 100 perguntas por dia, pesos do fit confirmados, a palavra "fria" proibida na plataforma, resposta no LinkedIn e no Instagram, tela para o teto de sinais e uma decisão sobre o agente propor fontes de busca.

## Decisões

1. **Orçamento de coleta em dólar, por cliente e por mês (padrão US$ 50).** Vale para tudo o que usa a Apify: sinais automáticos, enriquecimento, prospecção (estimar e fila) e teste de fonte do agente. É uma **segunda trava**, além dos créditos do cliente: valem as duas.
   - Gasto do mês = custo real das coletas já fechadas; se o fornecedor ainda não fechou a conta, vale o teto do crédito cobrado (nunca zero); o que está em andamento conta pelo teto reservado. Mês de Brasília.
   - Antes de reservar qualquer coleta, o banco confere se cabe (com a folga de 25% da reserva). Se não cabe, **nada é reservado nem gasto**: o sinal espera, o enriquecimento fica "sem saldo" e volta sozinho, a busca da fila vira erro explicado, e a Zoe já recebe o aviso ao estimar.
   - O dólar existe só em `internal.coleta_orcamento` e na tela **Uso global** do superadmin (que ajusta o orçamento de cada cliente). O cliente vê só a porcentagem usada e "restam cerca de N créditos de coleta" (`coleta_painel`).
   - Conta de referência: 1 crédito vale no máximo US$ 0,0096 (R$ 0,0529 ao dólar de R$ 5,50). Os US$ 50 equivalem a cerca de 5.200 créditos de coleta no teto; na prática, como o custo real é menor que o teto do crédito, cabe mais.

2. **Preço da prospecção pelo retorno sobre o custo.** Google Maps passa de 1 para **2 créditos por empresa nova** (custo na Apify perto de US$ 0,005 por empresa; margem de ~74% sobre o teto do crédito). Com 1 crédito, gastar os 10 mil créditos só em busca custaria perto dos US$ 50 inteiros e não sobraria nada para o resto. Receita por CNAE fica em 1. A tela **Margens** do superadmin mostra, por fonte, o preço e a **margem real medida** nas buscas já feitas ("sem busca medida" quando ainda não há dado), e o superadmin pode mudar o preço (`admin_prospect_source_price_set`).

3. **Copiloto gratuito, 100 perguntas por pessoa por dia.** Decisão do Nan; o limite protege o custo do modelo.

4. **Fit e chamas.** Pesos confirmados: perfil do ICP até 60, sinais recentes até 25, dados completos até 15. As **chamas** da conta (a antiga "temperatura") saem da nota: **70 a 100 = 3 chamas (Muito quente), 45 a 69 = 2 (Quente), até 44 = 1 (Aquecendo)**. O banco recalcula junto com o fit, então quem grava não escolhe a chama e ela nunca discorda da nota. **Não existe "fria"**: toda conta é uma empresa que vale a conversa; um teste varre o produto atrás da palavra.
   - Efeito colateral aceito: sinal novo já não "esquenta" a conta sozinho; ele entra na nota (até 25 pontos). O aviso "Sinal quente" dispara quando a conta fica com 3 chamas.

5. **Caixa de entrada responde pelo LinkedIn e pelo Instagram, DENTRO da conversa que já existe** (a Unipile recebe o id do chat; é diferente do e-mail e do WhatsApp, que mandam mensagem nova). Mesma política, mesmo preço (4 créditos) e mesma reserva. Proteção da conta de quem conectou: no máximo **50 respostas por dia** nesses dois canais, por pessoa. **Começar conversa nova** (convite, InMail) **não entra**: é decisão de produto à parte, com risco de bloqueio da conta.

6. **Teto de sinais ganha tela.** Na página Sinais aparecem "Coleta do mês", "Sinais no mês (X de teto)" e "Contas monitoradas"; o C-level e o superadmin têm o botão "Ajustar teto de sinais" (a estrategista só vê).

7. **O agente NÃO propõe nem cadastra fontes de prospecção.** As fontes são do catálogo da Althius, porque cada uma tem custo, qualidade e risco de LGPD. A Zoe escolhe entre as existentes; se nenhuma serve, diz isso e orienta a falar com a Althius. (Para sinais, o agente continua podendo testar e propor fonte, com aprovação do cliente: ADR 0060, onde o custo é de poucos créditos por conta.) Se o Nan quiser, o próximo passo é um "pedido de fonte" que chega ao superadmin.

8. Removido `src/server/providers/unipile.ts`: era um cliente antigo, sem uso, que **simulava sucesso** quando faltava a chave. O envio real é o de `src/server/cadencia/envio.ts`, que nunca simula.

9. **Unipile v1 e v2.** O Nan tem uma conta v1 (endereço próprio, como api68.unipile.com:19840, caminhos /api/v1), e o projeto nasceu na v2. O código fala com as duas: a versão vem de UNIPILE_API_VERSION ou do formato do endereço. Na v1: e-mail em JSON, chats em multipart (responder dentro do chat existente no LinkedIn e no Instagram), link de conexão com aviso por endereço próprio (a Unipile não deixa pôr cabeçalho nele, então o endereço leva uma chave HMAC só daquele pedido, que vale apenas para aviso de conexão), e webhooks autenticados por cabeçalho secreto Unipile-Auth. A leitura dos avisos da v1 segue a documentação e **ainda não foi vista com tráfego real**.

## Consequências
- Migrations 138 a 141 e testes pgTAP 00090 a 00093; ajustes nos testes que dependiam de a chama ser escolhida na gravação (00012, 00013, 00024, 00069).
- `npm run unipile:conferir` (somente leitura por padrão) confere a Unipile com a chave real: lista contas e chats; só envia com `--enviar` e uma conversa indicada.

## Limites conhecidos
- O envio no LinkedIn/Instagram segue a documentação v2 da Unipile e **ainda não foi testado em conta real**.
- O orçamento conta o que o banco sabe: um job que passa do teto reservado por conta do fornecedor só aparece quando a coleta fecha. Como a fila reserva poucos jobs por vez, o estouro possível é de poucos centavos.
- A margem real por fonte só aparece depois das primeiras buscas reais (hoje todas rodam com o serviço falso nos testes).
- Os custos da Unipile e do modelo não entram no orçamento de coleta (a Unipile é preço fixo por conta conectada; o modelo tem o limite diário do Copiloto e o registro de uso).
