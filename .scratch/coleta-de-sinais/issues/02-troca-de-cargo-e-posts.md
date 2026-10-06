# 02: Troca de cargo do decisor e posts do decisor (LinkedIn)

**What to build:** `troca_cargo` (perfil dos decisores mapeados comparado com o retrato anterior; busca de nova liderança por empresa como opção) e `posts_decisor` (posts recentes do decisor e da empresa), com `harvestapi/*`.

**Blocked by:** 01.

**Status:** in-progress

## Pode mexer

- Receitas e adaptadores de `troca_cargo` e `posts_decisor` em `src/server/sinais/`, com teste sem rede.
- Tabela do "retrato anterior" do perfil, com RLS por workspace.

## Não mexa

- Nos tickets 03 a 07 sem combinar.

## Critérios

- [x] Mudança de empresa e promoção são distinguidas; perfil sem mudança não gera evento.
- [x] Guardar só dado profissional público, com origem e data (LGPD).
- [x] Custo por conta dentro do que os créditos pagam (relatório: a busca de nova liderança passa de 5 créditos; fica opcional).
- [ ] `npm run verificar` verde.

## Comments

- Validado em execução real em 06/10/2026 (um contato, rodada 1 e 2): baseline sem evento; com cargo antigo simulado, 1 evento "mudou de empresa", conta esquentou, retrato atualizado. Custo por conta: US$ 0,004 por perfil e US$ 0,002 por post.
- Decidido pelo dono: C-level ou estrategista ligam o sinal. A busca de nova liderança por empresa (`linkedin-profile-search`) fica fora: US$ 0,10 por página passa do que 5 créditos pagam.
- As colunas `linkedin_company_name` e `linkedin_company_url` da conta existem, mas nada as preenche ainda (falta tela, importação ou agente).

## Passos do Nan

1. Ligar as receitas (superadmin): `admin_signal_recipe_set('troca_cargo', true)` e `admin_signal_recipe_set('posts_decisor', true)`.
2. Se o console da Apify pedir aprovação de permissão do ator na primeira execução, aprovar.
