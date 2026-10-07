(function(){
// Althius Revenue OS — mocks compartilhados + services (substituir por API real depois)
const espera = (v, ms = 380) => new Promise(r => setTimeout(() => r(JSON.parse(JSON.stringify(v))), ms));

const ROLES = {
  superadmin: { id: 'superadmin', label: 'Superadmin', usuario: 'Rafael Nunes', email: 'rafael@althius.com.br', sigla: 'RN' },
  estrategista: { id: 'estrategista', label: 'Estrategista', usuario: 'Camila Duarte', email: 'camila@althius.com.br', sigla: 'CD' },
  cliente: { id: 'cliente', label: 'C-level', usuario: 'Aline Xavier', email: 'aline@evolut.com.br', sigla: 'AX' },
  bdr: { id: 'bdr', label: 'BDR/SDR', usuario: 'Lucas Teixeira', email: 'lucas@evolut.com.br', sigla: 'LT' }
};

const TODAS = ['tasks','home','strategy','approvals','accounts','prospecting','cadences','campaigns','pipeline','inbox','executions','agents','contents','signals','analytics','integrations','credits','team','settings'];
const PERMS = {
  superadmin: TODAS.concat(["ws.switch", "ws.create", "ws.brand", "team.invite", "settings.own", "agents.chat", "agents.configure", "agents.signals", "signals.custom", "agents.pause", "agents.autonomy", "accounts.edit", "accounts.import", "prospecting.approve", "cadences.edit", "cadences.auto", "tasks.assign", "pipeline.boards", "pipeline.deals", "campaigns.edit", "approvals.decide", "approvals.spend", "credits.buy", "credits.policy", "executions.view", "exec.control", "exec.cost", "integrations.connect", "analytics.view", "channels.manage", "admin", "copilot", "agents.audit", "agents.test", "agents.logs", "exec.export", "providers.view"]),
  estrategista: TODAS.filter(p => p !== 'admin').concat(["ws.switch", "ws.brand", "team.invite", "settings.own", "agents.chat", "agents.configure", "agents.signals", "agents.pause", "agents.autonomy", "accounts.edit", "accounts.import", "prospecting.approve", "cadences.edit", "cadences.auto", "tasks.assign", "pipeline.boards", "pipeline.deals", "campaigns.edit", "approvals.decide", "executions.view", "exec.control", "integrations.connect", "analytics.view", "channels.manage", "copilot", "agents.test", "agents.logs", "exec.export", "providers.view"]),
  cliente: ['home','strategy','approvals','accounts','prospecting','cadences','tasks','inbox','campaigns','pipeline','executions','agents','contents','signals','analytics','integrations','credits','team','settings'].concat(["ws.brand", "team.invite", "settings.own", "agents.chat", "agents.pause", "accounts.edit", "accounts.import", "prospecting.approve", "cadences.auto", "tasks.assign", "pipeline.boards", "pipeline.deals", "campaigns.edit", "approvals.decide", "approvals.spend", "credits.buy", "credits.policy", "executions.view", "integrations.connect", "analytics.view", "channels.manage", "copilot", "agents.request", "exec.export"]),
  bdr: ['home','accounts','prospecting','cadences','tasks','inbox','pipeline','agents','agents.helpOnly','copilot','settings'].concat(["settings.own"])
};

const NAV = [
  { secao: 'Visão geral', itens: [['home','Início','IN'],['strategy','Estratégia','ES'],['approvals','Aprovações','AP']] },
  { secao: 'Receita', itens: [['accounts','Contas e leads','CL'],['prospecting','Prospecção','PR'],['cadences','Cadências','CA'],['tasks','Tarefas','TA'],['campaigns','Campanhas','CP'],['pipeline','Pipeline','PI'],['inbox','Caixa de entrada','CX']] },
  { secao: 'Operação', itens: [['agents','Agentes','AG'],['executions','Execuções','EX'],['contents','Conteúdos','CO']] },
  { secao: 'Inteligência', itens: [['signals','Sinais','SI'],['analytics','Relatórios','RE']] },
  { secao: 'Plataforma', itens: [['integrations','Integrações','IG'],['credits','Créditos e uso','CR'],['team','Equipe e acessos','EQ'],['settings','Configurações','CF']] },
  { secao: 'Superadmin', itens: [['admin/workspaces','Workspaces','WS'],['admin/usage','Uso global','UG'],['admin/providers','Fornecedores','FO'],['admin/margins','Margens','MG'],['admin/audit','Auditoria','AU'],['admin/health','Saúde','SA']], perm: 'admin' }
];

const FASE = { strategy: 3, accounts: 3, prospecting: 3, cadences: 3, tasks: 3, campaigns: 4, pipeline: 4, inbox: 4, playbooks: 4, contents: 4, signals: 4, analytics: 4, learnings: 4, integrations: 5, credits: 5, team: 5, settings: 5, admin: 5 };

const WORKSPACES = [
  { id: 'evolut', nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução' },
  { id: 'grao', nome: 'Grão Norte Alimentos', sigla: 'GN', momento: 'Preparação' },
  { id: 'vertice', nome: 'Vértice Indústria', sigla: 'VI', momento: 'Otimização' }
];

const I = (cap, fornecedor, modo) => ({ cap, fornecedor, modo });
const AGENTS = [
  { id: 'comercial', nome: 'Zoe', sigla: 'ZO', funcao: 'Prospecção · empresas, pessoas e comitê', latim: 'Vai atrás das contas certas', estado: 'ativo', autonomia: 'Assistido', precisaAprovacao: false, bdr: true,
    objetivo: 'A única que prospecta: busca empresas novas pelo ICP (Google Maps, Receita Federal), traz candidatas para você incluir ou excluir, mapeia o comitê de compra e acompanha os sinais das contas.', escopo: 'Diz o custo antes de rodar e só roda quando uma pessoa pede. Propõe contas, enriquecimento, Pipeline e planos; nada muda sem aprovação.',
    integracoes: [I('CRM','HubSpot','Leitura'), I('Busca de empresas','Google Maps','Leitura'), I('Dados cadastrais','Receita Federal','Leitura')],
    execCiclo: 280, ultima: 'há 6 min', sucesso: 95, pendencias: 1, responsavel: 'Camila Duarte',
    caps: { lerCrm: true, escreverCrm: false, pesquisar: true, listas: true, copy: false, campanhas: false, relatorios: true, aprovacao: true },
    playbooks: [['Playbook comercial','v3.2','Camila Duarte','12 set'],['Playbook comercial','v3.1','Camila Duarte','02 set']],
    conhecimento: [['ICP','Importadores médio porte · v4'],['Persona','Diretor(a) de Supply Chain'],['Regra do cliente','Excluir tradings concorrentes']] },
  { id: 'marketing', nome: 'Jax', sigla: 'JA', funcao: 'Estratégia · ICP e mídia paga', latim: 'Anuncia a marca ao mercado', estado: 'ativo', autonomia: 'Assistido', precisaAprovacao: true, bdr: false,
    objetivo: 'Escreve e remodela o ICP pelo que já vende, pelos dados e pelo Playbook, e cuida das campanhas e da verba de mídia paga.', escopo: 'Propõe mudanças no ICP, nas campanhas e na verba; tudo vira aprovação (verba, só o C-level). Lookalike no Meta Ads quando o conector existir.',
    integracoes: [I('Mídia paga','Meta Ads','Em breve')],
    execCiclo: 36, ultima: 'há 3 h', sucesso: 78, pendencias: 1, responsavel: 'Camila Duarte',
    caps: { lerCrm: false, escreverCrm: false, pesquisar: true, listas: false, copy: false, campanhas: true, relatorios: true, aprovacao: true },
    playbooks: [['Playbook de marketing','v1.3','Camila Duarte','05 set']],
    conhecimento: [['Campanha','Importação sem risco · Q4'],['Meta','CPL abaixo de R$ 150']] },
  { id: 'copy', nome: 'Lia', sigla: 'LI', funcao: 'Copy · mensagens e cadências', latim: 'Escreve no tom da marca', estado: 'ativo', autonomia: 'Supervisionado', precisaAprovacao: true, bdr: true,
    objetivo: 'Escreve e-mails, mensagens e roteiros de ligação no tom da marca e monta os passos das cadências.', escopo: 'Gera textos. Envio automático só nos passos de cadência que você liberar.',
    integracoes: [I('E-mail','Gmail','Rascunho'), I('CRM','HubSpot','Leitura')],
    execCiclo: 61, ultima: 'há 1 h', sucesso: 88, pendencias: 3, responsavel: 'Mateus Maia',
    caps: { lerCrm: true, escreverCrm: false, pesquisar: false, listas: false, copy: true, campanhas: false, relatorios: false, aprovacao: true },
    playbooks: [['Playbook de copy','v2.1','Mateus Maia','15 set']],
    conhecimento: [['Proposta de valor','Importação por conta e ordem'],['Objeções','Prazo, custo, câmbio']] },
  { id: 'revops', nome: 'Neo', sigla: 'NE', funcao: 'RevOps · métricas e relatórios', latim: 'Mantém os números de pé', estado: 'ativo', autonomia: 'Supervisionado', precisaAprovacao: true, bdr: false,
    objetivo: 'Lê as métricas, o pipeline e os negócios parados, explica os números e monta os relatórios quando você pede.', escopo: 'Lê o CRM e os números. Mudanças no CRM e tarefas só com aprovação.',
    integracoes: [I('CRM','HubSpot','Leitura e escrita')],
    execCiclo: 52, ultima: 'há 40 min', sucesso: 98, pendencias: 0, responsavel: 'Rafael Nunes',
    caps: { lerCrm: true, escreverCrm: true, pesquisar: false, listas: false, copy: false, campanhas: true, relatorios: true, aprovacao: true },
    playbooks: [['Playbook de RevOps','v1.4','Rafael Nunes','14 set']],
    conhecimento: [['Regra do cliente','Não sobrescrever proprietário do negócio'],['Métricas','Pipeline · ciclo · conversão por etapa']] }
];

const EXECUTIONS = [
  { id: 'ex-1042', titulo: 'Qualificar 1.200 importadores do Sudeste', tipo: 'Lista', agente: 'comercial', campanha: 'Importação sem risco · Q4', solicitante: 'Camila Duarte', horario: 'Hoje, 09:12', status: 'Em execução', progresso: 64, processados: 768, validos: 512, credEst: 1800, credRes: 1800, credCons: 1150, custo: 'US$ 41,20', integracoes: ['CRM', 'Dados de prospecção'], aprovacao: 'Aprovada por Aline Xavier',
    plano: ['Ler contas existentes no CRM para evitar duplicidade','Buscar importadores por NCM e região','Cruzar CNPJ com dados cadastrais','Pontuar fit com ICP v4','Gerar lista priorizada'], etapaAtual: 3,
    logs: ['09:12 Execução iniciada','09:14 1.204 empresas encontradas','09:31 512 contas com fit acima de 70'], erros: [] },
  { id: 'ex-1041', titulo: 'Mapear comitê de 48 contas quentes', tipo: 'Enriquecimento', agente: 'comercial', campanha: 'Importação sem risco · Q4', solicitante: 'Lucas Teixeira', horario: 'Hoje, 08:40', status: 'Concluída parcialmente', progresso: 100, processados: 48, validos: 39, credEst: 480, credRes: 480, credCons: 390, custo: 'US$ 12,10', integracoes: ['Enriquecimento de contatos'], aprovacao: 'Não exigida',
    plano: ['Identificar cargos-alvo por conta','Validar e-mails corporativos','Classificar papéis no comitê'], etapaAtual: 3,
    logs: ['08:40 Iniciada','09:02 39 de 48 contas com decisor validado'], erros: ['9 contas sem decisor público identificado'] },
  { id: 'ex-1040', titulo: 'Rascunhar e-mails T1 para Serra Azul', tipo: 'Copy', agente: 'copy', campanha: 'Cadência Importadores T1–T7', solicitante: 'Mateus Maia', horario: 'Hoje, 08:05', status: 'Aguardando aprovação', progresso: 0, processados: 0, validos: 0, credEst: 60, credRes: 0, credCons: 0, custo: '—', integracoes: ['E-mail'], aprovacao: 'Pendente · Aline Xavier',
    plano: ['Ler contexto da conta','Gerar 3 variações de e-mail','Enviar para aprovação'], etapaAtual: 0, logs: ['08:05 Plano criado, aguardando aprovação'], erros: [] },
  { id: 'ex-1039', titulo: 'Atualizar 120 negócios no CRM', tipo: 'CRM', agente: 'revops', campanha: '—', solicitante: 'Rafael Nunes', horario: 'Ontem, 18:20', status: 'Pausada', progresso: 35, processados: 42, validos: 42, credEst: 0, credRes: 0, credCons: 0, custo: '—', integracoes: ['CRM'], aprovacao: 'Aprovada por Aline Xavier',
    plano: ['Ler negócios em Proposta','Atualizar etapa e próxima tarefa'], etapaAtual: 1, logs: ['18:20 Iniciada','18:41 Pausada pelo estrategista'], erros: [] },
  { id: 'ex-1038', titulo: 'Leitura semanal de mídia paga', tipo: 'Análise', agente: 'marketing', campanha: 'Importação sem risco · Q4', solicitante: 'Camila Duarte', horario: 'Ontem, 07:00', status: 'Falhou', progresso: 20, processados: 0, validos: 0, credEst: 20, credRes: 20, credCons: 4, custo: 'US$ 0,30', integracoes: ['Mídia paga'], aprovacao: 'Não exigida',
    plano: ['Ler métricas da semana','Detectar anomalias','Sugerir realocação'], etapaAtual: 1, logs: ['07:00 Iniciada','07:01 Falha ao ler dados de mídia'], erros: ['Conexão de mídia paga expirou — reconectar na Central de Integrações'] },
  { id: 'ex-1037', titulo: 'Relatório semanal de pipeline', tipo: 'Relatório', agente: 'revops', campanha: '—', solicitante: 'Agendada', horario: 'Seg, 08:00', status: 'Concluída', progresso: 100, processados: 312, validos: 312, credEst: 0, credRes: 0, credCons: 0, custo: '—', integracoes: ['CRM', 'Planilhas'], aprovacao: 'Não exigida',
    plano: ['Consolidar funil','Calcular pipeline influenciado','Publicar relatório'], etapaAtual: 3, logs: ['08:00 Iniciada','08:03 Publicado'], erros: [] },
  { id: 'ex-1036', titulo: 'Lista de 300 indústrias do Sul', tipo: 'Lista', agente: 'comercial', campanha: 'Expansão Sul', solicitante: 'Camila Duarte', horario: 'Amanhã, 09:00', status: 'Agendada', progresso: 0, processados: 0, validos: 0, credEst: 450, credRes: 0, credCons: 0, custo: '—', integracoes: ['Dados de prospecção'], aprovacao: 'Aprovada por Aline Xavier',
    plano: ['Buscar indústrias por CNAE','Pontuar fit'], etapaAtual: 0, logs: ['Agendada para amanhã, 09:00'], erros: [] },
  { id: 'ex-1035', titulo: 'Enriquecer 80 contatos de feira', tipo: 'Enriquecimento', agente: 'comercial', campanha: 'Evento Intermodal', solicitante: 'Lucas Teixeira', horario: 'Hoje, 09:40', status: 'Na fila', progresso: 0, processados: 0, validos: 0, credEst: 160, credRes: 0, credCons: 0, custo: '—', integracoes: ['Enriquecimento de contatos'], aprovacao: 'Não exigida',
    plano: ['Validar contatos','Associar às contas'], etapaAtual: 0, logs: ['09:40 Na fila'], erros: [] }
];

const APPROVALS = [
  { id: 'ap-1', tipo: 'Copy', titulo: 'E-mails T1 — Serra Azul Têxtil', solicitante: 'Mateus Maia', agente: 'copy', motivo: 'Primeiro contato com a decisora mapeada.', impacto: '3 e-mails enviados para 1 contato', previa: 'Aline, vi que a Serra Azul abriu vaga para Gerente de Importação. Como vocês estão lidando com prazo de desembaraço hoje?', creditos: 60, prazo: 'Hoje, 14:00', historico: ['08:05 Criada pelo agente', '08:06 Enviada para Aline Xavier'] },
  { id: 'ap-2', tipo: 'Lista', titulo: 'Lista de 512 contas para cadência', solicitante: 'Camila Duarte', agente: 'comercial', motivo: 'Contas com fit acima de 70 no ICP v4.', impacto: '512 contas entram na cadência T1–T7', previa: '512 contas · 6 segmentos · Sudeste · fit médio 81', creditos: 0, prazo: 'Amanhã', historico: ['09:31 Lista gerada'] },
  { id: 'ap-3', tipo: 'Orçamento', titulo: 'Realocar R$ 8.000 para LinkedIn Ads', solicitante: 'Camila Duarte', agente: 'marketing', motivo: 'CPL no LinkedIn 38% menor que no Meta no último ciclo.', impacto: 'R$ 8.000 movidos entre canais', previa: 'Meta Ads: R$ 20.000 → R$ 12.000 · LinkedIn Ads: R$ 10.000 → R$ 18.000', creditos: 0, prazo: 'Sex, 18:00', historico: ['Ontem Recomendação do agente', 'Ontem Revisada por Camila Duarte'] },
  { id: 'ap-4', tipo: 'Alteração de CRM', titulo: 'Atualizar etapa de 78 negócios', solicitante: 'Rafael Nunes', agente: 'revops', motivo: 'Negócios sem atividade há 30 dias.', impacto: '78 negócios movidos para "Em risco"', previa: '78 negócios · R$ 2,4 mi em pipeline', creditos: 0, prazo: 'Seg', historico: ['Ontem Criada'] },
  { id: 'ap-5', tipo: 'Execução acima de limite', titulo: 'Qualificar 4.000 empresas do Nordeste', solicitante: 'Camila Duarte', agente: 'comercial', motivo: 'Expansão do ICP para nova região.', impacto: 'Reserva de 6.000 créditos', previa: 'Estimativa 6.000 créditos · saldo após reserva 1.950', creditos: 6000, prazo: 'Qua', historico: ['Hoje Plano criado pelo copiloto'] }
];

const HOME = {
  kpis: [
    ['pipeline', 'Pipeline influenciado', 'R$ 4,8 mi', '+12% no período'], ['oportunidades', 'Oportunidades abertas', '37', '+5'],
    ['contas', 'Contas qualificadas', '512', '+184'], ['leads', 'Leads prospectados', '1.946', '+620'],
    ['respostas', 'Respostas positivas', '64', '6,1% de taxa'], ['reunioes', 'Reuniões agendadas', '23', '+8'],
    ['midia', 'Investimento de mídia', 'R$ 30.000', '62% do orçamento'], ['creditos', 'Créditos disponíveis', '7.950', 'de 10.000 no ciclo']
  ],
  operacao: [['Execuções ativas', 3], ['Campanhas ativas', 4], ['Cadências ativas', 6], ['Agentes trabalhando', 3], ['Alertas e bloqueios', 2]],
  acoes: [
    { titulo: 'Ligar para Aline Xavier — Serra Azul Têxtil', resp: 'Lucas Teixeira', prazo: 'Hoje, 11:00', origem: 'Agente', prioridade: 'Alta' },
    { titulo: 'Aprovar e-mails T1 da Serra Azul', resp: 'Aline Xavier', prazo: 'Hoje, 14:00', origem: 'Agente', prioridade: 'Alta' },
    { titulo: 'Reconectar mídia paga', resp: 'Camila Duarte', prazo: 'Hoje', origem: 'Integração', prioridade: 'Alta' },
    { titulo: 'Revisar ICP para região Nordeste', resp: 'Camila Duarte', prazo: 'Qua', origem: 'Estrategista', prioridade: 'Média' },
    { titulo: 'Follow-up Douglas Quites — Alvorada', resp: 'Lucas Teixeira', prazo: 'Amanhã', origem: 'CRM', prioridade: 'Média' }
  ],
  timeline: [
    ['09:31', 'Lista enriquecida', '512 contas com fit acima de 70', 'ok'], ['09:20', 'Conta qualificada', 'Serra Azul Têxtil · fit 96', 'ok'],
    ['09:02', 'Execução concluída', 'Comitê de 48 contas · parcial', 'aviso'], ['08:48', 'Lead respondeu', 'Douglas Quites pediu proposta', 'ok'],
    ['08:10', 'Oportunidade criada', 'Grão Norte Alimentos · R$ 35.000', 'ok'], ['07:01', 'Integração com falha', 'Mídia paga · conexão expirou', 'erro'],
    ['Ontem', 'Campanha publicada', 'Importação sem risco · LinkedIn', 'ok']
  ]
};

const NOTIFICATIONS = [
  ['Aprovação pendente', 'E-mails T1 — Serra Azul Têxtil', 'há 5 min'],
  ['Integração com falha', 'Mídia paga precisa ser reconectada', 'há 2 h'],
  ['Execução concluída', 'Comitê de 48 contas · 39 válidas', 'há 1 h'],
  ['Lead respondeu', 'Douglas Quites pediu proposta', 'há 1 h'],
  ['Conta qualificada', 'Serra Azul Têxtil · fit 96', 'há 3 h'],
  ['Lista enriquecida', '512 contas com fit acima de 70', 'há 3 h'],
  ['Oportunidade criada', 'Grão Norte Alimentos · R$ 35.000', 'ontem']
];

const workspaceService = { list: () => espera(WORKSPACES, 120), get: id => espera(WORKSPACES.find(w => w.id === id) || WORKSPACES[0], 120) };
const homeService = { summary: () => espera(HOME) };
const agentService = { list: () => espera(AGENTS), get: id => espera(AGENTS.find(a => a.id === id) || null) };
const executionService = { list: () => espera(EXECUTIONS), get: id => espera(EXECUTIONS.find(e => e.id === id) || null) };
const approvalService = { list: () => espera(APPROVALS), decide: (id, decisao) => espera({ id, decisao }, 500) };
const notificationService = { list: () => espera(NOTIFICATIONS, 100) };

window.ALTHIUS_DATA = {ROLES, PERMS, NAV, FASE, WORKSPACES, AGENTS, EXECUTIONS, APPROVALS, HOME, NOTIFICATIONS, workspaceService, homeService, agentService, executionService, approvalService, notificationService};
})();
