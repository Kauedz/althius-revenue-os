# 02: Achar o site e o CNPJ

**What to build:** sem domínio, achar o site pela busca (Apify, por exemplo um ator de resultados do Google). Com o site, ler a página inicial e as páginas de rodapé ("quem somos", privacidade, contato) atrás do CNPJ (regex com dígito verificador). Sem CNPJ no site, busca "CNPJ + nome". O CNPJ achado por busca só é aceito se a razão social da Receita bater com o nome da conta (a mesma regra de `mesmaEmpresa`).

**Blocked by:** 01.

**Status:** feito em 06/10/2026. A metade "achar o site" caiu: `accounts.domain` é obrigatório, toda conta já tem site. O CNPJ por busca (Google, conferido na Receita) está em `src/server/enriquecimento/` (ADR 0062).

## Critérios
- [x] CNPJ validado pelo dígito verificador; dúvida = não preenche.
- [x] (não se aplica: o site é o domínio da conta)
- [x] Testes com HTML e busca falsos.
