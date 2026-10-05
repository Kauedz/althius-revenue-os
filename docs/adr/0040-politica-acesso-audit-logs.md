# ADR 0040: Política de acesso do `audit_logs`

## Contexto
Dois achados do PR da auditoria encadeada (ADR 0038):
1. A política de INSERT da migration 0006 deixava **qualquer membro logado** gravar linha de auditoria direto pela API. Com a corrente, a linha falsa entrava encadeada, mas continuava sendo falsa. Um C-level conseguia gravar auditoria no próprio workspace (confirmado em teste antes da correção).
2. A política de leitura citava papéis que não existem mais (`client_admin`, `strategist`). A matriz (capacidade `admin`: "uso global, margens, auditoria e saúde") dá acesso **só ao superadmin**.

Além disso, `anon` e `authenticated` tinham todas as permissões de tabela, inclusive `TRUNCATE`, que o gatilho de imutabilidade (por linha) não pega.

## Decisão
1. **Ninguém logado grava pela API.** A política de INSERT sai. Quem grava: `public.audit_write` e as funções de sistema (todas `SECURITY DEFINER`) e o `service_role`.
2. **Leitura:** política reescrita com o único papel que lê (`superadmin`, membro do workspace). O efeito prático é o mesmo de antes; muda só que o código deixa de enganar. Não ampliei para "superadmin global" porque isso mudaria regra de produto.
3. **Permissões de tabela:** `anon` sem nada; `authenticated` só `SELECT` (a RLS decide quem vê); `service_role` inalterado.

## Consequências
- `src/server/audit.ts` (`recordAuditLog`) grava pelo cliente de tela e **seria negado** se fosse usado com usuário logado. Hoje ninguém o importa. Quando o backend real existir, deve gravar com `service_role` ou por `audit_write`.
- Função nova que precise auditar deve chamar `public.audit_write` (SECURITY DEFINER), nunca `INSERT` direto.
- Decisão aberta para o dono: o superadmin lê só os workspaces dos quais é membro. Se a matriz quiser "global", é uma ADR nova.
