# Especificação Técnica e Funcional (PRD & Architecture Spec)
## Revenue OS (Althius) — Arquitetura V18 & Governança Hermes

---

## Problem Statement

Empresas B2B de médio e alto ticket perdem previsibilidade de receita devido à fragmentação de sua operação comercial e à falta de controle sobre agentes autônomos:
1. **Desperdício Financeiro e Risco de Infraestrutura:** Ferramentas de IA e scraping (como Apify) rodam sem limites claros de custo por cliente, sem reserva preventiva de saldo e sem separação entre custo de fornecedor e preço de venda, gerando cobranças surpresa ou vazamento de margens.
2. **Invasão de Privacidade na Mensageria Pessoal:** A conexão de contas pessoais de vendedores (WhatsApp, LinkedIn, Instagram e e-mail) tradicionalmente expõe conversas privadas de terceiros, violando a LGPD e a privacidade dos colaboradores.
3. **Falta de Governança sobre Ações de IA:** Agentes autônomos disparam mensagens sem controle de tom, gastam verba de mídia sem autorização financeira e alteram cadastros no CRM sem auditoria unificada.
4. **Desconexão entre Papéis e Operação:** BDRs perdem tempo organizando planilhas desestruturadas, enquanto a diretoria (C-level) não tem visibilidade clara de onde o orçamento está sendo alocado.

---

## Solution

O **Revenue OS (Althius)** é um sistema operacional de receita governado por 4 agentes de IA especializados (`comercial`, `marketing`, `copy`, `revops`), orquestrados pelo motor central **Hermes**, com interface modular densa (v18) e isolamento multi-tenant estrito no **Supabase**.

A plataforma resolve os problemas acima através de:
* **As 4 Checagens Universais do Hermes:** Toda e qualquer ação (seja um clique na tela, um gatilho de agente ou um evento de webhook) passa rigorosamente por 4 checagens em sequência:
  1. *O papel tem a chave técnica na matriz de capacidades?*
  2. *O usuário é o dono do dado (`assigned` / `own`)?*
  3. *A ação requer aprovação (`operacao` vs `gasto`)?*
  4. *A ação cabe nos créditos disponíveis e no teto configurado?*
  Após aprovação e execução, o Hermes registra em 4 saídas: Execução, Extrato de Créditos, Notificação e Auditoria.
* **4 Papéis Canônicos e Matriz de 33 Capacidades:** `superadmin` (operação da plataforma Althius), `estrategista` (GTM da Althius), `clevel` (diretoria do cliente) e `bdr` (time comercial do cliente), com escopos declarativos (`all`, `assigned`, `own`, `read`, `request`, `none`).
* **Motor de Mensageria Unificado e Invisível (Unipile) com Filtro Só-CRM:** Uma única integração conecta WhatsApp, LinkedIn, Instagram e e-mail pessoal por membro (`messaging_accounts`). Mensagens recebidas de pessoas que não estão cadastradas como contatos no CRM (`contact_channels`) são **descartadas imediatamente sem gravar texto nem metadados**. Conversas em grupo são sempre ignoradas.
* **Coleta Governada via Apify Centralizado:** O cliente nunca vê o nome do fornecedor nem custos em dólar. O catálogo expõe 20 sinais de negócio precificados em créditos comerciais.
* **Ledger Imutável de Créditos com Dupla Carteira:** Franquia mensal de 10.000 créditos (`monthly_allowance`) com expiração a cada ciclo e carteira de recarga (`topup_wallet`) com validade de 90 dias, reserva preventiva de +25% e consumo FEFO (First-Expiring, First-Out).
* **Pipeline Estruturado em 3 Motions:** `slg`, `mlg` e `plg`, suportando até 5 quadros por motion, com 6 etapas canônicas fixas (`entrada`, `qualificacao`, `descoberta`, `proposta`, `negociacao`, `ganho`), probabilidade padrão e atualização externa para o CRM conectado.

---

## User Stories por Papel

### Superadmin (Operação Althius)
1. Como Superadmin, quero alternar entre todos os workspaces da plataforma sem restrição de membership, para prestar suporte técnico e monitorar a saúde global.
2. Como Superadmin, quero manter cadastros de custos de fornecedores em dólar e precificação no schema `internal`, para proteger a margem confidencial da Althius.
3. Como Superadmin, quero inspecionar conversas de clientes apenas mediante registro explícito de motivo em log de auditoria, garantindo conformidade com a privacidade.
4. Como Superadmin, quero criar sinais personalizados e configurar atores Apify no catálogo global, para enriquecer as capacidades dos agentes.

### Estrategista (GTM Althius)
5. Como Estrategista, quero acessar exclusivamente os workspaces aos quais fui atribuído, para planejar e executar a tese de crescimento desses clientes.
6. Como Estrategista, quero escrever, versionar e publicar os Playbooks e Skills dos 4 agentes, para que a abordagem comercial siga as melhores práticas.
7. Como Estrategista, quero ligar e calibrar sinais de intenção de compra sobre contas-alvo, para gerar oportunidades qualificadas.
8. Como Estrategista, quero submeter solicitações de verba de mídia paga ou compra de créditos adicionais para aprovação do C-level.
9. Como Estrategista, quero aprovar operações sensíveis (lotes de copy, listas de prospecção e cadências), liberando os disparos automáticos.

### C-Level (Diretoria do Cliente)
10. Como C-level, quero visualizar meu saldo de créditos, extrato e histórico de consumo, acompanhando o retorno do investimento.
11. Como C-level, quero aprovar ou rejeitar solicitações de gasto financeiro (verba de campanhas de mídia e compras de créditos), controlando o orçamento corporativo.
12. Como C-level, quero pausar emergencialmente qualquer agente em execução com um clique, impedindo ações indesejadas no mercado.
13. Como C-level, quero convidar novos membros para o workspace atribuindo os papéis de C-level ou BDR, sem conseguir conceder papéis da Althius.
14. Como C-level, quero personalizar o logo e o domínio da minha empresa no workspace.

### BDR / SDR (Operador Comercial)
15. Como BDR, quero visualizar minha fila diária de tarefas de cadência filtrada exclusivamente para as contas e contatos sob minha responsabilidade.
16. Como BDR, quero conectar minhas contas pessoais de mensageria (WhatsApp via QR code, LinkedIn, Instagram e e-mail) através do assistente de conexão seguro.
17. Como BDR, quero que apenas conversas com contatos cadastrados no CRM apareçam na minha Caixa de entrada, preservando totalmente minhas conversas pessoais.
18. Como BDR, quero disparar passos manuais de cadência com um clique ("Enviar agora"), utilizando os textos sugeridos pelo Agente de Copy.
19. Como BDR, quero mover negócios no Pipeline entre as etapas canônicas, registrando o histórico de conversão e a situação de saúde do deal.

---

## Implementation Decisions

### 1. Arquitetura de Schemas e Segurança Multi-Tenant
* **Schema `public`:** Exposto ao PostgREST e protegido por RLS mandatário em todas as tabelas. Contém dados de workspaces, membros, contas, contatos, tarefas, cadências, mensagens, canais, créditos públicos e auditoria.
* **Schema `internal`:** Isolado e sem permissão de leitura para roles web/anon/authenticated. Contém segredos de provedores (chaves mestre Apify, Unipile, tokens OAuth), custos reais em USD, mapeamento de atores e funções de liquidação financeira.

### 2. Matriz de 33 Capacidades e RBAC Declarativo
* Armazenada em tabelas normalizadas `roles` e `role_permissions` com os escopos: `all`, `assigned`, `own`, `read`, `request`, `none`.
* A função `public.has_workspace_role()` e a nova função de autorização `public.check_permission(workspace_id, capability_key, target_owner_id)` avaliam as regras dinamicamente no banco e na API.

### 3. Função Universal de Política do Hermes (`hermes_evaluate_action`)
Recebe `(workspace_id, member_id, capability_key, target_entity_type, target_entity_id, estimated_credits, is_spend)` e executa as 4 checagens canônicas:
1. Valida se o papel do membro possui a capacidade na matriz.
2. Valida titularidade do dado se a capacidade exigir escopo `own` ou `assigned`.
3. Valida se requer aprovação (`category: 'operacao'` ou `'gasto'`). Se sim, insere na tabela `approvals` com `payload_hash` e status `pendente`.
4. Valida se o saldo disponível cobre a reserva de créditos (+25%). Se insuficiente, aciona recarga automática (se configurada) ou converte em aprovação de gasto.

### 4. Motor de Mensageria Unipile & Filtro Só-CRM
* **Tabela `messaging_accounts`:** Armazena o vínculo entre membro e provedores Unipile (`linkedin`, `whatsapp`, `instagram`, `google`, `microsoft`, `imap`).
* **Tabela `contact_channels`:** Armazena até 3 e-mails, 3 telefones, handles de WhatsApp, LinkedIn e Instagram por contato com índice único por workspace + tipo + valor normalizado.
* **Webhook Receiver:** Resposta HTTP 200 síncrona imediata com validação de assinatura `Unipile-Auth` $\rightarrow$ enfileiramento no BullMQ.
* **Worker de Ingestão:** Consulta `contact_channels`. Se o remetente não existir no CRM ou for mensagem de grupo, descarta o payload sem persistir nenhum dado. Se existir, persiste em `conversations` e `messages`, pausa a cadência ativa do contato e aciona o Agente de Copy.

### 5. Estrutura Canônica de Pipeline
* Tabela `pipelines` com restrição rígida de no máximo 5 quadros por motion (`slg`, `mlg`, `plg`).
* Tabela global `stage_definitions` com as 6 etapas canônicas: `entrada` (10%), `qualificacao` (20%), `descoberta` (35%), `proposta` (55%), `negociacao` (75%), `ganho` (100%).
* Tabela `opportunities` com `stage_key`, `position`, `health` (`no_prazo`, `em_risco`, `atrasado`) e histórico imutável em `opportunity_stage_history`.

---

## Testing Decisions

* **Seam 1 — Banco de Dados, RBAC & RLS (pgTAP):** Testar isolamento entre workspaces múltiplos e permissões de leitura/escrita para os 4 papéis em todas as capacidades sensíveis (especialmente garantindo que BDR não edite contas/negócios de outros membros e que Estrategista veja apenas workspaces atribuídos).
* **Seam 2 — Hermes Policy Engine:** Testar a função de checagem do Hermes cobrindo os 4 cenários de recusa (chave inexistente, violador de dono de dado, ação pendente de aprovação, saldo insuficiente) e o fluxo de aprovação com reserva preventiva de +25%.
* **Seam 3 — Privacidade de Mensageria (Filtro Só-CRM):** Testar webhook simulando mensagem de número desconhecido (garantindo 0 registros criados) versus número cadastrado em `contact_channels` (garantindo criação de conversa e pausa da cadência).
* **Seam 4 — Ledger de Créditos e Dupla Carteira:** Testar reserva, consumo parcial com devolução de sobra (`release`), e prioridade de consumo FEFO (expiração da franquia mensal antes de recargas de 90 dias).

---

## Out of Scope (MVP V18)

1. Criação de agentes novos e personalizados (plataforma fixa nos 4 agentes).
2. Conexões de WhatsApp Cloud API separadas (substituídas pela Unipile).
3. Mídia Paga com execução autônoma sem aprovação do C-level.
4. Módulo autônomo de gravação de reuniões (reuniões integradas como aba contextual na conta).
5. Sincronização bidirecional complexa com múltiplos CRMs legados na fase inicial.
