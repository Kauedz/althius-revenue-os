# 02: Troca de cargo do decisor e posts do decisor (LinkedIn)

**What to build:** `troca_cargo` (perfil dos decisores mapeados comparado com o retrato anterior; busca de nova liderança por empresa como opção) e `posts_decisor` (posts recentes do decisor e da empresa), com `harvestapi/*`.

**Blocked by:** 01.

**Status:** ready-for-agent

## Pode mexer

- Receitas e adaptadores de `troca_cargo` e `posts_decisor` em `src/server/sinais/`, com teste sem rede.
- Tabela do "retrato anterior" do perfil, com RLS por workspace.

## Não mexa

- Nos tickets 03 a 07 sem combinar.

## Critérios

- [ ] Mudança de empresa e promoção são distinguidas; perfil sem mudança não gera evento.
- [ ] Guardar só dado profissional público, com origem e data (LGPD).
- [ ] Custo por conta dentro do que os créditos pagam (relatório: a busca de nova liderança passa de 5 créditos; fica opcional).
- [ ] `npm run verificar` verde.

## Passos do Nan

1. Se o console da Apify pedir aprovação de permissão do ator na primeira execução, aprovar.
