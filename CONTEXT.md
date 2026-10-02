# Althius Revenue OS — Contexto e Glossário Canônico

Este documento define os termos formais, a ontologia e as regras de limites conceituais da plataforma **Althius**, orquestrada pelo **Hermes**. Ele serve como autoridade de vocabulário tanto para os agentes quanto para os desenvolvedores do backend.

---

## 1. Tenant, Acesso e Autorização

**Workspace**:
O limite operacional e transacional isolado de uma organização cliente dentro da plataforma. Toda entidade do sistema (exceto tabelas de catálogo global) carrega obrigatoriamente um `workspace_id`.
_Evitar_: Tenant, empresa, conta (para se referir à organização), sala, grupo.

**Papel (Role)**:
A cadeira ocupada por uma pessoa física em um determinado workspace. São exatamente 4 papéis canônicos: `superadmin` (operação da plataforma Althius), `estrategista` (GTM da Althius alocado ao cliente), `clevel` (diretoria do cliente: CEO/CRO/CMO, com alias `cliente` no frontend) e `bdr` (time comercial do cliente). Ninguém atribui papel superior ao seu próprio.
_Evitar_: Perfil, nível de acesso, permissão, cargo.

**Capacidade (Capability)**:
Uma operação atômica de negócio identificada por uma chave técnica padronizada (ex: `ws.brand`, `cadences.auto`, `approvals.spend`). A plataforma possui uma matriz fixa de 33 capacidades em 5 áreas (Workspace, Agentes, Receita, Aprovações e dinheiro, Operação e dados).
_Evitar_: Permissão, ação, feature, privilégio.

**Escopo (Scope)**:
O modificador de alcance associado a um papel para uma capacidade específica na matriz. Os valores permitidos são:
- `all` (`s`): Irrestrito dentro do workspace.
- `assigned` (`a`): Restrito aos workspaces em que o usuário foi expressamente alocado como membro (exclusivo do estrategista em `ws.switch`).
- `own` (`p`): Restrito aos dados onde o usuário é o responsável (`owner_member_id` ou `assignee_member_id`).
- `read` (`l`): Permissão apenas de leitura / visualização sem alteração.
- `request` (`q`): A ação não é executada diretamente; vira um pedido em Aprovações para quem tem poder de decisão.
- `none` (`n`): Operação expressamente proibida.
_Evitar_: Granularidade, nível, filtro.

---

## 2. Agentes, Inteligência e Conhecimento

**Agente**:
Um dos 4 trabalhadores digitais persistentes fixados no sistema: Comercial (`comercial`), Marketing (`marketing`), Copy (`copy`) e RevOps (`revops`). Cada agente possui missão, dono funcional e ferramentas especializadas. Não há criação de agentes arbitrários ou personalizados no MVP.
_Evitar_: Bot, assistente, chatbot, IA.

**Playbook**:
O documento estratégico em markdown que governa a missão, regras inegociáveis, processos de abordagem e limites operacionais de um agente. Possui versionamento rígido, onde apenas uma versão fica publicada (`is_published: true`) por workspace.
_Evitar_: Prompt, script, instrução.

**Skill**:
Um procedimento procedimental passo a passo (no padrão markdown do Claude Code / Matt Pocock) ensinando um agente a executar uma tarefa especializada. Armazenado na tabela `agent_skills`, editável pelo estrategista e superadmin.
_Evitar_: Função, plugin, ferramenta.

**Sinal**:
Um indicador de intenção de compra ou evento de mercado monitorado por um agente sobre contas do ICP. São 20 sinais de catálogo mapeados para capacidades da plataforma (via motor Apify invisível ou gatilhos internos). O workspace ativa/desativa cada sinal e define sua frequência.
_Evitar_: Alerta, trigger, evento de scraping.

---

## 3. Receita, Pipeline e Execução Comercial

**Motion**:
O modelo de tração e entrada no mercado adotado por um quadro de oportunidades. São permitidas 3 motions canônicas: `slg` (Sales-Led Growth), `mlg` (Marketing-Led Growth) e `plg` (Product-Led Growth).
_Evitar_: Tipo de pipeline, modalidade, estratégia.

**Quadro (Pipeline)**:
Uma instância de funil de vendas pertencente a uma motion específica (`motion`). Cada motion suporta no máximo 5 quadros ativos no mesmo workspace.
_Evitar_: Pipeline, funil, board.

**Etapa (Stage)**:
Uma das 6 fases canônicas e sequenciais de maturidade de um negócio: `entrada`, `qualificacao`, `descoberta`, `proposta`, `negociacao` e `ganho`. A chave técnica é idêntica para o workspace todo; apenas o rótulo descritivo se adapta conforme a motion. Toda etapa possui uma probabilidade de ganho padrão (10%, 20%, 35%, 55%, 75%, 100%).
_Evitar_: Coluna, status, fase.

**Cadência**:
Uma sequência estruturada e multicanal de passos de prospecção e relacionamento com contatos qualificados.
_Evitar_: Sequência, campanha de e-mail, régua de relacionamento.

**Passo Automático ou Manual**:
- **Passo Automático**: Ação executada pelo motor Unipile em nome da conta pessoal do usuário sem intervenção humana no momento do envio (permitido exclusivamente nos canais `email` e `whatsapp`, consumindo 4 créditos por envio).
- **Passo Manual**: Ação que gera uma tarefa com roteiro pronto para o responsável no dia estipulado (obrigatório para `linkedin`, `instagram` e `call`). Pode ser executado em um clique pelo botão "Enviar agora".
_Evitar_: Passo robô, tarefa automática.

**Conta de Mensagem (Messaging Account)**:
Uma conexão pessoal e autenticada via motor Unipile aos canais de comunicação de um membro específico (`member_id`): WhatsApp, LinkedIn, Instagram ou provedor de E-mail (Google, Microsoft, IMAP). A conta pertence estritamente ao membro físico, nunca ao workspace coletivo.
_Evitar_: Conexão de e-mail, integração de mensageria, caixa corporativa.

---

## 4. Governança, Decisão e Finanças

**Aprovação de Operação vs. Aprovação de Gasto**:
- **Aprovação de Operação (`category: 'operacao'`)**: Autorização para planos de agentes, novos lotes de copy, listas de prospecção e atualizações cadastrais sensíveis no CRM. Pode ser decidida por `superadmin`, `estrategista` ou `clevel`.
- **Aprovação de Gasto (`category: 'gasto'`)**: Autorização para verba de mídia paga, compra de pacotes de créditos e execuções que ultrapassem o teto de gastos configurado no workspace. Exclusiva de quem paga: apenas `clevel` e `superadmin` podem aprovar. O estrategista solicita (`request`), mas nunca aprova gasto.
Toda aprovação é de uso único e carrega um `payload_hash` criptográfico; qualquer alteração no conteúdo invalida a aprovação.
_Evitar_: Gate, validação, checklist.

**Crédito**:
A moeda transacional interna da plataforma utilizada para mensurar o consumo de infraestrutura variável, crawlers (Apify), agentes LLM e envios (Unipile). 1 crédito = US$ 0,005 de valor comercial de venda (200 créditos = US$ 1,00). Custos de fornecedores em dólar são estritamente confidenciais e isolados no schema `internal`.
_Evitar_: Token, saldo, centavos, custo de API.

**Reserva de Crédito**:
O bloqueio preventivo de créditos no saldo disponível antes do disparo de uma execução variável assíncrona (calculado com margem de +25% sobre a estimativa). Se a execução concluir com custo menor, a diferença é imediatamente liberada (`release`) de volta ao saldo. Se o saldo for insuficiente, a execução entra em aprovação ou aciona recarga automática.
_Evitar_: Pré-autorização, caução, retenção.
