# ADR 0055 — Coleta de sinais pela Apify e fontes públicas

Status: aceita
Data: 2026-10-06
Relacionadas: 0021 (créditos, nunca dólar), 0023 (segurança do banco), 0049 (cofre de chaves e rodízio da Apify), 0042 (motor por banco), 0054 (conectores "Em breve")

## Contexto
O catálogo de 20 sinais, a tela e o registro de um evento já existiam, mas nada coletava. O rodízio de chaves da Apify estava pronto e ninguém o chamava. A descoberta de 06/10/2026 (`docs/sinais/atores-por-sinal.md`) testou atores e fontes públicas reais para os 16 sinais externos. O protótipo AppAlthius já tinha um coletor validado em execução real, que foi usado como base (`docs/reaproveitamento-appalthius.md`).

## Decisão
1. **O banco decide, o serviço busca.** `signal_collect_next` escolhe as contas, reserva o crédito (+25% de folga, como nas outras ações) e devolve só o necessário. O serviço Node `sinais` busca o dado fora e entrega com `signal_collect_finish`, ou avisa a falha com `signal_collect_fail`. Funções só para `service_role` (ADR 0023).
2. **Receita por sinal** em `internal.signal_recipes`: lista ordenada de fontes (ator, teto de gasto, máximo de itens, marca de reserva). Fica no schema `internal`: o cliente nunca vê ator nem custo. **Nasce desligada**; o superadmin liga com `admin_signal_recipe_set`. A tela só descobre, por `signal_codes_com_coleta()`, quais sinais já coletam.
3. **Uma coleta por conta + sinal + período** (`internal.signal_runs`, chave única). A frequência (diária, semanal ou mensal, a do cliente ou a do catálogo) define o período. Rodar de novo no mesmo período não faz nada. Erro volta depois de 1 hora e desiste na 3ª tentativa. Sem saldo, não reserva nem executa e tenta de novo depois.
4. **Mesmo acontecimento não vale duas vezes**: `signal_events.event_key` com índice único por conta + sinal. Uma coleta esquenta a conta **uma vez**, não uma por evento.
5. **Falha nunca vira evento.** Erro, teto estourado, resposta vazia por bloqueio: execução registrada com o motivo, crédito devolvido (`credit_consume` com consumo 0 libera a reserva inteira). Resposta válida sem acontecimento novo é "sem novidade" e **cobra**, porque a varredura foi feita.
6. **Teto de gasto em toda chamada** (`maxTotalChargeUsd`); sem teto o rodízio recusa. Custo real lido da execução, com releitura (a Apify fecha a conta segundos depois) e guardado só em `internal.signal_runs`. Se não der para saber, fica nulo, nunca estimado.
7. **Apify atrás da nossa interface.** O ciclo recebe o coletor por injeção; os testes usam versão falsa. Nenhum teste chama API real.
8. **Aviso "em breve" por sinal.** A tela troca o aviso só para os sinais com receita ligada.

## Limites conhecidos (honestos)
- O filtro por empresa usa o nome **como o LinkedIn escreve** ("Magalu" acha vagas; "Magazine Luiza" não achou nenhuma). Conta com nome diferente volta "sem novidade". Caminho: guardar a página da empresa no LinkedIn na conta (hoje a conta só tem nome e domínio).
- Quando o sinal está ligado (padrão do catálogo `default_on` ou ajuste do cliente) e a receita está ligada, **toda conta ativa do cliente é coletada** e cobra créditos. Hoje o estrategista pode ligar um sinal (política de `workspace_signal_settings`). **Isto precisa de decisão do dono:** pela regra "quem paga decide o gasto", ligar um sinal que gasta créditos automaticamente deveria passar pelo C-level (ou por um teto aprovado). Não mudei essa política sozinho.
- Plano grátis da Apify: 5 execuções ao mesmo tempo (`SINAIS_CONCORRENCIA`, padrão 3).
- Raspar o LinkedIn tem risco de termos de uso; o ator pode sumir ou mudar.

## Câmbio de referência
Para comparar o custo do fornecedor (US$) com o preço de venda (R$ por crédito), vale **R$ 5,50 por US$ 1** (indicado pelo dono em 06/10/2026). Só para análise interna; nenhuma tela de cliente mostra dólar.

## Execução
Serviço `sinais` no Docker, a cada `SINAIS_INTERVALO_MINUTOS` (padrão 30), até `SINAIS_PEDIDOS_POR_RODADA` (padrão 20) contas por rodada, nunca duas rodadas juntas. O log só mostra números.
