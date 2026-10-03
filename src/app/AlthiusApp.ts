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
  }

  private cargaWorkspace = 0;
  private vivo = true;

  componentDidUpdate(prevProps: Readonly<AlthiusAppProps>, prevState: Readonly<Record<string, any>>) {
    super.componentDidUpdate?.(prevProps, prevState);
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

  carregarAgentes(): Promise<AgenteTela[]> {
    const ws = this.workspaceAtual();
    return ws ? listarAgentes(this.props.supabase, ws.uuid, (this.props.dados.AGENTS || []) as AgenteBase[]) : Promise.resolve([]);
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
}
