# ADR 0022: Login real e camada de dados sobre o front v18 (modo real x modo demonstração)

## Contexto
O front v18 foi convertido para React (ADR 0020), mas ainda lia só os dados fictícios do protótipo, deixava qualquer pessoa trocar de papel pelo avatar e não tinha senha no login. Cliente real precisa entrar com a própria conta e ver só o que o papel dele permite.

## Decisão
- **Dois modos**, escolhidos por `VITE_ALTHIUS_MODO`:
  - `real` (padrão): login com e-mail e senha (Supabase Auth); dados e permissões do banco.
  - `demo`: o protótipo como era, com dados fictícios e troca de papel, para apresentação comercial.
- `src/app/contexto.ts` lê do banco o que a pessoa enxerga: perfil (`public.profiles`, migration 0022), workspaces com o papel em cada um, a matriz `role_permissions` e os membros. A filtragem é feita pela RLS; o front não decide quem vê o quê.
- `src/app/dados.ts` (função pura) converte isso para o formato do protótipo (`window.ALTHIUS_DATA`, `window.ALTHIUS_CAPS`), mantendo os nomes de campo do contrato.
  - Uma capacidade libera a ação direto quando o escopo é **Sim** ou **Atribuídos**. "Só o seu", "Só ver" e "Pede" são tratados tela a tela, como no protótipo.
  - O C-level é `clevel` no banco e continua `cliente` dentro do front (ADR 0011).
  - Telas ainda não ligadas ao banco continuam com os dados do protótipo até a fatia delas.
- `src/app/AlthiusApp.ts` herda a lógica gerada e sobrescreve só `papel()`, `wsPermitidos()`, `membros()` e "Sair". As regras de produto em `scripts/v18/patches.mjs` escondem "Modo demonstração · papel" e "Ver como…" fora da demonstração.
- Erros de carga aparecem como tela de erro com "Tentar de novo"; nada é inventado (o `src/lib/supabase.ts` falha cedo se faltar configuração).

## Consequências
- Testes: `src/app/dados.test.ts` (adaptador), `src/app/contexto.test.ts` e `src/app/Raiz.test.tsx` rodam contra o Supabase local com o seed (são pulados com aviso se o banco estiver fora do ar).
- A troca de papel deixou de existir para cliente real: o papel vem só do banco.
- Ainda vêm do protótipo: Início, Aprovações, Créditos, Execuções, Contas, Pipeline etc. Cada uma vira uma fatia própria.
- A tela de login (`src/app/Login.tsx`) é a única tela escrita à mão: o protótipo não tem campo de senha. Ela copia o visual da tela de entrada do v18; se o design mudar essa tela, ela precisa ser ajustada à mão.
- Papel vale por workspace. O seletor de workspaces só aparece para quem tem `ws.switch` (superadmin e estrategista); C-level e BDR ficam no workspace aberto.
- Na saída (ou sessão expirada) o app apaga do navegador a foto e o histórico do copiloto, que o protótipo guarda sem separar por pessoa.
- O e-mail do perfil só muda pelo login (`auth.users`); a pessoa edita apenas nome e foto. A origem "Althius" na lista de membros ainda é deduzida do domínio do e-mail (`@althius.com.br`).
