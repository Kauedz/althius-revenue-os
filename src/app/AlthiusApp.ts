// Front v18 ligado ao banco. Herda toda a tela e a lógica do protótipo (arquivos gerados)
// e sobrescreve só o que vem do banco. Novas versões do design entram por `npm run v18:sync`
// sem apagar esta camada (ADR 0020).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlthiusLogic } from '../v18/logic.generated.js';
import { PAPEL_FRONT, sigla, type DadosAlthius, type PapelBanco, type PapelFront } from './dados';
import { controlarExecucao, listarExecucoes } from './servicos/execucoes';
import { comprarCreditos, lerCreditos, salvarPoliticaCreditos as gravarPoliticaCreditos } from './servicos/creditos';
import { precoEmReais } from './precos';
import { decidirAprovacao, listarAprovacoes, type AprovacaoTela, type DecisaoTela } from './servicos/aprovacoes';
import { listarEquipe, convidarEquipe, mudarPapelEquipe, suspenderMembroEquipe, cancelarConviteEquipe, type Equipe } from './servicos/equipe';
import {
  listarContas,
  criarConta,
  editarConta,
  importarContas,
  type ContaTela,
  type NovaContaInput,
  type EditarContaInput,
  type ContaImportacaoItem,
  type ResultadoImportacao
} from './servicos/contas';
import { obterResumoHome, type HomeResumoTela } from './servicos/inicio';
import { listarAgentes, pausarAgente, salvarCapacidades, type AgenteBase, type AgenteTela } from './servicos/agentes';
import { alterarSenha, lerMinhaConta, removerFoto, sairDosOutrosDispositivos, salvarMinhaConta, salvarPreferencias, trocarFoto } from './servicos/conta';
import { decidirAprendizado, lerPlaybooks, listarSugestoes, publicarPlaybook } from './servicos/aprendizados';
import { excluirContatoDoCrm, listarCaixa, marcarLida, minhasConexoes, pedirSugestaoDeResposta, type CaixaTela, type ConexoesTela } from './servicos/caixa';
import * as admin from './servicos/admin';
import { listarNotificacoes, marcarNotificacoesComoLidas, type NotificacaoTupla } from './servicos/notificacoes';
import { listarRelatorios, relatorioSemDados, type RelatoriosTela } from './servicos/relatorios';
import { listarSinais, sinaisSemDados, type SinaisTela } from './servicos/sinais';
import { listarProspeccao, prospeccaoSemDados, type ProspeccaoTela } from './servicos/prospeccao';

export interface AlthiusAppProps {
  dados: DadosAlthius;
  supabase: SupabaseClient;
  aoSair: () => void;
}

export class AlthiusApp extends AlthiusLogic<AlthiusAppProps> {
  constructor(props: AlthiusAppProps) {
    super(props);
    const relatoriosReais = relatorioSemDados();
    const sinaisReais = sinaisSemDados();
    const prospeccaoReais = prospeccaoSemDados();
    this.state = { ...this.state, relatoriosReais, sinaisReais, prospeccaoReais };
    this.publicarRelatorios(relatoriosReais);
    this.publicarSinais(sinaisReais);
    this.publicarProspeccao(prospeccaoReais);
  }

  // Fora da demonstração não existe troca de papel: o papel vem do banco.
  modoDemo = false;
  // Métodos herdados do protótipo, usados só pela camada real.
  declare avisar: (contexto: string, texto: string) => void;
  declare avisarCfg: (texto: string) => void;
  declare PAPEL_INFO: Record<PapelFront, { nome: string; cor: string }>;
  declare ir: (caminho: string) => void;
  declare confirmar: (titulo: string, texto: string, botao: string, fn: () => void) => void;

  componentDidMount() {
    // Os "services" do protótipo são o ponto de troca: as telas chamam list/decide sem saber de onde vêm os dados.
    this.props.dados.approvalService = {
      list: () => this.carregarAprovacoes(),
      decide: (id: string, decisao: DecisaoTela) => this.registrarDecisao(id, decisao)
    };
    this.props.dados.executionService = {
      list: () => this.carregarExecucoes(),
      control: (id: string, estado: string) => this.registrarControle(id, estado),
      repeat: (id: string) => this.registrarControle(id, 'Repetir')
    };
    this.props.dados.accountService = {
      list: () => this.carregarContas(),
      create: (dados: NovaContaInput) => this.criarNovaConta(dados),
      update: (dados: EditarContaInput) => this.atualizarConta(dados),
      import: (contas: ContaImportacaoItem[]) => this.importarListaContas(contas)
    };
    this.props.dados.agentService = {
      list: () => this.carregarAgentes(),
      get: (id: string) => this.carregarAgentes().then(lista => lista.find(a => a.id === id) || null)
    };
    this.props.dados.homeService = {
      summary: () => this.carregarHome()
    };
    this.props.dados.notificationService = {
      list: () => this.carregarNotificacoes()
    };
    super.componentDidMount?.();
    void this.carregarMinhaConta();
    this.publicarCaixa(null);
    this.registrarTelasAdmin();
  }

  private cargaWorkspace = 0;
  private vivo = true;

  componentDidUpdate(prevProps: Readonly<AlthiusAppProps>, prevState: Readonly<Record<string, any>>) {
    super.componentDidUpdate?.(prevProps, prevState);
    this.carregarPaginaSobDemanda(prevState);
    if (prevState.rota?.ws !== this.state.rota?.ws) {
      this.cargaWorkspace++;
      if (this.state.pronto) void this.recarregarWorkspace();
    }
    if (this.equipeAberta() && (!this.equipeAberta(prevState) || prevState.cfgWs !== this.state.cfgWs || prevState.rota?.ws !== this.state.rota?.ws)) {
      void this.carregarEquipeWs(this.workspaceEquipeSelecionado());
    } else if (!this.equipeAberta() && this.equipeAberta(prevState)) this.cargaEquipe++;
  }

  componentWillUnmount() {
    this.vivo = false;
    this.cargaEquipe++;
    this.cargaWorkspace++;
    this.publicarContas([]);
    this.publicarRelatorios(relatorioSemDados());
    this.publicarSinais(sinaisSemDados());
    this.publicarProspeccao(prospeccaoSemDados());
    this.publicarAprendizados({}, {});
    this.publicarCaixa(null);
    super.componentWillUnmount?.();
  }

  async carregarDadosIniciais() {
    // A carga inicial e as trocas compartilham a mesma geração: uma resposta antiga nunca substitui a atual.
    while (this.vivo) {
      const carga = ++this.cargaWorkspace;
      try {
        const D = this.props.dados;
        const [home, agents, execs, aprov, notifs, creditos, contas, relatorios, sinais, prospeccao] = await Promise.all([
          D.homeService.summary(), D.agentService.list(), this.carregarExecucoes(), this.carregarAprovacoes(), D.notificationService.list(), this.carregarCreditos(), this.carregarContas(), this.carregarRelatorios(), this.carregarSinais(), this.carregarProspeccao()
        ]);
        if (!this.vivo) return;
        if (carga !== this.cargaWorkspace) continue;
        this.publicarContas(contas);
        this.publicarRelatorios(relatorios);
        this.publicarSinais(sinais);
        this.publicarProspeccao(prospeccao);
        this.setState({ home, agents, execs, aprov, notifs, contas, relatoriosReais: relatorios, sinaisReais: sinais, prospeccaoReais: prospeccao, ...creditos, pronto: true, carregandoRota: false });
        return;
      } catch (falha) {
        if (!this.vivo) return;
        if (carga !== this.cargaWorkspace) continue;
        this.setState({ falhaCarga: true, pronto: true, carregandoRota: false });
        this.avisarFalha('Não foi possível carregar este workspace', falha);
        return;
      }
    }
  }

  async recarregarWorkspace() {
    const carga = ++this.cargaWorkspace;
    const relatoriosVazios = relatorioSemDados();
    const sinaisVazios = sinaisSemDados();
    const prospeccaoVazios = prospeccaoSemDados();
    this.publicarContas([]);
    this.publicarRelatorios(relatoriosVazios);
    this.publicarSinais(sinaisVazios);
    this.publicarProspeccao(prospeccaoVazios);
    this.setState({ aprov: [], execs: [], contas: [], relatoriosReais: relatoriosVazios, sinaisReais: sinaisVazios, prospeccaoReais: prospeccaoVazios, decisoes: {}, apSel: null, falhaCarga: false, carregandoRota: true });
    try {
      const [aprov, execs, creditos, contas, home, notifs, agents, relatorios, sinais, prospeccao] = await Promise.all([this.carregarAprovacoes(), this.carregarExecucoes(), this.carregarCreditos(), this.carregarContas(), this.carregarHome(), this.carregarNotificacoes(), this.carregarAgentes(), this.carregarRelatorios(), this.carregarSinais(), this.carregarProspeccao()]);
      if (this.vivo && carga === this.cargaWorkspace) {
        this.publicarContas(contas);
        this.publicarRelatorios(relatorios);
        this.publicarSinais(sinais);
        this.publicarProspeccao(prospeccao);
        this.setState({ aprov, execs, contas, home, notifs, agents, relatoriosReais: relatorios, sinaisReais: sinais, prospeccaoReais: prospeccao, ...creditos, carregandoRota: false });
        return carga;
      }
    } catch (falha) {
      if (this.vivo && carga === this.cargaWorkspace) {
        this.setState({ falhaCarga: true, carregandoRota: false });
        this.avisarFalha('Não foi possível carregar este workspace', falha);
      }
    }
  }

  /** Papel da pessoa num workspace (o papel vale por workspace). */
  papelEm(ws: string) {
    return this.props.dados.papelNoWorkspace(ws);
  }

  papel() {
    return this.papelEm(this.wsId());
  }

  /**
   * Workspaces que aparecem no seletor. Só troca de workspace quem tem `ws.switch`
   * no papel daquele workspace (superadmin e estrategista); C-level e BDR ficam no workspace aberto.
   */
  wsPermitidos() {
    const { WORKSPACES, PERMS } = this.props.dados;
    const podeTrocar = (slug: string) => (PERMS[this.papelEm(slug)] || []).includes('ws.switch');
    const naRota = (this.state.rota || {}).ws;
    const atual = WORKSPACES.find(w => w.id === naRota) || WORKSPACES[0];
    return WORKSPACES.filter(w => w === atual || podeTrocar(w.id));
  }

  membros(ws: string) {
    if (Object.hasOwn(this.state.equipes || {}, ws)) return (this.equipeAtual(ws)?.membros || []).filter(m => m.status !== 'suspended').map(m => this.membroNaTela(m, ws));
    return (this.state.membros || {})[ws] || this.props.dados.membros[ws] || [];
  }

  /** Logo do workspace: o que está no banco tem prioridade sobre a busca pelo site. */
  wsLogo(w: { id: string; nome: string }) {
    const salvo = this.props.dados.WORKSPACES.find(x => x.id === w.id)?.logoUrl;
    if (salvo && !(this.state.wsMarca || {})[w.id]) return { tem: true, src: salvo, erro: () => {}, load: () => {} };
    return super.wsLogo(w);
  }

  renderVals() {
    // O template lê modoDemo (regra de produto) para esconder a troca de papel.
    const base = super.renderVals();
    if (base?.rl?.ativo && this.modoDemo === false) this.aplicarRelatoriosNaTela(base);
    if (base?.sigCat?.ativo && this.modoDemo === false) this.aplicarSinaisNaTela(base);
    const stNotifs = (this.state.notifs as any[]) || [];
    const naoLidas = stNotifs.filter(n => (n[4] !== undefined ? !n[4] : !this.state.notifLidas)).length;
    const temNaoLidas = !this.state.notifLidas && naoLidas > 0;
    const notifResumo = !temNaoLidas ? 'Tudo lido' : (naoLidas === 1 ? '1 não lida' : `${naoLidas} não lidas`);

    const notifs = (base.notifs || []).map((item: any, idx: number) => {
      const original = stNotifs[idx];
      const lida = original && original[4] !== undefined ? original[4] : this.state.notifLidas;
      return {
        ...item,
        ponto: !lida && !this.state.notifLidas ? 'var(--signal)' : 'transparent'
      };
    });

    const v = {
      ...base,
      modoDemo: this.modoDemo,
      sair: () => this.props.aoSair(),
      recarregar: () => this.recarregarWorkspace(),
      temNaoLidas,
      notifResumo,
      notifs,
      marcarLidas: () => this.marcarNotificacoesLidas()
    };
    this.valoresEquipe(v);
    this.formularioNovoCliente(v);
    return v;
  }


  carregarCreditos() {
    const ws = this.workspaceAtual();
    if (!ws) return Promise.resolve({ extrato: [], saldoCreditos: 0, credCfg: { modo: 'auto' as const, teto: 500, limite: 5000, recarga: false } });
    return lerCreditos(this.props.supabase, ws.uuid).then(c => ({ extrato: c.extrato, saldoCreditos: c.disponivel, credCfg: c.politica }));
  }

  comprarOuPedirCreditos(quantidade: number) {
    const pode = (this.props.dados.PERMS[this.papel()] || []).includes('credits.buy');
    const preco = precoEmReais(quantidade);
    const nf = (n: number) => Math.round(n).toLocaleString('pt-BR');
    const pessoas = this.membros(this.wsId()) as Array<{ papel: string; dono?: boolean; nome: string }>;
    const decisor = (pessoas.find(m => m.papel === 'cliente' && m.dono) || pessoas.find(m => m.papel === 'cliente') || { nome: 'o C-level' }).nome;
    this.confirmar(
      pode ? 'Comprar ' + nf(quantidade) + ' créditos por ' + preco + '?' : 'Pedir ' + nf(quantidade) + ' créditos?',
      pode ? 'A cobrança vai no método de pagamento do workspace e os créditos entram na hora.' : decisor + ' recebe o pedido em Aprovações e decide a compra de ' + preco + '.',
      pode ? 'Comprar' : 'Enviar pedido',
      () => { void this.registrarCompra(quantidade, pode, nf, decisor); }
    );
  }

  async registrarCompra(quantidade: number, pode: boolean, nf: (n: number) => string, decisor: string) {
    const ws = this.workspaceAtual();
    const slug = this.wsId();
    try {
      if (!ws?.membroId) throw new Error('Você não participa deste workspace como membro.');
      const r = await comprarCreditos(this.props.supabase, ws.uuid, ws.membroId, quantidade);
      if (!this.vivo || this.wsId() !== slug) return;
      await this.recarregarWorkspace();
      if (!this.vivo || this.wsId() !== slug) return;
      this.avisar('mod', r.status === 'requires_approval' ? 'Pedido enviado para ' + decisor + '.' : nf(quantidade) + ' créditos adicionados.');
    } catch (falha) {
      this.avisarFalha(pode ? 'Compra não registrada' : 'Pedido não registrado', falha);
    }
  }

  async salvarPoliticaCreditos(parcial: { modo?: 'auto' | 'aprovacao'; teto?: number; limite?: number; recarga?: boolean }) {
    const ws = this.workspaceAtual();
    const atual = this.credCfg() as { modo: 'auto' | 'aprovacao'; teto: number; limite: number; recarga: boolean };
    try {
      if (!ws?.membroId) throw new Error('Você não participa deste workspace como membro.');
      await gravarPoliticaCreditos(this.props.supabase, ws.uuid, ws.membroId, { ...atual, ...parcial });
      if (!this.vivo) return;
      await this.recarregarWorkspace();
      this.avisar('mod', 'Regras de créditos atualizadas.');
    } catch (falha) {
      this.avisarFalha('Regras não atualizadas', falha);
    }
  }

  carregarExecucoes() {
    const ws = this.workspaceAtual();
    const custo = (this.props.dados.PERMS[this.papel()] || []).includes('exec.cost');
    return ws ? listarExecucoes(this.props.supabase, ws.uuid, custo) : Promise.resolve([]);
  }

  async registrarControle(id: string, estado: string) {
    const acoes = { Pausada: 'pause', 'Na fila': 'resume', 'Em execução': 'resume', Cancelada: 'cancel', Repetir: 'repeat' } as const;
    const acao = acoes[estado as keyof typeof acoes];
    const ws = this.workspaceAtual(), slug = this.wsId();
    try {
      if (!ws?.membroId || !acao) throw new Error('Você não participa deste workspace como membro.');
      const r = await controlarExecucao(this.props.supabase, id, ws.membroId, acao);
      if (!this.vivo || this.wsId() !== slug) return;
      const carga = await this.recarregarWorkspace();
      if (!this.vivo || this.wsId() !== slug || carga !== this.cargaWorkspace) return;
      if (r.status === 'requires_approval') this.avisar('exec', 'Pedido enviado para Aprovações.');
      else {
        if (acao === 'repeat' && r.execution_id) this.ir('app/' + slug + '/executions/' + r.execution_id);
        this.avisar('exec', 'Mudança registrada no banco.');
      }
    } catch (falha) {
      this.avisarFalha('Controle não registrado', falha);
    }
  }

  // ---------------------------------------------------------------- Aprovações

  private workspaceAtual() {
    return this.props.dados.workspaceNoBanco(this.wsId());
  }

  carregarAprovacoes(): Promise<AprovacaoTela[]> {
    const ws = this.workspaceAtual();
    return ws ? listarAprovacoes(this.props.supabase, ws.uuid) : Promise.resolve([]);
  }

  /**
   * A tela marca a decisão na hora; aqui ela é gravada no banco. Se o banco recusar
   * (alçada de gasto, conteúdo alterado, já decidida), a marcação é desfeita e o motivo aparece.
   */
  async registrarDecisao(id: string, decisao: DecisaoTela) {
    const notas = decisao === 'Ajustes solicitados' ? this.state.ajusteTexto : undefined;
    const aprovacao = (this.state.aprov || []).find((a: AprovacaoTela) => a.id === id);
    const ws = this.workspaceAtual();
    const resultado = !aprovacao || !ws?.membroId
      ? { ok: false as const, mensagem: 'Você não participa deste workspace como membro, então não pode decidir aqui.' }
      : await decidirAprovacao(this.props.supabase, { aprovacao, membroId: ws.membroId, decisao, notas });
    if (resultado.ok) return;
    const { [id]: _desfeita, ...decisoes } = this.state.decisoes || {};
    this.setState({ decisoes });
    this.confirmar('Decisão não registrada', resultado.mensagem, 'Entendi', () => {});
  }

  // ---------------------------------------------------------------- Equipe e convites

  private cargaEquipe = 0;
  private gravandoEquipe = false;
  private pedidoConvite?: { slug: string; email: string; papel: PapelBanco; chave: string };

  private equipeAberta(estado = this.state) {
    return estado.pronto && estado.rota?.page === 'settings' && estado.cfgSecao === 'Workspace e membros';
  }

  private workspaceEquipeSelecionado() {
    return this.wsPermitidos().some(w => w.id === this.state.cfgWs) ? this.state.cfgWs : this.wsId();
  }

  private podeGerirEquipe(slug: string) {
    return (this.props.dados.PERMS[this.papelEm(slug)] || []).includes('team.invite');
  }

  private equipeAtual(slug: string): Equipe | null {
    return this.state.equipes?.[slug] || null;
  }

  private membroNaTela(m: Equipe['membros'][number], slug: string) {
    const nomeWorkspace = this.props.dados.WORKSPACES.find(w => w.id === slug)?.nome || '';
    return {
      id: m.id, nome: m.nome, email: m.email, papel: PAPEL_FRONT[m.papel],
      origem: /@althius\.com\.br$/i.test(m.email) ? 'Althius' : nomeWorkspace,
      ...(m.status === 'invited' ? { pendente: true as const } : {})
    };
  }

  private async carregarEquipeWs(slug: string) {
    if (!this.vivo || !this.equipeAberta() || this.workspaceEquipeSelecionado() !== slug) return false;
    const carga = ++this.cargaEquipe;
    this.setState({ equipes: { ...this.state.equipes, [slug]: null }, equipeCarregando: slug });
    try {
      const ws = this.props.dados.workspaceNoBanco(slug);
      if (!ws?.membroId) throw new Error('Você não participa deste workspace. Tentar de novo.');
      const equipe = await listarEquipe(this.props.supabase, ws.uuid);
      if (!this.vivo || carga !== this.cargaEquipe || this.workspaceEquipeSelecionado() !== slug) return false;
      this.setState({ equipes: { ...this.state.equipes, [slug]: equipe }, equipeCarregando: null });
      return true;
    } catch (falha) {
      if (!this.vivo || carga !== this.cargaEquipe || this.workspaceEquipeSelecionado() !== slug) return false;
      this.setState({ equipeCarregando: null });
      this.erroEquipe('Equipe não carregada', falha, () => { void this.carregarEquipeWs(slug); });
      return false;
    }
  }

  private erroEquipe(titulo: string, falha: unknown, repetir: () => void) {
    console.error(falha);
    this.confirmar(titulo, falha instanceof Error ? falha.message : 'Não foi possível acessar a equipe. Tentar de novo.', 'Tentar de novo', repetir);
  }

  private async gravarEquipe(
    slug: string, acao: (ws: { uuid: string; membroId: string }) => Promise<unknown>, aviso: string
  ) {
    if (this.gravandoEquipe || !this.vivo || this.workspaceEquipeSelecionado() !== slug) return;
    const carga = this.cargaEquipe;
    this.gravandoEquipe = true;
    this.setState({ equipeGravando: true });
    try {
      const ws = this.props.dados.workspaceNoBanco(slug);
      if (!ws?.membroId || !this.podeGerirEquipe(slug)) throw new Error('Você não tem permissão para alterar a equipe deste workspace.');
      await acao({ uuid: ws.uuid, membroId: ws.membroId });
      if (!this.vivo || !this.equipeAberta() || carga !== this.cargaEquipe || this.workspaceEquipeSelecionado() !== slug) return;
      if (await this.carregarEquipeWs(slug)) this.avisarCfg(aviso);
    } catch (falha) {
      if (this.vivo && this.equipeAberta() && carga === this.cargaEquipe && this.workspaceEquipeSelecionado() === slug) {
        this.erroEquipe('Alteração da equipe não registrada', falha, () => { void this.gravarEquipe(slug, acao, aviso); });
      }
    } finally {
      this.gravandoEquipe = false;
      if (this.vivo) this.setState({ equipeGravando: false });
    }
  }

  private convidarNaEquipe(slug: string) {
    const email = String(this.state.convEmail || '').trim().toLowerCase();
    const selecionado = this.papelBanco(this.state.convPapel || 'bdr');
    const nivel = { superadmin: 4, estrategista: 3, clevel: 2, bdr: 1 };
    const ator = this.papelBanco(this.papelEm(slug)) || 'bdr';
    const papel = selecionado && nivel[selecionado] <= nivel[ator] ? selecionado : 'bdr';
    if (!papel) return;
    if (!this.pedidoConvite || this.pedidoConvite.slug !== slug || this.pedidoConvite.email !== email || this.pedidoConvite.papel !== papel) {
      this.pedidoConvite = { slug, email, papel, chave: crypto.randomUUID() };
    }
    const pedido = this.pedidoConvite;
    const carga = this.cargaEquipe;
    void this.gravarEquipe(slug, async ws => {
      await convidarEquipe(this.props.supabase, ws.uuid, ws.membroId, email, papel, pedido.chave);
      if (this.vivo && this.equipeAberta() && carga === this.cargaEquipe && this.workspaceEquipeSelecionado() === slug && this.pedidoConvite === pedido) {
        this.pedidoConvite = undefined;
        this.setState({ convEmail: '', convErro: '' });
      }
    }, 'Convite registrado. O envio de e-mail ainda está pendente.');
  }

  private papelBanco(papel: string): PapelBanco | undefined {
    return ({ superadmin: 'superadmin', estrategista: 'estrategista', cliente: 'clevel', bdr: 'bdr' } as const)[papel as PapelFront];
  }

  private valoresEquipe(v: Record<string, any>) {
    if (!v.cfgWs) return;
    const slug = this.workspaceEquipeSelecionado();
    const ws = this.props.dados.workspaceNoBanco(slug);
    const equipe = this.equipeAtual(slug);
    const nivel = { superadmin: 4, estrategista: 3, clevel: 2, bdr: 1 };
    const papelAtor = this.papelBanco(this.papelEm(slug)) || 'bdr';
    const pode = this.podeGerirEquipe(slug);
    const disponivel = !!equipe && !this.state.equipeGravando;
    const membros = equipe?.membros || [];
    const ativos = membros.filter(m => m.status === 'active').length;
    const clevels = membros.filter(m => m.status === 'active' && m.papel === 'clevel').length;
    const convites = equipe?.convites || [];
    const resumo = equipe ? ativos + ' ativos · ' + convites.length + ' convites pendentes'
      : this.state.equipeCarregando === slug ? 'Carregando equipe…' : 'Equipe indisponível';
    v.wsMetaN = resumo;
    v.ws2 = {
      ...v.ws2, resumo, dono: membros.find(m => m.status === 'active' && m.papel === 'clevel')?.nome || 'Não disponível', donoFoto: undefined,
      contagem: resumo, podeConvidar: pode && disponivel, semPermissao: !pode,
      convidar: () => this.convidarNaEquipe(slug),
      teclaConvite: (e: KeyboardEvent) => { if (e.key === 'Enter') this.convidarNaEquipe(slug); },
      membros: [
        ...membros.map(m => {
          const voce = m.id === ws?.membroId;
          const ultimoClevel = m.status === 'active' && m.papel === 'clevel' && clevels === 1;
          const gerenciavel = pode && disponivel && !voce && !ultimoClevel && nivel[m.papel] <= nivel[papelAtor];
          const front = this.membroNaTela(m, slug);
          return {
            ...front, sigla: sigla(m.nome), temFoto: false, foto: '', voce,
            origem: front.origem + (m.status === 'suspended' ? ' · suspenso' : m.status === 'invited' ? ' · acesso pendente' : ''),
            papelNome: this.props.dados.ROLES[front.papel]?.label || front.papel,
            cor: this.PAPEL_INFO[front.papel].cor, pendente: false,
            editavel: gerenciavel && m.status === 'active', fixo: !(gerenciavel && m.status === 'active'),
            removivel: gerenciavel && m.status !== 'suspended', removerRotulo: 'Suspender ' + m.nome,
            mudarPapel: (e: { target: { value: string } }) => {
              const papel = this.papelBanco(e.target.value);
              if (papel) void this.gravarEquipe(slug, w => mudarPapelEquipe(this.props.supabase, w.uuid, w.membroId, m.id, papel), 'Papel atualizado no banco.');
            },
            remover: () => this.confirmar('Suspender ' + m.nome + '?', 'O acesso a este workspace será suspenso. O registro do membro e seu histórico serão preservados.', 'Suspender',
              () => { void this.gravarEquipe(slug, w => suspenderMembroEquipe(this.props.supabase, w.uuid, w.membroId, m.id), 'Acesso ao workspace suspenso.'); })
          };
        }),
        ...convites.map(c => {
          const papel = PAPEL_FRONT[c.papel];
          return {
            id: c.id, nome: c.email, email: c.email, sigla: sigla(c.email), temFoto: false, foto: '',
            origem: c.envio === 'sent' ? 'Convite registrado · e-mail enviado' : c.envio === 'failed' ? 'Convite registrado · falha no envio de e-mail' : 'Convite registrado · envio de e-mail pendente',
            papel, papelNome: this.props.dados.ROLES[papel]?.label || papel,
            cor: this.PAPEL_INFO[papel].cor, voce: false, pendente: false, editavel: false, fixo: true,
            removivel: pode && disponivel && nivel[c.papel] <= nivel[papelAtor],
            removerRotulo: 'Cancelar convite para ' + c.email,
            remover: () => this.confirmar('Cancelar convite?', 'O convite para ' + c.email + ' deixará de permitir a entrada neste workspace.', 'Cancelar convite',
              () => { void this.gravarEquipe(slug, w => cancelarConviteEquipe(this.props.supabase, w.uuid, w.membroId, c.id), 'Convite cancelado no banco.'); })
          };
        })
      ]
    };
  }

  // ---------------------------------------------------------------- Contas e leads

  carregarContas(): Promise<ContaTela[]> {
    const ws = this.workspaceAtual();
    return ws ? listarContas(this.props.supabase, ws.uuid) : Promise.resolve([]);
  }

  private publicarContas(contas: ContaTela[]) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (mod?.accounts) {
      mod.accounts.linhas = contas;
      const total = contas.length;
      const fitMedio = total ? Math.round(contas.reduce((s, c) => s + c.fit, 0) / total) : 0;
      const comDecisor = total ? Math.round((contas.filter(c => c.decisor !== 'A mapear').length / total) * 100) + '%' : '0%';
      const quentes = contas.filter(c => c.temperatura === 3).length;
      mod.accounts.kpis = [
        ['Contas qualificadas', String(total), ''],
        ['Fit médio', String(fitMedio), 'de 100'],
        ['Com decisor mapeado', comDecisor, `${contas.filter(c => c.decisor !== 'A mapear').length} contas`],
        ['Quentes', String(quentes), 'temperatura alta']
      ];
    }
    // Substitui (não mistura): contatos do workspace anterior e do protótipo não ficam na memória do navegador.
    const comites: Record<string, ContaTela['comite']> = {};
    for (const c of contas) {
      if (c.comite) {
        comites[c.id] = c.comite;
      }
    }
    (window as any).ALTHIUS_COMITES = comites;
  }

  private avisarFalha(titulo: string, falha: unknown) {
    console.error(falha);
    this.confirmar(titulo, falha instanceof Error ? falha.message : 'Verifique a conexão e tente de novo em instantes.', 'Entendi', () => {});
  }

  // ---- Início, Notificações e Contas (Antigravity)
  async criarNovaConta(dados: NovaContaInput): Promise<{ id: string; nome: string; dominio: string }> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      throw new Error('Workspace ou membro não identificado.');
    }
    const conta = await criarConta(this.props.supabase, ws.uuid, ws.membroId, dados);
    await this.recarregarWorkspace();
    return conta;
  }

  async atualizarConta(dados: EditarContaInput): Promise<{ id: string; nome: string; dominio: string }> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      throw new Error('Workspace ou membro não identificado.');
    }
    const conta = await editarConta(this.props.supabase, ws.membroId, dados);
    await this.recarregarWorkspace();
    return conta;
  }

  async importarListaContas(contas: ContaImportacaoItem[]): Promise<ResultadoImportacao> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      throw new Error('Workspace ou membro não identificado.');
    }
    const resultado = await importarContas(this.props.supabase, ws.uuid, ws.membroId, contas);
    await this.recarregarWorkspace();
    return resultado;
  }


  carregarHome(): Promise<HomeResumoTela> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      // Sem membro não há o que mostrar: nunca os números do protótipo.
      return Promise.resolve({ kpis: [], operacao: [], acoes: [], timeline: [] } as unknown as HomeResumoTela);
    }
    return obterResumoHome(this.props.supabase, ws.uuid, ws.membroId);
  }

  carregarNotificacoes(): Promise<NotificacaoTupla[]> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      return Promise.resolve([]);
    }
    return listarNotificacoes(this.props.supabase, ws.uuid, ws.membroId);
  }

  async marcarNotificacoesLidas(notificacaoId?: string): Promise<void> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      this.setState({ notifLidas: true });
      return;
    }
    try {
      await marcarNotificacoesComoLidas(this.props.supabase, ws.membroId, notificacaoId);
      const notifsAtualizadas = ((this.state.notifs as any[]) || []).map(n => {
        if (!notificacaoId || n[3] === notificacaoId) {
          return [n[0], n[1], n[2], n[3], true];
        }
        return n;
      });
      this.setState({ notifs: notifsAtualizadas, notifLidas: true });
    } catch (falha) {
      this.avisarFalha('Não foi possível marcar as notificações como lidas.', falha);
    }
  }

  // ---- Relatórios, Sinais e Prospecção (Grok)

  carregarRelatorios(): Promise<RelatoriosTela> {
    const ws = this.workspaceAtual();
    return ws ? listarRelatorios(this.props.supabase, ws.uuid) : Promise.resolve(relatorioSemDados());
  }

  /** Substitui os números fictícios da página de Relatórios pelos do banco. */
  private publicarRelatorios(relatorios: RelatoriosTela) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (!mod?.analytics) return;
    mod.analytics.kpis = relatorios.kpis.map(k => [k.label, k.valor, k.delta]);
    mod.analytics.funil = null;
    mod.analytics.linhas = relatorios.linhas;
    mod.analytics.acoesLinha = [];
  }

  /** Troca os números do protótipo pelos do banco, só na página de Relatórios. */
  private aplicarRelatoriosNaTela(v: Record<string, any>) {
    const relatorios: RelatoriosTela = this.state.relatoriosReais || relatorioSemDados();
    Object.assign(v.rl, relatorios, {
      hrefPipe: v.rl.hrefPipe, hrefSinais: v.rl.hrefSinais, hrefCad: v.rl.hrefCad, hrefCamp: v.rl.hrefCamp, hrefCred: v.rl.hrefCred
    });
    if (!v.md) return;
    v.md.kpis = relatorios.kpis;
    v.md.temKpis = relatorios.kpis.length > 0;
    v.md.temFunil = false;
    v.md.temAcao = false;
    const cols = ['nome', 'fonte', 'frequencia', 'ultimo', 'dest'] as const;
    v.md.linhas = relatorios.linhas.map(l => ({
      abrir: () => {},
      tecla: () => {},
      bg: 'transparent',
      celulas: cols.map((k, ci) => ({
        temCo: false, temFogo: false, chamas: [], fogoRotulo: '', temTexto: true, temFoto: false, foto: '',
        v: l[k] || 'Sem dados ainda', temPonto: false, ponto: 'transparent',
        fs: ci === 0 ? '15px' : '14px', cor: ci === 0 ? 'var(--ink)' : 'var(--text-2)', ws: ci === 0 ? 'normal' : 'nowrap'
      }))
    }));
    v.md.vazio = v.md.linhas.length === 0;
    v.md.tabela = v.md.linhas.length > 0;
  }

  carregarSinais(): Promise<SinaisTela> {
    const ws = this.workspaceAtual();
    return ws ? listarSinais(this.props.supabase, ws.uuid) : Promise.resolve(sinaisSemDados());
  }

  /** Substitui o catálogo e os eventos fictícios da página de Sinais pelos do banco. */
  private publicarSinais(sinais: SinaisTela) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (!mod?.signals) return;
    mod.signals.kpis = sinais.kpis.map(k => [k.label, k.valor, k.delta]);
    mod.signals.linhas = sinais.eventos;
    mod.signals.acoesLinha = [];
  }

  /** Troca o catálogo do protótipo pelo do banco, só na página de Sinais. */
  private aplicarSinaisNaTela(v: Record<string, any>) {
    const sinais: SinaisTela = this.state.sinaisReais || sinaisSemDados();
    if (!v.sigCat) return;
    const anteriores = Array.isArray(v.sigCat.grupos) ? v.sigCat.grupos : [];
    v.sigCat.resumo = sinais.resumo;
    v.sigCat.grupos = sinais.grupos.map((g, i) => {
      const antigo = g.codigo
        ? anteriores.find((a: { nome?: string; sigla?: string; href?: string }) => typeof a?.nome === 'string' && a.nome.toLowerCase().includes(g.codigo))
        : undefined;
      const href = (antigo || anteriores[i] || {}).href || '#';
      return {
        nome: antigo?.nome || g.nome,
        sigla: antigo?.sigla || g.sigla,
        href,
        ativos: g.ativos,
        itens: g.itens.map(s => ({ nome: s.nome, custo: s.custo, cor: s.ativo ? 'var(--signal)' : 'var(--steel)' }))
      };
    });
  }

  carregarProspeccao(): Promise<ProspeccaoTela> {
    const ws = this.workspaceAtual();
    return ws ? listarProspeccao(this.props.supabase, ws.uuid) : Promise.resolve(prospeccaoSemDados());
  }

  /** Substitui as listas fictícias da página de Prospecção pelas do banco. Somente leitura. */
  private publicarProspeccao(tela: ProspeccaoTela) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (!mod?.prospecting) return;
    mod.prospecting.kpis = tela.kpis.map(k => [k.label, k.valor, k.delta]);
    mod.prospecting.linhas = tela.listas;
    mod.prospecting.acoesLinha = [];
    mod.prospecting.acao = null;
  }

  // ---- Agentes (Claude)

  /** Agentes + sugestões e playbook publicado de cada um (a aba Playbook lê ALTHIUS_SUGESTOES e ALTHIUS_PLAYBOOK). */
  async carregarAgentes(): Promise<AgenteTela[]> {
    const ws = this.workspaceAtual();
    if (!ws) return [];
    const [agentes, sugestoes, playbooks] = await Promise.all([
      listarAgentes(this.props.supabase, ws.uuid, (this.props.dados.AGENTS || []) as AgenteBase[]),
      listarSugestoes(this.props.supabase, ws.uuid),
      lerPlaybooks(this.props.supabase, ws.uuid)
    ]);
    this.publicarAprendizados(sugestoes, playbooks);
    return agentes;
  }

  /** Troca os exemplos do protótipo pelo que é deste workspace (vazio quando não há). */
  private publicarAprendizados(sugestoes: Record<string, unknown[]>, playbooks: Record<string, string>) {
    if (typeof window === 'undefined') return;
    (window as any).ALTHIUS_SUGESTOES = sugestoes;
    (window as any).ALTHIUS_PLAYBOOK = playbooks;
  }

  async decidirSugestaoReal(id: string, decisao: 'aplicada' | 'descartada') {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await decidirAprendizado(this.props.supabase, ws.uuid, ws.membroId, id, decisao);
    if (!r.ok) return this.confirmar('Sugestão não registrada', r.mensagem, 'Entendi', () => {});
    if (decisao === 'descartada') await this.atualizarAgentes();
  }

  async publicarPlaybookReal(a: { id: string; nome: string }, texto: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await publicarPlaybook(this.props.supabase, ws.uuid, ws.membroId, a.id, texto);
    if (!r.ok) return this.confirmar('Playbook não publicado', r.mensagem, 'Entendi', () => {});
    // O rascunho vira a versão publicada no banco; o histórico vem de lá.
    this.setState({ pb: Object.assign({}, this.state.pb, { [a.id]: {} }) });
    await this.atualizarAgentes();
    this.avisar('agente', 'Playbook v' + r.versao + ' publicado. O ' + a.nome + ' já usa a nova versão.');
  }

  /** Botão de emergência: grava no banco; o Hermes Agent deixa de agir enquanto estiver pausado. */
  async pausarAgenteReal(a: { id: string; nome: string; estado: string }) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const pausar = a.estado !== 'pausado';
    const r = await pausarAgente(this.props.supabase, ws.uuid, ws.membroId, a.id, pausar);
    if (!r.ok) return this.confirmar(pausar ? 'Agente não pausado' : 'Agente não retomado', r.mensagem, 'Entendi', () => {});
    await this.atualizarAgentes();
    this.avisar('agente', a.nome + (pausar ? ' pausado.' : ' retomado.'));
  }

  async salvarCapacidadeReal(a: { id: string; nome: string }, capacidade: string, ligada: boolean) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await salvarCapacidades(this.props.supabase, ws.uuid, ws.membroId, a.id, { [capacidade]: ligada });
    if (!r.ok) return this.confirmar('Capacidade não alterada', r.mensagem, 'Entendi', () => {});
    await this.atualizarAgentes();
  }

  private async atualizarAgentes() {
    const carga = this.cargaWorkspace;
    try {
      const agents = await this.carregarAgentes();
      if (this.vivo && carga === this.cargaWorkspace) this.setState({ agents });
    } catch (falha) {
      if (this.vivo && carga === this.cargaWorkspace) this.avisarFalha('Não foi possível atualizar os agentes', falha);
    }
  }

  // ---- Configurações (Claude): Minha conta e Notificações

  /** Dados reais da pessoa nas Configurações (o protótipo mostrava o papel no lugar do cargo). */
  private async carregarMinhaConta() {
    try {
      const conta = await lerMinhaConta(this.props.supabase);
      if (!this.vivo) return;
      this.setState({
        perfil: { nome: conta.nome, cargo: conta.cargo, fone: conta.fone },
        minhaFoto: conta.foto,
        ops: Object.assign({}, this.state.ops, conta.preferencias)
      });
    } catch (falha) {
      // Só a tela de Configurações usa estes dados: o aviso aparece lá, sem travar o resto do app.
      console.error(falha);
      if (this.vivo) this.avisarCfg('Não foi possível carregar seus dados. Recarregue a página para tentar de novo.');
    }
  }

  private async resultadoConta(r: { ok: true } | { ok: false; mensagem: string }, sucesso: string) {
    if (!this.vivo) return false;
    this.avisarCfg(r.ok ? sucesso : r.mensagem);
    return r.ok;
  }

  async salvarMinhaContaReal() {
    const pf = (this.state.perfil || {}) as { nome?: string; cargo?: string; fone?: string };
    const r = await salvarMinhaConta(this.props.supabase, { nome: pf.nome ?? '', cargo: pf.cargo ?? '', fone: pf.fone ?? '' });
    await this.resultadoConta(r, 'Dados salvos.');
  }

  async trocarFotoReal(arquivo: File) {
    const r = await trocarFoto(this.props.supabase, arquivo);
    if (await this.resultadoConta(r, 'Foto atualizada.')) await this.carregarMinhaConta();
  }

  async removerFotoReal() {
    const r = await removerFoto(this.props.supabase);
    if (await this.resultadoConta(r, 'Foto removida.')) this.setState({ minhaFoto: '' });
  }

  async alterarSenhaReal(s: { atual?: string; nova?: string }) {
    const { data } = await this.props.supabase.auth.getUser();
    const r = await alterarSenha(this.props.supabase, data.user?.email || '', s.atual || '', s.nova || '');
    if (!this.vivo) return;
    if (r.ok) {
      this.setState({ senha: {} });
      this.avisarCfg('Senha alterada. Os outros dispositivos vão pedir login de novo.');
    } else this.setState({ senha: Object.assign({}, this.state.senha, { erro: r.mensagem }) });
  }

  async sairOutrosReal() {
    await this.resultadoConta(await sairDosOutrosDispositivos(this.props.supabase), 'Você saiu dos outros dispositivos.');
  }

  async alternarPreferenciaReal(chave: string) {
    const ops = Object.assign({}, this.state.ops, { [chave]: !(this.state.ops || {})[chave] });
    this.setState({ ops });
    const r = await salvarPreferencias(this.props.supabase, ops);
    if (!r.ok && this.vivo) {
      this.setState({ ops: Object.assign({}, ops, { [chave]: !ops[chave] }) });
      this.avisarCfg(r.mensagem);
    }
  }

  // ---- Páginas carregadas sob demanda (Claude): só buscam no banco quando a pessoa abre a página

  private carregarPaginaSobDemanda(prev: Readonly<Record<string, any>>) {
    const rota = this.state.rota || {}, antes = prev.rota || {};
    const entrou = rota.page !== antes.page || rota.ws !== antes.ws || (this.state.pronto && !prev.pronto);
    if (!entrou || !this.state.pronto) return;
    if (rota.page === 'inbox') void this.carregarCaixa();
    if (String(rota.page || '').startsWith('admin/')) void this.carregarAdmin(rota.page);
    if (rota.ws !== antes.ws || (this.state.pronto && !prev.pronto)) void this.carregarConexoes();
  }

  /** No modo real, as conexões pessoais são as da pessoa no banco (o protótipo trazia as da Camila). */
  inboxCon(): ConexoesTela {
    if (this.modoDemo !== false) return (AlthiusLogic.prototype as any).inboxCon.call(this);
    return this.state.conexoesReais || { email: null, linkedin: null, whatsapp: null, instagram: null };
  }

  private async carregarConexoes() {
    const ws = this.workspaceAtual();
    this.setState({ conexoesReais: null });
    if (!ws) return;
    try {
      const conexoesReais = await minhasConexoes(this.props.supabase, ws.uuid);
      if (this.vivo && this.workspaceAtual()?.uuid === ws.uuid) this.setState({ conexoesReais });
    } catch (falha) {
      console.error(falha);
    }
  }

  /** Ganchos das listas genéricas do v18 (scripts/v18/patches.mjs). Devolve true quando a camada do banco tratou. */
  aoAbrirLinhaReal(page: string, linha: { id: string }) {
    if (page === 'inbox') void this.abrirConversa(linha.id);
  }

  acaoDeLinhaReal(page: string, acao: string, linha: { id: string }): boolean {
    if (page === 'admin/workspaces') {
      void this.acaoNoCliente(acao, linha as { id: string; nome: string });
      return true;
    }
    if (page === 'inbox') {
      void this.acaoNaConversa(acao, linha.id);
      return true;
    }
    return false;
  }

  // ---- Caixa de entrada (Claude)

  private cargaCaixa = 0;

  private publicarCaixa(caixa: CaixaTela | null) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (!mod?.inbox) return;
    mod.inbox.kpis = caixa ? caixa.kpis : [];
    mod.inbox.linhas = caixa ? caixa.linhas : [];
    // "Criar tarefa" volta quando Tarefas estiver ligada aqui; nada de botão que não faz nada.
    mod.inbox.acoesLinha = caixa ? [
      ['Sugerir resposta', 'Pedido enviado ao Agente de Copy. A sugestão aparece em Execuções.'],
      ['Excluir contato do CRM', 'Contato excluído do CRM. A Althius parou de receber as mensagens dele.', null, true,
        '{x} sai do CRM. As mensagens dele param de entrar na Caixa de entrada na hora, e as conversas que já tinham entrado saem junto.']
    ] : [];
  }

  async carregarCaixa() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaCaixa;
    this.publicarCaixa(null);
    if (!ws) return;
    try {
      const caixa = await listarCaixa(this.props.supabase, ws.uuid);
      if (!this.vivo || carga !== this.cargaCaixa) return;
      this.publicarCaixa(caixa);
      this.setState({ caixaVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaCaixa) this.avisarFalha('Não foi possível carregar a caixa de entrada', falha);
    }
  }

  private async abrirConversa(id: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await marcarLida(this.props.supabase, ws.uuid, ws.membroId, id);
    if (r.ok) void this.carregarCaixa();
  }

  private async acaoNaConversa(acao: string, id: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    if (acao === 'Sugerir resposta') {
      const r = await pedirSugestaoDeResposta(this.props.supabase, ws.uuid, ws.membroId, id);
      if (!r.ok) return this.confirmar('Pedido não enviado', r.mensagem, 'Entendi', () => {});
      this.avisar('mod', 'Pedido enviado ao Agente de Copy. A sugestão aparece em Execuções.');
      return;
    }
    if (acao === 'Excluir contato do CRM') {
      const r = await excluirContatoDoCrm(this.props.supabase, ws.uuid, ws.membroId, id);
      if (!r.ok) return this.confirmar('Contato não excluído', r.mensagem, 'Entendi', () => {});
      this.avisar('mod', 'Contato excluído do CRM. A Althius parou de receber as mensagens dele.');
      await this.carregarCaixa();
    }
  }

  // ---- Superadmin (Claude): o v18 não desenhou estas telas; usam a lista genérica (ADR 0030)

  private static TELAS_ADMIN: Record<string, { titulo: string; sub: string; colunas: string[][]; busca?: boolean; filtro?: string }> = {
    'admin/workspaces': { titulo: 'Workspaces', sub: 'Clientes da Althius', busca: true, filtro: 'status',
      colunas: [['nome', 'Cliente', '2fr'], ['slug', 'Endereço', '1fr'], ['clevel', 'C-level', '1.4fr'], ['membros', 'Membros', '90px'], ['saldo', 'Saldo', '1.2fr'], ['status', 'Status', '1fr']] },
    'admin/usage': { titulo: 'Uso global', sub: 'Consumo de créditos por cliente no ciclo', busca: true,
      colunas: [['nome', 'Cliente', '2fr'], ['consumido', 'Consumido no ciclo', '1.4fr'], ['saldo', 'Saldo', '1.2fr'], ['execucoes', 'Execuções no mês', '1fr'], ['ultimo', 'Último uso', '1fr']] },
    'admin/providers': { titulo: 'Fornecedores', sub: 'Contas de coleta, mensagens e modelo de IA (sem chaves)', filtro: 'tipo',
      colunas: [['nome', 'Fornecedor', '1.6fr'], ['tipo', 'Tipo', '1.4fr'], ['status', 'Status', '1fr'], ['uso', 'Custo real no mês', '1.2fr'], ['detalhe', 'Detalhe', '2fr']] },
    'admin/margins': { titulo: 'Margens', sub: 'Preço em créditos de cada capacidade', busca: true,
      colunas: [['capacidade', 'Capacidade', '2fr'], ['base', 'Base', '1fr'], ['margem', 'Margem', '1fr'], ['risco', 'Risco', '1fr'], ['status', 'Status', '1fr']] },
    'admin/audit': { titulo: 'Auditoria', sub: 'O que aconteceu em todos os clientes, do mais recente', busca: true,
      colunas: [['quando', 'Quando', '1.1fr'], ['cliente', 'Cliente', '1.4fr'], ['quem', 'Quem', '1.4fr'], ['acao', 'Ação', '1.6fr'], ['entidade', 'Item', '1.2fr']] },
    'admin/health': { titulo: 'Saúde', sub: 'Verificações da plataforma agora', filtro: 'status',
      colunas: [['nome', 'Verificação', '2fr'], ['status', 'Situação', '1fr'], ['detalhe', 'Detalhe', '2fr']] }
  };

  /** Cria as telas do Superadmin vazias (sem nada inventado) até o banco responder. */
  private registrarTelasAdmin() {
    if (typeof window === 'undefined' || this.modoDemo !== false) return;
    const mod = ((window as any).ALTHIUS_MOD = (window as any).ALTHIUS_MOD || {});
    for (const [pagina, def] of Object.entries(AlthiusApp.TELAS_ADMIN)) {
      mod[pagina] = { ...def, kpis: [], linhas: [], acoesLinha: [],
        acao: pagina === 'admin/workspaces' ? { label: 'Novo workspace' } : undefined };
    }
  }

  private cargaAdmin = 0;

  async carregarAdmin(pagina: string) {
    const mod = (window as any).ALTHIUS_MOD?.[pagina];
    if (!mod) return;
    const carga = ++this.cargaAdmin;
    const leitores: Record<string, (c: SupabaseClient) => Promise<{ kpis: unknown[]; linhas: unknown[] }>> = {
      'admin/workspaces': admin.listarClientes, 'admin/usage': admin.usoGlobal, 'admin/providers': admin.fornecedores,
      'admin/margins': admin.margens, 'admin/audit': c => admin.auditoriaGlobal(c), 'admin/health': admin.saude
    };
    try {
      const tela = await leitores[pagina](this.props.supabase);
      if (!this.vivo || carga !== this.cargaAdmin) return;
      mod.kpis = tela.kpis;
      mod.linhas = tela.linhas;
      if (pagina === 'admin/workspaces') mod.acoesLinha = [
        ['Gerar chaves dos agentes', ''],
        ['Revogar chaves dos agentes', '', null, true, 'As chaves dos agentes de {x} param de funcionar na hora. O Hermes Agent desse cliente fica sem acesso até gerar novas.']
      ];
      this.setState({ adminVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaAdmin) this.avisarFalha('Não foi possível carregar esta tela', falha);
    }
  }

  acaoDaPaginaReal(page: string): boolean {
    if (page !== 'admin/workspaces') return false;
    this.setState({ formNovoWs: { nome: '', slug: '', email: '', estrategista: '', erro: '' } });
    return true;
  }

  private formularioNovoCliente(v: Record<string, any>) {
    const f = this.state.formNovoWs as { nome: string; slug: string; email: string; estrategista: string; erro: string } | undefined;
    if (!f || !v.md || (this.state.rota || {}).page !== 'admin/workspaces') return;
    const muda = (campo: string) => (e: { target: { value: string } }) =>
      this.setState({ formNovoWs: Object.assign({}, this.state.formNovoWs, { [campo]: e.target.value, erro: '' }) });
    v.md.form = {
      titulo: 'Novo cliente',
      campos: [
        { label: 'Nome do cliente', valor: f.nome, mudar: muda('nome'), placeholder: 'Ex.: Evolut Trading' },
        { label: 'Endereço curto', valor: f.slug, mudar: muda('slug'), placeholder: 'ex.: evolut (vai na URL)' },
        { label: 'E-mail do C-level', valor: f.email, mudar: muda('email'), placeholder: 'diretoria@cliente.com.br', tipo: 'email' },
        { label: 'E-mail do estrategista (opcional)', valor: f.estrategista, mudar: muda('estrategista'), placeholder: 'quem cuida da conta na Althius', tipo: 'email' }
      ],
      erro: f.erro,
      salvarLabel: 'Criar cliente',
      salvar: () => this.criarClienteReal(),
      cancelar: () => this.setState({ formNovoWs: undefined })
    };
  }

  private async criarClienteReal() {
    const f = this.state.formNovoWs;
    const r = await admin.criarCliente(this.props.supabase, { nome: f.nome, slug: f.slug, emailClevel: f.email, emailEstrategista: f.estrategista });
    if (!this.vivo) return;
    if (!r.ok) return this.setState({ formNovoWs: Object.assign({}, f, { erro: r.mensagem }) });
    this.setState({ formNovoWs: undefined });
    this.avisar('mod', 'Cliente criado. O convite do C-level fica pendente até o conector de e-mail enviar.');
    await this.carregarAdmin('admin/workspaces');
  }

  private async acaoNoCliente(acao: string, linha: { id: string; nome: string }) {
    if (acao === 'Gerar chaves dos agentes') {
      const r = await admin.gerarChavesDosAgentes(this.props.supabase, linha.id);
      if (!r.ok) return this.confirmar('Chaves não geradas', r.mensagem, 'Entendi', () => {});
      const texto = Object.entries(r.chaves).map(([agente, chave]) => agente + ': ' + chave).join('\n');
      return this.confirmar('Chaves dos agentes de ' + linha.nome,
        'Copie agora e guarde no perfil de cada agente do Hermes. Elas não aparecem de novo.\n\n' + texto, 'Já copiei', () => {});
    }
    if (acao === 'Revogar chaves dos agentes') {
      const r = await admin.revogarChavesDosAgentes(this.props.supabase, linha.id);
      if (!r.ok) return this.confirmar('Chaves não revogadas', r.mensagem, 'Entendi', () => {});
      this.avisar('mod', r.revogadas + ' chaves revogadas.');
    }
  }
}
