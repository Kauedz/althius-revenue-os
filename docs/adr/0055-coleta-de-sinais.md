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
- O filtro por empresa usa o nome **como o LinkedIn escreve** ("Magalu" acha vagas; "Magazine Luiza" não achou nenhuma). **Solução (ticket 02):** a conta ganhou `linkedin_company_name` e `linkedin_company_url`; as vagas usam o nome do LinkedIn quando existe. Enquanto o campo estiver vazio (nada o preenche ainda), conta com nome diferente volta "sem novidade". Falta uma tela, importação ou agente que preencha esses campos.
- Quando o sinal está ligado (padrão do catálogo `default_on` ou ajuste do cliente) e a receita está ligada, **toda conta ativa do cliente é coletada** e cobra créditos. **Decidido pelo dono (06/10/2026):** o C-level **ou** o estrategista podem ligar um sinal por conta própria; a política atual de `workspace_signal_settings` já é essa e não muda. O gasto continua limitado pelo saldo de créditos (reserva antes de cada coleta; sem saldo, não coleta).
- Plano grátis da Apify: 5 execuções ao mesmo tempo (`SINAIS_CONCORRENCIA`, padrão 3).
- Raspar o LinkedIn tem risco de termos de uso; o ator pode sumir ou mudar.

## Câmbio de referência
Para comparar o custo do fornecedor (US$) com o preço de venda (R$ por crédito), vale **R$ 5,50 por US$ 1** (indicado pelo dono em 06/10/2026). Só para análise interna; nenhuma tela de cliente mostra dólar.

## Execução
Serviço `sinais` no Docker, a cada `SINAIS_INTERVALO_MINUTOS` (padrão 30), até `SINAIS_PEDIDOS_POR_RODADA` (padrão 20) contas por rodada, nunca duas rodadas juntas. O log só mostra números.

## Sinais de pessoas (ticket 02)
- **Troca de cargo** (`harvestapi/linkedin-profile-scraper`) e **posts do decisor** (`harvestapi/linkedin-profile-posts`) olham até 5 contatos com LinkedIn por conta (decisor, depois campeão e influenciador). Conta sem contato com LinkedIn nem é pedida: não reserva crédito.
- **Retrato anterior** em `internal.signal_snapshots` (cargo e empresa atuais). A **primeira leitura só guarda o retrato**: nunca inventa mudança. Mudou de empresa ou de cargo = acontecimento. Perfil sem cargo atual não prova que a pessoa saiu: nada é concluído e o retrato anterior fica. O retrato só é gravado depois de o resultado ser entregue, e só de contatos da própria conta.
- **Endereço do perfil como foi cadastrado:** o identificador do LinkedIn diferencia maiúsculas e minúsculas; o banco normaliza para minúsculas só para busca, então o pedido usa o valor original.
- **Casamento do perfil com o contato** pelo identificador público. Endereço do tipo "código" (`/in/ACw...`) não casa com nada que o ator devolve; só no caso de **um único contato** na conta o perfil devolvido é atribuído a ele. Com vários contatos, perfil sem casamento não é atribuído a ninguém.
- Fonte que devolve **só itens de erro** é falha (crédito devolvido), não "sem novidade".
- Dado de pessoa: só dado profissional público, com origem e data, dentro do workspace do cliente (LGPD).
