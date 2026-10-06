# 02: Achar o site e o CNPJ

**What to build:** sem domínio, achar o site pela busca (Apify, por exemplo um ator de resultados do Google). Com o site, ler a página inicial e as páginas de rodapé ("quem somos", privacidade, contato) atrás do CNPJ (regex com dígito verificador). Sem CNPJ no site, busca "CNPJ + nome". O CNPJ achado por busca só é aceito se a razão social da Receita bater com o nome da conta (a mesma regra de `mesmaEmpresa`).

**Blocked by:** 01.

**Status:** ready-for-agent (depois da 01)

## Critérios
- [ ] CNPJ validado pelo dígito verificador; dúvida = não preenche.
- [ ] Site achado por busca não pode ser rede social, diretório nem marketplace.
- [ ] Testes com HTML e busca falsos.
