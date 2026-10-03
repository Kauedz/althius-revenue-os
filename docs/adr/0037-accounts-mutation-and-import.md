# ADR 0037: Mutação de Contas, Contatos e Importação com Tratamento de Duplicidade

## Contexto
O serviço `src/app/servicos/contas.ts` implementava apenas leitura (`listarContas`), e a tabela `public.accounts` possuía política de `UPDATE` com escopo estrito (`accounts.edit`), mas não possuía política de `INSERT` nem rotinas para importação em lote com marcação de duplicidade.

Conforme a matriz de capacidades (`role_permissions`) e as regras de negócio de Hermes:
- Capacidade `accounts.edit`: gestores (`superadmin`, `estrategista`, `clevel`) possuem escopo `all` (podem editar qualquer conta do workspace); BDR possui escopo `own` ("BDR edita as contas em que é responsável").
- Capacidade `accounts.import`: gestores possuem escopo `all`; BDR não pode importar (`none`).
- Regra de importação: a importação marca duplicidade caso a conta (mesmo domínio no workspace) já exista, **nunca apaga** nem sobrescreve dados existentes.

## Decisão
1. **Modelagem de Duplicidade na Tabela `public.accounts`**:
   - Adicionada coluna `is_duplicate BOOLEAN NOT NULL DEFAULT FALSE`.
   - Adicionada coluna `duplicate_of_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL`.
   - Criação de índice `idx_accounts_workspace_domain` em `(workspace_id, domain)`.

2. **Políticas RLS em `public.accounts`**:
   - `INSERT`: permitida para gestores (`superadmin`, `estrategista`, `clevel`). BDR não cria contas soltas sem atribuição.
   - `UPDATE`: a política já existente em `20261002000012` é mantida e reforçada para respeitar `accounts.edit`.

3. **Funções RPC Seguras (ADR 0023)**:
   - `public.create_account(p_workspace_id UUID, p_member_id UUID, p_name TEXT, p_domain TEXT, p_state_uf TEXT, p_city TEXT, p_temperature INT, p_owner_member_id UUID DEFAULT NULL)`:
     - Executa `public.assert_caller_is_member(p_member_id)`.
     - Valida papel (requer gestor ou permissão `accounts.edit`).
     - Insere e retorna o registro da conta criada.
   - `public.update_account(p_account_id UUID, p_member_id UUID, p_name TEXT, p_domain TEXT, p_state_uf TEXT, p_city TEXT, p_temperature INT, p_owner_member_id UUID DEFAULT NULL)`:
     - Executa `public.assert_caller_is_member(p_member_id)`.
     - Se o papel for `bdr`, verifica se `owner_member_id == p_member_id` (escopo `own`). Lança erro `42501` caso contrário.
     - Atualiza os campos e retorna o registro atualizado.
   - `public.import_accounts(p_workspace_id UUID, p_member_id UUID, p_contas JSONB)`:
     - Executa `public.assert_caller_is_member(p_member_id)`.
     - Rejeita se o papel for `bdr` (`accounts.import` = `none`).
     - Para cada item na lista: verifica se já existe conta com aquele domínio no workspace.
       - Se já existe: insere com `is_duplicate = TRUE` e `duplicate_of_id = conta_original.id`.
       - Se não existe: insere com `is_duplicate = FALSE`.
     - Retorna JSON com resumo `{ "total": N, "criadas": C, "duplicadas": D }`.

4. **Serviço e Integração**:
   - `src/app/servicos/contas.ts` expõe `criarConta`, `editarConta` e `importarContas`.
   - O front em `AlthiusApp.ts` integra os métodos de salvar/editar e importar com tratamento de erro claro e feedback na UI.

## Consequências
- A integridade das contas existentes é sempre preservada em importações.
- BDR só edita suas próprias contas.
- Operações de mutação auditáveis e protegidas por RLS e RPCs com verificação de membro.