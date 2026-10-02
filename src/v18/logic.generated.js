// GERADO por scripts/v18/convert.mjs a partir de althius-frontend-v18/fonte/component.js.html.
// Lógica original do protótipo v18. Não edite à mão: rode `npm run v18:sync`.
/* eslint-disable */
import React from 'react';
import { renderTemplate } from './template.generated';
import { precoEmReais } from '../app/precos';

const MAPA_UFS = [{"uf": "AC", "nome": "Acre", "regiao": "Norte", "cx": 40.3, "cy": 176.5}, {"uf": "AL", "nome": "Alagoas", "regiao": "Nordeste", "cx": 434.8, "cy": 183.4}, {"uf": "AM", "nome": "Amazonas", "regiao": "Norte", "cx": 126.6, "cy": 106.7}, {"uf": "AP", "nome": "Amapá", "regiao": "Norte", "cx": 257.1, "cy": 48.3}, {"uf": "BA", "nome": "Bahia", "regiao": "Nordeste", "cx": 366.7, "cy": 228.5}, {"uf": "CE", "nome": "Ceará", "regiao": "Nordeste", "cx": 403.7, "cy": 131.3}, {"uf": "ES", "nome": "Espírito Santo", "regiao": "Sudeste", "cx": 391.3, "cy": 302.5}, {"uf": "GO", "nome": "Goiás", "regiao": "Centro-Oeste", "cx": 277.3, "cy": 258.5}, {"uf": "MA", "nome": "Maranhão", "regiao": "Nordeste", "cx": 335.4, "cy": 137.3}, {"uf": "MG", "nome": "Minas Gerais", "regiao": "Sudeste", "cx": 336.4, "cy": 289.8}, {"uf": "MS", "nome": "Mato Grosso do Sul", "regiao": "Centro-Oeste", "cx": 225.5, "cy": 313.6}, {"uf": "MT", "nome": "Mato Grosso", "regiao": "Centro-Oeste", "cx": 218.4, "cy": 219.9}, {"uf": "PA", "nome": "Pará", "regiao": "Norte", "cx": 257.1, "cy": 111.7}, {"uf": "PB", "nome": "Paraíba", "regiao": "Nordeste", "cx": 434.2, "cy": 153.3}, {"uf": "PE", "nome": "Pernambuco", "regiao": "Nordeste", "cx": 420.8, "cy": 167.6}, {"uf": "PI", "nome": "Piauí", "regiao": "Nordeste", "cx": 374.6, "cy": 149.1}, {"uf": "PR", "nome": "Paraná", "regiao": "Sul", "cx": 259.4, "cy": 362.3}, {"uf": "RJ", "nome": "Rio de Janeiro", "regiao": "Sudeste", "cx": 372.3, "cy": 332.1}, {"uf": "RN", "nome": "Rio Grande do Norte", "regiao": "Nordeste", "cx": 435.2, "cy": 138.7}, {"uf": "RO", "nome": "Rondônia", "regiao": "Norte", "cx": 125.0, "cy": 197.2}, {"uf": "RR", "nome": "Roraima", "regiao": "Norte", "cx": 150.7, "cy": 45.5}, {"uf": "RS", "nome": "Rio Grande do Sul", "regiao": "Sul", "cx": 236.2, "cy": 432.3}, {"uf": "SC", "nome": "Santa Catarina", "regiao": "Sul", "cx": 280.6, "cy": 399.0}, {"uf": "SE", "nome": "Sergipe", "regiao": "Nordeste", "cx": 428.8, "cy": 194.3}, {"uf": "SP", "nome": "São Paulo", "regiao": "Sudeste", "cx": 289.7, "cy": 337.8}, {"uf": "TO", "nome": "Tocantins", "regiao": "Norte", "cx": 298.8, "cy": 179.3}, {"uf": "DF", "nome": "Distrito Federal", "regiao": "Centro-Oeste", "cx": 306.1, "cy": 256.6}];
const MAPA_VB = [-4, -2, 466, 480];
const MAPA_PROJ = {"K": 0.9659258262890683, "LON0": -74.2, "LAT0": 5.6, "S": 12.0};
const MAPA_DIST = {"SP": 171, "MG": 52, "PR": 41, "RS": 38, "RJ": 34, "SC": 33, "GO": 18, "BA": 17, "MT": 16, "PE": 12, "ES": 11, "MS": 10, "CE": 10, "DF": 9, "PA": 8, "AM": 7, "MA": 4, "PB": 3, "RN": 3, "TO": 3, "RO": 3, "AL": 2, "SE": 2, "PI": 2, "AC": 1, "AP": 1, "RR": 1};
const MAPA_GEO = {"a1": [-23.55, -46.63, 2], "a2": [-21.18, -47.81, 5], "a3": [-26.3, -48.85, 20], "a4": [-19.92, -43.94, 12], "a5": [-22.41, -47.56, 45], "a6": [-3.12, -60.02, 50], "a7": [-15.6, -56.1, 3], "a8": [-25.43, -49.27, 9]};
const C = { ok: 'var(--ok)', aviso: 'var(--warn)', erro: 'var(--err)', neutro: 'var(--neutral)' };
const ESTADO_AG = { ativo: ['Ativo', C.ok], aguardando: ['Aguardando aprovação', C.aviso], pausado: ['Pausado', C.neutro], falha: ['Com falha', C.erro] };
const exCor = s => s === 'Falhou' ? C.erro : (s === 'Em execução' || s === 'Concluída') ? C.ok : (s === 'Pausada' || s === 'Cancelada') ? C.neutro : C.aviso;
const CAPS = [['lerCrm','Ler CRM'],['escreverCrm','Escrever no CRM'],['pesquisar','Pesquisar dados'],['listas','Criar listas'],['copy','Gerar copy'],['campanhas','Analisar campanhas'],['relatorios','Criar relatórios'],['aprovacao','Solicitar aprovação']];
const TABS_AG = [['visao','Visão geral'],['conversa','Conversa'],['capacidades','Capacidades'],['playbooks','Playbook'],['conhecimento','Skills'],['sinais','Sinais'],['integracoes','Integrações'],['execucoes','Execuções'],['auditoria','Auditoria']];
const KANBAN = [['Aprovação',['Aguardando aprovação']],['Fila',['Agendada','Na fila','Reservando créditos']],['Em andamento',['Em execução','Pausada']],['Concluídas',['Concluída','Concluída parcialmente']],['Interrompidas',['Falhou','Cancelada']]];
const ETAPAS = ['Solicitação','Entendimento do objetivo','Plano sugerido','Agentes delegados','Integrações necessárias','Estimativa de créditos','Aprovação','Execução','Resultado consolidado','Próximas ações'];
const EXEMPLOS = ['Encontre empresas do setor têxtil com sinais de expansão.','Crie uma campanha para a persona Diretor(a) de Supply Chain.','Analise as campanhas do último mês.','Prepare a lista para a cadência T1–T7.','Atualize o CRM após minha aprovação.'];
const AUDIT = [['18 set, 10:42','Camila Duarte','Autonomia: Supervisionado → Assistido','v3.2'],['12 set, 16:05','Camila Duarte','Playbook Qualificação por CNPJ atualizado','v3.1'],['02 set, 09:10','Rafael Nunes','Conexão de CRM atribuída (leitura)','v3.0']];
const CANAIS = [
  { id: 'sinais-de-compra', desc: 'Contas com sinais de compra desta semana', novas: 3 },
  { id: 'prospeccao', desc: 'Listas, qualificação e enriquecimento', novas: 0 },
  { id: 'cadencia-t1-t7', desc: 'Execução da cadência de importadores', novas: 1 },
  { id: 'geral', desc: 'Avisos do time', novas: 0 }
];
const MSGS = {
  'sinais-de-compra': [
    { sigla: 'CO', autor: 'Agente Comercial', agente: true, hora: '09:12', texto: 'Encontrei 6 contas novas dentro do ICP desde ontem. A de maior fit:', card: true, reacoes: { '🎯': { n: 2, minha: false, quem: ['Mateus Maia', 'Lucas Teixeira'] }, '👀': { n: 1, minha: false, quem: ['Aline Xavier'] } } },
    { sigla: 'MM', autor: 'Mateus Maia', agente: false, hora: '09:20', texto: '@Agente Comercial mapeia quem decide importação na Serra Azul?' },
    { sigla: 'CO', autor: 'Agente Comercial', agente: true, hora: '09:21', texto: 'Decisora: Aline Xavier, Diretora de Supply Chain. Campeão provável: Jonas Ribeiro, Comprador Sênior. Fontes no dossiê.' },
    { sigla: 'CO', autor: 'Agente Comercial', agente: true, hora: '09:22', texto: 'E-mail corporativo da Aline validado. Telefone institucional no dossiê.' },
    { sigla: 'LT', autor: 'Lucas Teixeira', agente: false, hora: '09:34', texto: 'Perfeito. Sobe para a cadência T1 hoje à tarde.', reacoes: { '👍': { n: 1, minha: false, quem: ['Mateus Maia'] } } }
  ],
  'prospeccao': [
    { sigla: 'CO', autor: 'Agente Comercial', agente: true, hora: '09:31', texto: 'Lista do Sudeste pronta: 512 contas com fit acima de 70. Aguardando aprovação para entrar na cadência.' }
  ],
  'cadencia-t1-t7': [
    { sigla: 'CP', autor: 'Agente de Copy', agente: true, hora: '08:05', texto: 'Rascunhei 3 e-mails T1 para a Serra Azul. Enviei para aprovação da Aline.' },
    { sigla: 'LT', autor: 'Lucas Teixeira', agente: false, hora: '08:48', texto: 'Douglas Quites respondeu pedindo proposta. Vou ligar amanhã cedo.' }
  ],
  'geral': [
    { sigla: 'CD', autor: 'Camila Duarte', agente: false, hora: 'Ontem', texto: 'Semana de foco em importadores do Sudeste. Qualquer dúvida sobre o ICP, me chamem aqui.', vistos: 5, reacoes: { '👍': { n: 3, minha: false, quem: ['Lucas Teixeira', 'Mateus Maia', 'Bruna Lima'] }, '🚀': { n: 1, minha: false, quem: ['Lucas Teixeira'] } } }
  ]
};
const btn = (label, fn, prim) => ({ label, fn, bg: prim ? 'var(--ink)' : 'var(--paper)', cor: prim ? 'var(--paper)' : 'var(--ink)', borda: prim ? 'var(--ink)' : 'var(--steel)' });
const parar = f => e => { if (e && e.stopPropagation) e.stopPropagation(); f(); };

export class AlthiusLogic extends React.Component {
  state = { pronto: false, rota: { ws: 'evolut', page: 'home', id: null }, carregandoRota: true, vw: 1280, role: null, periodo: 'Este mês',
    paleta: false, paletaQ: '', paletaIdx: 0, notif: false, avatar: false, drawer: false, saiu: false,
    agTab: 'todos', agBusca: '', agFuncao: 'Todas', agAutonomia: 'Todas', agDetTab: 'visao', caps: {}, chats: {}, msgTexto: '',
    exView: 'lista', exFiltro: 'Todas', apFiltro: 'Todos', apSel: null, decisoes: {}, ajusteAberto: false, ajusteTexto: '', ajusteErro: false,
    grupos: {}, canalMsgs: {}, canalTexto: '', cfgSecao: 'Minha conta', ops: { notif: true, som: false, compacto: false, aprovacao: true }, cop: false, copTexto: '', copEtapa: 0, copPct: 0, copPedido: '', confirm: null, aviso: null };

  componentDidMount() {
    new Promise((ok, falha) => { let n = 0; const t = () => { if (window.ALTHIUS_DATA && window.ALTHIUS_MOD) ok(window.ALTHIUS_DATA); else if (++n > 150) import(new URL('revenue-os/data.js', document.baseURI).href).then(ok, falha); else setTimeout(t, 20); }; t(); }).then(D => {
      this.D = D;
      return Promise.all([D.homeService.summary(), D.agentService.list(), D.executionService.list(), D.approvalService.list(), D.notificationService.list()]);
    }).then(([home, agents, execs, aprov, notifs]) => this.setState({ home, agents, execs, aprov, notifs, pronto: true, carregandoRota: false }))
      .catch(() => this.setState({ falhaCarga: true, pronto: true }));
    this._hash = () => this.lerRota(); window.addEventListener('hashchange', this._hash); this.lerRota();
    this._rs = () => { if (typeof this.state.copW === 'number' && this.state.copW > window.innerWidth) this.setState({ copW: 'cheia' }); this.forceUpdate(); };
    window.addEventListener('resize', this._rs); this._rs();
    if (window.ResizeObserver) { this._ro = new ResizeObserver(this._rs); this._ro.observe(document.documentElement); if (this._root) this._ro.observe(this._root); }
    this._key = e => this.tecla(e); window.addEventListener('keydown', this._key);
    this.aplicarTema(this.temaInicial());
    try { const dz = localStorage.getItem('althius-densidade'); if (dz) this.setState({ densidade: dz }); const ft = localStorage.getItem('althius-foto'); if (ft) this.setState({ minhaFoto: ft }); } catch (e) {}
    try { const w = localStorage.getItem('althius-cop-w'); if (w) this.setState({ copW: w === 'cheia' ? 'cheia' : +w }); const h = localStorage.getItem('althius-cop-hist'); if (h) this.setState({ copHist: JSON.parse(h) }); } catch (e) {}
    try { if (localStorage.getItem('althius-nav') === 'min') this.setState({ navMin: true }); } catch (e) {}
    if (window.matchMedia) { this._mq = window.matchMedia('(prefers-color-scheme: dark)'); this._mqf = () => this.forceUpdate(); this._mq.addEventListener && this._mq.addEventListener('change', this._mqf); }
    this._progEl = { current: null }; this._feedEl = { current: null };
    const pct = el => { if (!el) return 0; const max = el.scrollHeight - el.clientHeight; return max > 0 ? el.scrollTop / max : 0; };
    this._molaMain = this.molaProgresso(this._progEl, () => pct(this._main));
    this._molaFeed = this.molaProgresso(this._feedEl, () => pct(this._feedVp));
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this._hash); window.removeEventListener('resize', this._rs); window.removeEventListener('keydown', this._key);
    clearTimeout(this._tr); clearTimeout(this._tc); if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._mqf); if (this._main && this._onMainScroll) this._main.removeEventListener('scroll', this._onMainScroll); clearTimeout(this._ta); clearTimeout(this._td);
    if (this._ro) this._ro.disconnect();
  }
  lerRota() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) { location.hash = '#/app/evolut/home'; return; }
    const p = h.split('/');
    const rota = p[0] === 'admin' ? { ws: this.state.rota.ws, page: 'admin/' + (p[1] || 'workspaces'), id: null } : { ws: p[1] || 'evolut', page: p[2] || 'home', id: p[3] || null };
    const mudouPagina = rota.page !== this.state.rota.page || rota.id !== this.state.rota.id;
    this.setState({ rota, carregandoRota: true, drawer: false, conta: rota.page === 'accounts' ? this.state.conta : null, pipeCard: null, confirm: null, ixCon: null, notif: false, avatar: false, aviso: null, ajusteAberto: false, ajusteErro: false, agDetTab: mudouPagina && rota.page === 'agents' && rota.id ? (this._proxTab || 'visao') : this.state.agDetTab });
    this._proxTab = null;
    if (this._main) this._main.scrollTop = 0; if (this._molaMain) this._molaMain();
    clearTimeout(this._tr); this._tr = setTimeout(() => this.setState({ carregandoRota: false }), 320);
  }
  ir(path) { location.hash = '#/' + path; }
  wsPermitidos() { const D = this.D; if (!D) return []; const p = this.papel(); if (p === 'superadmin') return D.WORKSPACES;
    const em = D.ROLES[p].email; const l = D.WORKSPACES.filter(w => this.membros(w.id).some(m => m.email === em && !m.pendente)); return l.length ? l : D.WORKSPACES.slice(0, 1); }
  wsId() { const ok = this.wsPermitidos().map(w => w.id); return ok.indexOf(this.state.rota.ws) >= 0 ? this.state.rota.ws : (ok[0] || 'evolut'); }
  wsLogo(w) { const up = (this.state.wsMarca || {})[w.id]; if (up) return { tem: true, src: up, erro: () => {}, load: () => {} }; const l = this.logoDe('ws:' + w.id, w.nome, 'x'); return { tem: l.xTem, src: l.xLogo, erro: l.xErro, load: l.xLoad }; }
  papel() { return this.state.role || this.props.papel || 'estrategista'; }
  can(k) { return !!this.D && this.D.PERMS[this.papel()].indexOf(k) >= 0; }
  avisar(ctx, texto) { clearTimeout(this._ta); this.setState({ aviso: { ctx, texto } }); this._ta = setTimeout(() => this.setState({ aviso: null }), 4200); }
  confirmar(titulo, texto, rotulo, acao) { this.setState({ confirm: { titulo, texto, rotulo, acao } }); }
  abrirCop(texto) { this.setState({ cop: true, notif: false, avatar: false, paleta: false, copTexto: texto || '', copEtapa: 0, copPct: 0 }); }
  copAvancar() {
    const e = this.state.copEtapa;
    const limite = this.can('approvals.decide') || this.can('agents.configure') ? 7 : 7;
    if (e < limite) { this._tc = setTimeout(() => { this.setState({ copEtapa: e + 1 }); this.copAvancar(); }, 650); }
  }
  copExecutar() {
    this.setState({ copEtapa: 8, copPct: 0 });
    const passo = () => {
      const p = this.state.copPct + 20;
      if (p >= 100) { this.setState({ copPct: 100, copEtapa: 9 }); this._tc = setTimeout(() => this.setState({ copEtapa: 10 }), 700); }
      else { this.setState({ copPct: p }); this._tc = setTimeout(passo, 380); }
    };
    this._tc = setTimeout(passo, 380);
  }
  tecla(e) {
    const k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); this.setState({ paleta: !this.state.paleta, paletaQ: '', paletaIdx: 0 }); setTimeout(() => this._pal && this._pal.focus(), 30); return; }
    if ((e.metaKey || e.ctrlKey) && k === 'b') { e.preventDefault(); this.alternarNav(); return; }
    if (k === 'escape') { this.setState({ ixCon: null, pipeCard: null, pipeNome: null, canalModal: null, tarefa: null, oauth: null, conta: null, picker: null,  paleta: false, notif: false, avatar: false, cop: false, drawer: false, confirm: null }); return; }
    if (this.state.paleta && this._lista) {
      if (k === 'arrowdown') { e.preventDefault(); this.setState({ paletaIdx: Math.min(this.state.paletaIdx + 1, this._lista.length - 1) }); }
      if (k === 'arrowup') { e.preventDefault(); this.setState({ paletaIdx: Math.max(this.state.paletaIdx - 1, 0) }); }
      if (k === 'enter') { e.preventDefault(); const it = this._lista[this.state.paletaIdx]; if (it) it.run(); }
    }
  }
  chatDe(a) {
    if (this.state.chats[a.id]) return this.state.chats[a.id];
    const POR = {
      marketing: [{ tipo: 'user', texto: 'Como está o custo por lead em cada canal?', hora: '09:02', status: 'Lida' }, { tipo: 'agente', hora: '09:02', texto: 'LinkedIn Ads está em R$ 118 por lead e Meta Ads em R$ 190. Para diretores de Supply Chain, LinkedIn rende mais. Sugiro mover R$ 3.000 de Meta para LinkedIn até o fim do mês.' }, { tipo: 'plano', passos: ['Reduzir o orçamento de Meta Ads em R$ 3.000', 'Aumentar o orçamento de LinkedIn Ads em R$ 3.000', 'Avisar o time no #geral'], estado: 'pendente' }],
      copy: [{ tipo: 'user', texto: 'Escreve o e-mail do passo 2 para a Aline, da Serra Azul?', hora: '09:02', status: 'Lida' }, { tipo: 'agente', hora: '09:02', texto: 'Rascunho pronto. Abro pela vaga de Gerente de Importação e pergunto como eles lidam hoje com prazo de desembaraço. 74 palavras, sem anexo.' }, { tipo: 'plano', passos: ['Salvar o texto no passo 2 da cadência da Aline', 'Deixar o envio automático para o dia 3'], estado: 'pendente' }],
      revops: [{ tipo: 'user', texto: 'Quais negócios estão travados?', hora: '09:02', status: 'Lida' }, { tipo: 'agente', hora: '09:02', texto: 'Norte Log Transportes passou da data de fechamento (28 set) e Meridian Saúde está marcado em risco na Negociação. Os dois juntos somam R$ 467 mil.' }, { tipo: 'plano', passos: ['Criar tarefa para Bruna Lima sobre Norte Log', 'Criar tarefa para Mateus Maia sobre Meridian Saúde', 'Atualizar a previsão no CRM'], estado: 'pendente' }]
    };
    if (POR[a.id]) return POR[a.id];
    return [
      { tipo: 'user', texto: 'Quais contas devo priorizar hoje?', hora: '09:02', status: 'Lida' },
      { tipo: 'agente', hora: '09:02', texto: 'Três contas tiveram sinal novo desde ontem. Serra Azul Têxtil lidera com fit 96 e vaga aberta para Gerente de Importação.' },
      { tipo: 'deleg', texto: 'Delegou para Agente de Copy · rascunhar a abordagem da Serra Azul' },
      { tipo: 'plano', passos: ['Criar a empresa Serra Azul Têxtil no CRM', 'Associar Aline Xavier como decisora', 'Criar tarefa de ligação para Lucas Teixeira'], estado: 'pendente' }
    ];
  }

  // Tema: sistema | claro | escuro (preferência guardada só neste navegador)
  temaInicial() { try { return localStorage.getItem('althius-tema') || 'sistema'; } catch (e) { return 'sistema'; } }
  aplicarTema(t) {
    const el = document.documentElement;
    el.classList.add('tema-mudando'); clearTimeout(this._tm); this._tm = setTimeout(() => el.classList.remove('tema-mudando'), 260);
    if (t === 'claro') el.setAttribute('data-theme', 'light'); else if (t === 'escuro') el.setAttribute('data-theme', 'dark'); else el.removeAttribute('data-theme');
    try { localStorage.setItem('althius-tema', t); } catch (e) {}
    this.setState({ tema: t });
  }
  escuroAgora() { const t = this.state.tema || 'sistema'; return t === 'escuro' || (t === 'sistema' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)); }
  // Barra de progresso ligada ao scroll, com mola (stiffness 200, damping 30, mass 0.5 — como no scroll-area-04)
  molaProgresso(el, alvoFn) {
    const s = { x: 0, v: 0, raf: 0, t: 0 };
    const tick = now => {
      const dt = Math.min(0.032, ((now - (s.t || now)) / 1000) || 0.016); s.t = now;
      const alvo = alvoFn(); const f = -200 * (s.x - alvo) - 30 * s.v; s.v += (f / 0.5) * dt; s.x += s.v * dt;
      if (el.current) el.current.style.transform = 'scaleX(' + Math.max(0, Math.min(1, s.x)).toFixed(4) + ')';
      if (Math.abs(s.x - alvo) > 0.0005 || Math.abs(s.v) > 0.0005) s.raf = requestAnimationFrame(tick); else { s.raf = 0; s.t = 0; }
    };
    return () => { if (!s.raf) s.raf = requestAnimationFrame(tick); };
  }
  alternarNav() {
    const v = !this.state.navMin; this.setState({ navMin: v });
    try { localStorage.setItem('althius-nav', v ? 'min' : 'max'); } catch (e) {}
    clearTimeout(this._nv); this._nv = setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
  }
  // ---------- Contas: chamas, fotos, comitê e cadência
  chamas(n) { n = Math.max(1, Math.min(3, n || 1)); return Array.from({ length: n }, () => ({ g: 'url(#fogo-' + n + ')' })); }
  fogoRotulo(n) { return ['', 'Aquecendo', 'Quente', 'Muito quente'][n] || ''; }
  fotoUsuario(nome) { const k = (window.ALTHIUS_USUARIOS_FOTO || {})[nome]; return k ? (window.ALTHIUS_FOTOS || {})[k] : ''; }
  abrirConta(id, tab) { this.setState({ conta: id, contaTab: tab || 'comite', cadPessoa: null, cadSalvo: false }); }
  diaDe(passos, i) { let d = 1; for (let j = 1; j <= i; j++) d += passos[j].espera; return d; }
  cadPadrao(conta, p) {
    const nome = p.nome.split(' ')[0], emp = conta.nome;
    return { emails: (p.emails || []).slice(0, 3), fones: (p.fones || []).slice(0, 3), ig: p.instagram || '', passos: [
      { id: 's1', canal: 'email', espera: 0, alvo: 0, assunto: emp + ' · previsibilidade na importação', texto: 'Oi ' + nome + ', vi que a ' + emp + ' está com um movimento novo (' + (conta.sinal || 'sinal recente').toLowerCase() + '). Como vocês estão lidando com prazo e custo de desembaraço hoje?' },
      { id: 's2', canal: 'linkedin', espera: 1, liTipo: 'nota', texto: 'Oi ' + nome + ', acompanho o setor de ' + (conta.segmento || '').toLowerCase() + ' e queria trocar uma ideia sobre importação. Posso te adicionar?' },
      { id: 's3', canal: 'whatsapp', espera: 1, alvo: 0, texto: 'Oi ' + nome + ', aqui é da Althius. Te mandei um e-mail sobre a ' + emp + '. Faz sentido conversarmos 15 min esta semana?' },
      { id: 's4', canal: 'ligacao', espera: 1, alvo: 0, texto: 'Abertura: me apresentar e citar o sinal da ' + emp + '.\nPergunta: como funciona a importação hoje e onde mais trava?\nPróximo passo: agendar 30 min com o time de compras.' },
      { id: 's5', canal: 'email', espera: 3, alvo: 0, assunto: 'Re: ' + emp + ' · previsibilidade na importação', texto: nome + ', deixo um caso parecido com o de vocês. Se fizer sentido, te mostro em 20 min.' }
    ] };
  }
  hora() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  // Resposta em streaming (padrão ReUI c-message-7): pensando → digitando → pronta.
  streamar(agId, idx) {
    const set = fn => this.setState({ chats: Object.assign({}, this.state.chats, { [agId]: (this.state.chats[agId] || []).map((m, i) => i === idx ? fn(m) : m) }) });
    const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(this._st);
    const passo = () => {
      const m = (this.state.chats[agId] || [])[idx]; if (!m || m.stream == null) return;
      const n = Math.min(m.stream + 4, m.texto.length);
      if (n >= m.texto.length) { set(x => Object.assign({}, x, { stream: null })); this.setState({ chats: Object.assign({}, this.state.chats, { [agId]: this.state.chats[agId].map(x => x.tipo === 'user' ? Object.assign({}, x, { status: 'Lida' }) : x) }) }); return; }
      set(x => Object.assign({}, x, { stream: n })); this._st = setTimeout(passo, 24);
    };
    if (reduz) { this._st = setTimeout(() => set(x => Object.assign({}, x, { stream: null })), 300); return; }
    this._st = setTimeout(passo, 900);
  }

  CANAL_LABEL = { email: 'E-mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', ligacao: 'Ligação', instagram: 'Instagram' };
  CON_PADRAO = { hubspot: { conta: 'camila@althius.com.br', agentes: ['comercial', 'revops'] }, gmail: { conta: 'camila@althius.com.br', agentes: ['copy'] }, gads: { conta: 'Evolut · 482-115-9930', agentes: ['marketing'] }, meta: { conta: 'Evolut Ads', agentes: ['marketing'], erro: true }, apollo: { conta: 'camila@althius.com.br', agentes: ['comercial'] }, gsheets: { conta: 'camila@althius.com.br', agentes: ['revops'] }, slack: { conta: 'evolut.slack.com', agentes: ['comercial', 'marketing', 'copy', 'revops'] } };
  conexoes() { return this.state.conexoes || this.CON_PADRAO; }
  abrirOauth(id) { const ag = (this.state.agents || []).map(a => a.id); this.setState({ oauth: { id, passo: 'inicio', agentes: (this.conexoes()[id] || {}).agentes || ag.slice(0, 2) } }); }
  COP_HIST_PADRAO = [
    { id: 'h1', titulo: 'Lista do Sudeste para a cadência T1–T7', pedido: 'Prepare a lista para a cadência T1–T7.', grupo: 'Hoje', quando: '09:10', etapa: 10 },
    { id: 'h2', titulo: 'Campanha para Diretor(a) de Supply Chain', pedido: 'Crie uma campanha para a persona Diretor(a) de Supply Chain.', grupo: 'Ontem', quando: 'ontem, 17:42', etapa: 7 },
    { id: 'h3', titulo: 'Análise das campanhas de setembro', pedido: 'Analise as campanhas do último mês.', grupo: 'Últimos 7 dias', quando: 'seg, 11:05', etapa: 10 },
    { id: 'h4', titulo: 'Têxteis com sinais de expansão', pedido: 'Encontre empresas do setor têxtil com sinais de expansão.', grupo: 'Anteriores', quando: '12 set', etapa: 10 }
  ];
  copHist() { return this.state.copHist || this.COP_HIST_PADRAO; }
  salvarHist(lista) { this.setState({ copHist: lista }); try { localStorage.setItem('althius-cop-hist', JSON.stringify(lista)); } catch (e) {} }
  copGuardarAtual() { const id = this.state.copSessao; if (!id) return; this.salvarHist(this.copHist().map(h => h.id === id ? Object.assign({}, h, { etapa: this.state.copEtapa }) : h)); }
  copLarguraMax() { return Math.max(360, window.innerWidth); }
  copDefinirLargura(w, salvar) { const max = this.copLarguraMax(); const v = Math.round(Math.max(360, Math.min(max, w))); this.setState({ copW: v >= max - 24 ? 'cheia' : v });
    if (salvar) try { localStorage.setItem('althius-cop-w', String(v >= max - 24 ? 'cheia' : v)); } catch (e) {} }
  copArrastar(e) {
    if (e.button !== undefined && e.button !== 0) return; e.preventDefault();
    const el = e.currentTarget; try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (x) {}
    document.body.classList.add('cop-redim'); this.setState({ copArrastando: true });
    let raf = 0, ultimo = window.innerWidth - e.clientX;
    const mover = ev => { ultimo = window.innerWidth - ev.clientX; if (!raf) raf = requestAnimationFrame(() => { raf = 0; this.copDefinirLargura(ultimo, false); }); };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('pointercancel', soltar);
      document.body.classList.remove('cop-redim'); this.copDefinirLargura(ultimo, true); this.setState({ copArrastando: false }); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar); window.addEventListener('pointercancel', soltar);
  }
  MEMBROS_PADRAO = {
    evolut: [
      { id: 'u1', nome: 'Aline Xavier', email: 'aline@evolut.com.br', papel: 'cliente', dono: true, origem: 'Evolut' },
      { id: 'u2', nome: 'Mateus Maia', email: 'mateus@evolut.com.br', papel: 'cliente', origem: 'Evolut' },
      { id: 'u3', nome: 'Lucas Teixeira', email: 'lucas@evolut.com.br', papel: 'bdr', origem: 'Evolut' },
      { id: 'u4', nome: 'Bruna Lima', email: 'bruna@evolut.com.br', papel: 'bdr', origem: 'Evolut' },
      { id: 'u5', nome: 'Camila Duarte', email: 'camila@althius.com.br', papel: 'estrategista', origem: 'Althius' },
      { id: 'u6', nome: 'Rafael Nunes', email: 'rafael@althius.com.br', papel: 'superadmin', origem: 'Althius' },
      { id: 'u7', nome: 'Paula Gomes', email: 'paula.gomes@evolut.com.br', papel: 'bdr', origem: 'Evolut', pendente: true, quando: 'ontem' }
    ],
    grao: [
      { id: 'g1', nome: 'Eduardo Lins', email: 'eduardo@graonorte.com.br', papel: 'cliente', dono: true, origem: 'Grão Norte' },
      { id: 'g2', nome: 'Camila Duarte', email: 'camila@althius.com.br', papel: 'estrategista', origem: 'Althius' },
      { id: 'g3', nome: 'Rafael Nunes', email: 'rafael@althius.com.br', papel: 'superadmin', origem: 'Althius' }
    ],
    vertice: [
      { id: 'v1', nome: 'Patrícia Moura', email: 'patricia@verticeindustria.com.br', papel: 'cliente', dono: true, origem: 'Vértice' },
      { id: 'v2', nome: 'Rafael Nunes', email: 'rafael@althius.com.br', papel: 'superadmin', origem: 'Althius' }
    ]
  };
  PAPEL_INFO = {
    superadmin: { nome: 'Superadmin', cor: '#131313', desc: 'Time Althius. Acessa todos os workspaces, cria workspaces, vê custos e fornecedores.', quem: 'Definido pela Althius' },
    estrategista: { nome: 'Estrategista', cor: '#F7054F', desc: 'Time Althius. Opera os workspaces atribuídos: ICP, playbooks, sinais, cadências e aprovações de operação.', quem: 'Definido pelo superadmin' },
    cliente: { nome: 'C-level', cor: '#2E7D5B', desc: 'Diretoria do cliente (CEO, CRO, CMO). Decide gasto, compra créditos, aprova ações e convida o próprio time.', quem: 'Definido pelo estrategista' },
    bdr: { nome: 'BDR/SDR', cor: '#C79A1F', desc: 'Executa cadências, tarefas e a caixa de entrada das contas em que é responsável.', quem: 'Definido pelo C-level ou estrategista' }
  };
  membros(ws) { return (this.state.membros || {})[ws] || this.MEMBROS_PADRAO[ws] || []; }
  salvarMembros(ws, lista) { this.setState({ membros: Object.assign({}, this.state.membros, { [ws]: lista }) }); }
  avisarCfg(t) { clearTimeout(this._cfgA); this.setState({ cfgAviso: t }); this._cfgA = setTimeout(() => this.setState({ cfgAviso: null }), 3600); }
  sinalAtivo(s) { const o = (this.state.sinaisOn || {})[s.id]; return o === undefined ? s.ativo : o; }
  sinaisDe(ag) { return (window.ALTHIUS_SINAIS || []).concat(this.state.sinaisCustom || []).filter(s => s.agente === ag); }
  skillsDe(ag) { const base = ((window.ALTHIUS_SKILLS || {})[ag] || []).concat(((this.state.skillsNovas || {})[ag]) || []); const on = (this.state.skillsOn || {})[ag] || {}; return base.map(s => Object.assign({}, s, { ativo: on[s.id] === undefined ? s.ativo : on[s.id] })); }
  canais() { if (this.state.canais) return this.state.canais;
    const todos = this.membros('evolut').filter(m => !m.pendente).map(m => m.nome);
    return [
      { id: 'sinais-de-compra', desc: 'Contas com sinais de compra desta semana', novas: 3, pessoas: ['Camila Duarte', 'Lucas Teixeira', 'Mateus Maia', 'Bruna Lima'], agentes: ['comercial'] },
      { id: 'prospeccao', desc: 'Listas, qualificação e enriquecimento', novas: 0, pessoas: ['Camila Duarte', 'Lucas Teixeira', 'Bruna Lima'], agentes: ['comercial', 'copy'] },
      { id: 'cadencia-t1-t7', desc: 'Execução da cadência de importadores', novas: 1, pessoas: ['Camila Duarte', 'Lucas Teixeira', 'Mateus Maia'], agentes: ['copy'] },
      { id: 'geral', desc: 'Avisos do time', novas: 0, geral: true, pessoas: todos, agentes: ['revops'] }
    ]; }
  slug(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40); }
  liDe(p) { const o = (this.state.li || {})[p.id] || {}; return { url: o.url !== undefined ? o.url : (p.liUrl || ''), status: o.status || p.liStatus || 'nao' }; }
  pipeBase() {
    const D = (cid, conta, dono, cidade, fecha, valor, etapa, status, prob) => ({ id: 'n' + Math.random().toString(36).slice(2, 8), cid, conta, dono, cidade, fecha, valor, etapa, status, prob });
    return { motion: 'slg', ativo: { slg: 'q-slg-1', mlg: 'q-mlg-1', plg: 'q-plg-1' }, quadros: {
      slg: [
        { id: 'q-slg-1', nome: 'Outbound · Importadores', ordem: null, deals: [
          D('a7', 'Grão Norte Alimentos', 'Lucas Teixeira', 'Cuiabá, MT', '2026-10-30', 35000, 'proposta', 'ok', 55),
          D('a1', 'Serra Azul Têxtil', 'Lucas Teixeira', 'São Paulo, SP', '2026-11-14', 25000, 'descoberta', 'ok', 35),
          D('a4', 'Delta Saúde', 'Bruna Lima', 'Belo Horizonte, MG', '2026-11-20', 52000, 'descoberta', 'risco', 30),
          D('a2', 'Campo Belo Agro', 'Lucas Teixeira', 'Ribeirão Preto, SP', '2026-12-05', 60000, 'qualificacao', 'ok', 20),
          D('a8', 'Vértice Indústria', 'Bruna Lima', 'Curitiba, PR', '2026-12-12', 30000, 'qualificacao', 'ok', 20),
          D('a3', 'Metalúrgica Ipê', 'Bruna Lima', 'Joinville, SC', '2026-12-19', 18000, 'entrada', 'ok', 10),
          D('a6', 'Norte Log Transportes', 'Bruna Lima', 'Manaus, AM', '2026-09-28', 22000, 'negociacao', 'atraso', 70)
        ] },
        { id: 'q-slg-2', nome: 'Enterprise', ordem: null, deals: [
          D(null, 'Meridian Saúde', 'Mateus Maia', 'Porto Alegre, RS', '2026-10-24', 445000, 'negociacao', 'risco', 65),
          D(null, 'Alvorada & Associados', 'Lucas Teixeira', 'Campinas, SP', '2026-11-07', 45000, 'proposta', 'ok', 50),
          D(null, 'Aurora Farma', 'Mateus Maia', 'Goiânia, GO', '2026-09-18', 14256, 'ganho', 'ok', 100)
        ] }
      ],
      mlg: [
        { id: 'q-mlg-1', nome: 'Inbound · Conteúdo', ordem: null, deals: [
          D('a5', 'Rio Claro Cosméticos', 'Lucas Teixeira', 'Rio Claro, SP', '2026-11-28', 16000, 'qualificacao', 'ok', 20),
          D(null, 'Lumen Óptica', 'Bruna Lima', 'Recife, PE', '2026-12-10', 12000, 'entrada', 'ok', 10)
        ] },
        { id: 'q-mlg-2', nome: 'Evento Intermodal', ordem: null, deals: [] }
      ],
      plg: [ { id: 'q-plg-1', nome: 'Teste grátis → plano pago', ordem: null, deals: [] } ]
    } };
  }
  pipe() { return this.state.pipe || this._pipe0 || (this._pipe0 = this.pipeBase()); }
  mudarPipe(fn) { const p = JSON.parse(JSON.stringify(this.pipe())); fn(p); this.setState({ pipe: p }); }
  inboxCon() { return this.state.inboxCon || { email: { conta: 'camila@althius.com.br', via: 'gmail' }, linkedin: { conta: 'Camila Duarte · perfil pessoal' }, whatsapp: null, instagram: null }; }
  falarCom(agId, texto) { this._proxTab = 'conversa'; this.setState({ msgTexto: texto || '' }); this.ir('app/' + this.state.rota.ws + '/agents/' + agId); }
  extrato() { return this.state.extrato || [
    { id: 'x1', data: '2026-09-01', tipo: 'entrada', desc: 'Créditos iniciais do workspace', quem: 'Althius · franquia mensal', cr: 10000 },
    { id: 'x2', data: '2026-09-05', tipo: 'saida', desc: 'Mapeamento de comitê · 8 contas', quem: 'Agente Comercial', ag: 'comercial', cr: 200 },
    { id: 'x3', data: '2026-09-08', tipo: 'saida', desc: 'Enriquecimento · 64 contatos', quem: 'Agente Comercial', ag: 'comercial', cr: 640 },
    { id: 'x4', data: '2026-09-12', tipo: 'saida', desc: 'E-mails automáticos · 48 envios', quem: 'Agente de Copy', ag: 'copy', cr: 192 },
    { id: 'x5', data: '2026-09-15', tipo: 'saida', desc: 'Sinais monitorados · setembro', quem: 'Agente Comercial', ag: 'comercial', cr: 700 },
    { id: 'x6', data: '2026-09-22', tipo: 'saida', desc: 'Leitura semanal de mídia', quem: 'Agente de Marketing', ag: 'marketing', cr: 120 },
    { id: 'x7', data: '2026-09-26', tipo: 'saida', desc: 'Rascunhos e respostas · 59', quem: 'Agente de Copy', ag: 'copy', cr: 118 },
    { id: 'x8', data: '2026-09-29', tipo: 'saida', desc: 'Relatórios e higiene do CRM', quem: 'Agente de RevOps', ag: 'revops', cr: 80 }
  ]; }
  saldo() { return this.extrato().reduce((s, e) => s + (e.tipo === 'entrada' ? e.cr : -e.cr), 0); }
  gastar(cr, desc, ag) { const a = (this.state.agents || []).find(x => x.id === ag); const hoje = new Date().toISOString().slice(0, 10);
    this.setState({ extrato: this.extrato().concat([{ id: 'x' + Date.now(), data: hoje, tipo: 'saida', desc, quem: a ? a.nome : 'Copiloto', ag, cr }]) }); }
  credCfg() { return Object.assign({ modo: 'auto', teto: 500, limite: 5000, recarga: false }, this.state.credCfg || {}); }
  dominio(u) { return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0]; }
  siteDe(id) { return id ? ((this.state.sites || {})[id] || '') : ''; }
  logoDe(id, nome, px) { const d = this.dominio(this.siteDe(id)), f = (this.state.logoFalha || {})[d] || 0;
    const FONTES = d ? ['https://' + d + '/apple-touch-icon.png', 'https://www.google.com/s2/favicons?domain=' + d + '&sz=128'] : [];
    const src = FONTES[f] || '', falhou = () => { const lf = this.state.logoFalha || {}; if ((lf[d] || 0) === f) this.setState({ logoFalha: Object.assign({}, lf, { [d]: f + 1 }) }); };
    const sig = String(nome || '').replace(/&/g, ' ').split(/\s+/).filter(x => x.length > 1 || /[A-Z]/.test(x)).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    return { [px + 'Tem']: !!src, [px + 'Logo']: src, [px + 'Sigla']: sig, [px + 'Erro']: falhou, [px + 'Load']: e => { if ((e.currentTarget.naturalWidth || 0) <= 16) falhou(); } }; }
  renderVals() {
    const D = this.D, st = this.state;
    const vw = (this._root && this._root.clientWidth) || window.innerWidth || st.vw, modo = vw >= 1024 ? 'full' : vw >= 768 ? 'compact' : 'mobile';
    const mobile = modo === 'mobile', full = modo === 'full';
    const navMin = !mobile && !!st.navMin;
    const navFull = (full && !navMin) || (mobile && st.drawer);
    const lay = {
      full, mobile, notMobile: !mobile, navFull, navCompact: !navFull,
      navDisplay: mobile && !st.drawer ? 'none' : 'flex', navPos: mobile ? 'fixed' : 'relative',
      sideW: navMin ? '0px' : navFull ? '240px' : '72px', navBorda: navMin ? '0 solid transparent' : '1px solid var(--rule)', navVis: navMin ? 'hidden' : 'visible', navVisDelay: navMin ? '0.24s' : '0s', navOculta: navMin ? 'true' : 'false', navJust: navFull ? 'flex-start' : 'center',
      homeCols: full ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr)', agCols: vw >= 1180 ? 'minmax(0, 1fr) 300px' : 'minmax(0, 1fr)',
      chatCols: mobile ? 'minmax(0, 1fr)' : '220px minmax(0, 1fr)', apCols: vw >= 900 ? '360px minmax(0, 1fr)' : 'minmax(0, 1fr)',
      exCols: vw >= 900 ? 'minmax(0, 1fr) 190px 180px 150px' : 'minmax(0, 1fr)', copW: mobile ? '100vw' : '440px'
    };
    const base = {
      lay, vSaiu: st.saiu, vApp: !st.saiu, entrar: () => this.setState({ saiu: false }),
      navEstado: navMin ? 'min' : 'max', navExpandido: navMin ? 'false' : 'true', navRotulo: navMin ? 'Expandir menu' : 'Recolher menu',
      navSeta: navMin ? 'M13.5 10l2 2-2 2' : 'M16 10l-2 2 2 2', atalhoNav: /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘B' : 'Ctrl B',
      alternarNav: () => this.alternarNav(),
      drawerAberto: mobile && st.drawer, abrirDrawer: () => this.setState({ drawer: true }), fecharDrawer: () => this.setState({ drawer: false }),
      refMain: el => { if (el === this._main) return; if (this._main && this._onMainScroll) this._main.removeEventListener('scroll', this._onMainScroll); this._main = el; this._onMainScroll = () => this._molaMain && this._molaMain(); if (el) el.addEventListener('scroll', this._onMainScroll, { passive: true }); },
      refProg: el => { if (this._progEl) this._progEl.current = el; }, refFeedProg: el => { if (this._feedEl) this._feedEl.current = el; },
      feedScroll: e => { this._feedVp = e.currentTarget; this._molaFeed && this._molaFeed(); }, refRoot: el => { if (el && el !== this._root) { this._root = el; if (this._ro) this._ro.observe(el); } }, atalho: /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K'
    };
    if (!D || !st.pronto) return Object.assign(base, { vCarregando: true, paginaLabel: '', navTopo: [], navGrupos: [], canaisNav: [], agentesNav: [], wsMeta: '', tituloPagina: '', subtituloPagina: '', podeConfig: false, hrefConfig: '#', nav: [], railWs: [], crumbs: [], ws: { nome: '', momento: '', sigla: '', id: '' }, railWs: [], ws2: { lista: [], papeis: [], membros: [], papeisConvite: [], matriz: { papeis: [], grupos: [] } }, usuario: { sigla: '', usuario: '', label: '', email: '' }, papeis: [], notifs: [], temas: [], workspaces: [], sigCat: { grupos: [] }, pp: { motions: [], quadros: [], colunas: [] }, cp: { canais: [], conAgente: [] }, cr: { pacotes: [], modos: [], filtros: [], extrato: [], porAgente: [], custos: [] }, rl: { motions: [], etapas: [], funil: [], cadencias: [], canais: [], creditos: [] }, ix: { canais: [] }, ixm: { provedores: [] }, pd: { etapas: [], situacoes: [], donos: [] }, mapa: { f: {}, s: {}, x: {}, l: {}, c: {}, periodos: [], bolhas: [], pins: [], regioes: [], ranking: [], uf: { contas: [] } } });

    const papel = this.papel(), can = k => this.can(k), U = D.ROLES[papel];
    const wsId = this.wsId(), ws = D.WORKSPACES.find(w => w.id === wsId) || D.WORKSPACES[0];
    const demo = this.props.estadoDemo || 'normal';
    const vazio = demo === 'vazio';
    const r = st.rota, page = r.page, chave = page.indexOf('admin/') === 0 ? 'admin' : page;
    const permitido = chave === 'channels' || can(chave);
    const ir = p => () => this.ir(p);
    const appPath = p => 'app/' + wsId + '/' + p;
    const pendentes = st.aprov.filter(a => !st.decisoes[a.id]);
    const verForn = can('providers.view');
    const labelDe = id => { if (id === 'channels') return 'Canais'; for (const s of D.NAV) for (const it of s.itens) if (it[0] === id) return it[1]; return id; };

    const nav = D.NAV.filter(s => !s.perm || can(s.perm)).map(s => ({ secao: s.secao, itens: s.itens.filter(([id]) => can(id.indexOf('admin/') === 0 ? 'admin' : id)).map(([id, label, sigla]) => {
      const atual = page === id; const badge = id === 'approvals' ? pendentes.length : 0;
      return { label, sigla, href: '#/' + (id.indexOf('admin/') === 0 ? id : appPath(id)), atual: atual ? 'page' : 'false', bg: atual ? 'var(--paper)' : 'transparent', cor: 'var(--ink)', barra: atual ? '#F7054F' : 'transparent', temBadge: badge > 0, badge };
    }) })).filter(s => s.itens.length);

    const agentesVis = st.agents.filter(a => papel !== 'bdr' || a.bdr);
    const agNome = id => (st.agents.find(a => a.id === id) || {}).nome || id;
    const integ = a => a.integracoes.map(i => verForn ? i.fornecedor : i.cap).filter((v, i, arr) => arr.indexOf(v) === i);

    const crumbs = [{ label: ws.nome, href: '#/' + appPath('home') }, { label: labelDe(page), href: '#/' + (chave === 'admin' ? page : appPath(page)) }];
    if (r.id && page === 'agents') crumbs.push({ label: agNome(r.id), href: '#/' + appPath('agents/' + r.id) });
    if (r.id && page === 'executions') crumbs.push({ label: r.id, href: '#/' + appPath('executions/' + r.id) });
    const crumbsV = crumbs.map((c, i) => ({ label: c.label, href: c.href, temSep: i > 0, cor: i === crumbs.length - 1 ? 'var(--ink)' : 'var(--graphite)' }));

    const telas = { home: 1, agents: 1, executions: 1, approvals: 1, settings: 1 };
    const estaCarregando = st.carregandoRota || demo === 'carregando';
    const conteudoOk = permitido && !estaCarregando && demo !== 'erro' && !st.falhaCarga;
    const MOD = window.ALTHIUS_MOD || {};
    const vista = conteudoOk ? (MOD[page] ? 'modulo' : page === 'channels' ? 'canal' : page === 'agents' && r.id ? 'agente' : page === 'executions' && r.id ? 'execucao' : telas[page] ? page : 'fase') : null;

    const v = Object.assign(base, {
      ws, usuario: U, workspaces: this.wsPermitidos(), podeTrocarWs: this.wsPermitidos().length > 1, ...(() => { const L = this.wsLogo(ws); return { wsTemImg: L.tem, wsImg: L.src, wsImgErro: L.erro, wsImgLoad: L.load }; })(), periodo: st.periodo,
      mudarPeriodo: e => this.setState({ periodo: e.target.value }),
      mudarWs: e => this.ir('app/' + e.target.value + '/' + (page.indexOf('admin/') === 0 ? 'home' : page)),
      railWs: this.wsPermitidos().map(w => ({ ...(() => { const L = this.wsLogo(w); return { temImg: L.tem, semImg: !L.tem, img: L.src, imgErro: L.erro, imgLoad: L.load }; })(), nome: w.nome, sigla: w.sigla, href: '#/app/' + w.id + '/home', bg: w.id === ws.id ? '#F4F4F4' : 'transparent', cor: w.id === ws.id ? '#131313' : '#F4F4F4', borda: w.id === ws.id ? '#F4F4F4' : '#353535' })),
      nav, crumbs: crumbsV, paginaLabel: labelDe(page), hrefHome: '#/' + appPath('home'), hrefAprov: '#/' + appPath('approvals'),
      podeCopiloto: can('copilot'), abrirCopiloto: () => this.abrirCop(''),
      notifAberto: st.notif, alternarNotif: () => this.setState({ notif: !st.notif, avatar: false }),
      notifs: (papel === 'bdr' ? st.notifs.filter(n => n[0] !== 'Integração com falha' && n[0] !== 'Aprovação pendente') : st.notifs).map((n, i) => {
        const tipo = /aprova/i.test(n[0]) ? 'aprov' : /falha/i.test(n[0]) ? 'alerta' : /conclu/i.test(n[0]) ? 'ok' : /respond/i.test(n[0]) ? 'msg' : /qualific/i.test(n[0]) ? 'alvo' : /lista/i.test(n[0]) ? 'lista' : 'alta';
        const cor = { aprov: 'var(--signal)', alerta: 'var(--err)', ok: 'var(--ok)', msg: 'var(--ink)', alvo: 'var(--warn)', lista: 'var(--graphite)', alta: 'var(--ok)' }[tipo];
        const naoLida = !st.notifLidas && i < 3;
        const o = { i, titulo: n[0], texto: n[1], quando: n[2], cor, tinta: 'color-mix(in srgb, ' + cor + ' 14%, transparent)', ponto: naoLida ? 'var(--signal)' : 'transparent' };
        ['aprov', 'alerta', 'ok', 'msg', 'alvo', 'lista', 'alta'].forEach(k => { o['i_' + k] = k === tipo; });
        return o;
      }),
      temNaoLidas: !st.notifLidas, notifResumo: st.notifLidas ? 'Tudo lido' : '3 não lidas', marcarLidas: () => this.setState({ notifLidas: true }),
      temaEscuro: this.escuroAgora(), temaClaro: !this.escuroAgora(), temaRotulo: this.escuroAgora() ? 'Usar tema claro' : 'Usar tema escuro',
      alternarTema: () => this.aplicarTema(this.escuroAgora() ? 'claro' : 'escuro'),
      temas: [['sistema', 'Sistema'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([id, label]) => ({ label, ativo: (st.tema || 'sistema') === id ? 'true' : 'false', escolher: () => this.aplicarTema(id) })),
      avatarAberto: st.avatar, alternarAvatar: () => this.setState({ avatar: !st.avatar, notif: false }),
      papeis: Object.keys(D.ROLES).map(k => ({ label: D.ROLES[k].label, ativo: k === papel ? 'true' : 'false', bg: k === papel ? 'var(--mist)' : 'transparent', ponto: k === papel ? 'var(--ink)' : 'transparent', escolher: () => { this.setState({ role: k, avatar: false, agTab: 'todos', apSel: null }); } })),
      sair: () => this.setState({ saiu: true, avatar: false }),
      bannerOffline: demo === 'offline', bannerDesatualizado: demo === 'desatualizado',
      recarregar: () => { this.setState({ carregandoRota: true }); clearTimeout(this._tr); this._tr = setTimeout(() => this.setState({ carregandoRota: false }), 500); },
      vCarregando: permitido && estaCarregando && !st.falhaCarga, vErro: permitido && !estaCarregando && (demo === 'erro' || !!st.falhaCarga), vNegado: !permitido,
      vFase: vista === 'fase', faseNum: (D.FASE[chave] || 3),
      fasesPlano: [3, 4, 5].map(n => { const mods = Object.keys(D.FASE).filter(k => D.FASE[k] === n).map(labelDe); const minha = n === (D.FASE[chave] || 3);
        return { label: 'Fase ' + n + (minha ? ' · este módulo' : ''), titulo: mods.slice(0, 3).join(', ') + (mods.length > 3 ? ' e mais ' + (mods.length - 3) : ''), det: mods.length + ' módulos', st: minha ? 'now' : 'todo' }; }),
      vHome: vista === 'home', vAgentes: vista === 'agents', vAgente: vista === 'agente', vExecucoes: vista === 'executions', vExecucao: vista === 'execucao', vAprovacoes: vista === 'approvals',
      avisoTexto: st.aviso ? st.aviso.texto : '', avisoAgentes: !!st.aviso && st.aviso.ctx === 'agentes', avisoAgente: !!st.aviso && st.aviso.ctx === 'agente', avisoExec: !!st.aviso && st.aviso.ctx === 'exec'
    });

    // LAYOUT DESKTOP
    const itemNav = n => ({ label: n.label, sigla: n.sigla, href: n.href, atual: n.atual, badge: n.badge, temBadge: n.temBadge, bg: n.atual === 'page' ? 'var(--ink)' : 'transparent', cor: n.atual === 'page' ? 'var(--mist)' : 'var(--ink)' });
    const [topo, ...resto] = nav;
    v.navTopo = topo && topo.secao === 'Visão geral' ? topo.itens.map(itemNav) : [];
    const gruposNav = topo && topo.secao === 'Visão geral' ? resto : nav;
    v.navGrupos = gruposNav.map(s => {
      const contem = s.itens.some(n => n.atual === 'page');
      const aberto = st.grupos[s.secao] !== undefined ? st.grupos[s.secao] : contem;
      return { secao: s.secao, aberto: aberto ? 'true' : 'false', rot: aberto ? '90deg' : '0deg', mostra: aberto || !lay.navFull, temBadge: !aberto && s.itens.some(n => n.temBadge),
        itens: s.itens.map(itemNav), alternar: () => this.setState({ grupos: Object.assign({}, this.state.grupos, { [s.secao]: !aberto }) }) };
    });
    v.wsMeta = this.membros(ws.id).filter(m => !m.pendente).length + ' membros · ' + agentesVis.length + ' agentes';
    v.canaisNav = this.canais().map(c => { const on = page === 'channels' && r.id === c.id; return { nome: c.id, novas: c.novas, temNovas: c.novas > 0 && !on, atual: on ? 'page' : 'false', href: '#/' + appPath('channels/' + c.id), bg: on ? 'var(--ink)' : 'transparent', cor: on ? 'var(--mist)' : 'var(--ink)', hash: on ? 'var(--mist)' : 'var(--graphite)' }; });
    v.agentesNav = agentesVis.slice(0, 4).map(x => { const on = page === 'agents' && r.id === x.id; return { nome: x.nome, sigla: x.sigla, status: ESTADO_AG[x.estado][1], href: '#/' + appPath('agents/' + x.id), bg: on ? 'var(--ink)' : 'transparent', cor: on ? 'var(--mist)' : 'var(--ink)' }; });
    v.podeConfig = can('settings'); v.hrefConfig = '#/' + appPath('settings');
    const subs = { home: ws.momento + ' · ' + st.periodo, agents: 'Seu time de agentes', executions: 'Trabalho assíncrono da plataforma', approvals: pendentes.length + ' pendentes', settings: 'Preferências da conta e do workspace' };
    const canal = this.canais().find(c => c.id === r.id) || this.canais()[0];
    const agT = page === 'agents' && r.id ? st.agents.find(x => x.id === r.id) : null;
    const exT = page === 'executions' && r.id ? st.execs.find(x => x.id === r.id) : null;
    const MODT = (window.ALTHIUS_MOD || {})[page];
    v.tituloPagina = MODT ? MODT.titulo : page === 'channels' ? '# ' + canal.id : agT ? agT.nome : exT ? exT.titulo : labelDe(page);
    v.subtituloPagina = MODT ? MODT.sub : page === 'channels' ? canal.desc : agT ? agT.funcao + ' · ' + agT.autonomia : exT ? exT.status + ' · ' + exT.id : (subs[page] || ws.nome);
    v.vCanal = vista === 'canal'; v.vConfig = vista === 'settings';
    // MÓDULOS
    v.vModulo = vista === 'modulo';
    v.md = { kpis: [], funil: [], filtros: [], cabecalho: [], linhas: [], colunasK: [], det: { campos: [], acoes: [] } };
    if (v.vModulo) {
      const M = MOD[page], ov = (st.modOv || {})[page] || {}, ms = (st.modSt || {})[page] || {};
      const setMs = o => this.setState({ modSt: Object.assign({}, this.state.modSt, { [page]: Object.assign({}, ms, o) }) });
      const cols = M.colunas.filter(c => !c[3] || can(c[3]));
      const IXK = { 'E-mail': 'email', 'LinkedIn': 'linkedin', 'WhatsApp': 'whatsapp', 'Instagram': 'instagram' }, ixOn = this.inboxCon();
      const rows0 = (vazio ? [] : (((st.modExtra || {})[page]) || []).concat(M.linhas)).map(l => Object.assign({}, l, ov[l.id] || {})).filter(l => !l.removido && (page !== 'inbox' || !IXK[l.canal] || !!ixOn[IXK[l.canal]]));
      const dotCor = s => /falh|atras|erro|inativ|degrad|instáv/i.test(s) ? C.erro : /pausad|rascunho|aguard|revis|pendent|convite|hipót|teste|na fila|agend|adiar|neutra|morna|parcial/i.test(s) ? C.aviso : /ativ|conect|conclu|operac|ganho|aplicad|positiva|quente/i.test(s) ? C.ok : null;
      const q = (ms.busca || '').trim().toLowerCase();
      const fv = ms.filtro || 'Todos';
      const ufF = page === 'accounts' ? ms.uf : null; let rows = rows0.filter(l => !ufF || String(l.cidade || '').slice(-2) === ufF).filter(l => !q || cols.some(c => String(l[c[0]] == null ? '' : l[c[0]]).toLowerCase().indexOf(q) >= 0)).filter(l => !M.filtro || fv === 'Todos' || l[M.filtro] === fv);
      if (ms.ord) { const [k, dir] = ms.ord; rows = rows.slice().sort((a, b) => { const x = a[k], y = b[k]; const nx = parseFloat(String(x).replace(/[^0-9,-]/g, '').replace(',', '.')), ny = parseFloat(String(y).replace(/[^0-9,-]/g, '').replace(',', '.')); const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), 'pt-BR'); return dir * r; }); }
      const abrir = l => () => { if (page === 'accounts') { this.abrirConta(l.id, 'comite'); return; } setMs({ aberto: l.id }); };
      const tecla = l => ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(l)(); } };
      const md = v.md;
      md.titulo = M.titulo;
      md.temPorConta = page === 'cadences' && !vazio;
      md.porConta = md.temPorConta ? (MOD.accounts.linhas || []).filter(c => (window.ALTHIUS_COMITES || {})[c.id] && window.ALTHIUS_COMITES[c.id].length).map(c => {
        const pessoas = window.ALTHIUS_COMITES[c.id], cads = (st.cad || {})[c.id] || {};
        const p0 = cads[pessoas[0].id] ? cads[pessoas[0].id].passos : this.cadPadrao(c, pessoas[0]).passos;
        const prox = p0[1] || p0[0];
        const o = { nome: c.nome, chamas: this.chamas(+c.temperatura), chamasRotulo: this.fogoRotulo(+c.temperatura), fotos: pessoas.slice(0, 3).map(p => ({ src: (window.ALTHIUS_FOTOS || {})[p.foto], nome: p.nome })),
          resumo: pessoas.length + (pessoas.length > 1 ? ' pessoas' : ' pessoa') + ' · ' + p0.length + ' passos', proximo: 'Próximo: dia ' + this.diaDe(p0, p0.indexOf(prox)) + ' · ' + this.CANAL_LABEL[prox.canal] + ' com ' + pessoas[0].nome.split(' ')[0],
          abrir: () => this.abrirConta(c.id, 'cadencia') };
        ['email', 'linkedin', 'whatsapp', 'ligacao', 'instagram'].forEach(k => { o['c_' + k] = prox.canal === k; });
        return o; }) : [];
      md.temKpis = !!(M.kpis && M.kpis.length); md.kpis = (M.kpis || []).map(k => ({ label: k[0], valor: vazio ? '—' : k[1], delta: vazio ? '' : k[2] }));
      const maxF = M.funil ? Math.max.apply(null, M.funil.map(f => f[1])) : 1;
      md.temFunil = !!M.funil && !vazio; md.funil = (M.funil || []).map(f => ({ label: f[0], n: f[1].toLocaleString('pt-BR'), pct: Math.max(2, Math.round(f[1] / maxF * 100)) + '%' }));
      md.temBusca = !!M.busca; md.busca = ms.busca || ''; md.mudarBusca = ev => setMs({ busca: ev.target.value });
      md.filtros = M.filtro ? ['Todos'].concat(rows0.map(l => l[M.filtro]).filter((x, i2, a) => a.indexOf(x) === i2).sort((x, y) => M.filtro === 'temperatura' ? y - x : 0)).map(f => { const at = fv === f; const ff = M.filtro === 'temperatura' && /^[123]$/.test(String(f)); return { temFogo: ff, semFogo: !ff, chamas: ff ? this.chamas(+f) : [], label: ff ? this.fogoRotulo(+f) : f, n: f === 'Todos' ? rows0.length : rows0.filter(l => l[M.filtro] === f).length, ativo: at ? 'true' : 'false', bg: at ? 'var(--ink)' : 'var(--paper)', cor: at ? 'var(--paper)' : 'var(--ink)', borda: at ? 'var(--ink)' : 'var(--rule)', ir: () => setMs({ filtro: f }) }; }) : [];
      const podeAgir = papel !== 'bdr' || ['tasks', 'inbox', 'accounts', 'prospecting', 'cadences', 'pipeline'].indexOf(page) >= 0;
      md.temAcao = !!M.acao && podeAgir; md.acaoLabel = M.acao ? M.acao.label : '';
      md.acao = () => { if (page === 'tasks') { this.setState({ tarefa: { canal: 'Ligação', status: 'Pendente', resp: U.usuario, data: new Date().toISOString().slice(0, 10), hora: '10:00' } }); return; } if (!M.acao) return; if (M.acao.copiloto && can('copilot')) this.abrirCop(M.acao.copiloto); else this.avisar('mod', M.acao.toast || 'Pedido registrado.'); };
      md.limpar = () => setMs({ busca: '', filtro: 'Todos', uf: null });
      md.temUf = page === 'accounts' && !!ms.uf; md.ufNome = ms.uf ? ((MAPA_UFS.find(u => u.uf === ms.uf) || {}).nome || ms.uf) : ''; md.limparUf = () => setMs({ uf: null });
      md.vazio = rows.length === 0;
      md.tabela = M.layout !== 'kanban' && !md.vazio; md.kanban = M.layout === 'kanban' && !md.vazio; if (page === 'pipeline' || page === 'credits') { md.tabela = false; md.kanban = false; md.vazio = false; }
      md.cols = cols.map(c => 'minmax(0, ' + c[2] + ')').join(' ').replace(/minmax\(0, (\d+px)\)/g, '$1');
      md.colsLinha = lay.mobile ? 'minmax(0, 1fr)' : md.cols;
      md.cabecalho = cols.map(c => ({ label: c[1], seta: ms.ord && ms.ord[0] === c[0] ? (ms.ord[1] > 0 ? '↑' : '↓') : '', ordenar: () => setMs({ ord: ms.ord && ms.ord[0] === c[0] ? [c[0], -ms.ord[1]] : [c[0], 1] }) }));
      md.linhas = rows.map(l => ({ abrir: abrir(l), tecla: tecla(l), bg: ms.aberto === l.id ? 'var(--mist)' : 'transparent',
        celulas: cols.map((c, ci) => { const val = l[c[0]] == null ? '—' : String(l[c[0]]); const fogo = c[0] === 'temperatura' && /^[123]$/.test(val); const foto = c[0] === 'dono' ? this.fotoUsuario(val) : ''; const p = !fogo && /status|temperatura|intencao/.test(c[0]) ? dotCor(val) : null; const co = page === 'accounts' && c[0] === 'nome'; return Object.assign(co ? this.logoDe(l.id, val, 'co') : {}, { temCo: co }, { temFogo: fogo, chamas: fogo ? this.chamas(+val) : [], fogoRotulo: fogo ? this.fogoRotulo(+val) : '', temTexto: !fogo, temFoto: !!foto, foto, v: val, temPonto: !!p, ponto: p || 'transparent', fs: ci === 0 ? '15px' : '14px', cor: ci === 0 ? 'var(--ink)' : 'var(--text-2)', ws: ci === 0 ? 'normal' : 'nowrap' }); }) }));
      if (M.layout === 'kanban') {
        const soma = it => it.reduce((s, l) => s + (parseFloat(String(l.valor).replace(/[^0-9,]/g, '').replace(',', '.')) || 0), 0);
        md.colunasK = M.grupos.map(g => { const it = rows.filter(l => l[M.grupo] === g); return { titulo: g, total: it.length ? 'R$ ' + Math.round(soma(it)).toLocaleString('pt-BR') : '0', itens: it.map(l => ({ titulo: l.nome, valor: l.valor, dono: l.dono, abrir: abrir(l), tecla: tecla(l) })) }; });
      }
      const sel = rows0.find(l => l.id === ms.aberto);
      md.detalheAberto = !!sel; md.fechar = () => setMs({ aberto: null });
      md.temAvisoMod = !!st.aviso && st.aviso.ctx === 'mod';
      if (sel) {
        const rot = { desc: 'Descrição', cidade: 'Cidade', decisor: 'Decisor', roteiro: 'Roteiro sugerido', conta: 'Conta' };
        const campos = cols.map(c => ({ label: c[1], v: sel[c[0]] == null ? '—' : String(sel[c[0]]) }));
        Object.keys(rot).forEach(k => { if (sel[k] != null && !cols.some(c => c[0] === k)) campos.push({ label: rot[k], v: String(sel[k]) }); });
        const aplicar = patch => this.setState({ modOv: Object.assign({}, this.state.modOv, { [page]: Object.assign({}, ov, { [sel.id]: Object.assign({}, ov[sel.id] || {}, patch) }) }) });
        const acoes = (podeAgir ? (M.acoesLinha || []) : []).map((a, ai) => ({ label: a[0], bg: ai === 0 ? 'var(--ink)' : 'var(--paper)', cor: a[3] ? 'var(--err)' : ai === 0 ? 'var(--paper)' : 'var(--ink)', borda: a[3] ? 'var(--err)' : 'var(--ink)',
          fn: () => { const run = () => { if (a[2] === 'avancar' && M.grupos) { const ix = M.grupos.indexOf(sel[M.grupo]); aplicar({ [M.grupo]: M.grupos[Math.min(ix + 1, M.grupos.length - 1)] }); } else if (a[2] && typeof a[2] === 'object') aplicar(a[2]); setMs({ aberto: null }); this.avisar('mod', a[1]); };
            if (a[3]) this.confirmar(a[0] + '?', a[4] ? a[4].replace('{x}', sel.de || sel.nome || sel.titulo || '') : 'Esta ação afeta "' + (sel.nome || sel.titulo || sel.de || sel.id) + '". Pode ser revertida por um administrador.', a[0], run); else run(); } }));
        md.det = { titulo: sel.nome || sel.titulo || sel.conta || sel.cap || sel.de || sel.servico || sel.agente || sel.ws || sel.acao, campos, acoes, temAcoes: acoes.length > 0 };
      }
    }

    // PIPELINE
    v.pp = { ativo: page === 'pipeline' && vista === 'modulo', motions: [], quadros: [], colunas: [] };
    v.pd = { aberto: false, etapas: [], situacoes: [], donos: [] };
    { const ETAPAS = ['entrada', 'qualificacao', 'descoberta', 'proposta', 'negociacao', 'ganho'];
      const ROT = { slg: ['Prospecção', 'Qualificação', 'Reunião', 'Proposta', 'Negociação', 'Ganho'], mlg: ['Lead captado', 'MQL', 'SQL', 'Proposta', 'Negociação', 'Ganho'], plg: ['Cadastro', 'Ativado', 'PQL', 'Conversa comercial', 'Upgrade', 'Ganho'] };
      const PROB = { entrada: 10, qualificacao: 20, descoberta: 35, proposta: 55, negociacao: 75, ganho: 100 };
      const DESC = { slg: 'Sales-led: o time vai atrás da conta.', mlg: 'Marketing-led: o lead chega por campanha, conteúdo ou evento.', plg: 'Product-led: o cliente usa antes e a conversa nasce do uso.' };
      const SIT = { ok: ['No prazo', C.ok], risco: ['Em risco', C.aviso], atraso: ['Atrasado', C.erro] };
      const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const fData = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return +d + ' ' + MESES[+m - 1]; };
      const brl = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
      const curto = n => n >= 1e6 ? 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : n >= 1e3 ? 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil' : brl(n);
      const P = this.pipe(), mot = P.motion, qs = P.quadros[mot], q = qs.find(x => x.id === P.ativo[mot]) || qs[0];
      const rot = k => ROT[mot][ETAPAS.indexOf(k)];
      const ordem = q.ordem || ETAPAS;
      const sigla = n => n.split(' ').map(x => x[0]).slice(0, 2).join('');
      const abrirNovo = etapa => this.setState({ pipeCard: { novo: true, conta: '', valor: '', fecha: '', prob: PROB[etapa], etapa, status: 'ok', dono: U.usuario } });
      const dg = st.pipeDrag || null, alvo = st.pipeAlvo || null;
      const setAlvo = a => { const o = this.state.pipeAlvo || {}; if (o.col !== a.col || o.antes !== a.antes || o.tipo !== a.tipo) this.setState({ pipeAlvo: a }); };
      const fimDrag = () => { this._drag = null; this.setState({ pipeDrag: null, pipeAlvo: null }); };
      const moverCard = (id, col, antes) => { let msg = '';
        this.mudarPipe(p => { const b = p.quadros[p.motion].find(x => x.id === q.id), i = b.deals.findIndex(d => d.id === id); if (i < 0) return; const d = b.deals.splice(i, 1)[0];
          if (d.etapa !== col) { d.prob = PROB[col]; msg = d.conta + ' foi para ' + rot(col) + '. O Agente de RevOps atualiza o CRM.'; if (col === 'ganho') { d.status = 'ok'; msg = d.conta + ' ganho: ' + brl(d.valor) + '. O Agente de RevOps registrou no CRM.'; } }
          d.etapa = col; const j = antes ? b.deals.findIndex(x => x.id === antes) : -1; if (j >= 0) b.deals.splice(j, 0, d); else b.deals.push(d); });
        fimDrag(); if (msg) { this.avisar('mod', msg); if (col === 'ganho') this.setState({ notifs: [['Negócio ganho', msg, 'agora']].concat(this.state.notifs || []), notifLidas: false }); } };
      const moverEtapa = (k, antes) => { if (k === antes || k === 'ganho') { fimDrag(); return; } this.mudarPipe(p => { const b = p.quadros[p.motion].find(x => x.id === q.id); const o = (b.ordem || ETAPAS).filter(x => x !== k); let j = o.indexOf(antes); if (j < 0 || antes === 'ganho') j = o.indexOf('ganho'); o.splice(j, 0, k); b.ordem = o; }); fimDrag(); };
      if (v.pp.ativo) {
        const abertos = q.deals.filter(d => d.etapa !== 'ganho'), soma = l => l.reduce((s, d) => s + d.valor, 0);
        const pond = abertos.reduce((s, d) => s + d.valor * d.prob / 100, 0), ganhos = q.deals.filter(d => d.etapa === 'ganho');
        v.md.kpis = [{ label: 'Em aberto', valor: curto(soma(abertos)), delta: abertos.length + (abertos.length === 1 ? ' negócio' : ' negócios') }, { label: 'Previsão ponderada', valor: curto(pond), delta: 'valor × chance de ganho' }, { label: 'Ganhos no quadro', valor: curto(soma(ganhos)), delta: ganhos.length + (ganhos.length === 1 ? ' negócio' : ' negócios') }, { label: 'Em risco ou atrasados', valor: String(abertos.filter(d => d.status !== 'ok').length), delta: 'pedem ação do responsável' }];
        v.pp = { ativo: true, quadroNome: q.nome, motionDesc: DESC[mot], resumo: q.deals.length + (q.deals.length === 1 ? ' negócio' : ' negócios') + ' · ' + curto(soma(q.deals)),
          nota: 'As 6 etapas são fixas para todo o workspace e mudam só de nome por motion. É isso que deixa SLG, MLG e PLG comparáveis em Relatórios. Arraste o card para mudar de etapa e a alça da coluna para reordenar.',
          motions: ['slg', 'mlg', 'plg'].map(m => ({ label: m.toUpperCase(), desc: DESC[m], n: P.quadros[m].length, ativo: m === mot ? 'true' : 'false', ir: () => this.mudarPipe(p => { p.motion = m; }) })),
          quadros: qs.map(x => ({ nome: x.nome, n: x.deals.length, ativo: x.id === q.id ? 'true' : 'false', ir: () => { this.mudarPipe(p => { p.ativo[mot] = x.id; }); this.setState({ pipeNome: null }); } })),
          podeNovo: qs.length < 5 && can('pipeline.boards'), naoGere: !can('pipeline.boards'), limite: qs.length + ' de 5 quadros',
          novoQuadro: () => { const id = 'q-' + mot + '-' + Date.now(); const nome = 'Novo quadro ' + (qs.length + 1); this.mudarPipe(p => { p.quadros[mot].push({ id, nome, ordem: null, deals: [] }); p.ativo[mot] = id; }); this.setState({ pipeNome: nome }); },
          renomeando: st.pipeNome != null, naoRenomeando: st.pipeNome == null, nomeRascunho: st.pipeNome || '',
          renomear: () => this.setState({ pipeNome: q.nome }), mudarNome: e => this.setState({ pipeNome: e.target.value }),
          salvarNome: () => { const n = (this.state.pipeNome || '').trim() || q.nome; this.mudarPipe(p => { p.quadros[mot].find(x => x.id === q.id).nome = n; }); this.setState({ pipeNome: null }); },
          teclaNome: e => { if (e.key === 'Enter') v.pp.salvarNome(); if (e.key === 'Escape') this.setState({ pipeNome: null }); },
          podeExcluir: qs.length > 1,
          excluir: () => this.confirmar('Excluir o quadro "' + q.nome + '"?', q.deals.length ? 'Os ' + q.deals.length + ' negócios dele vão para o quadro "' + qs.find(x => x.id !== q.id).nome + '".' : 'O quadro está vazio.', 'Excluir quadro', () => { this.mudarPipe(p => { const l = p.quadros[mot], i = l.findIndex(x => x.id === q.id), [b] = l.splice(i, 1); l[0].deals = l[0].deals.concat(b.deals); p.ativo[mot] = l[0].id; }); this.setState({ pipeNome: null }); }),
          colunas: ordem.map(k => { const it = q.deals.filter(d => d.etapa === k);
            return { key: k, titulo: rot(k), n: it.length, total: curto(soma(it)), vazia: it.length === 0, fixa: k === 'ganho' || !can('pipeline.boards'), movivel: k !== 'ganho' && can('pipeline.boards'),
              alvo: alvo && alvo.col === k && (alvo.tipo === 'etapa' || !alvo.antes) ? 'true' : 'false', arrastando: dg && dg.tipo === 'etapa' && dg.id === k ? 'true' : 'false',
              adicionar: () => abrirNovo(k),
              dragStart: e => { e.stopPropagation(); try { e.dataTransfer.setData('text/plain', 'etapa:' + k); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} this._drag = { tipo: 'etapa', id: k }; setTimeout(() => this.setState({ pipeDrag: { tipo: 'etapa', id: k } }), 0); },
              dragEnd: fimDrag,
              over: e => { if (!this._drag) return; e.preventDefault(); setAlvo({ tipo: this._drag.tipo, col: k, antes: null }); },
              leave: () => {},
              drop: e => { e.preventDefault(); const d = this._drag; if (!d) return; if (d.tipo === 'card') moverCard(d.id, k, null); else moverEtapa(d.id, k); },
              itens: it.map(d => { const s = d.etapa === 'ganho' ? ['Ganho', C.ok] : SIT[d.status]; const f = this.fotoUsuario(d.dono); const meu = can('pipeline.deals') || d.dono === U.usuario, bloq = () => this.avisar('mod', 'Só ' + d.dono + ' ou um gestor mexe neste negócio.');
                return { ...this.logoDe(d.cid, d.conta, 'co'), conta: d.conta, motion: mot.toUpperCase(), dono: d.dono, sigla: sigla(d.dono), foto: f, temFoto: !!f, prob: d.prob + '%', cor: s[1], status: s[0], cidade: d.cidade, fecha: fData(d.fecha), valor: brl(d.valor),
                  rotulo: d.conta + ', ' + brl(d.valor) + ', ' + rot(d.etapa) + ', ' + s[0] + '. Enter para editar.',
                  antes: alvo && alvo.tipo === 'card' && alvo.antes === d.id ? 'true' : 'false', arrastando: dg && dg.tipo === 'card' && dg.id === d.id ? 'true' : 'false',
                  dragStart: e => { if (!meu) { e.preventDefault(); bloq(); return; } try { e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} this._drag = { tipo: 'card', id: d.id }; setTimeout(() => this.setState({ pipeDrag: { tipo: 'card', id: d.id } }), 0); },
                  dragEnd: fimDrag,
                  over: e => { if (!this._drag || this._drag.tipo !== 'card') return; e.preventDefault(); e.stopPropagation(); setAlvo({ tipo: 'card', col: k, antes: d.id }); },
                  drop: e => { if (!this._drag || this._drag.tipo !== 'card') return; e.preventDefault(); e.stopPropagation(); if (this._drag.id !== d.id) moverCard(this._drag.id, k, d.id); else fimDrag(); },
                  abrir: () => { if (!meu) { bloq(); return; } this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); },
                  tecla: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); } } }; }) }; }) };
        v.md.acao = () => abrirNovo(ordem[0]);
      }
      if (st.pipeCard && v.pp.ativo) { const c = st.pipeCard, setC = o => this.setState({ pipeCard: Object.assign({}, this.state.pipeCard, o) }), contas = MOD.accounts ? MOD.accounts.linhas : [];
        const cidSel = c.cid || (contas.find(x => x.nome === c.conta) || {}).id || '';
        v.pd = { aberto: true, titulo: c.novo ? 'Novo negócio · ' + q.nome : c.conta, editando: !c.novo, temConta: !!cidSel, salvarLabel: c.novo ? 'Criar negócio' : 'Salvar',
          conta: c.novo ? (c.cid || '') : cidSel, valor: c.valor, fecha: c.fecha, prob: c.prob, temErro: !!c.erro, erro: c.erro || '',
          mudarConta: e => { const a = contas.find(x => x.id === e.target.value); setC({ cid: e.target.value || null, conta: a ? a.nome : c.conta, cidade: a ? a.cidade : c.cidade, dono: a && c.novo ? a.dono : c.dono, erro: '' }); },
          mudarValor: e => setC({ valor: e.target.value.replace(/[^0-9]/g, ''), erro: '' }), mudarFecha: e => setC({ fecha: e.target.value }), mudarProb: e => setC({ prob: +e.target.value }),
          etapas: ordem.map(k => ({ label: rot(k), ativo: c.etapa === k ? 'true' : 'false', escolher: () => setC({ etapa: k, prob: PROB[k] }) })),
          situacoes: Object.keys(SIT).map(k => ({ label: SIT[k][0], ativo: c.status === k ? 'true' : 'false', escolher: () => setC({ status: k }) })),
          donos: this.membros(ws.id).filter(m => !m.pendente && m.papel !== 'superadmin' && (can('pipeline.deals') || m.nome === U.usuario)).map(m => { const f = this.fotoUsuario(m.nome); return { nome: m.nome.split(' ')[0], sigla: sigla(m.nome), foto: f, temFoto: !!f, ativo: c.dono === m.nome ? 'true' : 'false', escolher: () => setC({ dono: m.nome }) }; }),
          fechar: () => this.setState({ pipeCard: null }),
          verConta: () => { this.setState({ pipeCard: null }); location.hash = '#/' + appPath('accounts'); setTimeout(() => this.abrirConta(cidSel, 'comite'), 60); },
          remover: () => this.confirmar('Remover ' + c.conta + ' do quadro?', 'O negócio sai do pipeline. O histórico continua na conta.', 'Remover', () => { this.mudarPipe(p => { const b = p.quadros[p.motion].find(x => x.id === q.id); b.deals = b.deals.filter(d => d.id !== c.id); }); this.setState({ pipeCard: null }); this.avisar('mod', c.conta + ' saiu do quadro.'); }),
          salvar: () => { const x = this.state.pipeCard; if (!x.conta) { setC({ erro: 'Escolha a conta.' }); return; } if (!x.valor || +x.valor <= 0) { setC({ erro: 'Informe o valor do negócio.' }); return; }
            const d = { cid: x.cid || null, conta: x.conta, dono: x.dono, cidade: x.cidade || '—', fecha: x.fecha || '', valor: +x.valor, etapa: x.etapa, status: x.status, prob: x.etapa === 'ganho' ? 100 : x.prob };
            this.mudarPipe(p => { const b = p.quadros[p.motion].find(y => y.id === q.id); if (x.novo) b.deals.unshift(Object.assign({ id: 'n' + Date.now() }, d)); else { const i = b.deals.findIndex(y => y.id === x.id); if (i >= 0) b.deals[i] = Object.assign({ id: x.id }, d); } });
            this.setState({ pipeCard: null }); this.avisar('mod', x.novo ? x.conta + ' entrou em ' + rot(x.etapa) + ' · ' + brl(+x.valor) + '.' : 'Negócio atualizado.'); } };
      }
    }
    // CAMPANHAS
    v.cp = { ativo: page === 'campaigns' && vista === 'modulo', canais: [], conAgente: [] };
    if (v.cp.ativo) { const LG = window.ALTHIUS_LOGOS || {}, CX = this.conexoes(), KL = (window.ALTHIUS_CONECTORES || {}).lista || [];
      const ms = (st.modSt || {}).campaigns || {}, rowsC = MOD.campaigns.linhas.map(l => Object.assign({}, l, ((st.modOv || {}).campaigns || {})[l.id] || {}));
      const est = id => CX[id] ? (CX[id].erro ? 'erro' : 'on') : 'off';
      const con = id => { const k = KL.find(x => x.id === id) || { nome: id }, e = est(id); return { nome: k.nome, logo: LG[id], estado: e, titulo: k.nome + (e === 'on' ? ' · conectado' : e === 'erro' ? ' · precisa reconectar' : ' · não conectado'),
        status: e === 'on' ? 'Conectado · ' + CX[id].conta : e === 'erro' ? 'Falha na conexão' : 'Não conectado', cor: e === 'on' ? 'var(--graphite)' : e === 'erro' ? 'var(--err)' : 'var(--muted)',
        btnCls: e === 'on' ? 'con-btn-sec' : 'con-btn', acaoLabel: e === 'on' ? 'Gerenciar' : e === 'erro' ? 'Reconectar' : 'Conectar', acao: () => this.abrirOauth(id) }; };
      const CANAIS = [
        ['LinkedIn Ads', ['liads'], 'ABM com as contas do ICP: anúncio só para quem está na lista.', 'Monta o público a partir das contas qualificadas, lê CPL por cargo e sugere onde pôr ou tirar verba.'],
        ['Meta Ads', ['meta'], 'Remarketing e públicos parecidos com os clientes atuais.', 'Sobe a lista de clientes como público, acompanha frequência e avisa quando o anúncio cansa.'],
        ['Google Ads', ['gads', 'ga4'], 'Busca por intenção: quem procura importação e conta e ordem.', 'Lê termos de busca, corta palavras que só trazem curioso e cruza conversão com o GA4.'],
        ['Orgânico', ['notion', 'gdrive'], 'Posts e materiais do calendário editorial.', 'Define a pauta pelos sinais das contas. O Agente de Copy escreve, o de Marketing mede alcance e leads.'],
        ['Evento', ['eventbrite', 'hubspot'], 'Feiras, webinars e encontros com o ICP.', 'Cruza inscritos com contas do CRM e coloca quem foi numa cadência pós-evento.'],
        ['SEO/GEO', ['gsc', 'ga4'], 'Aparecer no Google e nas respostas de ChatGPT, Gemini e Perplexity.', 'Acompanha buscas e páginas que trazem visita e indica que conteúdo falta para a IA citar a marca.']
      ];
      const num = s => parseFloat(String(s).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
      const todos = []; CANAIS.forEach(c => c[1].forEach(id => { if (todos.indexOf(id) < 0) todos.push(id); }));
      const nOn = todos.filter(id => est(id) === 'on').length;
      v.cp.donoTexto = nOn + ' de ' + todos.length + ' conectores ativos' + (todos.some(id => est(id) === 'erro') ? ' · 1 precisa reconectar' : '') + '. Ele planeja, lê os números e sugere ajustes; mudança de verba passa por aprovação.';
      v.cp.conAgente = todos.map(con);
      v.cp.falarGeral = () => this.falarCom('marketing', 'Como estão as campanhas do ciclo? ');
      v.cp.canais = CANAIS.map(([nome, cons, desc, faz]) => { const r = rowsC.filter(l => l.canal === nome), inv = r.reduce((s, l) => s + num(l.investido), 0), leads = r.reduce((s, l) => s + (+l.leads || 0), 0), at = r.filter(l => l.status === 'Ativa').length, sel = ms.filtro === nome;
        return { nome, desc, faz, sel: sel ? 'true' : 'false', ativas: at + (at === 1 ? ' ativa' : ' ativas'), investido: inv ? 'R$ ' + inv.toLocaleString('pt-BR') : '—', leads: leads ? String(leads) : '—', cpl: inv && leads ? 'R$ ' + Math.round(inv / leads).toLocaleString('pt-BR') : '—', cons: cons.map(con),
          falar: () => this.falarCom('marketing', 'Sobre ' + nome + ': '), filtrarLabel: sel ? 'Mostrar todas' : 'Campanhas (' + r.length + ')',
          filtrar: () => this.setState({ modSt: Object.assign({}, this.state.modSt, { campaigns: Object.assign({}, ms, { filtro: sel ? 'Todos' : nome }) }) }) }; });
    }
    // CAIXA DE ENTRADA
    v.ix = { ativo: page === 'inbox' && vista === 'modulo', canais: [] };
    v.ixm = { aberto: false, provedores: [] };
    { const LG = window.ALTHIUS_LOGOS || {}, IC = this.inboxCon();
      const DEF = [['email', 'E-mail', 'gmail'], ['whatsapp', 'WhatsApp', 'whatsapp'], ['linkedin', 'LinkedIn', 'linkedin'], ['instagram', 'Instagram', 'instagram']];
      const setIC = (k, val) => this.setState({ inboxCon: Object.assign({}, this.inboxCon(), { [k]: val }) });
      if (v.ix.ativo) v.ix.canais = DEF.map(([k, nome, logo]) => { const c = IC[k]; return { nome, logo: LG[k === 'email' && c && c.via === 'outlook' ? 'outlook' : logo], on: c ? 'true' : 'false', conta: c ? c.conta : 'Não conectado', btnCls: c ? 'con-btn-sec' : 'con-btn', acaoLabel: c ? 'Desconectar' : 'Conectar',
        acao: () => { if (c) this.confirmar('Desconectar ' + nome + '?', 'As conversas de ' + nome + ' param de entrar na Caixa de entrada. O que já está nas contas continua lá.', 'Desconectar', () => { setIC(k, null); this.avisar('mod', nome + ' desconectado.'); }); else this.setState({ ixCon: { k, via: 'gmail' } }); } }; });
      if (st.ixCon && v.ix.ativo) { const x = st.ixCon, d = DEF.find(z => z[0] === x.k);
        const fim = () => { const conta = x.k === 'whatsapp' ? '(11) 90000-0100 · Evolut' : x.k === 'instagram' ? '@evolut.trading' : x.k === 'linkedin' ? U.usuario + ' · perfil pessoal' : (x.via === 'outlook' ? 'camila@evolut.com.br' : U.email);
          setIC(x.k, { conta, via: x.via }); this.setState({ ixCon: null }); this.avisar('mod', d[1] + ' conectado. Só conversas com contatos do CRM entram aqui.'); };
        v.ixm = { aberto: true, nome: d[1], logo: LG[d[2]], qr: x.k === 'whatsapp', email: x.k === 'email', login: x.k === 'linkedin' || x.k === 'instagram', ocupado: !!x.ocupado,
          loginTexto: 'Você entra na sua conta do ' + d[1] + ' numa janela segura. A Althius nunca vê sua senha e só recebe as conversas com pessoas que já estão no CRM.',
          provedores: [['gmail', 'Gmail ou Google Workspace'], ['outlook', 'Outlook ou Microsoft 365']].map(([id, nome]) => ({ nome, logo: LG[id], ativo: x.via === id ? 'true' : 'false', escolher: () => this.setState({ ixCon: Object.assign({}, x, { via: id }) }) })),
          botao: x.ocupado ? 'Conectando…' : x.k === 'whatsapp' ? 'Já escaneei' : x.k === 'email' ? 'Continuar' : 'Entrar com ' + d[1],
          fechar: () => this.setState({ ixCon: null }), confirmar: () => { this.setState({ ixCon: Object.assign({}, x, { ocupado: true }) }); clearTimeout(this._ixT); this._ixT = setTimeout(fim, 900); } };
      }
    }
    // CRÉDITOS
    v.cr = { ativo: page === 'credits' && vista === 'modulo', pacotes: [], modos: [], filtros: [], extrato: [], porAgente: [], custos: [] };
    { const VAL = 0.005, usd = n => '', brl = n => precoEmReais(n), nf = n => Math.round(n).toLocaleString('pt-BR');
      const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], fd = s => { const [y, m, d] = s.split('-'); return +d + ' ' + MESES[+m - 1]; };
      const X = this.extrato(), saldo = this.saldo(), entrou = X.filter(e => e.tipo === 'entrada').reduce((s, e) => s + e.cr, 0), saiu = X.filter(e => e.tipo === 'saida').reduce((s, e) => s + e.cr, 0);
      const porAg = (st.agents || []).map(a => { const c = X.filter(e => e.tipo === 'saida' && e.ag === a.id).reduce((s, e) => s + e.cr, 0); return { nome: a.nome, sigla: a.sigla, cr: c }; });
      v.rlCred = porAg.map(a => ({ nome: a.nome, creditos: nf(a.cr), usd: usd(a.cr) }));
      if (v.cr.ativo) { const cfg = this.credCfg(), setCfg = o => this.setState({ credCfg: Object.assign({}, this.credCfg(), o) }), leitura = !can('credits.policy'), podeComprar = can('credits.buy');
        const decisor = (this.membros(ws.id).find(m => m.papel === 'cliente' && m.dono) || this.membros(ws.id).find(m => m.papel === 'cliente') || { nome: 'o C-level' }).nome;
        const dias = Math.max(1, Math.round((new Date() - new Date('2026-09-01')) / 864e5)), porDia = saiu / dias;
        v.md.temAcao = false;
        v.md.kpis = [{ label: 'Saldo', valor: nf(saldo), delta: 'créditos disponíveis' }, { label: 'Entrou', valor: nf(entrou), delta: 'créditos no ciclo' }, { label: 'Saiu', valor: nf(saiu), delta: 'créditos usados' }, { label: 'Consumo por dia', valor: nf(porDia), delta: 'média do ciclo' }];
        let corre = 0; const linhas = X.map(e => { corre += e.tipo === 'entrada' ? e.cr : -e.cr; return Object.assign({}, e, { saldoApos: corre }); }).reverse();
        const fx = st.credFiltro || 'Tudo';
        const comprar = n => { const preco = brl(n); if (!podeComprar) { this.confirmar('Pedir ' + nf(n) + ' créditos?', decisor + ' recebe o pedido em Aprovações e decide a compra de ' + preco + '.', 'Enviar pedido', () => { this.setState({ notifs: [['Pedido de créditos', U.usuario + ' pediu ' + nf(n) + ' créditos · ' + preco + ' · para ' + decisor, 'agora']].concat(this.state.notifs || []), notifLidas: false }); this.avisar('mod', 'Pedido enviado para ' + decisor + '.'); }); return; } this.confirmar('Comprar ' + nf(n) + ' créditos por ' + preco + '?', 'A cobrança vai no método de pagamento do workspace e os créditos entram na hora.', 'Comprar', () => {
          const hoje = new Date().toISOString().slice(0, 10); this.setState({ extrato: this.extrato().concat([{ id: 'x' + Date.now(), data: hoje, tipo: 'entrada', desc: 'Compra de ' + nf(n) + ' créditos', quem: U.usuario + ' · ' + preco, cr: n }]), notifs: [['Créditos comprados', nf(n) + ' créditos · ' + preco, 'agora']].concat(this.state.notifs || []), notifLidas: false });
          this.avisar('mod', nf(n) + ' créditos adicionados. Saldo: ' + nf(this.saldo() + n) + '.'); }); };
        Object.assign(v.cr, { saldo: nf(saldo), saldoUsd: usd(saldo), pctSaldo: Math.max(0, Math.min(100, saldo / entrou * 100)).toFixed(1) + '%', barraRotulo: nf(saldo) + ' de ' + nf(entrou) + ' créditos restantes',
          entrouTexto: nf(saiu) + ' usados de ' + nf(entrou) + ' que entraram', duracao: porDia ? 'No ritmo atual (' + nf(porDia) + ' por dia), dura cerca de ' + nf(saldo / porDia) + ' dias' : '',
          leitura, compraTitulo: podeComprar ? 'Comprar em 1 clique' : 'Pedir créditos', compraSub: podeComprar ? 'cai na hora' : 'quem decide: ' + decisor,
          compraNota: podeComprar ? 'Preço fixo por crédito, sem pacote mais caro ou mais barato. O recibo vai para o e-mail do C-level.' : 'Quem paga decide. O pedido vai para ' + decisor + ' (C-level) e aparece em Aprovações.',
          modoNota: leitura ? 'Só o C-level e o superadmin mudam estas regras.' : '',
          pacotes: [10000, 25000, 50000, 100000].map(n => ({ creditos: nf(n), preco: brl(n), bloqueado: false, comprar: () => comprar(n) })),
          modos: [['auto', 'Automático'], ['aprovacao', 'Com aprovação']].map(([k, label]) => ({ label, ativo: cfg.modo === k ? 'true' : 'false', escolher: () => setCfg({ modo: k }) })),
          aprovacao: cfg.modo === 'aprovacao', teto: String(cfg.teto), limite: String(cfg.limite), recarga: cfg.recarga ? 'true' : 'false',
          modoTexto: cfg.modo === 'auto' ? 'Os agentes gastam sozinhos dentro do limite do mês. Nada para esperando você, e tudo aparece no extrato.' : 'Ação que passar de ' + nf(cfg.teto) + ' créditos vira pedido em Aprovações antes de rodar. Coisas pequenas, como responder no chat, seguem direto.',
          mudarTeto: e => setCfg({ teto: +e.target.value.replace(/\D/g, '') || 0 }), mudarLimite: e => setCfg({ limite: +e.target.value.replace(/\D/g, '') || 0 }), alternarRecarga: () => setCfg({ recarga: !cfg.recarga }),
          filtros: ['Tudo', 'Entradas', 'Saídas'].map(f => ({ label: f, ativo: fx === f ? 'true' : 'false', ir: () => this.setState({ credFiltro: f }) })),
          extrato: linhas.filter(e => fx === 'Tudo' || (fx === 'Entradas') === (e.tipo === 'entrada')).map(e => ({ data: fd(e.data), desc: e.desc, quem: e.quem, tipo: e.tipo, valor: (e.tipo === 'entrada' ? '+' : '−') + nf(e.cr), saldo: nf(e.saldoApos) })),
          porAgente: porAg.map(a => ({ nome: a.nome, sigla: a.sigla, creditos: nf(a.cr), usd: usd(a.cr), pct: (saiu ? a.cr / saiu * 100 : 0).toFixed(1) + '%' })),
          custos: [['Mensagem no chat ou no copiloto', 'qualquer agente', 2], ['Rascunho de mensagem ou tarefa', 'Agente de Copy', 2], ['E-mail ou WhatsApp automático', 'Agente de Copy · por envio', 4], ['Enriquecer um contato', 'Agente Comercial · e-mail e telefone', 10], ['Pesquisa de conta (dossiê)', 'Agente Comercial', 15], ['Mapear comitê de uma conta', 'Agente Comercial', 25], ['Sinal monitorado', 'por conta, a cada leitura · ver Sinais', '0 a 20'], ['Leitura de mídia', 'Agente de Marketing · por semana', 30], ['Relatório automático', 'Agente de RevOps · por envio', 20]].map(([acao, quem, c]) => ({ acao, quem, cr: c + ' cr', usd: '' })) });
      }
    }
    // RELATÓRIOS
    v.rl = { ativo: page === 'analytics' && vista === 'modulo', motions: [], etapas: [], funil: [], cadencias: [], canais: [], creditos: [] };
    if (v.rl.ativo) { const P = this.pipe(), ET = ['entrada', 'qualificacao', 'descoberta', 'proposta', 'negociacao', 'ganho'], NOME = ['Entrada', 'Qualificação', 'Descoberta', 'Proposta', 'Negociação', 'Ganho'];
      const curto = n => n >= 1e6 ? 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : n >= 1e3 ? 'R$ ' + Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil' : n ? 'R$ ' + n : '—';
      const deals = m => P.quadros[m].reduce((l, q) => l.concat(q.deals), []), MOT = ['slg', 'mlg', 'plg'];
      const cel = (lista) => ({ v: curto(lista.reduce((s, d) => s + d.valor, 0)), n: lista.length + (lista.length === 1 ? ' negócio' : ' negócios') });
      const todos = MOT.reduce((l, m) => l.concat(deals(m)), []), abertos = todos.filter(d => d.etapa !== 'ganho');
      v.md.kpis = [{ label: 'Pipeline em aberto', valor: curto(abertos.reduce((s, d) => s + d.valor, 0)), delta: abertos.length + ' negócios · SLG, MLG e PLG' }].concat(v.md.kpis.slice(1));
      v.md.temFunil = false;
      Object.assign(v.rl, { motions: ['SLG', 'MLG', 'PLG'], hrefPipe: '#/' + appPath('pipeline'), hrefSinais: '#/' + appPath('signals'), hrefCad: '#/' + appPath('cadences'), hrefCamp: '#/' + appPath('campaigns'), hrefCred: '#/' + appPath('credits'),
        etapas: ET.map((k, i) => ({ nome: NOME[i], total: 'false', cels: MOT.map(m => cel(deals(m).filter(d => d.etapa === k))).concat([cel(todos.filter(d => d.etapa === k))]) })).concat([{ nome: 'Total', total: 'true', cels: MOT.map(m => cel(deals(m))).concat([cel(todos)]) }]),
        creditos: v.rlCred || [] });
      const sinaisOn = (st.agents || []).reduce((s, a) => s + this.sinaisDe(a.id).filter(x => this.sinalAtivo(x)).length, 0);
      const F = [['Contas qualificadas', 512, 'Contas e leads'], ['Contas com sinal', 48, sinaisOn + ' sinais ligados nos agentes'], ['Leads em cadência', 684, 'Cadências'], ['Respostas', 64, 'Caixa de entrada'], ['Reuniões', 23, 'Agenda conectada'], ['Negócios abertos', abertos.length, 'Pipeline, ao vivo']];
      const mx = Math.max.apply(null, F.map(f => f[1]));
      v.rl.funil = F.map(f => ({ label: f[0], fonte: f[2], n: f[1].toLocaleString('pt-BR'), pct: Math.max(2, Math.round(f[1] / mx * 100)) + '%' }));
      const CAD = MOD.cadences.linhas.map(l => Object.assign({}, l, ((st.modOv || {}).cadences || {})[l.id] || {}));
      v.rl.cadencias = CAD.map(c => ({ nome: c.nome, contatos: c.contatos + ' contatos', resposta: c.resposta, cor: c.status === 'Ativa' ? C.ok : c.status === 'Pausada' || c.status === 'Rascunho' ? C.aviso : C.neutro }));
      v.rl.cadNota = 'Passos de e-mail e WhatsApp podem ser automáticos. LinkedIn e ligação sempre viram tarefa.';
      const CP = MOD.campaigns.linhas, num = s => parseFloat(String(s).replace(/[^0-9,]/g, '').replace(',', '.')) || 0, grp = {};
      CP.forEach(l => { const g = grp[l.canal] = grp[l.canal] || { inv: 0, leads: 0 }; g.inv += num(l.investido); g.leads += +l.leads || 0; });
      v.rl.canais = Object.keys(grp).map(k => ({ nome: k, inv: grp[k].inv ? 'R$ ' + grp[k].inv.toLocaleString('pt-BR') : 'sem mídia', leads: grp[k].leads + ' leads', cpl: grp[k].inv && grp[k].leads ? 'R$ ' + Math.round(grp[k].inv / grp[k].leads) : '—' }));
      const invT = Object.keys(grp).reduce((s, k) => s + grp[k].inv, 0);
      v.rl.custoReuniao = 'Custo por reunião: R$ ' + Math.round(invT / 23).toLocaleString('pt-BR') + ' em mídia (R$ ' + invT.toLocaleString('pt-BR') + ' ÷ 23 reuniões). Créditos dos agentes no ciclo: ' + (v.rlCred || []).reduce((s, a) => s + (+String(a.creditos).replace(/\D/g, '')), 0).toLocaleString('pt-BR') + '.';
    }
    // CANAL
    { const FT0 = this.fotoUsuario.bind(this), cs = this.canais(), membrosWs = this.membros(ws.id).filter(m => !m.pendente);
      const pessoasCanal = canal.geral ? membrosWs.map(m => m.nome) : (canal.pessoas || []);
      v.cn = { pessoasTexto: canal.geral ? 'Todos os ' + pessoasCanal.length + ' membros' : pessoasCanal.length + (pessoasCanal.length === 1 ? ' pessoa' : ' pessoas'),
        fotos: pessoasCanal.slice(0, 5).map(n => ({ sigla: n.split(' ').map(x => x[0]).slice(0, 2).join(''), src: FT0(n), tem: !!FT0(n) })),
        agentes: (canal.agentes || []).map(id => st.agents.find(x => x.id === id)).filter(Boolean).map(x => ({ nome: x.nome, sigla: x.sigla })), semAgentes: !(canal.agentes || []).length,
        podeGerir: can('channels.manage') || canal.criador === U.usuario, naoGere: !(can('channels.manage') || canal.criador === U.usuario),
        gerenciar: () => (can('channels.manage') || canal.criador === U.usuario) ? this.setState({ canalModal: { modo: 'editar', id: canal.id, nome: canal.id, desc: canal.desc, pessoas: pessoasCanal.slice(), agentes: (canal.agentes || []).slice() } }) : this.avisar('canal', 'Quem criou o canal ou um gestor muda pessoas e agentes.') };
      v.novoCanal = () => this.setState({ canalModal: { modo: 'novo', nome: '', desc: '', pessoas: [U.usuario], agentes: [] }, drawer: false });
      const cm = st.canalModal; v.cm = { aberto: !!cm, pessoas: [], agentes: [] };
      if (cm) { const ed = cm.modo === 'editar', alvo = ed ? cs.find(c => c.id === cm.id) : null, geral = !!(alvo && alvo.geral), setM = o => this.setState({ canalModal: Object.assign({}, this.state.canalModal, o) });
        const tog = (campo, val) => () => { const a = (this.state.canalModal[campo] || []).slice(), i = a.indexOf(val); i >= 0 ? a.splice(i, 1) : a.push(val); setM({ [campo]: a, erro: '' }); };
        const sl = this.slug(cm.nome);
        v.cm = { aberto: true, titulo: ed ? '#' + cm.id : 'Novo canal', podeNome: !ed, geral, nome: cm.nome, desc: cm.desc, slugTexto: sl ? 'Vai aparecer como #' + sl : 'Use letras, números e hífen', nPessoas: (geral ? membrosWs.length : (cm.pessoas || []).length) + ' no canal',
          mudarNome: e => setM({ nome: e.target.value, erro: '' }), mudarDesc: e => setM({ desc: e.target.value }),
          pessoas: membrosWs.map(m => { const f = FT0(m.nome), on = geral || (cm.pessoas || []).indexOf(m.nome) >= 0; return { nome: m.nome.split(' ')[0] + ' ' + (m.nome.split(' ')[1] || '').charAt(0) + '.', sigla: m.nome.split(' ').map(x => x[0]).slice(0, 2).join(''), foto: f, temFoto: !!f, ativo: on ? 'true' : 'false', travado: geral, alternar: geral ? () => {} : tog('pessoas', m.nome) }; }),
          agentes: st.agents.map(x => ({ nome: x.nome, sigla: x.sigla, ativo: (cm.agentes || []).indexOf(x.id) >= 0 ? 'true' : 'false', alternar: tog('agentes', x.id) })),
          temErro: !!cm.erro, erro: cm.erro || '', podeArquivar: ed && !geral, salvarLabel: ed ? 'Salvar' : 'Criar canal',
          fechar: () => this.setState({ canalModal: null }),
          arquivar: () => this.confirmar('Arquivar #' + cm.id + '?', 'O canal some do menu. As mensagens ficam guardadas e um admin pode restaurar.', 'Arquivar', () => { this.setState({ canais: this.canais().filter(c => c.id !== cm.id), canalModal: null }); this.ir(appPath('channels/geral')); }),
          salvar: () => { const x = this.state.canalModal;
            if (ed) { this.setState({ canalModal: null, canais: this.canais().map(c => c.id === x.id ? Object.assign({}, c, { pessoas: c.geral ? c.pessoas : x.pessoas, agentes: x.agentes }) : c) }); return; }
            const id = this.slug(x.nome); if (!id) { setM({ erro: 'Dê um nome ao canal.' }); return; }
            if (this.canais().some(c => c.id === id)) { setM({ erro: 'Já existe um canal #' + id + '.' }); return; }
            if (!(x.pessoas || []).length) { setM({ erro: 'Adicione pelo menos uma pessoa.' }); return; }
            this.setState({ canalModal: null, canais: this.canais().concat([{ id, desc: (x.desc || '').trim() || 'Canal do time', novas: 0, pessoas: x.pessoas, agentes: x.agentes, criador: U.usuario }]),
              canalMsgs: Object.assign({}, this.state.canalMsgs, { [id]: [{ sigla: U.sigla, autor: U.usuario, agente: false, hora: this.hora(), texto: 'Criei o canal #' + id + '.' }] }) });
            this.ir(appPath('channels/' + id)); } }; }
    }
    const msgsCanal = (st.canalMsgs[canal.id] || MSGS[canal.id] || []);
    v.canalNome = canal.id;
    const reac = st.reacoes || {};
    const RAPIDAS = ['👍', '❤️', '😆', '😮'], TODAS = ['👍', '❤️', '😆', '😮', '😢', '🙏', '🔥', '👏', '🎯', '✅', '👀', '🚀'];
    const NOMES = { '👍': 'Curtir', '❤️': 'Amei', '😆': 'Haha', '😮': 'Uau', '😢': 'Triste', '🙏': 'Obrigado', '🔥': 'Fogo', '👏': 'Palmas', '🎯': 'No alvo', '✅': 'Feito', '👀': 'De olho', '🚀': 'Bora' };
    const reacs = st.reac || {};
    const salvarLista = lista => this.setState({ canalMsgs: Object.assign({}, this.state.canalMsgs, { [canal.id]: lista }) });
    v.canalMsgs = msgsCanal.map((m, i) => {
      const chaveM = canal.id + ':' + i, cabeca = i === 0 || msgsCanal[i - 1].autor !== m.autor || !!m.resp, fim = i === msgsCanal.length - 1 || msgsCanal[i + 1].autor !== m.autor, meu = m.autor === U.usuario;
      const pickerAberto = st.picker === chaveM, editando = st.editMsg === chaveM, hov = st.hoverMsg === chaveM || pickerAberto;
      const base = Object.assign({}, m.reacoes || {}, reacs[chaveM] || {});   // { emoji: { n, minha, quem } }
      const reagir = emoji => () => {
        const atual = Object.assign({}, (this.state.reac || {})[chaveM] || m.reacoes || {});
        const r = Object.assign({ n: 0, minha: false, quem: [] }, atual[emoji]);
        const quem = r.minha ? r.quem.filter(q => q !== U.usuario) : r.quem.concat([U.usuario]);
        atual[emoji] = { n: Math.max(0, r.n + (r.minha ? -1 : 1)), minha: !r.minha, quem };
        if (atual[emoji].n === 0) delete atual[emoji];
        this.setState({ reac: Object.assign({}, this.state.reac, { [chaveM]: atual }), picker: null });
      };
      const lista = Object.keys(base).filter(e => base[e].n > 0).map(e => ({ emoji: e, n: base[e].n, minha: base[e].minha ? 'true' : 'false', alternar: reagir(e),
        rotulo: NOMES[e] + ', ' + base[e].n + (base[e].minha ? ', você reagiu' : ''), quem: (base[e].quem || []).join(', ') || NOMES[e] }));
      const vistos = m.vistos || 0, temStatus = meu && fim;
      const temRodape = lista.length > 0 || temStatus || !!m.editada;
      return { sigla: m.sigla, autor: m.autor, agente: !!m.agente, hora: m.hora, texto: m.texto, temCard: !!m.card, cardHref: '#/' + appPath('agents/comercial'),
        align: meu ? 'end' : 'start', avCls: m.agente ? 'msg-av-agente' : 'msg-av-pessoa', avVis: fim ? 'visible' : 'hidden', bubbleCls: meu ? 'bubble-ink' : 'bubble-muted', toolLado: meu ? 'left' : 'right',
        temStatus, status: vistos > 0 ? 'Visto por ' + vistos : 'Enviada', temRodape, avMb: temRodape ? '31px' : '0', editada: !!m.editada,
        temCitacao: !!m.resp, citAutor: m.resp ? m.resp.autor : '', citTexto: m.resp ? m.resp.texto : '',
        cabeca: cabeca && !meu, pad: cabeca ? '28px 12px 4px' : '6px 12px 4px', fundo: hov && !editando ? 'var(--mist)' : 'transparent', barra: hov && !editando,
        editando, naoEditando: !editando, podeEditar: meu && !m.agente,
        reacoes: lista, temReacoes: lista.length > 0, pickerAberto: pickerAberto ? 'true' : 'false',
        rapidas: RAPIDAS.map(e => ({ emoji: e, rotulo: NOMES[e], minha: base[e] && base[e].minha ? 'true' : 'false', reagir: reagir(e) })),
        todas: TODAS.map(e => ({ emoji: e, rotulo: NOMES[e], minha: base[e] && base[e].minha ? 'true' : 'false', reagir: reagir(e) })),
        abrirPicker: () => this.setState({ picker: pickerAberto ? null : chaveM, hoverMsg: chaveM }),
        entrar: () => this.state.hoverMsg !== chaveM && this.setState({ hoverMsg: chaveM }),
        sair: () => this.state.hoverMsg === chaveM && this.setState({ hoverMsg: null, picker: this.state.picker === chaveM ? null : this.state.picker }),
        editar: () => { this.setState({ editMsg: chaveM, editTexto: m.texto, picker: null }); setTimeout(() => { if (this._edit) { this._edit.focus(); this._edit.setSelectionRange(this._edit.value.length, this._edit.value.length); } }, 30); },
        responder: () => { this.setState({ respondendo: m.autor, respondendoTexto: m.texto }); setTimeout(() => this._canalIn && this._canalIn.focus(), 20); },
        delegar: () => this.abrirCop('Sobre a mensagem de ' + m.autor + ': ') };
    });
    const idxEdit = st.editMsg && st.editMsg.indexOf(canal.id + ':') === 0 ? +st.editMsg.split(':')[1] : -1;
    v.editTexto = st.editTexto || ''; v.refEdit = el => { this._edit = el; };
    v.mudarEdit = ev => this.setState({ editTexto: ev.target.value });
    v.cancelarEdit = () => this.setState({ editMsg: null, editTexto: '' });
    v.salvarEdit = () => {
      const t = (this.state.editTexto || '').trim(); if (idxEdit < 0) return;
      if (!t) { this.setState({ editMsg: null }); return; }
      const nova = msgsCanal.map((x, j) => j === idxEdit ? Object.assign({}, x, { texto: t, editada: x.editada || t !== x.texto }) : x);
      this.setState({ editMsg: null, editTexto: '' }); salvarLista(nova);
    };
    v.teclaEdit = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); v.salvarEdit(); } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); v.cancelarEdit(); } };
    v.respondendo = !!st.respondendo; v.respondendoNome = st.respondendo || ''; v.cancelarResposta = () => this.setState({ respondendo: null });
    v.refCanalInput = el => { this._canalIn = el; };
    v.digitando = !!st.digitando && st.digitando.canal === canal.id; v.digitandoNome = st.digitando ? st.digitando.nome : ''; v.digitandoSigla = st.digitando ? st.digitando.sigla || 'CO' : 'CO';
    const enviarCanal = () => {
      const t = (this.state.canalTexto || '').trim(); if (!t) return;
      const agora = new Date(); const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
      const lista = msgsCanal.concat([{ sigla: U.sigla, autor: U.usuario, agente: false, hora, texto: t, resp: this.state.respondendo ? { autor: this.state.respondendo, texto: this.state.respondendoTexto || '' } : null }]);
      this.setState({ canalTexto: '', respondendo: null, canalMsgs: Object.assign({}, this.state.canalMsgs, { [canal.id]: lista }) });
      const agsCanal = (canal.agentes || []).map(id => st.agents.find(x => x.id === id)).filter(Boolean); const agR = agsCanal.find(x => t.indexOf('@' + x.nome) >= 0) || agsCanal[0];
      if (/@/.test(t) && !agR) { setTimeout(() => this.setState({ canalMsgs: Object.assign({}, this.state.canalMsgs, { [canal.id]: (this.state.canalMsgs[canal.id] || lista).concat([{ sigla: 'AL', autor: 'Althius', agente: true, hora, texto: 'Nenhum agente participa de #' + canal.id + '. Adicione um em Pessoas e agentes.' }]) }) }), 400); }
      if (/@/.test(t) && agR) {
        this.setState({ digitando: { canal: canal.id, nome: agR.nome, sigla: agR.sigla } });
        clearTimeout(this._td); this._td = setTimeout(() => {
          const atual = (this.state.canalMsgs[canal.id] || lista).concat([{ sigla: (this.state.digitando || {}).sigla || 'CO', autor: (this.state.digitando || {}).nome || 'Agente Comercial', agente: true, hora, texto: 'Recebido. Levanto isso agora e respondo aqui com as fontes.' }]);
          this.setState({ digitando: null, canalMsgs: Object.assign({}, this.state.canalMsgs, { [canal.id]: atual }) });
        }, 1600);
      }
    };
    v.canalTexto = st.canalTexto; v.mudarCanalTexto = ev => this.setState({ canalTexto: ev.target.value });
    v.teclaCanal = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); enviarCanal(); } };
    v.enviarCanal = enviarCanal;
    // CATÁLOGO DE SINAIS (Inteligência > Sinais)
    v.sigCat = { ativo: page === 'signals' && vista === 'modulo', grupos: [] };
    if (v.sigCat.ativo) { let on = 0, tot = 0;
      v.sigCat.grupos = st.agents.map(x => { const its = this.sinaisDe(x.id); const at = its.filter(s => this.sinalAtivo(s)).length; on += at; tot += its.length;
        return { nome: x.nome, sigla: x.sigla, href: '#/' + appPath('agents/' + x.id), ativos: at + ' de ' + its.length + ' ativos', itens: its.map(s => ({ nome: s.nome, custo: s.custo, cor: this.sinalAtivo(s) ? 'var(--signal)' : 'var(--steel)' })) }; });
      v.sigCat.resumo = on + ' sinais ativos de ' + tot + ' · cada agente liga e desliga os seus em Agentes → Sinais'; }
    // NOVA TAREFA
    v.tf = { aberto: !!st.tarefa, canais: [], contatos: [], resps: [], agentes: [], status: [] };
    if (st.tarefa) { const t = st.tarefa, setT = o => this.setState({ tarefa: Object.assign({}, this.state.tarefa, o) }), COM = window.ALTHIUS_COMITES || {}, FTs = window.ALTHIUS_FOTOS || {};
      const contas = MOD.accounts ? MOD.accounts.linhas : [], cSel = contas.find(c => c.id === t.conta), pessoasC = t.conta ? (COM[t.conta] || []) : [];
      v.tf = { aberto: true, titulo: t.titulo || '', nota: t.nota || '', data: t.data || '', hora: t.hora || '', conta: t.conta || '', temErro: !!t.erro, erro: t.erro || '',
        mudarTitulo: e => setT({ titulo: e.target.value, erro: '' }), mudarNota: e => setT({ nota: e.target.value }), mudarData: e => setT({ data: e.target.value }), mudarHora: e => setT({ hora: e.target.value }),
        mudarConta: e => setT({ conta: e.target.value, contato: null }),
        canais: ['Ligação', 'E-mail', 'WhatsApp', 'LinkedIn', 'Instagram', 'Reunião', 'CRM'].map(x => ({ label: x, ativo: t.canal === x ? 'true' : 'false', escolher: () => setT({ canal: x }) })),
        contatos: pessoasC.map(p => ({ nome: p.nome, foto: FTs[p.foto], ativo: t.contato === p.id ? 'true' : 'false', escolher: () => setT({ contato: t.contato === p.id ? null : p.id }) })),
        semContatos: pessoasC.length === 0, contatosVazio: t.conta ? 'Conta sem comitê mapeado' : 'Escolha uma conta',
        resps: this.membros(ws.id).filter(m => !m.pendente && m.papel !== 'superadmin' && (can('tasks.assign') || m.nome === U.usuario)).map(m => { const f = this.fotoUsuario(m.nome); return { nome: m.nome.split(' ')[0], sigla: m.nome.split(' ').map(x => x[0]).slice(0, 2).join(''), foto: f, temFoto: !!f, ativo: t.resp === m.nome ? 'true' : 'false', escolher: () => setT({ resp: m.nome }) }; }),
        agentes: st.agents.map(x => ({ nome: x.nome, sigla: x.sigla, ativo: t.agente === x.id ? 'true' : 'false', escolher: () => setT({ agente: t.agente === x.id ? null : x.id }) })),
        status: ['Pendente', 'Em andamento', 'Concluída'].map(x => ({ label: x, ativo: t.status === x ? 'true' : 'false', escolher: () => setT({ status: x }) })),
        fechar: () => this.setState({ tarefa: null }),
        salvar: () => { const x = this.state.tarefa; if (!(x.titulo || '').trim()) { setT({ erro: 'Escreva o que precisa ser feito.' }); return; } if (!x.data) { setT({ erro: 'Escolha a data.' }); return; }
          const [yy, mm, dd] = x.data.split('-'), hoje = new Date().toISOString().slice(0, 10), prazo = (x.data === hoje ? 'Hoje' : dd + '/' + mm) + (x.hora ? ', ' + x.hora : '');
          const ct = cSel ? cSel.nome : '—', pessoa = pessoasC.find(p => p.id === x.contato), ag = st.agents.find(a2 => a2.id === x.agente);
          const nova = { id: 'tn' + Date.now(), titulo: x.titulo.trim(), tipo: x.canal, conta: ct + (pessoa ? ' · ' + pessoa.nome : ''), prazo, status: x.status, desc: (x.nota || '') + (ag ? (x.nota ? '\n' : '') + ag.nome + ' vai preparar o material.' : ''), resp: x.resp };
          const n = [['Tarefa criada', nova.titulo + ' · ' + prazo + ' · ' + (x.resp || U.usuario), 'agora']].concat(ag ? [['Agente marcado', ag.nome + ' vai preparar: ' + nova.titulo, 'agora']] : []);
          this.setState({ tarefa: null, modExtra: Object.assign({}, this.state.modExtra, { tasks: [nova].concat(((this.state.modExtra || {}).tasks) || []) }), notifs: n.concat(this.state.notifs || []), notifLidas: false });
          if (ag) this.gastar(2, 'Material da tarefa: ' + nova.titulo, ag.id);
          this.avisar('mod', 'Tarefa criada para ' + (x.resp || U.usuario) + ' · ' + prazo + '.'); } };
    }
    // CONECTORES
    const KC = window.ALTHIUS_CONECTORES || { cats: [], lista: [], escopos: {} }, LG = window.ALTHIUS_LOGOS || {}, cons = this.conexoes();
    const nomeAg = id => (st.agents.find(a => a.id === id) || {}).nome || id;
    const usoTexto = c => { const n = (c.agentes || []).length; return n ? n + (n > 1 ? ' agentes' : ' agente') : 'nenhum agente'; };
    v.cat = { ativo: page === 'integrations' && vista === 'modulo', grupos: [], filtros: [] };
    if (v.cat.ativo) {
      const q = (st.catBusca || '').trim().toLowerCase(), fc = st.catFiltro || 'todos';
      const lista = KC.lista.filter(c => !q || (c.nome + ' ' + c.empresa).toLowerCase().indexOf(q) >= 0);
      const nCon = KC.lista.filter(c => cons[c.id]).length;
      v.cat.resumo = nCon + ' conectados de ' + KC.lista.length + ' disponíveis · cada conexão é autorizada na página oficial da ferramenta';
      v.cat.busca = st.catBusca || ''; v.cat.mudarBusca = ev => this.setState({ catBusca: ev.target.value });
      v.cat.filtros = [{ id: 'todos', nome: 'Todos' }, { id: 'conectados', nome: 'Conectados' }].concat(KC.cats).map(c => ({ label: c.nome, ativo: fc === c.id ? 'true' : 'false', ir: () => this.setState({ catFiltro: c.id }),
        n: c.id === 'todos' ? lista.length : c.id === 'conectados' ? lista.filter(x => cons[x.id]).length : lista.filter(x => x.cat === c.id).length }));
      v.cat.grupos = KC.cats.map(g => ({ nome: g.nome, desc: g.desc, itens: lista.filter(c => c.cat === g.id && (fc === 'todos' || fc === g.id || (fc === 'conectados' && cons[c.id]))).map(c => {
        const k = cons[c.id], ok = !!k && !k.erro, erro = !!k && !!k.erro;
        return { nome: c.nome, desc: c.desc, auth: c.auth, logo: LG[c.id], conectado: ok, erro, estado: ok ? 'ok' : erro ? 'erro' : 'off', usoTexto: k ? 'usado por ' + usoTexto(k) : '',
          btnCls: ok ? 'con-btn-sec' : 'con-btn', acaoLabel: ok ? 'Gerenciar' : erro ? 'Reconectar' : 'Conectar', acaoRotulo: (ok ? 'Gerenciar ' : 'Conectar ') + c.nome, acao: () => this.abrirOauth(c.id) };
      }) })).filter(g => g.itens.length);
      v.cat.vazio = v.cat.grupos.length === 0;
    }
    // modal OAuth
    v.oa = { aberto: false, escopos: [], agentes: [] };
    if (st.oauth) {
      const o = st.oauth, c = KC.lista.find(x => x.id === o.id) || {};
      const fechar = () => { clearTimeout(this._oa); this.setState({ oauth: null }); };
      v.oa = { aberto: true, nome: c.nome, empresa: c.empresa, auth: c.auth, logo: LG[c.id], escopos: KC.escopos[c.cat] || [], conta: U.email, usoTexto: (o.agentes || []).map(nomeAg).join(', ') || 'nenhum agente ainda',
        passoInicio: o.passo === 'inicio', passoAguardando: o.passo === 'aguardando', passoOk: o.passo === 'ok', fechar,
        agentes: st.agents.map(a => ({ nome: a.nome, ativo: (o.agentes || []).indexOf(a.id) >= 0 ? 'true' : 'false', alternar: () => { const s = new Set(this.state.oauth.agentes || []); s.has(a.id) ? s.delete(a.id) : s.add(a.id); this.setState({ oauth: Object.assign({}, this.state.oauth, { agentes: Array.from(s) }) }); } })),
        cancelar: () => { clearTimeout(this._oa); this.setState({ oauth: Object.assign({}, o, { passo: 'inicio' }) }); },
        continuar: () => { this.setState({ oauth: Object.assign({}, o, { passo: 'aguardando' }) }); clearTimeout(this._oa);
          this._oa = setTimeout(() => { const atual = this.state.oauth; if (!atual) return;
            this.setState({ oauth: Object.assign({}, atual, { passo: 'ok' }), conexoes: Object.assign({}, this.conexoes(), { [atual.id]: { conta: U.email, agentes: atual.agentes || [] } }),
              notifs: [['Integração conectada', c.nome + ' · ' + U.email, 'agora']].concat(this.state.notifs || []), notifLidas: false }); }, 1600); } };
    }
    v.hrefIntegracoes = '#/' + appPath('integrations');
    // CONTA (painel do comitê e da cadência)
    v.cta = { aberta: false, chamas: [], tabs: [], grupos: [], personas: [] }; v.cad = { emails: [], fones: [], passos: [], novos: [] };
    const contaSel = st.conta ? (MOD.accounts ? MOD.accounts.linhas.find(x => x.id === st.conta) : null) : null;
    if (contaSel) {
      const FT = window.ALTHIUS_FOTOS || {}, pessoas = (window.ALTHIUS_COMITES || {})[contaSel.id] || [];
      const tab = st.contaTab || 'comite', sinc = st.sincConta === contaSel.id;
      const PAPEL = { decisor: 'Decisor', influenciador: 'Influenciador', campeao: 'Campeão' };
      const fechar = () => this.setState({ conta: null, cadPessoa: null });
      const mapear = () => { this.avisar('mod', 'Agente Comercial recebeu ' + contaSel.nome + '. O resultado aparece em Execuções.'); fechar(); };
      v.cta = { aberta: true, nome: contaSel.nome, fit: contaSel.fit, segmento: contaSel.segmento, cidade: contaSel.cidade || '—', dono: contaSel.dono, donoFoto: this.fotoUsuario(contaSel.dono),
        chamas: this.chamas(+contaSel.temperatura), chamasRotulo: this.fogoRotulo(+contaSel.temperatura), w: lay.mobile ? '100vw' : 'min(760px, 92vw)', fechar, mapear,
        ...this.logoDe(contaSel.id, contaSel.nome, 'co'),
        ...(() => { const se = st.siteEdit && st.siteEdit.id === contaSel.id ? st.siteEdit : null, site = this.siteDe(contaSel.id), setSE = o => this.setState({ siteEdit: Object.assign({ id: contaSel.id }, this.state.siteEdit, o) });
          const salvar = () => { const d = this.dominio((this.state.siteEdit || {}).v); if (!d) { this.setState({ sites: Object.assign({}, this.state.sites, { [contaSel.id]: '' }), siteEdit: null }); return; }
            if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) { setSE({ erro: 'Use o endereço do site, por exemplo empresa.com.br.' }); return; }
            this.setState({ sites: Object.assign({}, this.state.sites, { [contaSel.id]: d }), logoFalha: Object.assign({}, this.state.logoFalha, { [d]: 0 }), siteEdit: null });
            this.avisar('mod', 'Site salvo. O logo vem do próprio ' + d + ' e aparece aqui, na lista de contas e no Pipeline.'); };
          return { siteEditando: !!se, siteTem: !se && !!site, siteVazio: !se && !site, site, siteHref: 'https://' + site, siteRascunho: se ? (se.v || '') : '', siteTemErro: !!(se && se.erro), siteErro: se ? se.erro || '' : '',
            siteEditar: () => this.setState({ siteEdit: { id: contaSel.id, v: site } }), siteMudar: e => setSE({ v: e.target.value, erro: '' }), siteCancelar: () => this.setState({ siteEdit: null }), siteSalvar: salvar,
            siteTecla: e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } if (e.key === 'Escape') { e.stopPropagation(); this.setState({ siteEdit: null }); } } }; })(),
        tabs: [['comite', 'Comitê de compra', pessoas.length], ['cadencia', 'Cadência', pessoas.length]].map(([id, label, n]) => ({ label, n, ativo: tab === id ? 'true' : 'false', ir: () => this.setState({ contaTab: id }) })),
        tabComite: tab === 'comite', tabCadencia: tab === 'cadencia', rodapeCad: tab === 'cadencia' && pessoas.length > 0,
        sincOn: sinc, sincOff: !sinc, sincronizando: sinc ? 'true' : 'false', syncBotao: sinc ? 'Atualizando…' : 'Atualizar do LinkedIn',
        syncTexto: sinc ? 'Buscando fotos, cargos e mudanças de emprego no LinkedIn…' : 'Fotos e cargos puxados do LinkedIn · ' + ((st.sincFeito || {})[contaSel.id] ? 'atualizado agora' : 'há 2 dias'),
        sincronizar: () => { if (sinc) return; this.setState({ sincConta: contaSel.id }); clearTimeout(this._sc); this._sc = setTimeout(() => this.setState({ sincConta: null, sincFeito: Object.assign({}, this.state.sincFeito, { [contaSel.id]: true }) }), 1400); },
        semPessoas: pessoas.length === 0, temPessoas: pessoas.length > 0,
        grupos: [['decisor', 'Decisores', 'quem assina'], ['influenciador', 'Influenciadores', 'quem pesa na decisão'], ['campeao', 'Campeões', 'quem defende a compra por dentro']].map(([k, titulo, desc]) => {
          const ps = pessoas.filter(p => p.papel === k);
          return { titulo, desc, vazio: ps.length === 0, vazioTexto: 'Nenhum ' + titulo.toLowerCase().replace(/es$/, '').replace(/s$/, '') + ' mapeado ainda.',
            pessoas: ps.map(p => ({ ...(() => { const li = this.liDe(p), ed = (st.liEdit || {})[p.id], setLi = o => this.setState({ li: Object.assign({}, this.state.li, { [p.id]: Object.assign({}, this.liDe(p), o) }) });
              const href = li.url || p.linkedin, nota = 'Oi ' + p.nome.split(' ')[0] + ', acompanho a ' + contaSel.nome + ' e queria trocar uma ideia sobre importação. Posso te adicionar?';
              const ACO = { conectado: ['Enviar mensagem', 'Mensagem copiada. Cole na conversa que abriu no LinkedIn.'], pendente: ['Ver convite', 'O convite ainda não foi aceito.'], nao: ['Conectar com nota', 'Nota copiada. Clique em Conectar e cole a nota.'] }[li.status] || ['Abrir perfil', ''];
              return { liHref: li.url ? (li.status === 'conectado' ? li.url.replace(/\/$/, '') + '/' : li.url) : p.linkedin, liUrlTexto: li.url ? 'Editar URL · ' + li.url : 'Adicionar a URL do perfil',
                liAcaoLabel: li.url ? ACO[0] : 'Buscar no LinkedIn', liEditando: !!ed, liNaoEditando: !ed, liRascunho: ed ? ed.v : '', liTemErro: !!(ed && ed.erro), liErro: ed ? ed.erro || '' : '',
                liAcao: () => { if (li.url && (li.status === 'conectado' || li.status === 'nao')) { try { navigator.clipboard && navigator.clipboard.writeText(li.status === 'nao' ? nota : 'Oi ' + p.nome.split(' ')[0] + ', tudo bem?'); } catch (e) {} this.avisar('mod', ACO[1]); } },
                liEditar: () => this.setState({ liEdit: Object.assign({}, this.state.liEdit, { [p.id]: { v: li.url } }) }),
                liCancelar: () => this.setState({ liEdit: Object.assign({}, this.state.liEdit, { [p.id]: null }) }),
                liMudar: e => this.setState({ liEdit: Object.assign({}, this.state.liEdit, { [p.id]: { v: e.target.value } }) }),
                liSalvar: () => { const v0 = (((this.state.liEdit || {})[p.id] || {}).v || '').trim();
                  if (v0 && !/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^\s/]+\/?$/i.test(v0)) { this.setState({ liEdit: Object.assign({}, this.state.liEdit, { [p.id]: { v: v0, erro: 'Use o link do perfil, no formato linkedin.com/in/nome.' } }) }); return; }
                  setLi({ url: v0 }); this.setState({ liEdit: Object.assign({}, this.state.liEdit, { [p.id]: null }) }); },
                liTecla: e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); setTimeout(() => { const b = document.activeElement; }, 0); } },
                liStatus: [['nao', 'Sem conexão'], ['pendente', 'Convite enviado'], ['conectado', 'Conectado']].map(([k, label]) => ({ label, ativo: li.status === k ? 'true' : 'false', escolher: () => setLi({ status: k }) })) }; })(), nome: p.nome, cargo: p.cargo, foto: FT[p.foto], linkedin: p.linkedin, contato: (p.emails || [])[0] + ' · ' + (p.fones || [])[0], verCadencia: () => this.setState({ contaTab: 'cadencia', cadPessoa: p.id }) })) };
        }) };
      if (pessoas.length) {
        const pid = pessoas.find(p => p.id === st.cadPessoa) ? st.cadPessoa : pessoas[0].id, pessoa = pessoas.find(p => p.id === pid);
        v.cta.personas = pessoas.map(p => ({ nome: p.nome, papel: PAPEL[p.papel], foto: FT[p.foto], ativo: p.id === pid ? 'true' : 'false', escolher: () => this.setState({ cadPessoa: p.id, cadSalvo: false }) }));
        const todas = st.cad || {}, cad = (todas[contaSel.id] || {})[pid] || this.cadPadrao(contaSel, pessoa);
        const gravar = fn => { const atual = JSON.parse(JSON.stringify(((this.state.cad || {})[contaSel.id] || {})[pid] || cad)); fn(atual);
          this.setState({ cadSalvo: false, cad: Object.assign({}, this.state.cad, { [contaSel.id]: Object.assign({}, (this.state.cad || {})[contaSel.id], { [pid]: atual }) }) }); };
        const primeiro = pessoa.nome.split(' ')[0], dono = contaSel.dono.split(' ')[0];
        const lista = (campo, max) => cad[campo].map((val, i) => ({ v: val, n: i + 1, mudar: ev => { const x = ev.target.value; gravar(c => { c[campo][i] = x; }); }, remover: () => gravar(c => { c[campo].splice(i, 1); c.passos.forEach(s => { if (s.alvo >= c[campo].length) s.alvo = 0; }); }) }));
        const LI = [['conexao', 'Conexão'], ['nota', 'Conexão com nota'], ['mensagem', 'Mensagem']];
        const subst = t => String(t || '').replace(/\{primeiro_nome\}/g, primeiro).replace(/\{empresa\}/g, contaSel.nome);
        const soDig = f => String(f || '').replace(/\D/g, '');
        v.cad = { primeiro, linkedin: pessoa.linkedin, salvo: !!st.cadSalvo,
          emails: lista('emails'), fones: lista('fones'), podeEmail: cad.emails.length < 3, podeFone: cad.fones.length < 3,
          ig: cad.ig || '', mudarIg: ev => { const x = ev.target.value.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[\/?].*$/, '').trim(); gravar(c => { c.ig = x; }); },
          addEmail: () => gravar(c => { if (c.emails.length < 3) c.emails.push(''); }), addFone: () => gravar(c => { if (c.fones.length < 3) c.fones.push(''); }),
          resumo: cad.passos.length + ' passos em ' + this.diaDe(cad.passos, cad.passos.length - 1) + ' dias',
          rodape: (() => { const a = cad.passos.filter(s => (s.canal === 'email' || s.canal === 'whatsapp') && s.modo !== 'manual').length, m = cad.passos.length - a; return (a ? a + (a === 1 ? ' passo automático' : ' passos automáticos') + ' (e-mail e WhatsApp, enviados pela IA)' : 'Nenhum passo automático') + ' · ' + (m ? m + (m === 1 ? ' vira tarefa' : ' viram tarefa') + ' para ' + dono + ' no dia certo.' : 'nada manual.'); })(),
          novos: ['email', 'linkedin', 'whatsapp', 'ligacao', 'instagram'].map(k => { const o = { label: this.CANAL_LABEL[k], add: () => gravar(c => c.passos.push({ id: 's' + Date.now(), canal: k, espera: 1, alvo: 0, liTipo: 'conexao', igTipo: 'seguir', assunto: '', texto: '' })) }; ['email', 'linkedin', 'whatsapp', 'ligacao', 'instagram'].forEach(x => { o['c_' + x] = x === k; }); return o; }),
          salvar: () => {
            const n = [['Cadência atualizada', contaSel.nome + ' · ' + pessoa.nome + ' · ' + cad.passos.length + ' passos', 'agora']];
            this.setState({ cadSalvo: true, notifs: n.concat(this.state.notifs || []), notifLidas: false });
            this.avisar('mod', 'Cadência de ' + pessoa.nome + ' salva. Você recebe um aviso no dia de cada passo.');
          },
          passos: cad.passos.map((s, i) => {
            const dia = this.diaDe(cad.passos, i), canalAlvos = s.canal === 'email' ? cad.emails : cad.fones;
            const o = { n: i + 1, dia, canal: s.canal, espera: s.espera, diasTexto: s.espera === 1 ? 'dia' : 'dias', primeiro: i === 0, naoPrimeiro: i > 0, ultimo: i === cad.passos.length - 1, minEspera: s.espera <= 0,
              aviso: 'Aviso para ' + dono + ' no dia ' + dia, assunto: s.assunto || '', texto: s.texto || '',
              ...(() => { const autoOk = s.canal === 'email' || s.canal === 'whatsapp', auto = autoOk && s.modo !== 'manual', canalN = s.canal === 'email' ? 'e-mail' : 'WhatsApp';
                return { automatizavel: autoOk, soManual: !autoOk, auto, naoAuto: !auto, avisoAuto: 'IA envia no dia ' + dia,
                  modos: [['auto', 'Automático · IA envia'], ['manual', 'Manual · você envia']].map(([k, label]) => ({ label, ativo: (k === 'auto') === auto ? 'true' : 'false', escolher: () => gravar(c => { c.passos[i].modo = k; }) })),
                  modoTexto: auto ? 'O Agente de Copy personaliza e envia pelo ' + canalN + ' conectado no dia ' + dia + ', em horário comercial. Se ' + primeiro + ' responder, a cadência para. 4 créditos por envio.'
                    : autoOk ? 'Vira tarefa para ' + dono + ' no dia ' + dia + ', com a mensagem pronta.'
                    : s.canal === 'linkedin' ? 'O LinkedIn não permite envio automático. ' + dono + ' recebe a tarefa com o texto pronto e abre o perfil num clique.' : s.canal === 'instagram' ? 'O Instagram não permite seguir nem abrir conversa de forma automática. ' + dono + ' recebe a tarefa e abre o perfil ou o direct num clique.' : 'Ligação é sempre feita por uma pessoa. A tarefa chega para ' + dono + ' com o roteiro.' }; })(),
              canais: ['email', 'linkedin', 'whatsapp', 'ligacao', 'instagram'].map(k => ({ label: this.CANAL_LABEL[k], ativo: s.canal === k ? 'true' : 'false', escolher: () => gravar(c => { c.passos[i].canal = k; c.passos[i].alvo = 0; if (k === 'linkedin' && !c.passos[i].liTipo) c.passos[i].liTipo = 'conexao'; if (k === 'instagram' && !c.passos[i].igTipo) c.passos[i].igTipo = 'seguir'; }) })),
              alvos: canalAlvos.filter(x => x).map((x, j) => ({ label: x, ativo: (s.alvo || 0) === j ? 'true' : 'false', escolher: () => gravar(c => { c.passos[i].alvo = j; }) })),
              mudarAssunto: ev => { const x = ev.target.value; gravar(c => { c.passos[i].assunto = x; }); },
              mudarTexto: ev => { const x = ev.target.value; gravar(c => { c.passos[i].texto = x; }); },
              menos: () => gravar(c => { c.passos[i].espera = Math.max(0, c.passos[i].espera - 1); }), mais: () => gravar(c => { c.passos[i].espera = Math.min(30, c.passos[i].espera + 1); }),
              subir: () => gravar(c => { if (i > 0) { const t = c.passos[i - 1]; c.passos[i - 1] = c.passos[i]; c.passos[i] = t; c.passos[0].espera = 0; if (c.passos[1] && !c.passos[1].espera) c.passos[1].espera = 1; } }),
              descer: () => gravar(c => { if (i < c.passos.length - 1) { const t = c.passos[i + 1]; c.passos[i + 1] = c.passos[i]; c.passos[i] = t; c.passos[0].espera = 0; if (c.passos[1] && !c.passos[1].espera) c.passos[1].espera = 1; } }),
              remover: () => gravar(c => { c.passos.splice(i, 1); if (c.passos[0]) c.passos[0].espera = 0; }),
              liTipos: LI.map(([k, label]) => ({ label, ativo: (s.liTipo || 'conexao') === k ? 'true' : 'false', escolher: () => gravar(c => { c.passos[i].liTipo = k; }) })),
              liTemTexto: s.canal === 'linkedin' && s.liTipo !== 'conexao', liSoConexao: s.canal === 'linkedin' && (s.liTipo || 'conexao') === 'conexao',
              liMax: s.liTipo === 'nota' ? 300 : 1900, liPlaceholder: s.liTipo === 'nota' ? 'Nota do convite (até 300 caracteres)' : 'Mensagem direta',
              liContagem: (s.texto || '').length + ' / ' + (s.liTipo === 'nota' ? 300 : 1900),
              liHref: this.liDe(pessoa).url || pessoa.linkedin, liAcaoLabel: !this.liDe(pessoa).url ? 'Buscar perfil no LinkedIn' : (s.liTipo === 'mensagem' ? 'Abrir conversa e colar a mensagem' : s.liTipo === 'nota' ? 'Conectar com a nota copiada' : 'Abrir perfil para conectar'),
              liAcao: () => { if (this.liDe(pessoa).url && s.liTipo !== 'conexao') { try { navigator.clipboard && navigator.clipboard.writeText(subst(s.texto)); } catch (e) {} this.avisar('mod', s.liTipo === 'nota' ? 'Nota copiada. Clique em Conectar no LinkedIn e cole.' : 'Mensagem copiada. Cole na conversa do LinkedIn.'); } },
              waLink: 'https://wa.me/55' + soDig(cad.fones[s.alvo || 0] || cad.fones[0]) + '?text=' + encodeURIComponent(subst(s.texto)),
              telLink: 'tel:+55' + soDig(cad.fones[s.alvo || 0] || cad.fones[0]),
              ...(() => { const h = (cad.ig || '').trim(), msg = (s.igTipo || 'seguir') === 'mensagem';
                return { igTipos: [['seguir', 'Seguir perfil'], ['mensagem', 'Mensagem direta']].map(([k, label]) => ({ label, ativo: (s.igTipo || 'seguir') === k ? 'true' : 'false', escolher: () => gravar(c => { c.passos[i].igTipo = k; }) })),
                  igTemTexto: msg, igSoSeguir: !msg, igSemPerfil: s.canal === 'instagram' && !h,
                  igHref: !h ? 'https://www.instagram.com/' : msg ? 'https://ig.me/m/' + encodeURIComponent(h) : 'https://www.instagram.com/' + encodeURIComponent(h) + '/',
                  igAcaoLabel: !h ? 'Abrir Instagram' : msg ? 'Abrir direct e colar a mensagem' : 'Abrir perfil para seguir',
                  igAcao: () => { if (h && msg) { try { navigator.clipboard && navigator.clipboard.writeText(subst(s.texto)); } catch (e) {} this.avisar('mod', 'Mensagem copiada. Cole no direct do Instagram.'); } } }; })() };
            ['email', 'linkedin', 'whatsapp', 'ligacao', 'instagram'].forEach(k => { o['c_' + k] = s.canal === k; });
            return o;
          }) };
      }
    }
    // CONFIGURAÇÕES
    const SEC = [['Minha conta', 'Foto, dados e senha'], ['Workspace e membros', 'Papéis e convites'], ['Notificações', 'Avisos e aprovações'], ['Aparência', 'Tema e densidade'], ['Agentes', 'Configuração por agente']].filter(s => papel !== 'bdr' || ['Minha conta', 'Notificações', 'Aparência'].indexOf(s[0]) >= 0);
    const DESC = { 'Minha conta': 'Como você aparece para o time e como entra na Althius.', 'Workspace e membros': 'Quem faz parte de cada workspace e o que cada papel pode fazer.', 'Notificações': 'Quando a Althius chama sua atenção.', 'Aparência': 'Preferências de visualização deste navegador.', 'Agentes': 'Atalho para a configuração de cada agente.' };
    const secAtual = SEC.some(s => s[0] === st.cfgSecao) ? st.cfgSecao : 'Minha conta';
    v.secoes = SEC.map(([n, sub]) => ({ nome: n, sub, ativo: secAtual === n ? 'true' : 'false', ir: () => this.setState({ cfgSecao: n }) }));
    v.secaoAtual = secAtual; v.secaoDesc = DESC[secAtual];
    v.cfgConta = secAtual === 'Minha conta'; v.cfgWs = secAtual === 'Workspace e membros'; v.cfgAparencia = secAtual === 'Aparência'; v.cfgAgentes = secAtual === 'Agentes'; v.cfgToggles = secAtual === 'Notificações';
    v.cfgAviso = !!st.cfgAviso; v.cfgAvisoTexto = st.cfgAviso || '';
    const op = (k, nome, desc) => ({ nome, desc, on: st.ops[k] ? 'true' : 'false', alternar: () => this.setState({ ops: Object.assign({}, this.state.ops, { [k]: !this.state.ops[k] }) }) });
    v.opcoes = [op('notif', 'Notificações na área de trabalho', 'Avisar quando um agente pedir aprovação'), op('aprovacao', 'Aprovação antes do CRM', 'Agentes só gravam no CRM depois do seu ok'), op('som', 'Som de mensagem', 'Toque curto a cada nova menção')];
    // aparência
    v.densidade = st.densidade || 'confortavel';
    v.densidades = [['confortavel', 'Confortável'], ['compacta', 'Compacta']].map(([id, label]) => ({ label, ativo: v.densidade === id ? 'true' : 'false', escolher: () => { this.setState({ densidade: id }); try { localStorage.setItem('althius-densidade', id); } catch (e) {} } }));
    v.navRecolhido = st.navMin ? 'true' : 'false';
    // minha conta
    v.minhaFoto = st.minhaFoto || this.fotoUsuario(U.usuario) || ''; v.temMinhaFoto = !!v.minhaFoto;
    const pf = st.perfil || {}, sn = st.senha || {};
    const forca = s => !s ? 'Mínimo de 8 caracteres, com letras e números.' : s.length < 8 ? 'Muito curta' : /[0-9]/.test(s) && /[a-zA-Z]/.test(s) ? (s.length >= 12 ? 'Senha forte' : 'Senha boa') : 'Use letras e números';
    const setSn = o => this.setState({ senha: Object.assign({}, this.state.senha, o) }), setPf = o => this.setState({ perfil: Object.assign({}, this.state.perfil, o) });
    v.conta = { nome: pf.nome !== undefined ? pf.nome : U.usuario, cargo: pf.cargo !== undefined ? pf.cargo : U.label, fone: pf.fone || '',
      mudarNome: e => setPf({ nome: e.target.value }), mudarCargo: e => setPf({ cargo: e.target.value }), mudarFone: e => setPf({ fone: e.target.value }),
      salvar: () => this.avisarCfg('Dados salvos.'),
      trocarFoto: e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) { this.avisarCfg('A foto passa de 2 MB. Escolha uma menor.'); return; }
        const r = new FileReader(); r.onload = () => { this.setState({ minhaFoto: r.result }); try { localStorage.setItem('althius-foto', r.result); } catch (x) {} this.avisarCfg('Foto atualizada.'); }; r.readAsDataURL(f); },
      removerFoto: () => { this.setState({ minhaFoto: '' }); try { localStorage.setItem('althius-foto', ''); } catch (x) {} },
      senhaAtual: sn.atual || '', senhaNova: sn.nova || '', senhaConf: sn.conf || '', forcaTexto: forca(sn.nova || ''),
      mudarSenhaAtual: e => setSn({ atual: e.target.value, erro: '' }), mudarSenhaNova: e => setSn({ nova: e.target.value, erro: '' }), mudarSenhaConf: e => setSn({ conf: e.target.value, erro: '' }),
      temErroSenha: !!sn.erro, erroSenha: sn.erro || '',
      alterarSenha: () => { const s = this.state.senha || {};
        if (!s.atual) return setSn({ erro: 'Digite sua senha atual.' });
        if (!s.nova || s.nova.length < 8 || !/[0-9]/.test(s.nova) || !/[a-zA-Z]/.test(s.nova)) return setSn({ erro: 'A nova senha precisa de 8 caracteres ou mais, com letras e números.' });
        if (s.nova !== s.conf) return setSn({ erro: 'A confirmação não bate com a nova senha.' });
        this.setState({ senha: {} }); this.avisarCfg('Senha alterada. Os outros dispositivos vão pedir login de novo.'); },
      doisFatores: st.doisFatores ? 'true' : 'false', alternar2fa: () => { this.setState({ doisFatores: !this.state.doisFatores }); this.avisarCfg(this.state.doisFatores ? 'Verificação em duas etapas desligada.' : 'Verificação em duas etapas ligada. No próximo login, leia o QR code com seu app.'); },
      sairOutras: () => this.avisarCfg('Você saiu dos outros dispositivos.') };
    // workspace e membros
    {
      const wsCfg = this.wsPermitidos().some(w => w.id === st.cfgWs) ? st.cfgWs : ws.id, wsObj = D.WORKSPACES.find(w => w.id === wsCfg) || ws, lista = this.membros(wsCfg);
      const P = this.PAPEL_INFO, admin = papel === 'superadmin' || papel === 'estrategista' || papel === 'cliente';
      const podeDar = { superadmin: ['superadmin', 'estrategista', 'cliente', 'bdr'], estrategista: ['estrategista', 'cliente', 'bdr'], cliente: ['cliente', 'bdr'], bdr: [] }[papel];
      const dono = lista.find(m => m.dono) || lista[0] || { nome: '—' };
      const papelConv = podeDar.indexOf(st.convPapel) >= 0 ? st.convPapel : podeDar[podeDar.length - 1];
      const salvar = l => this.salvarMembros(wsCfg, l);
      const convidar = () => { const em = (this.state.convEmail || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { this.setState({ convErro: 'Digite um e-mail válido.' }); return; }
        if (this.membros(wsCfg).some(m => m.email.toLowerCase() === em)) { this.setState({ convErro: 'Essa pessoa já faz parte do workspace.' }); return; }
        const nome = em.split('@')[0].split(/[._-]/).map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
        salvar(this.membros(wsCfg).concat([{ id: 'n' + Date.now(), nome, email: em, papel: papelConv, origem: /althius\.com\.br$/.test(em) ? 'Althius' : wsObj.nome.split(' ')[0], pendente: true, quando: 'agora' }]));
        this.setState({ convEmail: '', convErro: '' }); this.avisarCfg('Convite enviado para ' + em + ' como ' + P[papelConv].nome + '. O link vale por 7 dias.'); };
      const ativos = lista.filter(m => !m.pendente).length, pend = lista.length - ativos;
      v.ws2 = { podeTrocar: this.wsPermitidos().length > 1, nome: wsObj.nome, sigla: wsObj.sigla, resumo: 'Fase de ' + wsObj.momento.toLowerCase() + ' · ' + ativos + ' membros ativos',
        dono: dono.nome, donoFoto: this.fotoUsuario(dono.nome) || '',
        lista: this.wsPermitidos().map(w => ({ nome: w.nome, ativo: w.id === wsCfg ? 'true' : 'false', escolher: () => this.setState({ cfgWs: w.id }) })),
        ...(() => { const L = this.wsLogo(wsObj), pode = can('ws.brand'), se = st.wsSiteEdit, dom = this.siteDe('ws:' + wsObj.id), up = (st.wsMarca || {})[wsObj.id];
          const salvarSite = () => { const d = this.dominio((this.state.wsSiteEdit || {}).v); if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) { this.setState({ wsSiteEdit: Object.assign({}, this.state.wsSiteEdit, { erro: 'Use o endereço do site, por exemplo empresa.com.br.' }) }); return; }
            this.setState({ sites: Object.assign({}, this.state.sites, { ['ws:' + wsObj.id]: d }), logoFalha: Object.assign({}, this.state.logoFalha, { [d]: 0 }), wsMarca: Object.assign({}, this.state.wsMarca, { [wsObj.id]: '' }), wsSiteEdit: null }); this.avisarCfg('Logo do workspace puxado de ' + d + '.'); };
          return { logoTem: L.tem, logoSem: !L.tem, logo: L.src, logoErro: L.erro, logoLoad: L.load, podeMarca: pode, naoPodeMarca: !pode,
            logoOrigem: up ? 'Imagem enviada' : dom ? 'Puxado de ' + dom : 'Sem logo: aparecem as iniciais', temLogoProprio: !!(up || dom),
            siteEditando: !!se, siteNaoEditando: !se, siteRascunho: se ? se.v || '' : '', siteTemErro: !!(se && se.erro), siteErro: se ? se.erro || '' : '',
            siteEditar: () => this.setState({ wsSiteEdit: { v: dom } }), siteMudar: e => this.setState({ wsSiteEdit: { v: e.target.value } }), siteCancelar: () => this.setState({ wsSiteEdit: null }), siteSalvar: salvarSite,
            siteTecla: e => { if (e.key === 'Enter') { e.preventDefault(); salvarSite(); } },
            logoArquivo: e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 1024 * 1024) { this.avisarCfg('A imagem passa de 1 MB. Escolha uma menor.'); return; }
              const r = new FileReader(); r.onload = () => { this.setState({ wsMarca: Object.assign({}, this.state.wsMarca, { [wsObj.id]: r.result }) }); this.avisarCfg('Logo de ' + wsObj.nome + ' atualizado para todo o workspace.'); }; r.readAsDataURL(f); },
            logoRemover: () => { this.setState({ wsMarca: Object.assign({}, this.state.wsMarca, { [wsObj.id]: '' }), sites: Object.assign({}, this.state.sites, { ['ws:' + wsObj.id]: '' }) }); this.avisarCfg('Logo removido. O workspace volta a mostrar as iniciais.'); } }; })(),
        matriz: (() => { const C2 = window.ALTHIUS_CAPS || { papeis: [], grupos: [] }, ix = C2.papeis.findIndex(p => p[0] === papel); const G = { s: ['Sim', 'sim'], a: ['Atribuídos', 'parcial'], p: ['Só o seu', 'parcial'], l: ['Só ver', 'ver'], q: ['Pede', 'pede'], n: ['—', 'nao'] };
          return { papeis: C2.papeis.map((p, i) => ({ nome: p[1], meu: i === ix ? 'true' : 'false' })), grupos: C2.grupos.map(g => ({ nome: g.nome, itens: g.itens.map(c => ({ nome: c.nome, nota: c.nota, temNota: !!c.nota, cels: c.v.map((x, i) => ({ t: G[x][0], k: G[x][1], meu: i === ix ? 'true' : 'false' })) })) })) }; })(),
        papeis: ['superadmin', 'estrategista', 'cliente', 'bdr'].map(k => ({ nome: P[k].nome, desc: P[k].desc, quem: P[k].quem, cor: P[k].cor, meu: k === papel ? 'true' : 'false' })),
        contagem: ativos + ' ativos' + (pend ? ' · ' + pend + (pend > 1 ? ' convites pendentes' : ' convite pendente') : ''),
        podeConvidar: podeDar.length > 0, semPermissao: !admin,
        conviteEmail: st.convEmail || '', mudarConvite: e => this.setState({ convEmail: e.target.value, convErro: '' }), teclaConvite: e => { if (e.key === 'Enter') { e.preventDefault(); convidar(); } },
        papeisConvite: podeDar.map(k => ({ label: P[k].nome, ativo: k === papelConv ? 'true' : 'false', escolher: () => this.setState({ convPapel: k }) })),
        convidar, temErroConvite: !!st.convErro, erroConvite: st.convErro || '',
        membros: lista.map(m => { const voce = m.nome === U.usuario, foto = this.fotoUsuario(m.nome), pode = podeDar.indexOf(m.papel) >= 0 && !voce && !m.dono;
          return { nome: m.nome, email: m.email, origem: m.dono ? m.origem + ' · dono' : m.origem, sigla: m.nome.split(' ').map(x => x[0]).slice(0, 2).join(''), temFoto: !!foto, foto,
            papel: m.papel, papelNome: P[m.papel].nome, cor: P[m.papel].cor, voce, pendente: !!m.pendente, quando: m.quando || '',
            editavel: pode && !m.pendente, fixo: !(pode && !m.pendente), removivel: pode,
            mudarPapel: e => { const novo = e.target.value; if (podeDar.indexOf(novo) < 0) { this.avisarCfg('Seu papel não pode atribuir ' + P[novo].nome + '.'); return; }
              salvar(this.membros(wsCfg).map(x => x.id === m.id ? Object.assign({}, x, { papel: novo }) : x)); this.avisarCfg(m.nome + ' agora é ' + P[novo].nome + ' em ' + wsObj.nome + '.'); },
            reenviar: () => this.avisarCfg('Convite reenviado para ' + m.email + '.'),
            removerRotulo: m.pendente ? 'Cancelar convite' : 'Remover ' + m.nome,
            remover: () => this.confirmar(m.pendente ? 'Cancelar convite?' : 'Remover ' + m.nome + '?', m.pendente ? 'O link enviado para ' + m.email + ' deixa de funcionar.' : m.nome + ' perde o acesso a ' + wsObj.nome + ' na hora. As tarefas dele ficam sem responsável.', m.pendente ? 'Cancelar convite' : 'Remover',
              () => { salvar(this.membros(wsCfg).filter(x => x.id !== m.id)); this.avisarCfg(m.pendente ? 'Convite cancelado.' : m.nome + ' foi removido do workspace.'); }) }; }) };
      v.wsMetaN = ativos;
    }
    v.cfgListaAg = agentesVis.map(x => ({ nome: x.nome, sigla: x.sigla, autonomia: x.autonomia, acao: can('agents.configure') ? 'Configurar' : 'Ver', href: '#/' + appPath('agents/' + x.id) }));

    // HOME
    const h = st.home;
    const kpiBdr = ['oportunidades','contas','leads','respostas','reunioes'];
    const kpiPrincipais = papel === 'bdr' ? ['contas','respostas','reunioes','oportunidades'] : ['pipeline','oportunidades','reunioes','creditos'];
    v.kpis = h.kpis.filter(k => kpiPrincipais.indexOf(k[0]) >= 0 && (papel !== 'bdr' || kpiBdr.indexOf(k[0]) >= 0)).map(k => ({ label: k[1], valor: k[2], delta: k[3] }));
    v.homeCta = can('approvals.decide') && pendentes.length ? { label: 'Revisar aprovações', acao: ir(appPath('approvals')) } : { label: 'Criar solicitação', acao: () => this.abrirCop('') };
    v.mostraOperacao = papel !== 'bdr';
    const opHref = ['executions','campaigns','cadences','agents','executions'];
    // MAPA DE CONTAS
    {
      const per = st.mapaPer || '30', uSel = st.mapaUf || null, reg = st.mapaReg || 'Brasil';
      const fr = per === '30' ? 0.36 : per === '60' ? 0.61 : 1;
      const cont = {}; MAPA_UFS.forEach(u => { const n = MAPA_DIST[u.uf] || 0; cont[u.uf] = fr === 1 ? n : Math.max(n > 0 ? 1 : 0, Math.round(n * fr)); });
      const total = Object.keys(cont).reduce((s, k) => s + cont[k], 0), max = Math.max.apply(null, Object.keys(cont).map(k => cont[k]));
      const passo = n => n <= 0 ? 0 : n <= max * 0.06 ? 1 : n <= max * 0.18 ? 2 : n <= max * 0.45 ? 3 : 4;
      const pct = (x, y) => ({ x: ((x - MAPA_VB[0]) / MAPA_VB[2] * 100).toFixed(2) + '%', y: ((y - MAPA_VB[1]) / MAPA_VB[3] * 100).toFixed(2) + '%' });
      const proj = (lat, lon) => [(lon - MAPA_PROJ.LON0) * MAPA_PROJ.K * MAPA_PROJ.S, (MAPA_PROJ.LAT0 - lat) * MAPA_PROJ.S];
      const ufReg = {}; MAPA_UFS.forEach(u => { ufReg[u.uf] = u.regiao; });
      const vis = uf => reg === 'Brasil' || ufReg[uf] === reg;
      const selUf = uf => () => this.setState({ mapaUf: this.state.mapaUf === uf ? null : uf, mapaReg: reg !== 'Brasil' && ufReg[uf] !== reg ? 'Brasil' : reg });
      const contas = (MOD.accounts ? MOD.accounts.linhas : []).map(c => Object.assign({}, c, ((st.modOv || {}).accounts || {})[c.id] || {}));
      const diasMax = per === '30' ? 30 : per === '60' ? 60 : 9999;
      const ufDe = c => String(c.cidade || '').slice(-2);
      const FT = window.ALTHIUS_FOTOS || {}, COM = window.ALTHIUS_COMITES || {};
      const m = { f: {}, s: {}, x: {}, l: {}, c: {} };
      MAPA_UFS.forEach(u => { m.f[u.uf] = 'var(--mapa-' + passo(cont[u.uf]) + ')'; m.s[u.uf] = uSel === u.uf ? 'true' : 'false'; m.x[u.uf] = vis(u.uf) ? 'false' : 'true';
        m.l[u.uf] = u.nome + ': ' + cont[u.uf] + (cont[u.uf] === 1 ? ' conta' : ' contas'); m.c[u.uf] = selUf(u.uf); });
      m.periodos = [['30', '30 dias'], ['60', '60 dias'], ['tudo', 'Todas']].map(([id, label]) => ({ label, ativo: per === id ? 'true' : 'false', escolher: () => this.setState({ mapaPer: id }) }));
      m.resumo = total.toLocaleString('pt-BR') + ' contas com localização' + (per === 'tudo' ? '' : ' e sinal nos últimos ' + per + ' dias') + ' · 27 estados';
      m.maxTexto = max.toLocaleString('pt-BR');
      m.semLocal = per === '30' ? 5 : per === '60' ? 9 : 14;
      m.bolhas = MAPA_UFS.filter(u => cont[u.uf] > 0).map(u => { const p = pct(u.cx, u.cy), n = cont[u.uf], r = Math.round(20 + Math.sqrt(n / max) * 22);
        return { x: p.x, y: p.y, r: r + 'px', n, sel: uSel === u.uf ? 'true' : 'false', dim: vis(u.uf) ? 'false' : 'true', rotulo: u.nome + ', ' + n + ' contas. Ver contas do estado', selecionar: selUf(u.uf) }; });
      m.pins = contas.filter(c => MAPA_GEO[c.id] && MAPA_GEO[c.id][2] <= diasMax && (COM[c.id] || []).length).map(c => { const g = MAPA_GEO[c.id], xy = proj(g[0], g[1]), p = pct(xy[0], xy[1]);
        return { x: p.x, y: p.y, nome: c.nome, cidade: c.cidade, fit: c.fit, nivel: String(c.temperatura), chamas: this.chamas(+c.temperatura), dim: vis(ufDe(c)) ? 'false' : 'true',
          rotulo: c.nome + ', ' + c.cidade + ', fit ' + c.fit + '. Abrir conta', abrir: () => this.abrirConta(c.id, 'comite') }; });
      const regs = ['Brasil', 'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
      m.regioes = regs.map(r => ({ label: r, n: MAPA_UFS.filter(u => r === 'Brasil' || u.regiao === r).reduce((s, u) => s + cont[u.uf], 0), ativo: reg === r ? 'true' : 'false', escolher: () => this.setState({ mapaReg: r, mapaUf: null }) }));
      m.ranking = MAPA_UFS.filter(u => vis(u.uf)).sort((a, b) => cont[b.uf] - cont[a.uf]).slice(0, 7).map(u => ({ uf: u.uf, n: cont[u.uf], pct: Math.max(3, Math.round(cont[u.uf] / max * 100)) + '%', selecionar: selUf(u.uf) }));
      m.temUf = !!uSel; m.semUf = !uSel; m.limpar = () => this.setState({ mapaUf: null });
      if (uSel) { const u = MAPA_UFS.find(x => x.uf === uSel), cs = contas.filter(c => ufDe(c) === uSel && (MAPA_GEO[c.id] || [0, 0, 0])[2] <= diasMax);
        m.uf = { nome: u.nome, sigla: u.uf, n: cont[uSel], resumo: cont[uSel] + (cont[uSel] === 1 ? ' conta' : ' contas') + ' · região ' + u.regiao, semDossie: cs.length === 0, temLista: cs.length > 0, verTexto: 'Ver ' + (cs.length === 1 ? 'a conta' : 'as ' + cs.length + ' contas') + ' de ' + u.uf + ' em Contas e leads',
          contas: cs.map(c => ({ nome: c.nome, cidade: c.cidade, fit: c.fit, sinal: c.sinal, fotos: (COM[c.id] || []).slice(0, 3).map(p => FT[p.foto]), abrir: () => this.abrirConta(c.id, 'comite') })),
          verTodas: () => { this.setState({ modSt: Object.assign({}, this.state.modSt, { accounts: Object.assign({}, (this.state.modSt || {}).accounts, { uf: uSel, aberto: null }) }) }); this.ir(appPath('accounts')); } };
      } else m.uf = { contas: [] };
      v.mapa = m;
    }
    v.operacao = h.operacao.map((o, i) => ({ label: o[0], n: o[1], href: '#/' + appPath(opHref[i]), cor: i === 4 ? C.erro : 'var(--ink)' }));
    const acoesBase = vazio ? [] : (papel === 'bdr' ? h.acoes.filter(a => a.resp === U.usuario) : h.acoes);
    v.acoes = acoesBase.map(a => Object.assign({}, a, { corPri: a.prioridade === 'Alta' ? 'var(--err)' : 'var(--graphite)' }));
    v.acoesVazio = v.acoes.length === 0;
    v.mostraAprovHome = can('approvals') && pendentes.length > 0 && !vazio;
    v.aprovHome = pendentes.slice(0, 3).map(a => ({ tipo: a.tipo, titulo: a.titulo, prazo: a.prazo, abrir: () => { this.setState({ apSel: a.id }); this.ir(appPath('approvals')); } }));
    const tlCor = { ok: C.ok, aviso: C.aviso, erro: C.erro };
    v.timeline = (vazio ? [] : h.timeline.filter(t => papel !== 'bdr' || t[3] !== 'erro')).map(t => {
      const k = t[3] === 'erro' ? 'alerta' : /lista/i.test(t[1]) ? 'lista' : /qualific/i.test(t[1]) ? 'alvo' : /respond/i.test(t[1]) ? 'msg' : /oportun/i.test(t[1]) ? 'alta' : 'ok';
      const cor = tlCor[t[3]], o = { hora: t[0], evento: t[1], det: t[2], cor, tinta: 'color-mix(in srgb, ' + cor + ' 14%, var(--paper))' };
      ['lista', 'alvo', 'ok', 'msg', 'alta', 'alerta'].forEach(x => { o['i_' + x] = x === k; });
      return o;
    });

    // AGENTES
    const tabsDef = [['todos','Todos',() => true],['ativos','Ativos',a => a.estado === 'ativo'],['aguardando','Aguardando aprovação',a => a.estado === 'aguardando'],['pausados','Pausados',a => a.estado === 'pausado'],['falha','Com falha',a => a.estado === 'falha']];
    v.agTabs = tabsDef.map(([id, label, f]) => ({ label, n: agentesVis.filter(f).length, ativo: st.agTab === id ? 'true' : 'false', barra: st.agTab === id ? '#F7054F' : 'transparent', ir: () => this.setState({ agTab: id }) }));
    v.agBusca = st.agBusca; v.mudarAgBusca = e => this.setState({ agBusca: e.target.value });
    v.funcoes = ['Todas'].concat(agentesVis.map(a => a.funcao).filter((f, i, arr) => arr.indexOf(f) === i));
    v.agFuncao = st.agFuncao; v.mudarAgFuncao = e => this.setState({ agFuncao: e.target.value });
    v.agAutonomia = st.agAutonomia; v.mudarAgAutonomia = e => this.setState({ agAutonomia: e.target.value });
    v.limparFiltrosAg = () => this.setState({ agTab: 'todos', agBusca: '', agFuncao: 'Todas', agAutonomia: 'Todas' });
    const tabF = tabsDef.find(t => t[0] === st.agTab)[2], q = st.agBusca.trim().toLowerCase();
    const filtrados = vazio ? [] : agentesVis.filter(() => true).filter(a => !q || a.nome.toLowerCase().indexOf(q) >= 0).filter(a => st.agFuncao === 'Todas' || a.funcao === st.agFuncao).filter(a => st.agAutonomia === 'Todas' || a.autonomia === st.agAutonomia);
    const acoesAg = (a, detalhe) => {
      const abrirTab = t => () => { this._proxTab = t; if (detalhe) this.setState({ agDetTab: t }); else this.ir(appPath('agents/' + a.id)); };
      if (papel === 'bdr') return [btn('Pedir ajuda', parar(abrirTab('conversa')), true)];
      if (can('agents.configure')) return [
        btn('Conversar', parar(abrirTab('conversa')), true), btn('Configurar', parar(abrirTab('capacidades'))),
        btn('Testar', parar(() => this.avisar(detalhe ? 'agente' : 'agentes', 'Teste de ' + a.nome + ' iniciado em ambiente de homologação.'))),
        btn(a.estado === 'pausado' ? 'Retomar' : 'Pausar', parar(() => this.confirmar(a.estado === 'pausado' ? 'Retomar ' + a.nome + '?' : 'Pausar ' + a.nome + '?', a.estado === 'pausado' ? 'O agente volta a executar o que está na fila.' : 'Execuções em andamento deste agente serão pausadas. Nada é perdido.', a.estado === 'pausado' ? 'Retomar' : 'Pausar agente', () => {
          this.setState({ agents: st.agents.map(x => x.id === a.id ? Object.assign({}, x, { estado: x.estado === 'pausado' ? 'ativo' : 'pausado' }) : x) });
          this.avisar(detalhe ? 'agente' : 'agentes', a.nome + (a.estado === 'pausado' ? ' retomado.' : ' pausado.'));
        }))),
        btn('Ver logs', parar(abrirTab('execucoes')))
      ];
      return [btn('Conversar', parar(abrirTab('conversa')), true), btn('Ver atividade', parar(abrirTab('execucoes'))), btn('Solicitar execução', parar(() => this.abrirCop('Solicitar execução para ' + a.nome + ': ')))].concat(can('agents.pause') ? [btn(a.estado === 'pausado' ? 'Retomar' : 'Pausar', parar(() => this.confirmar(a.estado === 'pausado' ? 'Retomar ' + a.nome + '?' : 'Pausar ' + a.nome + '?', a.estado === 'pausado' ? 'O agente volta a executar o que está na fila.' : 'Tudo que ele está fazendo para agora. O estrategista é avisado.', a.estado === 'pausado' ? 'Retomar' : 'Pausar agente', () => { this.setState({ agents: st.agents.map(x => x.id === a.id ? Object.assign({}, x, { estado: x.estado === 'pausado' ? 'ativo' : 'pausado' }) : x), notifs: [['Agente ' + (a.estado === 'pausado' ? 'retomado' : 'pausado'), a.nome + ' por ' + U.usuario, 'agora']].concat(this.state.notifs || []), notifLidas: false }); this.avisar(detalhe ? 'agente' : 'agentes', a.nome + (a.estado === 'pausado' ? ' retomado.' : ' pausado.')); })))] : []);
    };
    v.agentes = filtrados.map(a => ({ nome: a.nome, sigla: a.sigla, funcao: a.funcao, objetivo: a.objetivo, autonomia: a.autonomia, precisaAprovacao: a.precisaAprovacao,
      estadoLabel: ESTADO_AG[a.estado][0], estadoCor: ESTADO_AG[a.estado][1], integracoes: integ(a), execCiclo: a.execCiclo, sucesso: a.sucesso, pendencias: a.pendencias, ultima: a.ultima,
      href: '#/' + appPath('agents/' + a.id), abrir: ir(appPath('agents/' + a.id)), acoes: acoesAg(a, false) }));
    v.agVazio = v.agentes.length === 0;
      { const SN = window.ALTHIUS_SINAIS || [], SK = window.ALTHIUS_SKILLS || {};
        v.agentes = agentesVis.map((x, i) => Object.assign({}, v.agentes.find(y => y.nome === x.nome) || {}, { nome: x.nome, sigla: x.sigla, funcao: x.funcao, objetivo: x.objetivo, autonomia: x.autonomia, execCiclo: x.execCiclo, href: '#/' + appPath('agents/' + x.id),
          sinaisN: SN.filter(s => s.agente === x.id && this.sinalAtivo(s)).length, skillsN: this.skillsDe(x.id).filter(s => s.ativo).length,
          conversar: () => { this._proxTab = 'conversa'; this.ir(appPath('agents/' + x.id)); }, personalizar: () => { this._proxTab = 'playbooks'; this.ir(appPath('agents/' + x.id)); } })); }
    v.agCta = can('agents.create') ? { tem: true, label: 'Novo agente', acao: () => this.abrirCop('Criar um novo agente para ') } : can('agents.request') ? { tem: true, label: 'Solicitar automação', acao: () => this.abrirCop('Quero automatizar ') } : { tem: false, label: '', acao: () => {} };
    v.agResumo = ['ativo','aguardando','pausado','falha'].map(k => ({ label: ESTADO_AG[k][0], cor: ESTADO_AG[k][1], n: agentesVis.filter(a => a.estado === k).length }));
    v.mostraAtividadeAg = papel !== 'bdr';
    v.agAtividade = st.execs.slice(0, 5).map(e => ({ titulo: e.titulo, status: e.status, horario: e.horario, cor: exCor(e.status), href: '#/' + appPath('executions/' + e.id) }));

    // DETALHE DO AGENTE
    const a = page === 'agents' && r.id ? agentesVis.find(x => x.id === r.id) : null;
    if (page === 'agents' && r.id && !a && conteudoOk) { v.vAgente = false; v.vNegado = true; }
    if (a) {
      const tabsOk = TABS_AG.filter(([id]) => papel === 'bdr' ? (id === 'visao' || id === 'conversa') : id === 'auditoria' ? can('agents.audit') : true);
      const tab = tabsOk.find(t => t[0] === st.agDetTab) ? st.agDetTab : 'visao';
      v.ag = { nome: a.nome, sigla: a.sigla, objetivo: a.objetivo, escopo: a.escopo, autonomia: a.autonomia, responsavel: a.responsavel, execCiclo: a.execCiclo, sucesso: a.sucesso, pendencias: a.pendencias, ultima: a.ultima,
        estadoLabel: ESTADO_AG[a.estado][0], estadoCor: ESTADO_AG[a.estado][1], acoes: acoesAg(a, true) };
      v.agTabsDet = tabsOk.map(([id, label]) => ({ label, ativo: id === tab ? 'true' : 'false', barra: id === tab ? '#F7054F' : 'transparent', ir: () => this.setState({ agDetTab: id }) }));
      ['visao','conversa','capacidades','playbooks','conhecimento','sinais','integracoes','execucoes','auditoria'].forEach(id => { v['t' + id.charAt(0).toUpperCase() + id.slice(1)] = tab === id; });
      v.threads = [['Prioridades de hoje', 'agora', true], ['Revisão da lista Sudeste', 'ontem', false], ['Objeções de câmbio', 'seg', false]].map(t => ({ titulo: t[0], quando: t[1], bg: t[2] ? 'var(--mist)' : 'var(--paper)' }));
      const msgs = this.chatDe(a);
      const fb = st.feedback || {};
      v.chat = msgs.map((m, i) => {
        const k = a.id + ':' + i, s = m.stream, pensando = s === 0, digitando = s != null && s > 0, pronto = s == null;
        return { texto: m.texto, hora: m.hora || this.hora(), status: m.status || 'Enviada', isUser: m.tipo === 'user', isAgente: m.tipo === 'agente', isDeleg: m.tipo === 'deleg', isPlano: m.tipo === 'plano', passos: m.passos || [], pendente: m.estado === 'pendente', resolvido: m.estado === 'resolvido', resultado: m.resultado || '',
          pensando, temTexto: !pensando, textoVis: digitando ? m.texto.slice(0, s) : m.texto, cursor: digitando, busy: pronto ? 'false' : 'true', footVis: pronto ? 'visible' : 'hidden',
          marcador: 'Lendo o ICP vigente e o histórico de ' + a.nome.split(' ')[0].toLowerCase() + '…', anuncio: pensando ? 'Gerando resposta' : pronto && m.stream === null ? 'Resposta pronta' : '',
          copiarLabel: st.copiado === k ? 'Copiado' : '',
          copiar: () => { try { navigator.clipboard && navigator.clipboard.writeText(m.texto); } catch (e) {} this.setState({ copiado: k }); clearTimeout(this._cp); this._cp = setTimeout(() => this.setState({ copiado: null }), 1600); },
          refazer: () => { this.setState({ chats: Object.assign({}, this.state.chats, { [a.id]: msgs.map((x, j) => j === i ? Object.assign({}, x, { stream: 0 }) : x) }) }); this.streamar(a.id, i); },
          utilOn: fb[k] === 1 ? 'true' : 'false', inutilOn: fb[k] === -1 ? 'true' : 'false',
          util: () => this.setState({ feedback: Object.assign({}, this.state.feedback, { [k]: fb[k] === 1 ? 0 : 1 }) }),
          inutil: () => this.setState({ feedback: Object.assign({}, this.state.feedback, { [k]: fb[k] === -1 ? 0 : -1 }) }) };
      });
      const decide = can('approvals.decide') || can('agents.configure');
      v.rotuloPlano = decide ? 'Aprovar plano' : 'Pedir aprovação';
      v.aprovarPlano = () => {
        const nova = msgs.map(m => m.tipo === 'plano' ? Object.assign({}, m, { estado: 'resolvido', resultado: decide ? 'Plano aprovado por ' + U.usuario + '. Execução enviada para a fila.' : 'Pedido de aprovação enviado ao estrategista.' }) : m);
        this.setState({ chats: Object.assign({}, st.chats, { [a.id]: nova }) });
      };
      const enviar = texto => {
        const t = (texto || '').trim(); if (!t) return;
        const h = this.hora();
        const atual = this.chatDe(a).concat([{ tipo: 'user', texto: t, hora: h, status: 'Enviada' }, { tipo: 'agente', hora: h, stream: 0, texto: 'Entendido. Vou levantar isso com base no ICP vigente e te mostro o plano antes de qualquer ação no CRM.' }]);
        this.setState({ msgTexto: '', chats: Object.assign({}, this.state.chats, { [a.id]: atual }) });
        this.gastar(2, 'Conversa: ' + (t.length > 42 ? t.slice(0, 42) + '…' : t), a.id);
        this.streamar(a.id, atual.length - 1);
      };
      v.msgTexto = st.msgTexto; v.mudarMsg = e => this.setState({ msgTexto: e.target.value });
      v.teclaMsg = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(this.state.msgTexto); } };
      v.enviarMsg = () => enviar(st.msgTexto);
      v.comandos = ['/resumo da conta', '/próximo lead', '/objeções prováveis'].map(c => ({ label: c, fn: () => enviar(c) }));
      const capsAg = Object.assign({}, a.caps, st.caps[a.id] || {});
      const editavel = can('agents.configure');
      v.capacidades = CAPS.map(([k, label]) => ({ label, on: capsAg[k] ? 'true' : 'false', editavel, leitura: !editavel, estado: capsAg[k] ? 'Ativa' : 'Inativa', corTxt: capsAg[k] ? 'var(--ink)' : 'var(--graphite)',
        lado: capsAg[k] ? 'flex-end' : 'flex-start', trilho: capsAg[k] ? 'var(--ink)' : 'var(--steel)',
        alternar: () => this.setState({ caps: Object.assign({}, st.caps, { [a.id]: Object.assign({}, st.caps[a.id] || {}, { [k]: !capsAg[k] }) }) }) }));
      v.playbooks = a.playbooks.map(p => ({ nome: p[0], versao: p[1], resp: p[2], data: p[3] }));
      { // Playbook
        const editavel = can('agents.configure'), base = (window.ALTHIUS_PLAYBOOK || {})[a.id] || '', pbs = (st.pb || {})[a.id] || {};
        const versoes = (pbs.versoes || []).concat(a.playbooks.map(p => ({ v: p[1], quem: p[2], quando: p[3] })));
        const vAtual = versoes[0] ? versoes[0].v : 'v1.0', prox = 'v' + (Math.round((parseFloat(vAtual.slice(1)) + 0.1) * 10) / 10).toFixed(1);
        const publicado = pbs.publicado !== undefined ? pbs.publicado : base, texto = pbs.rascunho !== undefined ? pbs.rascunho : publicado;
        const gravar = o => this.setState({ pb: Object.assign({}, this.state.pb, { [a.id]: Object.assign({}, ((this.state.pb || {})[a.id]) || {}, o) }) });
        const descartadas = pbs.descartadas || [], aplicadas = pbs.aplicadas || [];
        const sugs = ((window.ALTHIUS_SUGESTOES || {})[a.id] || []).filter(s => descartadas.indexOf(s.id) < 0 && aplicadas.indexOf(s.id) < 0);
        const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
        v.pb = { texto, versao: vAtual, proxima: prox, editavel, somenteLeitura: !editavel, status: texto !== publicado ? 'Rascunho não publicado' : 'Publicado · em uso',
          contagem: palavras + ' palavras · o agente lê o playbook inteiro antes de cada tarefa',
          mudar: e => gravar({ rascunho: e.target.value }), descartar: () => gravar({ rascunho: undefined }),
          salvar: () => { const t = (((this.state.pb || {})[a.id] || {}).rascunho); gravar({ publicado: t !== undefined ? t : publicado, rascunho: undefined, versoes: [{ v: prox, quem: U.usuario, quando: 'agora' }].concat(pbs.versoes || []) }); this.avisar('agente', 'Playbook ' + prox + ' publicado. O ' + a.nome + ' já usa a nova versão.'); },
          versoes: versoes.slice(0, 5), nSug: sugs.length ? sugs.length + (sugs.length > 1 ? ' novas' : ' nova') : '', semSug: sugs.length === 0,
          sugestoes: sugs.map(s => ({ aprendizado: s.aprendizado, mudanca: s.mudanca, origem: s.origem,
            aplicar: () => { const linha = s.mudanca.replace(/^Adicionar em [^:]+:\s*/, ''); gravar({ rascunho: texto.replace(/\n*$/, '') + '\n- ' + linha.charAt(0).toUpperCase() + linha.slice(1), aplicadas: aplicadas.concat([s.id]) }); this.avisar('agente', 'Aprendizado adicionado ao rascunho. Publique para o agente passar a usar.'); },
            descartar: () => gravar({ descartadas: descartadas.concat([s.id]) }) })) };
      }
      { // Skills
        const editavel = can('agents.configure'), f = st.skForm || null, setF = o => this.setState({ skForm: Object.assign({}, this.state.skForm, o) });
        const add = (nome, quando, instr) => { const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'skill';
          this.setState({ skForm: null, skillsNovas: Object.assign({}, this.state.skillsNovas, { [a.id]: (((this.state.skillsNovas || {})[a.id]) || []).concat([{ id, nome, quando, instrucoes: instr, ativo: true, nova: true }]) }) });
          this.avisar('agente', 'Skill /' + id + ' adicionada ao ' + a.nome + '.'); };
        v.sk = { editavel, somenteLeitura: !editavel, formAberto: !!f, nome: f ? f.nome || '' : '', quando: f ? f.quando || '' : '', instrucoes: f ? f.instrucoes || '' : '', temErro: !!(f && f.erro), erro: f ? f.erro || '' : '',
          abrirNova: () => this.setState({ skForm: {} }), cancelar: () => this.setState({ skForm: null }),
          mudarNome: e => setF({ nome: e.target.value, erro: '' }), mudarQuando: e => setF({ quando: e.target.value, erro: '' }), mudarInstrucoes: e => setF({ instrucoes: e.target.value, erro: '' }),
          salvar: () => { const x = this.state.skForm || {}; if (!(x.nome || '').trim() || !(x.quando || '').trim() || !(x.instrucoes || '').trim()) { setF({ erro: 'Preencha nome, gatilho e instruções.' }); return; } add(x.nome.trim(), x.quando.trim(), x.instrucoes.trim()); },
          importar: e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; const r = new FileReader();
            r.onload = () => { const t = String(r.result || ''); const nm = (t.match(/^name:\s*(.+)$/m) || t.match(/^#\s+(.+)$/m) || [null, fl.name.replace(/\.(md|txt)$/i, '')])[1].trim();
              const qd = (t.match(/^description:\s*(.+)$/m) || [null, 'Definido no arquivo importado'])[1].trim(); add(nm, qd, t); }; r.readAsText(fl); },
          lista: this.skillsDe(a.id).map(s => ({ id: s.id, nome: s.nome, quando: s.quando, nova: !!s.nova, ativo: s.ativo ? 'true' : 'false',
            alternar: () => { if (!editavel) return; this.setState({ skillsOn: Object.assign({}, this.state.skillsOn, { [a.id]: Object.assign({}, ((this.state.skillsOn || {})[a.id]) || {}, { [s.id]: !s.ativo }) }) }); } })) };
      }
      { // Sinais do agente
        const editavel = can('agents.configure'), sa = papel === 'superadmin';
        v.sinaisAg = this.sinaisDe(a.id).map(s => { const on = this.sinalAtivo(s); return { nome: s.nome, desc: s.desc, fonte: s.fonte, freq: s.freq, custo: s.custo, custom: !s.fixo, ativo: on ? 'true' : 'false', travado: !editavel,
          alternar: () => { if (!editavel) return; this.setState({ sinaisOn: Object.assign({}, this.state.sinaisOn, { [s.id]: !on }) }); this.avisar('agente', (on ? 'Sinal desligado: ' : 'Sinal ligado: ') + s.nome + '.'); } }; });
        const sf = st.sinalForm || {}, setS = o => this.setState({ sinalForm: Object.assign({}, this.state.sinalForm, o) }), FQ = ['Diária', 'Semanal', 'Mensal', 'Sob demanda'];
        v.sinalForm = { pode: sa, nome: sf.nome || '', fonte: sf.fonte || '', desc: sf.desc || '', custo: sf.custo || 5, temErro: !!sf.erro, erro: sf.erro || '',
          mudarNome: e => setS({ nome: e.target.value, erro: '' }), mudarFonte: e => setS({ fonte: e.target.value, erro: '' }), mudarDesc: e => setS({ desc: e.target.value, erro: '' }),
          menos: () => setS({ custo: Math.max(0, (sf.custo || 5) - 1) }), mais: () => setS({ custo: Math.min(200, (sf.custo || 5) + 1) }),
          freqs: FQ.map(x => ({ label: x, ativo: (sf.freq || 'Semanal') === x ? 'true' : 'false', escolher: () => setS({ freq: x }) })),
          salvar: () => { const x = this.state.sinalForm || {}; if (!(x.nome || '').trim() || !(x.desc || '').trim()) { setS({ erro: 'Dê um nome e descreva o que o sinal deve buscar.' }); return; }
            this.setState({ sinalForm: {}, sinaisCustom: (this.state.sinaisCustom || []).concat([{ id: 'c' + Date.now(), agente: a.id, nome: x.nome.trim(), fonte: (x.fonte || 'Fonte pública').trim(), desc: x.desc.trim(), custo: x.custo || 5, freq: x.freq || 'Semanal', ativo: true, fixo: false }]) });
            this.avisar('agente', 'Sinal personalizado criado e ligado no ' + a.nome + '.'); } };
      }
      v.conhecimento = a.conhecimento.map(k => ({ tipo: k[0], nome: k[1] }));
      v.agIntegracoes = a.integracoes.map(i => ({ nome: verForn ? i.fornecedor + ' · ' + i.cap : i.cap, modo: i.modo }));
      { const KC2 = window.ALTHIUS_CONECTORES || { lista: [] }, LG2 = window.ALTHIUS_LOGOS || {}, cons2 = this.conexoes(), modosAg = (st.agModo || {})[a.id] || {};
        const MODOS = [['leitura', 'Leitura'], ['rascunho', 'Rascunho'], ['escrita', 'Escrita']];
        v.agConectores = KC2.lista.filter(c => cons2[c.id]).map(c => {
          const k = cons2[c.id], usa = (k.agentes || []).indexOf(a.id) >= 0, modo = modosAg[c.id] || (c.cat === 'crm' ? 'leitura' : c.cat === 'email' ? 'rascunho' : 'leitura');
          return { nome: c.nome, logo: LG2[c.id], usa: usa ? 'true' : 'false', desligado: !usa, sub: (k.erro ? 'Conexão com falha · reconecte em Integrações' : k.conta) + ' · ' + c.auth,
            modos: MODOS.map(([id, label]) => ({ label, ativo: usa && modo === id ? 'true' : 'false', escolher: () => this.setState({ agModo: Object.assign({}, this.state.agModo, { [a.id]: Object.assign({}, modosAg, { [c.id]: id }) }) }) })),
            alternar: () => { const todos = Object.assign({}, this.conexoes()), ag = new Set(todos[c.id].agentes || []); ag.has(a.id) ? ag.delete(a.id) : ag.add(a.id); todos[c.id] = Object.assign({}, todos[c.id], { agentes: Array.from(ag) }); this.setState({ conexoes: todos }); } };
        });
      }
      v.agExecs = st.execs.filter(e => e.agente === a.id).map(e => ({ titulo: e.titulo, status: e.status, cor: exCor(e.status), validos: e.validos, credCons: e.credCons, href: '#/' + appPath('executions/' + e.id) }));
      v.agExecVazio = v.agExecs.length === 0;
      v.versoesAg = AUDIT.map((u, i) => ({ label: u[3] + ' · ' + u[0], titulo: u[2], det: u[1], st: i === 0 ? 'now' : 'todo' }));
      v.auditoria = AUDIT.map(u => ({ sigla: u[1].split(' ').map(x => x[0]).slice(0, 2).join(''), data: u[0], autor: u[1], mudanca: u[2], versao: u[3], rollback: () => this.confirmar('Restaurar ' + u[3] + '?', 'A configuração de ' + a.nome + ' volta para a versão ' + u[3] + '. A versão atual fica no histórico.', 'Restaurar', () => this.avisar('agente', 'Configuração restaurada para ' + u[3] + '.')) }));
    }

    // EXECUÇÕES
    const fStatus = ['Todas','Em execução','Aguardando aprovação','Na fila','Agendada','Pausada','Concluída','Concluída parcialmente','Falhou'];
    v.exViews = [['lista','Lista'],['kanban','Kanban'],['timeline','Timeline']].map(([id, label]) => ({ label, ativo: st.exView === id ? 'true' : 'false', bg: st.exView === id ? 'var(--ink)' : 'var(--paper)', cor: st.exView === id ? 'var(--paper)' : 'var(--ink)', ir: () => this.setState({ exView: id }) }));
    const execBase = vazio ? [] : st.execs;
    v.exFiltros = fStatus.map(s => { const ativo = st.exFiltro === s; return { label: s, n: s === 'Todas' ? execBase.length : execBase.filter(e => e.status === s).length, ativo: ativo ? 'true' : 'false', bg: ativo ? 'var(--ink)' : 'var(--paper)', cor: ativo ? 'var(--paper)' : 'var(--ink)', borda: ativo ? 'var(--ink)' : 'var(--rule)', ir: () => this.setState({ exFiltro: s }) }; });
    const exMap = e => ({ i_check: /Conclu/.test(e.status), i_x: e.status === 'Falhou' || e.status === 'Cancelada', i_run: e.status === 'Em execução', i_clock: !/Conclu|Falhou|Cancelada|Em execução/.test(e.status), tinta: 'color-mix(in srgb, ' + exCor(e.status) + ' 14%, transparent)', id: e.id, titulo: e.titulo, tipo: e.tipo, agenteNome: agNome(e.agente), horario: e.horario, status: e.status, cor: exCor(e.status), pct: e.progresso + '%', validos: e.validos, processados: e.processados, credCons: e.credCons, credEst: e.credEst, href: '#/' + appPath('executions/' + e.id) });
    const exF = execBase.filter(e => st.exFiltro === 'Todas' || e.status === st.exFiltro);
    v.execs = exF.map(exMap);
    v.exVazio = v.execs.length === 0;
    v.exLista = st.exView === 'lista' && !v.exVazio; v.exKanban = st.exView === 'kanban' && !v.exVazio; v.exTimeline = st.exView === 'timeline' && !v.exVazio;
    v.kanban = KANBAN.map(([titulo, sts]) => { const itens = exF.filter(e => sts.indexOf(e.status) >= 0).map(exMap); return { titulo, n: itens.length, itens }; });

    const e = page === 'executions' && r.id ? st.execs.find(x => x.id === r.id) : null;
    if (page === 'executions' && r.id && !e && conteudoOk) { v.vExecucao = false; v.vNegado = true; }
    v.mostraCusto = can('exec.cost');
    if (e) {
      const ativa = e.status === 'Em execução';
      const fx = /Aguardando/.test(e.status) ? 0 : /Agendada|Na fila|Reservando/.test(e.status) ? 1 : /Conclu/.test(e.status) ? 4 : 2, falhou = /Falhou|Cancelada/.test(e.status);
      v.ex = { fases: ['Solicitada', 'Aprovada', 'Em execução', 'Concluída'].map((label, i) => { const done = i < fx || fx === 4, atual = i === fx && fx < 4, err = atual && falhou;
          return { label, done: done || atual ? 'true' : 'false', st: err ? 'erro' : done ? 'done' : atual ? 'now' : 'todo', atual, nota: err ? e.status : atual ? (e.status === 'Pausada' ? 'Pausada' : 'Agora') : done ? 'Feito' : 'A seguir', i_check: done, i_play: atual && !err, i_x: err }; }),
        logsTl: (e.logs || []).map(l => { const m = String(l).match(/^(\d{1,2}:\d{2})\s+(.*)$/); return m ? { hora: m[1], texto: m[2] } : { hora: '', texto: l }; }),
        id: e.id, titulo: e.titulo, status: e.status, cor: exCor(e.status), credEst: e.credEst, credRes: e.credRes, credCons: e.credCons, custo: e.custo, logs: e.logs, erros: e.erros,
        temErros: e.erros.length > 0, rotuloErro: e.status === 'Concluída parcialmente' ? 'Dados parciais' : 'Erro na execução',
        resumo: [['Agente', agNome(e.agente)], ['Campanha', e.campanha], ['Workspace', ws.nome], ['Solicitante', e.solicitante], ['Horário', e.horario], ['Progresso', e.progresso + '%'], ['Registros processados', e.processados], ['Resultados válidos', e.validos], ['Integrações', e.integracoes.join(', ')], ['Aprovação', e.aprovacao]].map(x => ({ label: x[0], valor: x[1] })),
        etapas: e.plano.map((p, i) => { const feito = i < e.etapaAtual || e.status === 'Concluída'; const atual = !feito && i === e.etapaAtual && ativa; return { done: feito ? 'true' : 'false', st: feito ? 'done' : atual ? 'run' : 'todo', i_check: feito, i_run: atual, texto: p, estado: feito ? 'Concluída' : atual ? 'Em andamento' : 'Pendente', bg: feito ? 'var(--ink)' : atual ? '#F7054F' : 'var(--paper)' }; }) };
      const acs = [];
      const muda = (status, msg) => () => { this.setState({ execs: st.execs.map(x => x.id === e.id ? Object.assign({}, x, { status }) : x) }); this.avisar('exec', msg); };
      if (can('exec.control') && (ativa || e.status === 'Na fila' || e.status === 'Agendada')) acs.push({ label: 'Pausar', borda: 'var(--ink)', cor: 'var(--ink)', fn: () => this.confirmar('Pausar execução?', 'O trabalho para na etapa atual. Créditos reservados continuam reservados até retomar ou cancelar.', 'Pausar', muda('Pausada', 'Execução pausada.')) });
      if (can('exec.control') && e.status === 'Pausada') acs.push({ label: 'Retomar', borda: 'var(--ink)', cor: 'var(--ink)', fn: muda('Em execução', 'Execução retomada.') });
      if (can('exec.control') && ['Concluída','Falhou','Cancelada','Concluída parcialmente'].indexOf(e.status) >= 0) acs.push({ label: 'Repetir', borda: 'var(--ink)', cor: 'var(--ink)', fn: () => this.confirmar('Repetir execução?', 'Uma nova execução é criada com o mesmo input. Estimativa: ' + e.credEst + ' créditos.', 'Repetir', () => this.avisar('exec', 'Nova execução criada na fila.')) });
      if (can('exec.export')) acs.push({ label: 'Exportar', borda: 'var(--steel)', cor: 'var(--ink)', fn: () => this.avisar('exec', 'Exportação gerada: ' + e.validos + ' resultados válidos (CSV).') });
      if (can('exec.control') && ['Concluída','Falhou','Cancelada'].indexOf(e.status) < 0) acs.push({ label: 'Cancelar', borda: 'var(--err)', cor: 'var(--err)', fn: () => this.confirmar('Cancelar execução?', 'Esta ação não pode ser desfeita. Créditos não consumidos são liberados.', 'Cancelar execução', muda('Cancelada', 'Execução cancelada. Créditos não consumidos foram liberados.')) });
      v.exAcoes = acs;
    }

    // APROVAÇÕES
    const apBase = vazio ? [] : st.aprov;
    const tipos = ['Todos'].concat(apBase.map(x => x.tipo).filter((t, i, arr) => arr.indexOf(t) === i));
    v.apFiltros = tipos.map(t => { const ativo = st.apFiltro === t; return { label: t, ativo: ativo ? 'true' : 'false', bg: ativo ? 'var(--ink)' : 'var(--paper)', cor: ativo ? 'var(--paper)' : 'var(--ink)', borda: ativo ? 'var(--ink)' : 'var(--rule)', ir: () => this.setState({ apFiltro: t }) }; });
    const apF = apBase.filter(x => st.apFiltro === 'Todos' || x.tipo === st.apFiltro);
    const decCor = d => d === 'Aprovada' ? C.ok : d === 'Rejeitada' ? C.erro : d ? C.aviso : 'var(--graphite)';
    const sel = apF.find(x => x.id === st.apSel) || apF[0];
    v.apPendentes = pendentes.length;
    v.aprov = apF.map(x => ({ tipo: x.tipo, titulo: x.titulo, solicitante: x.solicitante, prazo: x.prazo, decisao: st.decisoes[x.id] || 'Pendente', corDecisao: decCor(st.decisoes[x.id]), sel: sel && sel.id === x.id ? 'true' : 'false', bg: sel && sel.id === x.id ? 'var(--mist)' : 'var(--paper)', barra: sel && sel.id === x.id ? '#F7054F' : 'transparent', abrir: () => this.setState({ apSel: x.id, ajusteAberto: false, ajusteErro: false, ajusteTexto: '' }) }));
    v.apVazio = apF.length === 0; v.apTem = !v.apVazio;
    if (sel) {
      const dec = st.decisoes[sel.id];
      v.apSel = Object.assign({}, sel, { agenteNome: agNome(sel.agente), creditos: sel.creditos ? sel.creditos.toLocaleString('pt-BR') : 'Sem consumo', decidida: !!dec, decisao: dec || '', corDecisao: decCor(dec), podeDecidir: can('approvals.decide') && !dec && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')), semAlcada: can('approvals.decide') && !dec && /Orçamento|acima de limite/i.test(sel.tipo) && !can('approvals.spend'),
        histTl: (sel.historico || []).map(l => { const m = String(l).match(/^(\d{1,2}:\d{2})\s+(.*)$/); return m ? { hora: m[1], texto: m[2] } : { hora: '', texto: l }; }),
        fasesAp: (sel.historico || []).map(l => { const t = String(l), i = t.indexOf(' '); return { quando: t.slice(0, i), label: t.slice(i + 1), det: '', done: 'true', st: 'done' }; }).concat([
          { quando: dec ? 'Agora' : 'Pendente', label: dec ? dec : (can('approvals.decide') && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')) ? 'Sua decisão' : 'Decisão do C-level'), det: dec ? 'Registrada por ' + U.usuario : 'Prazo: ' + (sel.prazo || '—'), done: dec ? 'true' : 'false', st: dec ? 'done' : 'now' }]) });
      const decidir = d => { this.setState({ decisoes: Object.assign({}, st.decisoes, { [sel.id]: d }), ajusteAberto: false, ajusteTexto: '', ajusteErro: false }); this.D.approvalService.decide(sel.id, d); };
      v.aprovar = () => sel.creditos > 1000 ? this.confirmar('Aprovar reserva de ' + v.apSel.creditos + ' créditos?', 'A execução reserva até ' + v.apSel.creditos + ' créditos do saldo do ciclo antes de começar.', 'Aprovar', () => decidir('Aprovada')) : decidir('Aprovada');
      v.rotuloAjuste = st.ajusteAberto ? 'Enviar ajustes' : 'Solicitar ajustes';
      v.pedirAjuste = () => { if (!st.ajusteAberto) return this.setState({ ajusteAberto: true }); if (!st.ajusteTexto.trim()) return this.setState({ ajusteErro: true }); decidir('Ajustes solicitados'); };
      v.rejeitar = () => this.confirmar('Rejeitar "' + sel.titulo + '"?', 'O solicitante e o agente são avisados. O item sai da fila de aprovação.', 'Rejeitar', () => decidir('Rejeitada'));
    } else { v.apSel = { historico: [], histTl: [], fasesAp: [] }; }
    v.ajusteAberto = st.ajusteAberto; v.ajusteTexto = st.ajusteTexto; v.ajusteErro = st.ajusteErro; v.mudarAjuste = ev => this.setState({ ajusteTexto: ev.target.value, ajusteErro: false });

    // COPILOTO
    const et = st.copEtapa, bdrFluxo = !can('approvals.decide') && !can('agents.configure');
    v.copAberto = st.cop; v.fecharCopiloto = () => { clearTimeout(this._tc); this.copGuardarAtual(); this.setState({ cop: false }); };
    {
      const vwAtual = window.innerWidth, cheia = st.copW === 'cheia', larg = cheia ? vwAtual : Math.min(vwAtual, +st.copW || 440);
      const largo = !lay.mobile && larg >= 760, histAberto = st.copHistAberto === undefined ? largo : !!st.copHistAberto;
      const hist = this.copHist(), q = (st.copHistBusca || '').trim().toLowerCase();
      const statusDe = e => e >= 10 ? ['Concluída', 'var(--ok)'] : e === 7 ? ['Aguardando aprovação', 'var(--warn)'] : e === 0 ? ['Rascunho', 'var(--neutral)'] : ['Em andamento', 'var(--signal)'];
      const abrirSessao = h => () => { clearTimeout(this._tc); this.copGuardarAtual();
        this.setState({ copSessao: h.id, copPedido: h.pedido, copTexto: '', copEtapa: h.etapa, copPct: h.etapa >= 9 ? 100 : 0, copHistAberto: largo ? histAberto : false }); };
      const GR = ['Hoje', 'Ontem', 'Últimos 7 dias', 'Anteriores'];
      const vis = hist.filter(h => !q || (h.titulo + ' ' + h.pedido).toLowerCase().indexOf(q) >= 0);
      v.cop = { w: lay.mobile ? '100vw' : cheia ? '100vw' : larg + 'px', podeRedimensionar: !lay.mobile, cheia, naoCheia: !cheia, telaRotulo: cheia ? 'Voltar ao tamanho lateral' : 'Tela inteira',
        veu: cheia ? '0' : '1', arrastando: st.copArrastando ? 'true' : 'false', pct: Math.round(larg / vwAtual * 100),
        histAberto: histAberto ? 'true' : 'false', histVisivel: histAberto, histSobreposto: largo ? 'false' : 'true',
        alternarHist: () => this.setState({ copHistAberto: !histAberto }),
        histBusca: st.copHistBusca || '', mudarHistBusca: ev => this.setState({ copHistBusca: ev.target.value }), histVazio: vis.length === 0,
        tituloAtual: (hist.find(h => h.id === st.copSessao) || {}).titulo || (st.copEtapa > 0 ? st.copPedido : 'Nova conversa'),
        nova: () => { clearTimeout(this._tc); this.copGuardarAtual(); this.setState({ copSessao: null, copEtapa: 0, copPct: 0, copTexto: '', copHistAberto: largo ? histAberto : false }); },
        alternarTela: () => { const novo = cheia ? 440 : 'cheia'; this.setState({ copW: novo }); try { localStorage.setItem('althius-cop-w', String(novo)); } catch (e) {} },
        iniciarArraste: e => this.copArrastar(e),
        teclaAlca: e => { const k = e.key; if (k === 'ArrowLeft') { e.preventDefault(); this.copDefinirLargura(larg + 40, true); } else if (k === 'ArrowRight') { e.preventDefault(); this.copDefinirLargura(larg - 40, true); }
          else if (k === 'Home') { e.preventDefault(); this.copDefinirLargura(vwAtual, true); } else if (k === 'End') { e.preventDefault(); this.copDefinirLargura(440, true); } },
        grupos: GR.map(g => ({ nome: g, itens: vis.filter(h => h.grupo === g).map(h => { const e = h.id === st.copSessao ? st.copEtapa : h.etapa, s = statusDe(e);
          return { titulo: h.titulo, quando: h.quando, status: s[0], cor: s[1], atual: h.id === st.copSessao ? 'true' : 'false', abrir: abrirSessao(h),
            apagar: () => { const resto = this.copHist().filter(x => x.id !== h.id); this.salvarHist(resto); if (h.id === this.state.copSessao) { clearTimeout(this._tc); this.setState({ copSessao: null, copEtapa: 0 }); } } }; }) })).filter(g => g.itens.length) };
    }
    v.copInicio = et === 0; v.copAndamento = et > 0; v.copTexto = st.copTexto; v.copPct = st.copPct + '%';
    v.mudarCop = ev => this.setState({ copTexto: ev.target.value });
    const iniciar = t => { const tx = (t || '').trim(); if (!tx) return; clearTimeout(this._tc); this.copGuardarAtual(); const id = 'c' + Date.now(), agora = this.hora();
      this.salvarHist([{ id, titulo: tx.length > 60 ? tx.slice(0, 58) + '…' : tx, pedido: tx, grupo: 'Hoje', quando: agora, etapa: 1 }].concat(this.copHist()));
      this.setState({ copSessao: id, copPedido: tx, copTexto: '', copEtapa: 1, copPct: 0 }); setTimeout(() => this.copAvancar(), 0); };
    v.copEnviar = () => iniciar(st.copTexto);
    v.teclaCop = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); iniciar(this.state.copTexto); } };
    v.exemplos = EXEMPLOS.map(t => ({ texto: t, usar: () => iniciar(t) }));
    v.copAprovar = () => this.confirmar('Aprovar e executar?', 'Serão reservados até 2.000 créditos. Nenhum registro é gravado no CRM sem uma segunda confirmação.', 'Aprovar e executar', () => this.copExecutar());
    v.copReiniciar = () => { clearTimeout(this._tc); this.setState({ copEtapa: 0, copTexto: st.copPedido, copSessao: null }); };
    const integCop = verForn ? ['HubSpot (leitura)', 'Apify', 'ReceitaWS'] : ['CRM (leitura)', 'Dados de prospecção', 'Dados cadastrais'];
    const conteudo = [
      { texto: st.copPedido },
      { texto: 'Gerar uma lista de contas dentro do ICP vigente com sinal de compra recente, pronta para a cadência T1–T7.' },
      { lista: ['Buscar empresas por segmento e região', 'Cruzar com sinais de expansão e importação', 'Pontuar fit com o ICP v4', 'Mapear decisores das 50 contas com maior fit'] },
      { lista: ['Agente Comercial', 'Agente de Copy'] },
      { lista: integCop },
      bdrFluxo ? { texto: 'Estimativa enviada ao estrategista responsável.' } : { lista: ['Estimativa: 1.800 créditos', 'Reserva máxima: 2.000 créditos', 'Saldo após a reserva: 5.950 créditos'] },
      bdrFluxo ? { texto: 'Pedido enviado para aprovação do estrategista. Você é avisado quando a execução começar.' } : { aprovacao: et === 7, texto: et > 7 ? 'Aprovado por ' + U.usuario + '.' : '' },
      { barra: true, texto: et > 8 ? '1.204 empresas processadas.' : 'Processando…' },
      { lista: ['512 contas com fit acima de 70', '48 decisores mapeados', '1.150 créditos consumidos · 850 liberados'] },
      { lista: ['Revisar a lista na Central de Aprovações', 'Aprovar a entrada na cadência T1–T7', 'Atualizar o CRM após sua confirmação'] }
    ];
    const limiteEtapa = bdrFluxo ? Math.min(et, 7) : et;
    v.copPedidoTxt = st.copPedido;
    v.copEtapas = ETAPAS.slice(0, bdrFluxo ? 7 : 10).map((label, i) => {
      const n = i + 1, feito = n < limiteEtapa || (bdrFluxo && n === 7 && et >= 7), atual = n === limiteEtapa && !feito, alc = n <= limiteEtapa;
      const c = alc ? conteudo[i] : {};
      const rodando = atual && !c.aprovacao && et < 10 && !(bdrFluxo && n === 7);
      return { n, label, rodando, feito, doneAttr: feito ? 'true' : 'false', st: feito ? 'done' : rodando ? 'run' : alc ? 'wait' : 'todo', mostraN: !rodando && !feito, borda: alc ? 'var(--ink)' : 'var(--steel)', bg: feito ? 'var(--ink)' : 'var(--paper)', cor: feito ? 'var(--paper)' : alc ? 'var(--ink)' : 'var(--muted)', corTitulo: alc ? 'var(--ink)' : 'var(--muted)',
        temTexto: !!c.texto && i > 0, texto: c.texto || '', temLista: !!c.lista, lista: c.lista || [], temBarra: !!c.barra && et === 8, aprovacao: !!c.aprovacao && atual };
    });

    // PALETA
    const q2 = st.paletaQ.trim().toLowerCase();
    const itens = [];
    nav.forEach(s => s.itens.forEach(it => itens.push({ label: it.label, grupo: 'Ir para', run: () => { this.setState({ paleta: false }); location.hash = it.href; } })));
    agentesVis.forEach(x => itens.push({ label: x.nome, grupo: 'Agente', run: () => { this.setState({ paleta: false }); this.ir(appPath('agents/' + x.id)); } }));
    if (can('copilot')) itens.push({ label: 'Abrir copiloto', grupo: 'Ação', run: () => { this.setState({ paleta: false }); this.abrirCop(''); } });
    Object.keys(D.ROLES).forEach(k => itens.push({ label: 'Ver como ' + D.ROLES[k].label, grupo: 'Demonstração', run: () => this.setState({ paleta: false, role: k, agTab: 'todos', apSel: null }) }));
    const lista = itens.filter(it => !q2 || it.label.toLowerCase().indexOf(q2) >= 0).slice(0, 12);
    this._lista = lista;
    const idx = Math.min(st.paletaIdx, Math.max(lista.length - 1, 0));
    v.paletaAberta = st.paleta; v.paletaQ = st.paletaQ; v.paletaVazia = lista.length === 0;
    v.paleta = lista.map((it, i) => ({ label: it.label, grupo: it.grupo, run: it.run, ativo: i === idx ? 'true' : 'false', bg: i === idx ? 'var(--ink)' : 'var(--paper)', cor: i === idx ? 'var(--paper)' : 'var(--ink)' }));
    v.mudarPaleta = ev => this.setState({ paletaQ: ev.target.value, paletaIdx: 0 });
    v.abrirPaleta = () => { this.setState({ paleta: true, paletaQ: '', paletaIdx: 0 }); setTimeout(() => this._pal && this._pal.focus(), 30); };
    v.fecharPaleta = () => this.setState({ paleta: false });
    v.refPaleta = el => { this._pal = el; };

    // CONFIRMAÇÃO
    v.confirmAberto = !!st.confirm; v.confirm = st.confirm || { titulo: '', texto: '', rotulo: '' };
    v.confirmCancelar = () => this.setState({ confirm: null });
    v.confirmOk = () => { const f = st.confirm && st.confirm.acao; this.setState({ confirm: null }); if (f) f(); };
    return v;
  }
}


AlthiusLogic.prototype.render = function () {
  return renderTemplate({ ...this.props, ...(this.renderVals() || {}) });
};
