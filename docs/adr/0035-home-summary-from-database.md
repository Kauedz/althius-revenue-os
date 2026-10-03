# ADR 0035: Início (Home) alimentado pelo banco de dados com isolamento e respeito a papéis

## Contexto
O painel de Início (Home) lia dados fictícios através de `D.homeService.summary()`. Os números essenciais da operação (contas qualificadas, execuções ativas, alertas e bloqueios, aprovações pendentes e saldo de créditos) precisam vir do banco em tempo real, respeitando o papel do usuário no workspace (ex.: BDR vê somente suas contas atribuídas na matriz "só o seu", e não vê o bloco de operações nem custos).

## Decisão
1. **Função `public.get_home_summary(p_workspace_id UUID, p_member_id UUID)` no Postgres**:
   - `SECURITY DEFINER`, com `assert_caller_is_member(p_member_id)` e validação de que o membro pertence e está ativo no workspace `p_workspace_id`.
   - `REVOKE ALL` de `PUBLIC`, `anon`, `authenticated`; `GRANT EXECUTE` somente para `authenticated` (ADR 0023).
   - Contas qualificadas ativas: para papel `bdr`, filtra por `owner_member_id = p_member_id`; para gestores (`clevel`, `estrategista`, `superadmin`), total do workspace.
   - Execuções ativas (`running`, `queued`, `reserving_credits`, `scheduled`) e alertas (`failed`).
   - Fila de aprovações pendentes do workspace.
   - Saldo disponível da carteira de créditos (`credit_wallets`) e limite mensal (`workspace_settings`).
2. **Serviço `src/app/servicos/inicio.ts`**:
   - Invoca `get_home_summary` e mapeia para o objeto `HomeResumoTela` no contrato do front v18 (`kpis`, `operacao`, `acoes`, `timeline`).
   - Créditos em formato numérico e textual brasileiro, sem qualquer menção a dólar (ADR 0021).
3. **Substituição em `src/app/AlthiusApp.ts`**:
   - Sobrescreve `this.props.dados.homeService = { summary: () => this.carregarHome() }`.
   - Atualiza `recarregarWorkspace()` para recarregar o Início.

## Consequências
- Os números refletem fielmente o banco de dados.
- Isolamento absoluto entre clientes (Evolut × Grão Norte).
- Protegido por testes pgTAP e Vitest.