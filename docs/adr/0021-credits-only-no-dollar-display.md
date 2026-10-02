# ADR 0021: A plataforma mostra só créditos, nunca dólar (substitui a ADR 0013)

## Contexto
A ADR 0013 adotou o padrão do front v18: mostrar "1 crédito = US$ 0,005" e o saldo convertido em dólar. Em 2026-10-02 o dono do produto decidiu o contrário: o cliente não deve ver a quantidade de dólares (por exemplo, "10.000 créditos = US$ 50"). Na plataforma só existe a palavra "créditos".

## Decisão
- Nenhuma tela de cliente (C-level, BDR) nem do estrategista mostra valores em dólar ou a conversão crédito → dólar.
- O preço de compra de créditos aparece em **reais** (`src/app/precos.ts`). O valor atual (10.000 créditos = R$ 529,00, linear) é provisório e precisa de confirmação comercial.
- O custo real do fornecedor em dólar continua existindo só para o superadmin (detalhe de execução "Custo real · somente superadmin" e os painéis internos `admin/*`), como prevê o documento de papéis (`exec.cost`, `admin`).
- No front v18, a regra é aplicada pelas regras de produto em `scripts/v18/patches.mjs` a cada `npm run v18:sync`. O teste "tela de Créditos não mostra dólar" protege a regra.

## Consequências
- A ADR 0013 fica substituída.
- Se uma versão nova do design voltar a mostrar dólar no mesmo lugar, o conversor falha ao aplicar a regra ou o teste falha, e nada passa em silêncio.
- A tabela de pacotes ainda precisa de decisão comercial final (valores em reais por pacote).
