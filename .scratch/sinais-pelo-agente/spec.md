# O agente acha, testa e propõe a fonte de cada sinal

Status: fatia 1 implementada (06/10/2026). Origem: pedido do Nan em 06/10/2026: "tem que funcionar igual o Claude: com a chave da Apify e internet, a IA busca o melhor ator para o sinal descrito, mescla atores e aprende; não dá para ficar cadastrando ator dentro do app". ADR 0060.

## Problem Statement
Cada sinal externo precisava de uma receita escrita à mão (ator + adaptador + superadmin ligando). Só 3 de 16 sinais coletavam, e sinal pedido por cliente ("quero saber quando X abrir filial") não tinha caminho.

## Solution
O agente pesquisa na loja da Apify, lê a fonte, testa numa conta do cliente (com crédito e teto), ajusta o mapeamento até os eventos fazerem sentido e propõe a receita. Uma pessoa aprova. A coleta de sempre passa a usar a receita do cliente, só naquele cliente.

## User Stories
1. Como estrategista, quero pedir à Lia "comece a coletar notícias das minhas contas" e ela achar a fonte sozinha.
2. Como C-level, quero aprovar a fonte vendo de onde vem o dado e quanto custa em créditos por conta.
3. Como C-level, quero que o teste gaste no máximo o preço de uma coleta e que, se falhar, eu não pague.
4. Como estrategista, quero que um item de outra empresa nunca vire sinal da minha conta.
5. Como cliente, quero que a fonte que aprovei valha só para mim.
6. Como dono, quero que a coleta nunca custe mais em dólar do que cobra em créditos.

## Implementation Decisions
Ver ADR 0060. Arquivos:
- Banco: `supabase/migrations/20261002000125_sinais_pelo_agente.sql`, teste `supabase/tests/database/00077_sinais_pelo_agente.sql`.
- Coletor: `src/server/sinais/adaptadores/generico.ts` e uma mudança pequena em `src/server/sinais/ciclo.ts` (fonte com mapeamento usa o genérico).
- Loja: `src/server/sinais/loja-apify.ts` (endereços públicos, preço em créditos).
- Teste: `src/server/sinais/agente.ts` + rota `/integracoes/agente/sinais/testar` (`src/server/webhooks/servidor.ts` e `principal.ts`). `docker/Dockerfile.webhooks` passou a copiar `sinais` e `providers`.
- Agente: 5 ferramentas em `src/server/mcp/ferramentas.ts` e `althius.ts`. Habilidade "fontes-de-sinais" semeada pela migration.

## Testing Decisions
- pgTAP: permissões, catálogo sem dólar, teste só com pessoa pedindo, conta de outro cliente recusada, crédito reservado/cobrado/devolvido, proposta só depois de teste bom, validação do mapeamento, aprovação aplica, coleta usa a receita só no cliente certo, habilidade semeada.
- Vitest: adaptador genérico (variáveis, vínculo empresa/domínio, janela, chaves), ciclo com receita do agente, serviço de teste (crédito, falhas, nunca dólar), loja (preço em créditos, sem chave, sem "$"), ferramentas MCP e rota HTTP.
- Nenhum teste chama Apify, modelo ou app real.

## Out of Scope (próximas fatias, ver issues)
- Sinais de pessoas pelo agente.
- Conserto automático quando a coleta falha.
- Sinal personalizado do cliente (descrição livre → sinal novo no catálogo).
- Tela do superadmin com o custo real dos testes.
