# ADR 0020: Front v18 convertido para React por um conversor, com camada de dados por cima

## Contexto
O front oficial é o protótipo `althius-frontend-v18`, exportado do Claude Design. Ele roda num runtime próprio (`<x-dc>`, template com `sc-if`/`sc-for`/`{{ }}` e uma classe `Component extends DCLogic`). O `src/App.tsx` anterior era uma tela provisória que não usava nada do v18. Redesenhar as 19 telas à mão seria lento e perderia fidelidade, e o design ainda vai ganhar novas versões (v19, v20...).

## Decisão
- `scripts/v18/convert.mjs` converte o protótipo em código do projeto, reproduzindo a semântica do runtime original:
  - `template.html` → `src/v18/template.generated.tsx` (JSX)
  - `component.js.html` → `src/v18/logic.generated.js` (a classe vira `AlthiusLogic extends React.Component`)
  - estilos → `src/v18/althius.css`
- Os arquivos `*.generated.*` **não são editados à mão**. Uma nova versão do design é aplicada trocando a pasta do protótipo e rodando `npm run v18:sync`.
- A ligação com o backend fica **fora** dos arquivos gerados: uma subclasse de `AlthiusLogic` sobrescreve os métodos que tocam dados (carregar workspaces, `can()`, `gastar()`, aprovações etc.) e chama os serviços do Supabase. Assim o design pode evoluir sem apagar a integração.

## Consequências
- Fidelidade visual verificada: screenshots de 21 telas comparadas pixel a pixel com o protótipo, com diferença apenas de suavização de fonte (menos de 300 px em 1,3 milhão).
- Testes de fumaça em `src/v18/v18.test.tsx` protegem a conversão (rota, menu e matriz de papéis).
- O JSX gerado é grande (cerca de 8 mil linhas) e não é idiomático. Telas que precisarem de comportamento muito diferente do protótipo podem ser extraídas para componentes próprios, um módulo por vez.
- Se uma versão nova do design renomear um método que a subclasse sobrescreve, os testes da camada de dados devem falhar e apontar o ponto a ajustar.
