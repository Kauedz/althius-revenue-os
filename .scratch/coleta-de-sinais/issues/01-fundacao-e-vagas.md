# 01: Fundação da coleta e o primeiro sinal (vagas abertas)

**What to build:** receitas de sinal no banco, o serviço `sinais` com reserva/consumo de crédito, idempotência e registro de execução, e o sinal `vagas_cargo` coletando de verdade (ator `valig/linkedin-jobs-scraper`, reserva `curious_coder/linkedin-jobs-scraper`). O pool da Apify passa a esperar o fim da execução, ler os itens e aplicar teto de gasto e limite de concorrência.

**Blocked by:** None.

**Status:** ready-for-agent

## Pode mexer

- Migration nova (próximo número depois de `20261002000116`) com `signal_recipes`, `internal.signal_runs` e as funções do sistema, mais pgTAP.
- `src/server/providers/apify-pool.ts` (esperar, ler itens, teto, build, memória, concorrência) e seu teste.
- `src/server/sinais/` (novo), `docker/Dockerfile.sinais`, entrada em `docker-compose.yml`.
- Tela de Sinais: só o aviso "em breve" do sinal `vagas_cargo`.
- `docs/adr/` com a decisão do desenho do coletor.

## Não mexa

- Em `src/v18/*.generated.*` (mudança de tela = regra em `scripts/v18/patches.mjs` + `npm run v18:sync`).
- Em migrations já commitadas, `.githooks/`, `scripts/guardas.mjs`.
- Nos sinais internos.

## Critérios

- [ ] Conta sem a janela nova de vagas não gera evento; vaga repetida (mesma empresa+cargo) não conta duas vezes.
- [ ] Rodar duas vezes no mesmo período grava um evento só (idempotência).
- [ ] Falha, teto estourado ou resposta vazia: crédito devolvido, execução registrada com motivo, nenhum evento.
- [ ] Isolamento: workspace B nunca vê execução ou evento do workspace A (pgTAP).
- [ ] Nenhuma tela de cliente mostra dólar; custo real só no superadmin.
- [ ] `npm run verificar` verde.

## Passos do Nan

1. Cadastrar as chaves da Apify na tela Fornecedores (cofre). Nunca colar chave no chat.
2. Conferir no console da Apify o saldo antes da primeira rodada real.
