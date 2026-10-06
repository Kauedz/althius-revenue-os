# 01: Fundação da coleta e o primeiro sinal (vagas abertas)

**What to build:** receitas de sinal no banco, o serviço `sinais` com reserva/consumo de crédito, idempotência e registro de execução, e o sinal `vagas_cargo` coletando de verdade (ator `valig/linkedin-jobs-scraper`, reserva `curious_coder/linkedin-jobs-scraper`). O pool da Apify passa a esperar o fim da execução, ler os itens e aplicar teto de gasto e limite de concorrência.

**Blocked by:** None.

**Status:** in-progress

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

- [x] Conta sem a janela nova de vagas não gera evento; vaga repetida (mesma empresa+cargo) não conta duas vezes.
- [x] Rodar duas vezes no mesmo período grava um evento só (idempotência).
- [x] Falha, teto estourado ou resposta vazia: crédito devolvido, execução registrada com motivo, nenhum evento.
- [x] Isolamento: workspace B nunca vê execução ou evento do workspace A (pgTAP).
- [x] Nenhuma tela de cliente mostra dólar; custo real só no superadmin.
- [ ] `npm run verificar` verde. **Pendente:** banco (66 arquivos, 1.627 verificações), tipos e build passam; no front 8 testes falham nesta máquina **com e sem** este ticket (6 do executor do Hermes por rede local, 1 de permissão 0600 do Windows, 1 de tela do aprendizado).

## Comments

- Validado em execução real em 06/10/2026 (uma conta, a Nubank, teto de US$ 0,05): 8 vagas reais viraram eventos, 5 créditos cobrados, conta esquentou um nível, segunda rodada no mesmo período não fez nada. Custo real lido da Apify (US$ 0,0054 numa execução de 11 vagas).
- Limite conhecido: o filtro por empresa usa o nome como o LinkedIn escreve ("Magalu" acha, "Magazine Luiza" não). Ver ADR 0055.
- Pendência de decisão do Nan: quem pode ligar um sinal que gasta créditos sozinho (ADR 0055, "Limites conhecidos").

## Passos do Nan

1. Cadastrar as chaves da Apify na tela Fornecedores (cofre). Nunca colar chave no chat.
2. Conferir no console da Apify o saldo antes da primeira rodada real.
3. Ligar a coleta de vagas (só o superadmin): função `admin_signal_recipe_set('vagas_cargo', true)`. Nada coleta antes disso.
