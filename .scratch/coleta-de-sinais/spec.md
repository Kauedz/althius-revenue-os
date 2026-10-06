# Spec: Coleta de sinais

**Status:** ready-for-agent

**Frente:** Sinais (backend real). Catálogo e tela já existem (`supabase/migrations/20261002000013_signals_apify_catalog.sql`, tela de Sinais). Falta **coletar de verdade**.
Relatório de fontes testadas: [`docs/sinais/atores-por-sinal.md`](../../docs/sinais/atores-por-sinal.md).
Material reaproveitável do protótipo: `AppAlthius/supabase/functions/signal-runner/adaptadores/` e `AppAlthius/.scratch/sinais-reais/`.
Regras: `AGENTS.md` (créditos nunca dólar; nunca inventar dado; GRANT explícito; RLS por workspace; nenhum teste chama API real).

## Problem Statement

A plataforma tem 20 sinais no catálogo, mas **nada coleta**. O rodízio de chaves da Apify (`criarPoolApify`) está pronto e testado, mas ninguém o chama; não há receita por sinal nem agendador. Hoje a tela de Sinais mostra "Coleta automática em breve".

## Solution

1. Uma **receita por sinal** no banco (`signal_recipes`): lista ordenada de fontes (ator da Apify ou fonte pública), modelo de entrada, mapeamento da saída para o evento e custo máximo por conta.
2. Um serviço Node **`sinais`** (padrão dos serviços `cadencia` e `aprendizado`) que, na frequência de cada sinal, para cada workspace com o sinal LIGADO e cada conta: reserva crédito, roda as fontes da receita, consome o crédito real, registra o evento com a função existente `process_signal_event` e chave de idempotência por conta+sinal+período.
3. Erro de coleta = registro claro, crédito devolvido, **nunca evento inventado**.
4. Quando um sinal passar a coletar de verdade, sai o aviso "Coleta automática em breve" **só dele**.

## Decisões já tomadas (da descoberta de 06/10/2026)

- 16 sinais externos; 4 internos ficam fora. Detalhe por sinal no relatório.
- **5 sinais não usam Apify** (notícias, rodada, Receita, licitações, parte de nova filial): fontes públicas gratuitas.
- Importação por NCM, expositores de feiras e Reclame Aqui dentro de 3 créditos **não têm solução boa**; ficam "Em breve" até decisão do Nan (ticket 07).
- A Apify exige: esperar a execução terminar, ler os itens, **teto de gasto por execução** (`maxTotalChargeUsd`), no máximo 5 execuções ao mesmo tempo no plano grátis.
- Site que bloqueia robô (403) ou resposta vazia **é erro**, não evento.

## Implementation Decisions

- Tabela `public.signal_recipes` (catálogo global, só superadmin escreve, `authenticated` lê só o que o cliente pode ver, sem custo em dólar na leitura do cliente). Custo real do fornecedor em `internal`, só superadmin.
- Tabela de execuções `internal.signal_runs` (sinal, workspace, conta, período, chave de idempotência única, estado, itens, custo estimado, mensagem).
- Funções novas nascem sem permissão; `service_role` só para funções do sistema (ADR 0023).
- Fonte atrás de uma interface nossa com versão falsa para teste (`FonteDeSinal`), no padrão de `src/server/providers/`.
- Serviço com Dockerfile próprio e entrada em `docker-compose.yml`, nunca duas rodadas ao mesmo tempo, log só com números.

## Testing Decisions

- pgTAP: RLS e isolamento entre dois workspaces; idempotência; crédito reservado, consumido e devolvido.
- Vitest: serviço com Apify falsa (sucesso, teto estourado, 403/vazio, falha, repetição, sinal desligado).
- Nenhum teste chama API real.

## Out of Scope

- Sinais internos (objeções, duplicidade, negócio parado, contato inválido).
- Chave de Apify do cliente (nunca; ADR 0049).
- Importação por NCM, expositores e seguidores de concorrente até a decisão do Nan.

## Further Notes

Tickets em `issues/`. 01 é a fundação e já entrega um sinal de ponta a ponta. 02 a 06 dependem do 01 e podem andar em PRs separados. 07 é decisão do dono.
