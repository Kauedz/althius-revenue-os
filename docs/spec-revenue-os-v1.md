# Especificação Técnica e Funcional (PRD & Architecture Spec)
## Revenue OS (Althius) — Fase 0 (Fundações) & Fase 1 (Mínimo Vendável)

---

## Problem Statement

Empresas B2B de médio e alto ticket perdem previsibilidade de receita devido à fragmentação de sua operação comercial. O ecossistema atual força as empresas a alternarem entre ferramentas pontuais e desconexas:
1. **Desperdício Financeiro e Falta de Governança em Dados:** Coletas de mercado e crawlers (como Apify) rodam sem limites claros de custo por cliente, sem reserva prévia e sem cálculo de margem, gerando cobranças surpresa ou vazando chaves e custos internos para o cliente final.
2. **Contaminação da Operação de Vendas (BDRs sobrecarregados):** Coletas em lote despejam milhares de contatos brutos e desqualificados diretamente no CRM ou nas planilhas do BDR. O operador comercial perde horas limpando planilhas em vez de prospectar contas aderentes ao ICP.
3. **Risco de Entregabilidade e Spam:** Ferramentas massivas de outbound disparam mensagens sem contexto e sem validação prévia de supressão ou opt-out, queimando a reputação de domínios corporativos e gerando passivo de conformidade com a LGPD.
4. **Chat Inadequado para Operações Transacionais:** Plataformas conversacionais baseadas em "chatbots genéricos" são incapazes de fornecer auditoria, controle de estados, acompanhamento de filas e rastreabilidade de etapas assíncronas.

---

## Solution

O **Revenue OS (Althius)** é um sistema operacional de receita gerenciado que une estratégia de posicionamento, inteligência de dados de mercado, cadências governadas e execução assistida por agentes sob controle humano.

A plataforma resolve o problema através de:
* **Frontend Herdado do Buzz, Desacoplado do Nostr:** Interface limpa e densa em React/TypeScript com navegação orientada a módulos de negócio (*Control Plane* para estrategistas e *Sales Workbench* para BDRs), mantendo o Copiloto conversacional na aba de apoio e gavetas contextuais.
* **Segurança e Isolamento em Dois Schemas Postgres:** O schema `public` atende a aplicação cliente via Supabase PostgREST protegido por Row Level Security (RLS) estrito por `workspace_id`. O schema `internal` blinda chaves do Apify, segredos OAuth, custos reais em dólar e regras de margem contra qualquer consulta do frontend.
* **Pipeline de Dados em 3 Camadas:** `raw_records` (staging imutável) $\rightarrow$ `accounts`/`contacts` (entidades canônicas deduplicadas) $\rightarrow$ `leads`/`tasks` (unidades de trabalho qualificadas operadas no Workbench do BDR).
* **Ledger Imutável de Créditos com Reserva Preventiva (+25%):** Orçamento previsível onde 200 créditos equivalem internamente a US$ 1.00 de custo de fornecedor, com status `pending_credits` para proteger intenções operacionais quando o saldo for insuficiente.
* **Outbound Consultivo via OAuth com Supressão Centralizada:** Envios executados pelas mailboxes legítimas dos vendedores (Google Workspace / Microsoft 365) com espaçamento estocástico e tabela central imutável de supressão (LGPD).
* **Sincronização Unidirecional com HubSpot:** Push determinístico de contas, contatos, notas e oportunidades para o HubSpot disparado apenas nos marcos de conversão qualificada.

---

## User Stories

### Superadmin (Althius Platform Operator)
1. Como Superadmin, quero cadastrar e versionar regras de precificação de capacidades no schema `internal`, para que o custo real de fornecedores seja convertido em créditos comerciais com margem segura.
2. Como Superadmin, quero configurar limites globais de concorrência e teto de gastos na conta mestre do Apify, para evitar que um loop anômalo de um cliente comprometa o saldo global da plataforma.
3. Como Superadmin, quero consultar o ledger financeiro consolidado de todos os workspaces, para conciliar faturas em reais com o custo liquidado em dólar junto aos fornecedores.
4. Como Superadmin, quero ativar um kill switch global por capacidade ou por conector, para pausar instantaneamente coletas problemáticas sem indisponibilizar a plataforma inteira.
5. Como Superadmin, quero visualizar logs operacionais e de falha de todos os workspaces sem que nenhum segredo de infraestrutura seja retornado em payloads públicos.

### Estrategista Althius (Market & Revenue Operator)
6. Como Estrategista, quero criar e versionar definições de ICP com critérios de inclusão, exclusão e maturidade, para que todo o motor de busca e scoring siga a tese oficial do cliente.
7. Como Estrategista, quero aprovar ou rejeitar explicitamente rascunhos de personas e comitês de compra gerados pela IA, garantindo que hipóteses incorretas nunca sejam ativadas.
8. Como Estrategista, quero configurar playbooks de abordagem e narrativas de mensagens, para que os agentes de ativação gerem copy alinhada ao tom de voz do cliente.
9. Como Estrategista, quero desenhar cadências de outbound definindo etapas, intervalos em dias e canais, garantindo que o primeiro lote de copy passe por revisão humana.
10. Como Estrategista, quero monitorar a taxa de conversão por sinal e por segmento, para iterar o ICP oficial com base nas respostas reais de mercado.

### Client Admin (Customer Workspace Owner)
11. Como Client Admin, quero visualizar o saldo da minha carteira de créditos (disponível, reservado e consumido no ciclo), para acompanhar o investimento em dados sem ver detalhes de infraestrutura em dólar.
12. Como Client Admin, quero receber notificações imediatas quando uma coleta relevante for pausada por `pending_credits`, para que eu possa autorizar recarga ou readequar o volume da lista.
13. Como Client Admin, quero conectar a conta oficial de HubSpot do meu workspace via OAuth no Hub de Integrações, concedendo permissão de escrita para criação de contatos e negócios.
14. Como Client Admin, quero auditar todas as aprovações concedidas no workspace com registro de quem aprovou, data, impacto e custo estimado em créditos.
15. Como Client Admin, quero convidar membros da minha equipe atribuindo papéis de BDR ou Visualizador, garantindo que nenhum BDR consiga alterar configurações ou ver dados sensíveis.

### BDR / SDR (Commercial Operator)
16. Como BDR, quero acessar meu *Sales Workbench* e visualizar diretamente a lista de "Minhas Tarefas de Hoje", sem ter que garimpar leads brutos em tabelas de scraping.
17. Como BDR, quero conectar minha caixa de e-mail corporativa (Google ou Outlook) via OAuth, para que as mensagens da cadência saiam do meu próprio remetente comercial.
18. Como BDR, quero inspecionar o contexto 360 do lead antes de um envio (sinais detectados, dor mapeada, perfil da empresa e histórico), para personalizar a abordagem quando necessário.
19. Como BDR, quero aprovar, editar ou adiar o envio de uma mensagem sugerida pela IA em um clique, para cumprir a cadência com agilidade e controle.
20. Como BDR, quero registrar respostas recebidas e acionar a marcação de opt-out em um clique, para que o lead e sua empresa sejam imediatamente suprimidos de qualquer contato futuro.
21. Como BDR, quero converter uma resposta positiva em uma Oportunidade com reunião agendada, disparando o push automático dos dados para o HubSpot.

---

## Implementation Decisions

### 1. Módulos do Sistema e Navegação

A navegação principal do Revenue OS substitui a casca puramente conversacional do Buzz por uma estrutura modular densa:

```
┌─────────────────────────────────────────────────────────────────┐
│ Topbar: Workspace Selector | Global Search | Credit Meter | User│
├──────────────┬──────────────────────────────────────────────────┤
│ Sidebar      │ Main Content View                                │
│              │                                                  │
│ [Início]     │ • Visão personalizada por papel                   │
│ [Mercado]    │ • ICPs, Personas, Buying Committees (Studio)     │
│ [Sinais]     │ • Fontes de Dados, Receitas Apify, Listas        │
│ [Prospecção] │ • Contas e Contatos Normalizados                 │
│ [Workbench]  │ • Fila Diária do BDR (Tarefas e Contexto 360)    │
│ [Cadências]  │ • Sequências, Etapas, Templates e Inscrições     │
│ [Execuções]  │ • Runs assíncronos, Etapas, Custos e Auditoria   │
│ [Aprovações] │ • Fila de decisões pendentes de autorização      │
│ [Hub Integ.] │ • Conexões (HubSpot, Google, Microsoft)          │
│ [Copiloto]   │ • Chat orquestrador com especialistas            │
│ [Admin]      │ • Membros, Papéis, Carteira de Créditos, Configs │
└──────────────┴──────────────────────────────────────────────────┘
```

* **Chat Contextual:** Um painel lateral deslizante (*Sheet / Drawer*) disponível nas telas de detalhe (Conta, Lead, Execução) permite invocar o Copiloto em split-view sem perder o contexto da tela ativa.

---

### 2. Matriz de Permissões (RBAC) por Papel e Ação

O acesso é controlado por RLS e middleware da aplicação em 8 capacidades atômicas:
* `view` (V) | `create` (C) | `edit` (E) | `approve` (A) | `execute` (X) | `export` (EXP) | `configure` (CFG) | `admin` (ADM)

| Módulo / Recurso | Superadmin | Estrategista Althius | Client Admin | BDR / SDR | Analista / Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Workspaces & Membros** | V, C, E, CFG, ADM | V, E, CFG | V, C, E, CFG, ADM | V (perfil próprio) | V |
| **Estratégia (ICP / Personas)** | V, C, E, A, CFG | V, C, E, A, CFG | V, A | V | V |
| **Coletas & Sinais (Apify)** | V, C, E, X, CFG | V, C, E, X, CFG | V, X, A | - | V |
| **Contas & Contatos (Canônico)**| V, C, E, EXP | V, C, E, EXP | V, C, E, EXP | V, E (atribuídos) | V |
| **Cadências & Templates** | V, C, E, A, CFG | V, C, E, A, CFG | V, A | V (execução) | V |
| **Sales Workbench & Tarefas** | V, C, E, X | V, C, E, X | V, C, E, X | V, E, X (suas tarefas) | V |
| **Execuções & Runs** | V, C, E, X, CFG | V, C, E, X | V, X | V (seus triggers) | V |
| **Fila de Aprovações** | V, A, ADM | V, A | V, A | - | - |
| **Hub de Integrações** | V, C, E, CFG, ADM | V, C, E, CFG | V, C, E, CFG, ADM | V (sua mailbox) | - |
| **Carteira de Créditos** | V, C, E, ADM | V, E | V, A (recarga) | - | V (resumo) |
| **Schema `internal` (Custos/Keys)**| V, C, E, ADM | - | - | - | - |

---

### 3. Modelo de Máquinas de Estado (State Machines)

#### A. Estado de Execução (`executions.status`)
```
[pending_credits] ───────────────► (Cancelada pelo gestor)
       │
(Saldo liberado / recarga)
       ▼
 [queued] ──► [reserving_credits] ──► [running] ──► [completed]
                                         │                ▲
                                         │ (Falha parcial)│
                                         ├──► [partial] ──┘
                                         ▼
                                      [failed] ──► (Estorno de reserva)
```
* **Transições críticas:** 
  * Se `available_credits < reserved_credits`, transita para `pending_credits`.
  * Se o fornecedor falhar sem entrega válida, `reserved_credits` é totalmente devolvido via `credit_transactions.type = 'release'`.

#### B. Estado de Aprovação (`approvals.status`)
```
[pending] ──► [approved] ──► (Destrava execução ou disparo)
    │
    ├──► [rejected] ──► (Cancela ação associada e notifica agente)
    │
    └──► [expired]  ──► (Invalidada por timeout ou alteração de payload)
```
* **Regra de Invalidação:** Qualquer modificação substancial no payload da ação proposta invalida a aprovação e gera novo hash SHA-256.

#### C. Estado de Inscrição em Cadência (`cadence_enrollments.status`)
```
[draft] ──► [awaiting_approval] ──► [scheduled] ──► [active]
                                                       │
         ┌──────────────────┬──────────────────────────┼─────────────────────┐
         ▼                  ▼                          ▼                     ▼
     [replied]           [booked]                  [paused]              [opted_out]
         │                  │                          │                     │
  (Push HubSpot)     (Push Deal HubSpot)      (Intervenção BDR)     (Grava Supressão)
```

#### D. Estado da Conexão de Mailbox (`email_mailboxes.status`)
```
[connected] ──► [attention] ──► [throttled] ──► [expired] ──► [revoked]
```
* `throttled`: Ativado automaticamente se a taxa de rejeição (*bounce rate*) ultrapassar 4% no dia ou se atingir o teto de 100 envios/dia.

#### E. Estado da Transação de Crédito (`credit_transactions.transaction_type`)
```
[grant]      -> Concessão mensal contratual (renovação de franquia)
[reserve]    -> Bloqueio preventivo (+25% do custo estimado)
[consume]    -> Débito definitivo liquidado sobre o custo real entregue
[release]    -> Devolução de saldo reservado não utilizado
[topup]      -> Compra de pacote avulso pelo cliente
[refund]     -> Estorno por falha técnica de entrega
[adjustment] -> Correção manual de auditoria pelo Superadmin
[expire]     -> Expiração de créditos mensais não utilizados no ciclo
```

#### F. Estado de Sincronização HubSpot (`hubspot_sync_runs.status`)
```
[pending] ──► [in_progress] ──► [synced]
                     │
                     └──► [failed] ──► [retry_scheduled] (Backoff exponencial até 3x)
```

---

### 4. Especificação de Banco de Dados (Dual-Schema Supabase)

#### Schema `public` (Acessível via PostgREST / RLS Ativo)

1. **`workspaces`**:
   * `id` UUID PK, `name` TEXT NOT NULL, `slug` TEXT UNIQUE, `status` TEXT DEFAULT 'active', `settings_json` JSONB DEFAULT '{}', `created_at` TIMESTAMPTZ DEFAULT now().
2. **`workspace_members`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `user_id` UUID NOT NULL, `role` TEXT NOT NULL, `status` TEXT DEFAULT 'active', `joined_at` TIMESTAMPTZ DEFAULT now().
3. **`icps`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `name` TEXT NOT NULL, `version` INT DEFAULT 1, `status` TEXT DEFAULT 'draft', `firmographics_json` JSONB NOT NULL, `exclusion_criteria` JSONB DEFAULT '[]', `approved_by` UUID, `approved_at` TIMESTAMPTZ, `created_at` TIMESTAMPTZ DEFAULT now().
4. **`personas`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `icp_id` UUID REFERENCES icps(id), `job_title` TEXT NOT NULL, `seniority` TEXT, `pain_points` TEXT[], `buying_role` TEXT, `status` TEXT DEFAULT 'draft', `created_at` TIMESTAMPTZ DEFAULT now().
5. **`raw_records`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `execution_id` UUID, `source_type` TEXT NOT NULL, `payload_json` JSONB NOT NULL, `processed_status` TEXT DEFAULT 'unprocessed', `created_at` TIMESTAMPTZ DEFAULT now().
6. **`accounts`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `name` TEXT NOT NULL, `domain` TEXT NOT NULL, `external_hubspot_id` TEXT, `industry` TEXT, `employee_count` INT, `fit_score` INT DEFAULT 0, `intent_score` INT DEFAULT 0, `created_at` TIMESTAMPTZ DEFAULT now(), UNIQUE(workspace_id, domain).
7. **`contacts`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `account_id` UUID REFERENCES accounts(id), `full_name` TEXT NOT NULL, `email` TEXT NOT NULL, `phone` TEXT, `job_title` TEXT, `linkedin_url` TEXT, `external_hubspot_id` TEXT, `created_at` TIMESTAMPTZ DEFAULT now(), UNIQUE(workspace_id, email).
8. **`leads`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `account_id` UUID REFERENCES accounts(id), `contact_id` UUID REFERENCES contacts(id), `status` TEXT DEFAULT 'qualified', `lead_score` INT NOT NULL, `score_reasons_json` JSONB, `current_cadence_id` UUID, `owner_member_id` UUID, `created_at` TIMESTAMPTZ DEFAULT now().
9. **`cadences`**:
   * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `name` TEXT NOT NULL, `status` TEXT DEFAULT 'draft', `daily_send_limit` INT DEFAULT 50, `approval_policy` TEXT DEFAULT 'hybrid', `created_at` TIMESTAMPTZ DEFAULT now().
10. **`cadence_steps`**:
    * `id` UUID PK, `cadence_id` UUID REFERENCES cadences(id), `step_order` INT NOT NULL, `channel` TEXT NOT NULL, `delay_days` INT DEFAULT 1, `template_subject` TEXT, `template_body` TEXT, `requires_human_approval` BOOLEAN DEFAULT true.
11. **`cadence_enrollments`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `cadence_id` UUID REFERENCES cadences(id), `lead_id` UUID REFERENCES leads(id), `status` TEXT DEFAULT 'scheduled', `current_step_order` INT DEFAULT 1, `next_action_at` TIMESTAMPTZ, `created_at` TIMESTAMPTZ DEFAULT now().
12. **`tasks`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `enrollment_id` UUID REFERENCES cadence_enrollments(id), `lead_id` UUID REFERENCES leads(id), `assigned_member_id` UUID, `type` TEXT NOT NULL, `suggested_subject` TEXT, `suggested_body` TEXT, `status` TEXT DEFAULT 'pending', `due_date` DATE NOT NULL, `created_at` TIMESTAMPTZ DEFAULT now().
13. **`workspace_suppression_list`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `scope_type` TEXT NOT NULL, `scope_value` TEXT NOT NULL, `reason_code` TEXT NOT NULL, `source_type` TEXT NOT NULL, `notes` TEXT, `suppressed_by` UUID, `suppressed_at` TIMESTAMPTZ DEFAULT now(), `is_active` BOOLEAN DEFAULT true, UNIQUE(workspace_id, scope_type, scope_value).
14. **`credit_wallets`**:
    * `id` UUID PK, `workspace_id` UUID UNIQUE REFERENCES workspaces(id), `included_credits` INT DEFAULT 10000, `available_credits` INT DEFAULT 10000, `reserved_credits` INT DEFAULT 0, `consumed_credits` INT DEFAULT 0, `cycle_renews_at` TIMESTAMPTZ NOT NULL, `updated_at` TIMESTAMPTZ DEFAULT now().
15. **`credit_transactions`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `execution_id` UUID, `transaction_type` TEXT NOT NULL, `amount_credits` INT NOT NULL, `balance_after` INT NOT NULL, `description` TEXT, `created_by` UUID, `created_at` TIMESTAMPTZ DEFAULT now().
16. **`executions`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `agent_id` TEXT NOT NULL, `title` TEXT NOT NULL, `status` TEXT DEFAULT 'queued', `estimated_credits` INT NOT NULL, `reserved_credits` INT NOT NULL, `consumed_credits` INT DEFAULT 0, `items_processed` INT DEFAULT 0, `valid_results` INT DEFAULT 0, `created_by` UUID, `started_at` TIMESTAMPTZ, `finished_at` TIMESTAMPTZ, `created_at` TIMESTAMPTZ DEFAULT now().
17. **`execution_steps`**:
    * `id` UUID PK, `execution_id` UUID REFERENCES executions(id), `step_order` INT NOT NULL, `name` TEXT NOT NULL, `status` TEXT DEFAULT 'pending', `input_payload` JSONB, `output_payload` JSONB, `error_message` TEXT, `started_at` TIMESTAMPTZ, `finished_at` TIMESTAMPTZ.
18. **`approvals`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `execution_id` UUID, `entity_type` TEXT NOT NULL, `entity_id` UUID NOT NULL, `status` TEXT DEFAULT 'pending', `payload_hash` TEXT NOT NULL, `impact_summary` TEXT, `requested_by` UUID, `decided_by` UUID, `decision_comment` TEXT, `created_at` TIMESTAMPTZ DEFAULT now(), `decided_at` TIMESTAMPTZ.
19. **`email_mailboxes`**:
    * `id` UUID PK, `workspace_id` UUID REFERENCES workspaces(id), `member_id` UUID REFERENCES workspace_members(id), `provider` TEXT NOT NULL, `email_address` TEXT NOT NULL, `daily_limit` INT DEFAULT 80, `sent_today` INT DEFAULT 0, `status` TEXT DEFAULT 'connected', `last_synced_at` TIMESTAMPTZ, `created_at` TIMESTAMPTZ DEFAULT now().

---

#### Schema `internal` (Privado / Oculto do PostgREST)

1. **`internal.connection_secrets`**:
   * `id` UUID PK, `workspace_id` UUID, `integration_code` TEXT, `encrypted_access_token` BYTEA, `encrypted_refresh_token` BYTEA, `token_expires_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ DEFAULT now().
2. **`internal.master_provider_keys`**:
   * `id` UUID PK, `provider_name` TEXT NOT NULL, `encrypted_api_key` BYTEA NOT NULL, `monthly_budget_usd` NUMERIC(10,2), `accumulated_cost_usd` NUMERIC(10,2), `updated_at` TIMESTAMPTZ DEFAULT now().
3. **`internal.provider_cost_events`**:
   * `id` UUID PK, `workspace_id` UUID, `execution_id` UUID, `provider_code` TEXT NOT NULL, `apify_run_id` TEXT, `cost_usd` NUMERIC(10,4) NOT NULL, `fx_rate` NUMERIC(6,4) DEFAULT 5.75, `margin_applied` NUMERIC(5,2), `created_at` TIMESTAMPTZ DEFAULT now().
4. **`internal.pricing_multipliers`**:
   * `id` UUID PK, `capability_code` TEXT NOT NULL, `base_credit_unit` INT NOT NULL, `margin_percent` NUMERIC(5,2) DEFAULT 40.00, `is_active` BOOLEAN DEFAULT true, `created_at` TIMESTAMPTZ DEFAULT now().

---

### 5. Contratos de Eventos Assíncronos e Filas (BullMQ)

A orquestração roda em filas BullMQ dedicadas com Redis:

#### Fila 1: `scraping-queue` (Apify Engine)
* **Job Name:** `start-apify-run`
  * **Payload:** `{ workspaceId, executionId, actorId, inputConfig, estimatedCredits }`
  * **Comportamento:** Valida e reserva créditos $\rightarrow$ dispara Apify Actor configurando `webhooks: [{ eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"], requestUrl: "https://api.althius.com/webhooks/apify" }]` $\rightarrow$ atualiza execution para `running_external` $\rightarrow$ encerra o job.
* **Callback Webhook:** `/webhooks/apify`
  * **Comportamento:** Recebe status do run $\rightarrow$ valida HMAC token $\rightarrow$ enfileira job em `enrichment-queue`.

#### Fila 2: `enrichment-queue` (Data Transformation)
* **Job Name:** `process-raw-records`
  * **Payload:** `{ workspaceId, executionId, apifyRunId, actualCostUsd }`
  * **Comportamento:** Baixa dataset do Apify $\rightarrow$ salva em `raw_records` $\rightarrow$ chama serviço de créditos para liquidar consumo real $\rightarrow$ executa deduplicação e promove para `accounts` e `contacts`.

#### Fila 3: `cadence-dispatcher-queue` (Outbound Engine)
* **Job Name:** `dispatch-outbound-email`
  * **Payload:** `{ workspaceId, taskId, enrollmentId, mailboxId }`
  * **Comportamento:**
    1. Consulta `workspace_suppression_list` (se suprimido, cancela com log e aborta).
    2. Consulta limites diários da `email_mailboxes` (se atingido, adia o job em 24h).
    3. Aplica **espaçamento estocástico** (jitter de 90 a 180 segundos).
    4. Envia via Gmail API / MS Graph API com retry exponencial (máximo 3 tentativas para erros temporários 5xx).

#### Fila 4: `crm-sync-queue` (HubSpot Unidirecional)
* **Job Name:** `sync-to-hubspot`
  * **Payload:** `{ workspaceId, entityType: 'contact' | 'deal', entityId, triggerEvent }`
  * **Comportamento:** Envia payload mapeado para os endpoints `/crm/v3/objects/contacts` ou `/crm/v3/objects/deals` do HubSpot $\rightarrow$ salva `external_hubspot_id` retornado.

---

### 6. Políticas de RLS (Row Level Security)

Todas as tabelas em `public` possuem RLS ativado por padrão.
Função auxiliar no Postgres:
```sql
CREATE OR REPLACE FUNCTION public.current_workspace_member() 
RETURNS TABLE (workspace_id uuid, role text) AS $$
  SELECT workspace_id, role 
  FROM public.workspace_members 
  WHERE user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

* **Leitura Geral:**
  ```sql
  CREATE POLICY "Tenant isolation read" ON public.accounts
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.current_workspace_member()));
  ```
* **Escrita Restrita por Papel (Ex: ICPs):**
  ```sql
  CREATE POLICY "Estrategista and Admin write icps" ON public.icps
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.current_workspace_member() 
      WHERE role IN ('superadmin', 'strategist', 'client_admin')
    )
  );
  ```
* **Visualização de Tarefas do BDR:**
  ```sql
  CREATE POLICY "BDR own tasks" ON public.tasks
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.current_workspace_member())
    AND (assigned_member_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.current_workspace_member() WHERE role IN ('client_admin', 'strategist', 'superadmin')
    ))
  );
  ```

---

### 7. Publicação no Supabase Realtime

Para otimizar performance e não saturar sockets, apenas as seguintes tabelas emitem Postgres Changes via `supabase_realtime`:
1. `executions` (atualização ao vivo de progresso, status e barras de carregamento).
2. `tasks` (notificação de novas tarefas vencidas ou adicionadas à fila do BDR).
3. `approvals` (alerta sonoro/visual de aprovações pendentes para o Estrategista/Admin).
4. `credit_wallets` (atualização imediata do medidor de créditos no topbar).

---

## Testing Decisions

### Seams de Teste (Pontos de Verificação)
1. **Seam 1 — Banco de Dados & RLS (pgTAP / SQL Test Harness):**
   * Testar se um usuário autenticado no Workspace A recebe erro ou lista vazia ao tentar consultar `accounts`, `leads` ou `credit_wallets` do Workspace B.
   * Testar se o BDR consegue editar um ICP ou tabela de `credit_wallets` (deve retornar `Access Denied`).
   * Testar se qualquer query via PostgREST para o schema `internal` é bloqueada na camada de banco.
2. **Seam 2 — Ledger de Créditos & Idempotência Financeira:**
   * Simular uma execução de 1.000 créditos e forçar um crash do worker após a reserva.
   * Verificar se o job reprocessado **não debita a reserva duas vezes** e se o estorno restaura o saldo perfeitamente.
   * Simular concorrência com 5 execuções simultâneas disputando o saldo final do workspace.
3. **Seam 3 — Supressão LGPD:**
   * Cadastrar um domínio `@exemplo.com.br` na `workspace_suppression_list`.
   * Disparar uma coleta que traga 10 contatos daquele domínio.
   * Testar se a rotina de enriquecimento bloqueia a criação de `leads` e impede o agendamento de qualquer `task` para esses contatos.
4. **Seam 4 — Dispatcher de E-mail & Throttling:**
   * Simular fila de 120 e-mails para uma única mailbox com teto diário de 80.
   * Verificar se exatamente 80 e-mails são disparados com jitter (espaçamento de 90-180s) e os 40 restantes são reagendados para o dia seguinte com status `scheduled`.
5. **Seam 5 — Sincronização Unidirecional HubSpot:**
   * Simular avanço de lead para `booked`.
   * Verificar se o mock da API HubSpot recebe o payload de criação de Deal e Contact com os campos customizados corretos, salvando o `external_hubspot_id` localmente.

---

## Out of Scope (Fora do Escopo da Fase 0 e Fase 1)

Os seguintes recursos estão **estritamente excluídos** deste escopo:
1. **Infraestrutura Gerenciada de Cold Mail:** Não haverá compra de domínios secundários em massa, DNS pools ou warmup automatizado (Instantly/Smartlead clones) na V1.
2. **Sincronização Bidirecional de CRM:** Não haverá escuta contínua de webhooks do HubSpot para alterar estados dentro do Revenue OS.
3. **Múltiplos Provedores de CRM:** Sem suporte inicial para Pipedrive, Salesforce, RD Station ou Close na V1.
4. **Mídia Paga & Anúncios:** Nenhuma integração ativa com Meta Ads, Google Ads ou LinkedIn Ads.
5. **SEO & GEO:** Módulo de geração e publicação de conteúdo orgânico desativado.
6. **Granola / Inteligência de Áudio:** Sem gravação ou transcrição de reuniões na V1.

---

## Further Notes

### Roteiro de Desacoplamento do Buzz (Fase 0)
1. **Limpeza de Bindings Nostr:**
   * Remover dependências `@nostr-dev-kit`, `nostr-tools` e referências a relays no código do cliente React.
   * Substituir o gerenciador de sessão local baseado em chaves criptográficas Nostr por `@supabase/auth-helpers-react` / Supabase Auth.
2. **Preservação de Design System:**
   * Manter a estrutura Tailwind, configurações de Radix UI / shadcn/ui e componentes de layout (sidebar, chat bubbles, avatar stack) existentes em [`desktop/src/features`](file:///c:/Users/KauêZanato-EvolutTra/OneDrive%20-%20EVOLUT/Desktop/A/buzz-reference/desktop/src/features).
3. **Transição para Tickets:**
   * Após a validação desta especificação, o próximo comando a rodar será **/to-tickets** para gerar o breakdown executável da Fase 0 e Fase 1.
