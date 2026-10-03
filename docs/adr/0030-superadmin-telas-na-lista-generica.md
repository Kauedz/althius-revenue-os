# ADR 0030: telas do Superadmin usam a lista genérica do v18, com um formulário simples

## Contexto
O menu do v18 tem a seção Superadmin (Workspaces, Uso global, Fornecedores, Margens, Auditoria, Saúde) e o
documento de regras prevê "criação de workspace pelo superadmin", mas o protótipo não desenhou nenhuma
dessas telas: elas mostram só "chega na fase N". Sem elas não dá para cadastrar um cliente.

## Decisão
- As 6 telas usam a **lista genérica** do v18 (a mesma de Contas, Sinais e Caixa de entrada), com títulos,
  colunas e números vindos do banco. Nada de layout novo.
- Para criar cliente, entra um **formulário simples dentro da lista** (campos, erro, salvar e cancelar),
  com as classes de estilo que o v18 já usa em Configurações. Regra no conversor (`scripts/v18/patches.mjs`),
  reaproveitável por outras listas.
- Ganchos genéricos no conversor: botão principal da página (`acaoDaPaginaReal`), abrir linha
  (`aoAbrirLinhaReal`) e ação de linha (`acaoDeLinhaReal`) passam pela camada do banco no modo real.
- As chaves dos agentes (ADR 0024) são geradas e revogadas pela tela Workspaces; a chave aparece uma única vez.
- Fornecedores nunca mostram chave, token ou segredo. Custo real do fornecedor só para o superadmin (ADR 0021).

## Consequências
- Quando o design desenhar essas telas, a regra do formulário e as definições de colunas em `AlthiusApp`
  são substituídas; o banco e os serviços (`src/app/servicos/admin.ts`) continuam iguais.
- O convite do C-level fica pendente até o conector de e-mail existir (ADR 0025).
