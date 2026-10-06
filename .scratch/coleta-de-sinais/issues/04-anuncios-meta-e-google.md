# 04: Anúncios ativos (Meta e Google)

**What to build:** `anuncios_ativos` com `curious_coder/facebook-ads-library-scraper` e `silva95gustavo/google-ads-scraper`, confirmando a conta certa pelo CNPJ do anunciante.

**Blocked by:** 01.

**Status:** ready-for-agent

## Pode mexer

- Receita e adaptador de `anuncios_ativos`; registro da foto por execução para detectar "começou" ou "parou" de anunciar.

## Não mexa

- LinkedIn Ads: não validou (mínimo de 25 resultados e a busca por nome devolveu 0). Fica fora até novo teste.

## Critérios

- [ ] Anúncio de outra empresa (nome parecido) é descartado pelo CNPJ.
- [ ] Respeitar os mínimos do ator (Meta: 10 anúncios, 512 MB).
- [ ] `npm run verificar` verde.

## Passos do Nan

Nenhum além do ticket 01.
