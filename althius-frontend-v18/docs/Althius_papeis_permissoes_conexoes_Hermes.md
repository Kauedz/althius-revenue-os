# Althius — papéis, permissões e conexões para o Hermes

Oct 2, 2026 · @Renan Zanato

## Resumo

A Althius passa a ter uma única tabela de permissões, com 33 capacidades em 5 áreas. Essa mesma tabela é lida pela tela e pelo Hermes. Na v18 do protótipo:

- "Admin do cliente" virou **C-level**.
- Superadmin, estrategista e C-level trocam o logo do workspace.
- A tabela "O que cada papel pode fazer" aparece em Configurações → Workspace e membros.

Três regras organizam tudo:

1. **Cadeira define o teto.** Cada papel tem um limite fixo, e ninguém dá um papel acima do próprio.
2. **Dono do dado define o alcance.** O BDR mexe só no que é dele: contas, negócios, cadências e canais em que é responsável.
3. **Quem paga decide o gasto.** Verba de mídia, compra de créditos e execução acima do limite são decisão do C-level (ou do superadmin). O estrategista pede, não aprova.

Este documento é a referência da plataforma para quem constrói o backend. Ele complementa o desenho de banco e o Blueprint (versão de 42 páginas) e, **onde houver conflito, vale o que está aqui**, porque reflete o front v18. Para ler na ordem: como a plataforma funciona, papéis, matriz, revisão de congruência, Hermes, eventos, agentes, Apify, Unipile, Pipeline e créditos, conferência, mudanças no banco e decisões em aberto.

## Como a plataforma funciona

A Althius é um ciclo de 6 etapas. Cada etapa tem um agente dono e um motor por trás, e o Hermes fica em volta de tudo. Dois motores externos ficam escondidos do cliente: o **Apify**, que coleta, e a **Unipile**, que conversa.

**Diagrama — ciclo de receita (6 etapas, cada uma com agente dono):**

1. **Sinais e coleta** — Apify roda os sinais ligados em cada agente; vira conta nova ou muda a temperatura. Dono: Agente Comercial e Agente de Marketing. Motor: Apify, invisível para o cliente.
2. **Contas e leads** — site, logo, fit, temperatura e comitê; campanhas também trazem leads. Dono: Agente Comercial. Fonte: CRM conectado e coleta.
3. **Cadências** — e-mail e WhatsApp automático ou manual; LinkedIn, Instagram e ligação viram tarefa. Dono: Agente de Copy. Envio: Unipile, pela conta da pessoa.
4. **Caixa de entrada** — só conversas com contatos do CRM; resposta pausa a cadência e vira tarefa. Dono: Agente de Copy (sugere resposta). Chegada: webhook da Unipile.
5. **Pipeline** — SLG, MLG e PLG, até 5 quadros cada; 6 etapas fixas. Dono: Agente de RevOps. Sincroniza com o CRM.
6. **Relatórios** — lê Pipeline, Cadências, Campanhas e Créditos. Dono: Agente de RevOps.

Em volta de tudo: **Hermes** checa papel, dono do dado, aprovação e créditos antes de cada ação; o resultado volta como sugestão no Playbook de cada agente.

O cliente nunca escolhe ferramenta. Ele liga sinais, aprova cadências e decide gasto; quem chama Apify, Unipile, CRM e LLM é o Hermes, com as credenciais centrais da Althius ou com as contas que cada pessoa conectou.

## As 4 cadeiras

Superadmin e estrategista são do time Althius; C-level e BDR/SDR são do time do cliente. A pessoa tem um papel por workspace.

| Cadeira | Id técnico | Quem é | Alcance | Quem nomeia |
| --- | --- | --- | --- | --- |
| Superadmin | `superadmin` | Time Althius (operação da plataforma) | Todos os workspaces, custos reais, fornecedores, margens, auditoria, sinais personalizados | A Althius |
| Estrategista | `estrategista` | Time Althius (GTM do cliente) | Só os workspaces em que foi colocado. Escreve ICP, playbooks, skills, sinais e cadências; aprova a operação | Superadmin |
| C-level | `cliente` (sugestão: `clevel` no backend) | Diretoria do cliente: CEO, CRO, CMO | O workspace dele. Decide gasto, compra créditos, aprova ações, pausa agente, convida C-level e BDR | Estrategista |
| BDR/SDR | `bdr` | Time comercial do cliente | Contas, negócios, tarefas, cadências e caixa de entrada em que é responsável; conversa com Agente Comercial e Agente de Copy | C-level ou estrategista |
|  |  |  |  |  |

## Matriz de capacidades

Cada linha é uma capacidade com chave técnica. O Hermes checa a chave antes de qualquer ação, venha ela da tela ou de um agente. No protótipo, a tabela sai do mesmo arquivo que libera os botões (`papeis_data.py` → `PERMS` e `ALTHIUS_CAPS`).

Legenda: **Sim** pode · **Atribuídos** só nos workspaces dele · **Só o seu** só no que é responsável · **Só ver** lê, não muda · **Pede** a ação vira pedido para quem decide · **Não** não pode.

| Área | Capacidade | Chave | Superadmin | Estrategista | C-level | BDR/SDR | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workspace | Trocar de workspace | `ws.switch` | Sim | Atribuídos | Não | Não | Superadmin vê todos. Estrategista vê só os workspaces em que foi colocado. |
| Workspace | Criar e arquivar workspace | `ws.create` | Sim | Não | Não | Não |  |
| Workspace | Mudar o logo do workspace | `ws.brand` | Sim | Sim | Sim | Não | Aparece na barra lateral e no seletor de workspaces. |
| Workspace | Convidar e mudar papel | `team.invite` | Sim | Sim | Sim | Não | Ninguém dá um papel acima do próprio. C-level convida C-level e BDR. |
| Workspace | Minha conta, notificações e aparência | `settings.own` | Sim | Sim | Sim | Sim |  |
| Agentes | Conversar com agentes | `agents.chat` | Sim | Sim | Sim | Só o seu | BDR conversa com o Agente Comercial e o Agente de Copy. |
| Agentes | Editar e publicar playbook e skills | `agents.configure` | Sim | Sim | Só ver | Não | C-level lê e aprova; quem escreve é o estrategista. |
| Agentes | Ligar e desligar sinais | `agents.signals` | Sim | Sim | Só ver | Não |  |
| Agentes | Criar sinal personalizado | `signals.custom` | Sim | Não | Não | Não |  |
| Agentes | Pausar agente | `agents.pause` | Sim | Sim | Sim | Não | Botão de emergência do cliente. |
| Agentes | Mudar autonomia do agente | `agents.autonomy` | Sim | Sim | Pede | Não |  |
| Receita | Editar conta: site, logo, comitê e LinkedIn | `accounts.edit` | Sim | Sim | Sim | Só o seu | BDR edita as contas em que é responsável. |
| Receita | Importar lista de contas | `accounts.import` | Sim | Sim | Sim | Não |  |
| Receita | Aprovar lista de prospecção | `prospecting.approve` | Sim | Sim | Sim | Só ver |  |
| Receita | Editar cadência | `cadences.edit` | Sim | Sim | Só ver | Só o seu |  |
| Receita | Ligar envio automático (e-mail e WhatsApp) | `cadences.auto` | Sim | Sim | Sim | Só o seu | Consome créditos e envia em nome da pessoa conectada. |
| Receita | Criar tarefa para outra pessoa | `tasks.assign` | Sim | Sim | Sim | Só o seu | BDR cria tarefa só para si. |
| Receita | Ler a Caixa de entrada | `inbox.read` | Só ver | Só ver | Só ver | Só o seu | Só conversas com contatos do CRM. Leitura pelo time Althius fica registrada na Auditoria. |
| Receita | Conectar WhatsApp, LinkedIn, Instagram e e-mail | `inbox.connect` | Só o seu | Só o seu | Só o seu | Só o seu | Cada pessoa conecta as próprias contas. |
| Receita | Criar, renomear e excluir quadros do Pipeline | `pipeline.boards` | Sim | Sim | Sim | Não |  |
| Receita | Criar e mover negócios | `pipeline.deals` | Sim | Sim | Sim | Só o seu | BDR move só os negócios em que é responsável. |
| Receita | Criar campanha | `campaigns.edit` | Sim | Sim | Sim | Não |  |
| Aprovações e dinheiro | Aprovar plano de agente, copy, lista e CRM | `approvals.decide` | Sim | Sim | Sim | Não |  |
| Aprovações e dinheiro | Aprovar verba de mídia e execução acima do limite | `approvals.spend` | Sim | Pede | Sim | Não | Dinheiro do cliente: decide quem paga. |
| Aprovações e dinheiro | Comprar créditos | `credits.buy` | Sim | Pede | Sim | Não |  |
| Aprovações e dinheiro | Modo de consumo, limite mensal e recarga | `credits.policy` | Sim | Só ver | Sim | Não |  |
| Operação e dados | Ver execuções | `executions.view` | Sim | Sim | Sim | Não |  |
| Operação e dados | Pausar, cancelar e refazer execução | `exec.control` | Sim | Sim | Não | Não |  |
| Operação e dados | Ver custo real e fornecedores | `exec.cost` | Sim | Não | Não | Não |  |
| Operação e dados | Conectar integrações do workspace | `integrations.connect` | Sim | Sim | Sim | Não | CRM, e-mail da empresa, mídia, reuniões e conhecimento. |
| Operação e dados | Ver relatórios | `analytics.view` | Sim | Sim | Sim | Não |  |
| Operação e dados | Gerenciar qualquer canal e o #geral | `channels.manage` | Sim | Sim | Sim | Só o seu | BDR gerencia os canais que criou. |
| Operação e dados | Painel Althius: uso global, margens, auditoria e saúde | `admin` | Sim | Não | Não | Não |  |

## Revisão de congruência

As 14 áreas se conectam na tela. O que falta é o backend executar o que a tela promete: hoje débito de créditos, tarefas e sincronização com o CRM ainda são simulados.

| Área | Conecta com | Corrigido na v18 | Fica para o backend (Hermes) |
| --- | --- | --- | --- |
| Workspace e equipe | Todas as áreas | C-level; logo do workspace; estrategista vê só os workspaces atribuídos; matriz de papéis | Convite real por e-mail; criação de workspace pelo superadmin |
| Contas e leads | Sinais, Cadências, Pipeline, Caixa de entrada, mapa da Home | Logo da conta na lista, na lateral e no Pipeline (v17) | Travar edição do BDR fora das contas dele; conta excluída para cadências e apaga conversas |
| Sinais | Agentes (cada sinal tem dono), temperatura da conta, Créditos, Relatórios | — | Leitura real por scraping; débito por conta no extrato |
| Cadências | Comitê da conta, Caixa de entrada, Tarefas, Créditos, conexões de e-mail e WhatsApp | Instagram como passo manual (v17) | Passo manual virar tarefa no dia; parar quando a pessoa responder; C-level só vê |
| Tarefas | Cadências, Pipeline, Agentes, Notificações | BDR cria tarefa só para si | Notificação ir para o responsável, não para quem criou |
| Caixa de entrada | Contas (filtro CRM), Cadências, Agente de Copy, Tarefas | C-level passa a ler | Uma conexão por pessoa; BDR vê só as próprias conversas; leitura da Althius na Auditoria |
| Pipeline | Contas, Relatórios (etapas fixas), Agente de RevOps | BDR mexe só nos próprios negócios; quadros só para gestores | Sincronizar com o CRM conectado e definir qual lado manda |
| Campanhas | Agente de Marketing, conectores por canal, Aprovações, Relatórios | Verba só aprovada por C-level ou superadmin | Lead da campanha virar conta ou negócio com a origem marcada |
| Agentes | Playbook, Skills, Sinais, Integrações, Execuções, Créditos, Canais | C-level pausa agente; permissão de criar agente removida | C-level sugerir mudança no playbook (hoje só lê) |
| Aprovações | Agentes, Campanhas, Créditos, CRM | Gasto é decisão do C-level; estrategista vê o aviso | Pedido de créditos do estrategista virar item em Aprovações (hoje é notificação) |
| Créditos | Toda ação de agente, Aprovações (teto), Relatórios | Compra e política só para C-level e superadmin; estrategista pede | Débito real em cada ação; recarga automática cobrando de verdade |
| Relatórios | Pipeline, Cadências, Campanhas, Créditos, Sinais | — | Funil (512, 684, 64, 23) ainda é número fixo de demonstração |
| Canais | Agentes (só responde quem está no canal), Equipe (#geral) | Gerencia quem criou o canal ou um gestor | Agente chamado no canal debitar crédito e respeitar o papel de quem chamou |
| Integrações | Agentes, Campanhas, Caixa de entrada | — | Separar conexão da empresa (CRM, mídia) da conexão pessoal (caixa de entrada) |

## Como o Hermes orquestra

O Hermes segue a mesma sequência para qualquer ação, venha ela de um clique, de um agente ou de um evento. A regra que trava o botão na tela é a mesma que trava o agente.

**Diagrama — fluxo de checagem do Hermes:**

1. Pedido chega (tela, agente ou evento).
2. O papel tem a chave? Não → recusado e explicado (botão desligado ou aviso; nada roda).
3. É dono do dado? (regras "Só o seu" e "Atribuídos") Não → recusado.
4. Precisa de decisão de alguém? (Pede, gasto, acima do teto, autonomia baixa) Sim → vira pedido em Aprovações (gasto: C-level ou superadmin; operação: estrategista também) → aprovado volta ao passo 5.
5. Cabe nos créditos? (saldo, limite do mês, custo) Não → recarga automática se ligada; senão o C-level recebe o pedido.
6. O agente executa com o playbook e as skills publicados.
7. Registra tudo: execução, extrato, notificação e auditoria.

A ordem importa: a permissão é checada antes do custo, então ninguém gasta crédito numa ação que não podia fazer. O passo 6 vale para tudo, inclusive para o que foi recusado.

No prompt de cada agente, o Hermes coloca três coisas: o papel de quem pediu, as chaves desse papel e o saldo de créditos. Assim o agente já responde dentro do limite ("isso precisa da aprovação da Aline") em vez de tentar e falhar.

## Eventos e entidades

O Hermes precisa de 17 entidades e reage a 15 eventos. Toda entidade carrega `workspace_id` e, quando faz sentido, `responsavel_id`: é isso que permite aplicar as regras "Atribuídos" e "Só o seu".

**Entidades:** Workspace (logo, site) · Membro (papel por workspace) · Conta (site, logo, temperatura) · Contato (LinkedIn, Instagram, e-mails, telefones) · Negócio · Quadro (motion) · Cadência e Passo (modo automático ou manual) · Tarefa · Conversa · Campanha · Agente (versão do playbook, skills, sinais ligados, autonomia) · Execução · Aprovação (tipo: operação ou gasto) · Movimento de crédito · Canal e Mensagem · Notificação · Registro de auditoria.

| Evento | Vem de | O que o Hermes faz |
| --- | --- | --- |
| `conta.site_definido` | Tela (lateral da conta) | Busca o logo no site, guarda e mostra na lista, na lateral e no Pipeline |
| `sinal.encontrado` | Coleta do Apify, pelo agente dono do sinal | Atualiza a temperatura, avisa o #sinais-de-compra, sugere cadência, debita o custo do sinal |
| `contato.excluido` | Tela ou CRM | Para as cadências da pessoa, apaga as conversas dela e deixa de aceitar mensagens dela |
| `mensagem.recebida` | Webhook da Unipile (WhatsApp, LinkedIn, Instagram ou e-mail) | Se o remetente não está no CRM, descarta sem gravar. Se está: classifica a intenção, para a cadência e pede ao Agente de Copy uma sugestão de resposta |
| `conta_de_mensagem.status_mudou` | Webhook de status da Unipile | Marca a conexão da pessoa como `attention` e avisa para reconectar; pausa os envios automáticos dela |
| `linkedin.nova_conexao` | Webhook de nova relação da Unipile | Muda o contato para Conectado e libera o próximo passo de mensagem |
| `cadencia.passo_venceu` | Agenda da cadência | Automático: o Agente de Copy escreve e envia pela Unipile (4 créditos). Manual: cria a tarefa para o responsável com o texto pronto e o botão Enviar agora |
| `negocio.movido` | Pipeline (arrastar) | O Agente de RevOps atualiza o CRM. Se ganho: notificação e entrada nos Relatórios |
| `tarefa.criada` | Tela, cadência ou agente | Notifica o responsável no horário; se tem agente marcado, ele prepara o material (2 créditos) |
| `aprovacao.decidida` | Aprovações | Aprovada: libera a execução. Ajuste: devolve ao agente com o pedido. Rejeitada: encerra e registra |
| `campanha.verba_pedida` | Agente de Marketing | Cria aprovação do tipo gasto, que só C-level ou superadmin decide |
| `credito.saldo_baixo` | Extrato | Avisa o C-level, que pede créditos à Althius (ADR 0064) |
| `agente.pausado` | Tela (C-level, estrategista ou superadmin) | Congela a fila do agente e avisa o estrategista |
| `membro.papel_mudado` | Configurações → Workspace e membros | Recalcula o que a pessoa pode fazer e registra na Auditoria |
| `workspace.logo_mudado` | Configurações | Troca a marca na barra lateral e no seletor de workspaces |

## Agentes por dentro

São 4 agentes fixos por workspace, e ninguém cria agente novo (decisão do front, mais rígida que o Blueprint, que previa agentes personalizados). Os nomes ainda podem mudar. A coluna "No Blueprint" mostra de onde veio cada um.

| Agente (front) | O que faz | No Blueprint | Autonomia inicial | BDR conversa? |
| --- | --- | --- | --- | --- |
| Agente Comercial (`comercial`) | ICP, contas, comitê de compra, sinais de compra, enriquecimento | Estrategista de Mercado + Inteligência e Sinais | Assistido | Sim |
| Agente de Marketing (`marketing`) | Mídia paga, orgânico, eventos, SEO/GEO; aponta onde realocar verba | Growth e Demanda | Assistido | Não |
| Agente de Copy (`copy`) | E-mails, WhatsApp, LinkedIn, Instagram, roteiros, anúncios; sugere resposta na Caixa de entrada | Ativação e Conversas (parte de mensagem) | Supervisionado | Sim |
| Agente de RevOps (`revops`) | Higiene do CRM, Pipeline, previsão, negócio parado, relatórios, leitura de reuniões | Ativação e Conversas (parte de CRM) + capacidade de Reuniões | Supervisionado | Não |

A autonomia usa a escala de 0 a 5 do Blueprint. **Supervisionado** = nível 2: prepara e tudo passa por aprovação. **Assistido** = nível 3 para ações sensíveis e nível 4 para rotinas de baixo risco (ex.: atualizar uma propriedade no CRM). Dinheiro, contato externo em lote, exclusão e mudança de permissão nunca passam do nível 3.

Cada agente tem quatro camadas de configuração. Não misture: cada uma tem dono e tabela própria.

| Camada | O que é | Quem muda | Onde fica |
| --- | --- | --- | --- |
| Playbook | Texto em markdown com missão, regras, processo e o que o agente nunca faz. Uma versão publicada por vez, com histórico | Estrategista publica; C-level lê; superadmin tudo | `agent_playbooks` (já existe no banco) |
| Skills | Como fazer uma tarefa específica, no formato de skill do Claude Code (`.md` com passo a passo). Pode ser importada | Estrategista e superadmin | Tabela nova `agent_skills` |
| Sinais | Catálogo fixo de sinais por agente (20 hoje), cada um com fonte, frequência e custo por conta. O workspace liga e desliga; o superadmin cria sinais personalizados | Ligar: estrategista. Criar: superadmin | Tabelas novas `signal_definitions` e `workspace_signal_settings` |
| Conhecimento | O material que o agente consulta: Notion, Drive, transcrições, cases. Entra pelos conectores, não por upload solto | Quem conecta a integração | `connections` + `agent_connection_assignments` (já existem) |

Aprendizado não é tela própria. O Hermes junta resultados (respostas, reuniões, CPL) e gera **sugestões de mudança no Playbook**, com a evidência ("aprendido com 140 ligações"). O estrategista aplica ou descarta, e só então nasce uma nova versão. No banco isso usa `learning_entries` com status `sugerida`, `aplicada` ou `descartada`.

## Coleta com Apify

Toda coleta passa pelo Apify, numa conta central da Althius. O cliente nunca vê a Apify, nome de Actor nem custo em dólar do fornecedor: ele vê sinais com nome da marca e o custo em créditos. Isso já está no Blueprint e o front segue igual.

Como um sinal roda:

1. O estrategista liga o sinal na aba Sinais do agente. Isso grava em `workspace_signal_settings` (sinal, ligado, frequência).
2. Na frequência do sinal, o Hermes cria uma execução com as contas do escopo e estima o custo: custo por conta × número de contas.
3. O Credit Service reserva os créditos (reserva 25% acima da estimativa, como no Blueprint). Sem saldo ou acima do teto, a execução vira pedido em Aprovações.
4. O Data Provider Gateway escolhe o Actor, injeta a chave central e roda com limite de tempo e de custo. O Hermes nunca recebe a chave.
5. O resultado é normalizado e deduplicado antes de tocar o CRM, nos 7 passos do Blueprint.
6. Cada achado vira um registro em `signal_events` e atualiza a conta: temperatura (1 a 3 chamas), último sinal, cidade e UF (para o mapa da Home).
7. Sinal quente avisa o #sinais-de-compra. O consumo real é liquidado e a sobra da reserva volta ao saldo.

Relação entre os 20 sinais do front e o catálogo de capacidades do Blueprint (o código é o que o superadmin liga a um Actor):

| Sinal no front | Agente | Capacidade | Custo por conta |
| --- | --- | --- | --- |
| Vagas abertas por cargo | Comercial | `job_signal_monitor` | 5 cr |
| Troca de cargo do decisor | Comercial | `person_enrichment` (monitorado) | 5 cr |
| Dados cadastrais da Receita | Comercial | `company_enrichment` | 2 cr |
| Nova filial ou mudança de endereço | Comercial | `company_enrichment` + `maps_business_search` | 3 cr |
| Rodada de investimento ou M&A | Comercial | `market_scan` | 4 cr |
| Importação recorrente por NCM | Comercial | `market_scan` | 4 cr |
| Licitações e contratos públicos | Comercial | `market_scan` | 4 cr |
| Anúncios ativos | Marketing | `ad_signal_monitor` | 5 cr |
| Gaps de SEO do site | Marketing | novo: `site_audit` | 8 cr |
| Presença em respostas de IA (GEO) | Marketing | novo: `geo_presence` | 10 cr |
| Seguidores de concorrente | Marketing | novo: `social_followers` (precisa de revisão jurídica, desligado por padrão) | 20 cr |
| Expositores de eventos e feiras | Marketing | `event_exhibitor_map` | 6 cr |
| Avaliações e reclamações | Marketing | novo: `review_monitor` | 3 cr |
| Posts do decisor | Copy | novo: `social_posts` | 3 cr |
| Notícias da empresa | Copy | `market_scan` | 3 cr |
| Objeções recorrentes | Copy | interno, sem Apify (lê a Caixa de entrada) | 0 cr |
| Negócio parado | RevOps | interno (lê o Pipeline) | 0 cr |
| Contato inválido | RevOps | interno (bounce da Unipile ou do e-mail) | 1 cr |
| Duplicidade no CRM | RevOps | interno (CRM) | 0 cr |
| Mudança de stack tecnológica | RevOps | novo: `tech_detection` | 4 cr |

O logo da conta e do workspace **não precisa de Apify**. Uma função do backend busca, nesta ordem, `apple-touch-icon`, a imagem `og:image` e o favicon do site, e guarda no storage. O front hoje busca direto no navegador só para demonstrar.

## Caixa de entrada e cadências com Unipile

A Unipile é o motor de conversa: uma API só para LinkedIn, WhatsApp, Instagram e e-mail (Google, Microsoft e IMAP). Ela **não está nos documentos do backend**, que previam Gmail, Microsoft Graph e WhatsApp Cloud API separados. Esta seção substitui essa parte. A palavra Unipile nunca aparece na tela.

### 1. Conexão: uma por pessoa

A conta é da pessoa, não do workspace. Cada membro conecta o próprio WhatsApp, LinkedIn, Instagram e e-mail (chave `inbox.connect`, regra "Só o seu").

1. A pessoa clica em Conectar na Caixa de entrada.
2. O backend cria um link do assistente de conexão da Unipile (`POST /api/v1/hosted/accounts/link`) com `type: "create"`, o provedor do canal, `name` = id do membro e `notify_url` = uma Edge Function nossa.
3. A pessoa entra na conta (no WhatsApp, lê o QR code no celular).
4. A Edge Function recebe `status: "CREATION_SUCCESS"`, `account_id` e `name`, e grava em `messaging_accounts`.
5. Se a conta cair, o webhook de status da conta marca `attention`. O front mostra Reconectar, que gera um novo link com `type: "reconnect"` e `reconnect_account`.

O front hoje desenha o próprio QR code só como demonstração. Falta confirmar se o assistente da Unipile pode aparecer sem a marca dela; se não puder, use a autenticação customizada da Unipile com tela nossa.

### 2. Recebimento: só contatos do CRM

Esta é a regra de privacidade mais importante da plataforma: a conversa com a noiva ou com os pais de quem conectou nunca entra.

1. A Unipile manda o webhook de nova mensagem (ou de novo e-mail) para a nossa Edge Function, com um header secreto (`Unipile-Auth`) que conferimos.
2. A função responde 200 na hora (o prazo é 30 segundos e há 5 tentativas) e põe o processamento numa fila. O id da mensagem é a chave de idempotência.
3. O worker pega o remetente (telefone, e-mail, id do LinkedIn ou do Instagram) e procura em `contact_channels` do workspace daquela conta.
4. **Não achou: descarta sem gravar nada**, nem texto nem metadado. Grupo: descarta sempre.
5. Achou: grava a conversa e a mensagem ligadas ao contato e à conta, classifica a intenção (positiva, adiar, objeção, neutra, opt-out, automática), pausa a cadência daquela pessoa e pede ao Agente de Copy uma sugestão de resposta.
6. Contato excluído do CRM: apaga as mensagens dele e, a partir dali, o passo 3 não acha mais ninguém.

Na primeira conexão, não importe o histórico inteiro. Puxe só as conversas em que algum participante já é contato do CRM.

### 3. Envio: o que é automático e o que é manual

| Canal | Automático? | Como funciona |
| --- | --- | --- |
| E-mail | Sim, se o passo estiver em Automático | O Agente de Copy escreve e o Hermes envia pela conta de e-mail da pessoa, via Unipile, em horário comercial. 4 créditos por envio |
| WhatsApp | Sim, se o passo estiver em Automático | Envia na conversa existente (`chat_id`) ou abre uma nova (`POST /api/v1/chats` com `attendees_ids`). Limite diário por pessoa e só para contatos do CRM. 4 créditos |
| LinkedIn | Não (decisão de produto) | Vira tarefa. Pela Unipile, só dá para abrir conversa com quem já é conexão, o que bate com o front: Conectado → mensagem; sem conexão → convite com nota (o front limita em 300 caracteres; confirmar o limite atual do LinkedIn) ou só convite. O webhook de nova relação muda o status para Conectado sozinho |
| Instagram | Não | Vira tarefa. Mensagem direta pode sair pela Unipile quando a pessoa clica em Enviar. Seguir é sempre manual: não achei esse recurso na documentação da Unipile |
| Ligação | Não | Vira tarefa com roteiro e link `tel:`. Não passa pela Unipile |

"Manual" não precisa significar copiar e colar. A tarefa pode ter um botão **Enviar agora**: a pessoa revisa e clica, e o envio sai pela Unipile na conta dela. Para o LinkedIn e o Instagram isso conta como ação da pessoa, e resolve a limitação atual do front (hoje ele só copia o texto e abre o perfil).

O rastreio de e-mail (aberturas) e os bounces chegam por webhook e alimentam o sinal "Contato inválido" do Agente de RevOps.

[Documentação da Unipile](https://developer.unipile.com/docs/getting-started) · [Assistente de conexão](https://developer.unipile.com/docs/hosted-auth) · [Webhooks](https://developer.unipile.com/docs/webhooks-2) · [Envio de mensagens](https://developer.unipile.com/docs/send-messages)

## Pipeline, motions e créditos

### Pipeline

São 6 etapas fixas para o workspace inteiro. Só o nome muda conforme a motion: é isso que deixa SLG, MLG e PLG comparáveis em Relatórios. Cada motion tem até 5 quadros.

| Chave da etapa | SLG | MLG | PLG | Chance padrão |
| --- | --- | --- | --- | --- |
| `entrada` | Prospecção | Lead captado | Cadastro | 10% |
| `qualificacao` | Qualificação | MQL | Ativado | 20% |
| `descoberta` | Reunião | SQL | PQL | 35% |
| `proposta` | Proposta | Proposta | Conversa comercial | 55% |
| `negociacao` | Negociação | Negociação | Upgrade | 75% |
| `ganho` | Ganho | Ganho | Ganho | 100% |

Regras:

- Quadro = um registro em `pipelines` com `motion` (`slg`, `mlg`, `plg`). O banco recusa o 6º quadro da mesma motion.
- A etapa do negócio guarda a chave, nunca o nome. A ordem das colunas pode mudar por quadro, mas Ganho fica sempre no fim.
- Ao mudar de etapa, a chance de ganho volta ao padrão da etapa; depois o responsável pode ajustar. Em Ganho fica 100%.
- Situação do negócio: `no_prazo`, `em_risco` ou `atrasado`. Ela pinta a barra de chance no card.
- A ordem dentro da coluna é salva (campo `position`), porque o card pode ser arrastado dentro da mesma etapa.
- Excluir um quadro move os negócios dele para outro quadro da mesma motion. Nada some.
- BDR cria e move só negócios em que é responsável. Quadros só para C-level, estrategista e superadmin.
- Cada mudança de etapa grava em `opportunity_stage_history` e dispara o Agente de RevOps para atualizar o CRM.

### Créditos

1 crédito vale US$ 0,005 (200 créditos = US$ 1, a mesma regra do Blueprint). Todo workspace começa com 10.000 créditos (US$ 50).

Modos de consumo, que só o C-level e o superadmin mudam:

- **Automático:** os agentes gastam sem pedir, até o limite do mês (padrão 5.000 créditos).
- **Com aprovação:** ação acima do teto (padrão 500 créditos) vira pedido em Aprovações antes de rodar.
- **Recarga automática:** desligada (ADR 0064). A Althius opera junto com o cliente, então nada compra créditos sozinho.

Custos que o front mostra hoje:

| Ação | Créditos |
| --- | --- |
| Mensagem no chat ou no copiloto | 2 |
| Rascunho de mensagem ou tarefa | 2 |
| E-mail ou WhatsApp automático | 4 por envio |
| Enriquecer um contato (e-mail e telefone), pedido à mão ou por agente | 10 |
| Enriquecimento automático de uma conta nova (site, logo, CNPJ, endereço e ponto no mapa) | 5 por conta, devolvido se não achar nada |
| Enriquecimento automático das pessoas de uma conta (até 5, com foto e LinkedIn) | 2 por pessoa criada |
| Pesquisa de conta (dossiê) | 15 |
| Mapear o comitê de uma conta | 25 |
| Sinal monitorado | 0 a 20 por conta, a cada leitura |
| Leitura de mídia | 30 por semana |
| Relatório automático | 20 por envio |

O enriquecimento automático (toda conta nova entra sozinha na fila, ADR 0062) tem preço próprio e mais baixo, porque usa fontes públicas e uma busca barata. "Enriquecer um contato" (10) e "Mapear o comitê" (25) continuam valendo para o que alguém ou um agente pede à mão. Os valores do automático são provisórios: o custo real de cada trabalho é medido na fila (`custo_usd`, só o superadmin vê) e o preço é revisto com esses números.

O extrato do front só mostra entradas e saídas. No banco, cada ação passa por reserva, consumo e liberação (`reserve`, `consume`, `release`), e o extrato junta as três numa linha só. **Créditos se pedem à Althius** (ADR 0064, decisão do Nan em 06/10/2026): o cliente assina por mês e a Althius opera a plataforma junto com ele, então não há compra em 1 clique. Quem tem `credits.buy` (C-level, estrategista, superadmin) pede; o pedido é uma aprovação de gasto que **só o superadmin decide**, e o crédito entra no saldo quando ele aprova. A cobrança segue o contrato do cliente.

## Conferência dos documentos do backend

Os 3 PDFs que foram para a IA do backend acertam a base: Supabase, RLS por workspace, ledger imutável, Apify central, Hermes como orquestrador e Execuções como centro. Mas 24 pontos ficaram para trás depois das mudanças no front. **Onde houver conflito, vale o front e este documento.**

O "Blueprint ... Buzz.pdf" (42 páginas) é o mais completo. O "Buzz 1" (38 páginas) é igual, mas sem as páginas de franquia, pacotes e validade dos créditos. Use só o de 42.

| Tema | Documentos do backend | Front e este documento | O que fazer |
| --- | --- | --- | --- |
| Agentes | 4 agentes: Estrategista de Mercado, Inteligência e Sinais, Ativação e Conversas, Growth e Demanda. Prevê agentes personalizados e templates | 4 fixos: Comercial, Marketing, Copy, RevOps. Ninguém cria agente | Usar os 4 do front no Agent Registry; tirar agentes personalizados do MVP |
| Papéis | Banco: 8 papéis (Superadmin, Estrategista, Operador de Marketing, Admin do Cliente, Gestor Comercial, BDR/SDR, Analista, Visualizador). Blueprint: outros 8 (com Owner, RevOps/Gestor, Marketing, Convidado) | 4: superadmin, estrategista, C-level, BDR/SDR | Criar só os 4 no seed. Owner e Admin do Cliente viram C-level; os outros ficam para depois |
| Superadmin e dados do cliente | Blueprint: só com fluxo de suporte auditado | Matriz: lê a Caixa de entrada, com registro na Auditoria | Fazer a leitura do superadmin passar por um "modo suporte" com motivo e registro |
| Crédito em conversa | Conversa e recomendação incluídas no fee; custo de LLM medido à parte, sem tirar do saldo | Mensagem no chat custa 2 créditos; rascunho, 2 | Decisão em aberto (ver abaixo) |
| Dólar na tela | O cliente nunca vê dólar; crédito não é conversão pública | Mostra 1 crédito = US$ 0,005 e US$ no extrato | Decisão em aberto. Se ficar, é preço de venda, nunca custo do fornecedor |
| Franquia | 10.000 créditos por mês, renovam e expiram; recarga vale 90 ou 180 dias; gasta antes o que vence antes | Começa com 10.000; não mostra renovação nem validade | Seguir o Blueprint no banco (carteira mensal + carteira de recarga) e o front passa a mostrar renovação e validade |
| Pacotes | Em reais: 2.000 por R$ 119, 5.000 por R$ 279, 10.000 por R$ 529, 25.000 por R$ 1.249 | Em dólar, preço linear: 10.000 a 100.000 por US$ 50 a US$ 500 | Escolher uma tabela só (decisão em aberto) |
| Reserva | Reserva 25% acima da estimativa e libera a sobra | Saldo não mostra o reservado | Mostrar "reservado" no saldo |
| Caixa de entrada | Não existe; respostas ficam no Sales Workbench. Banco sem tabela de mensagens | Módulo próprio, 4 canais, só contatos do CRM | Criar módulo e tabelas (seção Unipile) |
| WhatsApp, Instagram, LinkedIn | WhatsApp Cloud API com templates (Tier 2), WhatsApp proativo só com aprovação; Instagram desligado e sem DMs; Gmail e Graph diretos | Unipile para os 4 canais; WhatsApp automático na cadência | Unipile substitui esses conectores. A regra de Instagram do Blueprint vale para coleta de dados de terceiros, não para a caixa da própria pessoa |
| Unipile | Não citada | Motor de conversa, escondido do cliente | Seguir a seção Unipile |
| Tarefas | "Tarefa humana" é um tipo de execução; tabela `tasks` sem campos | Nome, canal, conta, contato, responsável, agente marcado, data, hora, status, nota | Definir os campos (próxima seção) |
| Pipeline | Só "visão sincronizada com o CRM", sem etapas | 6 etapas fixas, 3 motions, até 5 quadros cada | Seguir a seção Pipeline |
| Sinais | Banco não tem; Blueprint tem catálogo de capacidades | 20 sinais fixos por agente, ligar e desligar, sinal personalizado do superadmin | Tabelas novas, ligadas às capacidades |
| Skills | Não aparecem (só citadas no runtime do Hermes) | Aba Skills por agente, com importação de `.md` | Tabela nova |
| Aprendizado | Banco: `learning_entries`; Blueprint: feedback por recomendação | Sem tela própria; vira sugestão no Playbook | Status de sugestão em `learning_entries` |
| Reuniões | Módulo Reuniões e capacidade auxiliar | Sem tela; Granola, Gong etc. são conectores e o RevOps lê | Decisão: virar aba dentro da conta |
| Conhecimento | Aba própria com dono, validade e confidencialidade | Entra pelos conectores; Skills cobrem o "como fazer" | Guardar dono e validade nos documentos conectados |
| Notificações | Banco não tem tabela; Blueprint deixa com o Buzz | Sino por papel; tarefa, compra, pausa e negócio ganho notificam | Tabela `notifications`, entregue ao responsável e não a quem criou |
| Canais de chat | 7 canais sugeridos (#estrategia-receita, #aprovacoes etc.) | #geral obrigatório com todo mundo; canais criados com pessoas e agentes; agente só responde se estiver no canal | Seed com #geral; regra de agente por canal |
| Aprovações | Uso único: mudar o conteúdo invalida | Tipos Copy, Lista, Orçamento, Alteração de CRM, Execução acima do limite; gasto só C-level | Campo `category` (`operacao` ou `gasto`) e hash do conteúdo |
| Copiloto | Chips Estratégia, Sinais, Ativação, Growth | Os 4 agentes novos | Trocar os chips pelos 4 agentes |
| Logo e site | Não existe | Conta e workspace com site e logo | Campos novos |
| Mapa da Home | Não existe | Contas por UF no mapa do Brasil | Conta guarda UF, cidade e coordenadas vindas da coleta |

O que já bate e não precisa mexer: Home diferente por papel, Execuções como aba própria, Hub de Integrações com credencial do workspace concedida aos agentes, Apify escondido do cliente, ledger imutável, auditoria, isolamento por workspace e a regra de que o BDR não mexe em agentes nem em integrações.

## Mudanças no banco

O desenho de banco que já foi enviado continua valendo. Para cobrir o front atual, são 14 tabelas novas e 13 alteradas. Os nomes seguem o padrão do documento original (`snake_case`, `workspace_id` em tudo, UUID).

| Tabela | Novo ou alterar | Campos | Para quê |
| --- | --- | --- | --- |
| `roles` + `role_permissions` | Alterar (seed) | 4 papéis: `superadmin`, `estrategista`, `clevel`, `bdr`. Cada permissão = uma chave da matriz + `scope` (`all`, `assigned`, `own`, `read`, `request`, `none`) | A matriz vira dado; tela e Hermes leem a mesma coisa |
| `workspaces` | Alterar | `logo_url`, `site_domain`, `logo_source` (`upload` ou `site`) | Logo do workspace |
| `workspace_settings` | Alterar | `credit_mode` (`auto` ou `approval`), `approval_threshold`, `monthly_credit_limit`, `auto_topup_enabled`, `auto_topup_below`, `auto_topup_amount` | Modo de consumo |
| `accounts` | Alterar | `logo_url`, `temperature` (1 a 3), `last_signal_text`, `state_uf`, `lat`, `lng` (`domain` já existe) | Logo, chamas e mapa |
| `contacts` | Alterar | `buying_role` (`decisor`, `influenciador`, `campeao`), `linkedin_status` (`sem_conexao`, `convite_enviado`, `conectado`), `photo_url` | Comitê e LinkedIn |
| `contact_channels` | Novo | `contact_id`, `type` (`email`, `phone`, `whatsapp`, `linkedin`, `instagram`), `value_normalized`, `position` (1 a 3). Único por workspace + tipo + valor | Até 3 e-mails e 3 telefones, @ do Instagram e a busca do filtro só-CRM |
| `messaging_accounts` | Novo | `member_id`, `provider` (`linkedin`, `whatsapp`, `instagram`, `google`, `microsoft`, `imap`), `unipile_account_id`, `display_name`, `status` | Conexão de cada pessoa na Unipile |
| `conversations` | Novo | `contact_id`, `account_id`, `messaging_account_id`, `channel`, `external_chat_id`, `intent`, `last_message_at`, `unread` | Caixa de entrada |
| `messages` | Novo | `conversation_id`, `direction` (`in` ou `out`), `external_message_id` (único), `text`, `sent_by` (`member`, `agent`, `automation`), `cadence_step_execution_id` | Mensagens; apagadas junto com o contato |
| `cadence_steps` | Alterar | `channel` (`email`, `whatsapp`, `linkedin`, `instagram`, `call`); `execution_mode` (`auto` ou `manual`, com regra: `auto` só em e-mail e WhatsApp); `linkedin_action` (`connect`, `connect_note`, `message`); `instagram_action` (`follow`, `message`); `subject`, `body`, `target_position` | Cadência automática e manual |
| `cadence_enrollment_steps` | Novo | Passos ajustados para uma pessoa (o front edita a cadência por contato, dentro da conta) | Personalização por contato |
| `tasks` | Alterar | `title`, `channel`, `account_id`, `contact_id`, `assignee_member_id`, `agent_id` (opcional), `due_at`, `status` (`pendente`, `em_andamento`, `concluida`), `note`, `source` (`manual`, `cadencia`, `agente`) | Nova tarefa e passos manuais |
| `pipelines` | Alterar | `motion` (`slg`, `mlg`, `plg`), `name`, `stage_order`; no máximo 5 por motion | Quadros |
| `stage_definitions` | Novo (global) | `key`, `default_probability`, `is_final`, mais o nome por motion | As 6 etapas fixas |
| `opportunities` | Alterar | `pipeline_id`, `stage_key`, `account_id`, `owner_member_id`, `amount`, `close_date`, `win_probability`, `health` (`no_prazo`, `em_risco`, `atrasado`), `position` | Cards do quadro |
| `campaigns` | Alterar | `channel_type` (`linkedin_ads`, `meta_ads`, `google_ads`, `organico`, `evento`, `seo_geo`), `leads_count` | Campanhas por canal |
| `signal_definitions` | Novo | `agent_code`, `code`, `name`, `source_label`, `description`, `credits_per_account`, `frequency`, `default_on`, `capability_code`, `is_custom` | Catálogo de sinais |
| `workspace_signal_settings` | Novo | `signal_id`, `enabled`, `updated_by` | Ligar e desligar por workspace |
| `signal_events` | Novo | `signal_id`, `account_id`, `execution_id`, `payload`, `detected_at` | O que cada sinal achou |
| `agent_skills` | Novo | `agent_id`, `name`, `slug`, `content_markdown`, `enabled`, `version` | Aba Skills |
| `agent_playbooks` | Alterar | `is_published` (só uma versão publicada por agente) | Publicar e voltar versão |
| `learning_entries` | Alterar | `agent_id`, `suggestion_text`, `evidence`, `status` (`sugerida`, `aplicada`, `descartada`) | Sugestões no Playbook |
| `approvals` | Alterar | `category` (`operacao` ou `gasto`), `payload_hash` | Gasto só para C-level; aprovação de uso único |
| `chat_channels`, `chat_channel_members`, `chat_channel_agents` | Novo (ou no Buzz) | `slug`, `description`, `is_general`, `created_by`; pessoas; agentes | Canais com #geral obrigatório e agentes por canal |
| `notifications` | Novo | `recipient_member_id`, `type`, `title`, `body`, `entity_type`, `entity_id`, `read_at` | Sino de notificações |

Na RLS, as regras "Só o seu" viram filtro por `owner_member_id` ou `assignee_member_id` para o papel `bdr`. "Atribuídos" vira o filtro por `workspace_members` que o documento original já prevê. Contas, negócios e tarefas sem responsável ficam visíveis, mas só gestores mexem.

## Decisões em aberto

São 14 escolhas abertas. As 6 primeiras mudam regras da matriz, e a v18 já usa a opção padrão. As 8 seguintes vieram da conferência com os documentos do backend; até Nan decidir, a IA do backend segue o padrão indicado.

- [ ] **Superadmin lendo a Caixa de entrada:** padrão "Só ver, com registro na Auditoria". Alternativa: só métricas, sem abrir a conversa.
- [ ] **Estrategista e dinheiro:** padrão "pede" para verba e créditos. Alternativa: aprovar até um teto que o C-level define.
- [ ] **C-level no playbook:** padrão "Só ver". Alternativa: sugerir mudança, que o estrategista aceita ou não.
- [ ] **BDR e envio automático:** padrão "Só o seu" (liga nas próprias contas). Alternativa: sempre pedir ao C-level, porque gasta crédito.
- [ ] **Fonte da verdade do Pipeline:** Althius ou o CRM conectado (HubSpot, Pipedrive etc.) quando os dois mudam o mesmo negócio.
- [ ] **Id técnico do C-level:** manter `cliente` ou migrar para `clevel` antes de o backend nascer (recomendo migrar agora).

### Da conferência com o backend

- [ ] **Conversa com agente gasta crédito?** Padrão: sim, 2 créditos por mensagem, como está no front. O Blueprint incluía as conversas no fee.
- [ ] **Dólar na tela:** padrão: mostrar 1 crédito = US$ 0,005 como preço de venda. O Blueprint esconde qualquer valor em dólar.
- [ ] **Tabela de pacotes:** a do front (em dólar, preço linear de 10.000 a 100.000 créditos) ou a do Blueprint (em reais, de 2.000 por R$ 119 a 25.000 por R$ 1.249).
- [ ] **Franquia mensal:** padrão: 10.000 créditos por mês, que renovam e expiram, e recarga com validade de 90 dias, como no Blueprint. O front ainda mostra só "começa com 10.000".
- [ ] **WhatsApp automático:** padrão: permitido só para contatos do CRM, com limite diário por pessoa e com o C-level ligando a opção no workspace. O WhatsApp pela Unipile usa a conta pessoal, e volume alto arrisca bloqueio do número.
- [ ] **E-mail pela Unipile ou direto:** padrão: o e-mail da pessoa (Caixa de entrada e envios) vai pela Unipile; Gmail e Outlook no Hub ficam para agenda e rascunhos dos agentes.
- [ ] **Reuniões:** padrão: virar uma aba dentro da conta, alimentada por Granola, Gong e similares e lida pelo Agente de RevOps. O Blueprint tinha um módulo próprio.
- [ ] **Negócio perdido:** o Pipeline não tem coluna Perdido. Padrão: marcar como perdido com motivo, o card sai do quadro e entra nos Relatórios.
