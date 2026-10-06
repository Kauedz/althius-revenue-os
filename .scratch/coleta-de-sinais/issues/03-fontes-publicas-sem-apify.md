# 03: Fontes públicas sem Apify (notícias, rodada, Receita, licitações)

**What to build:** `noticias_empresa` (RSS do Google News), `rodada_investimento` (RSS com termos de captação mais fatos relevantes da CVM, com classificação por IA), `receita_federal` (BrasilAPI) e `licitacoes_publicas` (API do PNCP filtrando pelos CNPJs das contas).

**Blocked by:** 01.

**Status:** ready-for-agent

## Pode mexer

- Fontes públicas atrás da interface `FonteDeSinal`, com versão falsa nos testes.
- Receitas dos 4 sinais.

## Não mexa

- Nos demais tickets.

## Critérios

- [ ] Espaçar chamadas e respeitar o uso justo de cada fonte; fonte fora do ar = erro claro e crédito devolvido.
- [ ] Notícia e rodada guardam só título, link, data e fonte.
- [ ] Licitações lê a janela uma vez por semana para todos os clientes e filtra por CNPJ.
- [ ] `npm run verificar` verde.

## Passos do Nan

1. Confirmar que o uso do RSS do Google News é aceitável para o produto (é uso não oficial).
