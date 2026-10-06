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
import { desconectarConta, iniciarConexaoConta, provedorDoCanal } from './servicos/conexoes';
import { excluirContatoDoCrm, listarCaixa, marcarLida, minhasConexoes, pedirSugestaoDeResposta, type CaixaTela, type ConexoesTela } from './servicos/caixa';
import * as admin from './servicos/admin';
import { decidirConsentimento, lerConsentimento, marcarAvisoVisto, type EstadoAprendizado } from './servicos/aprendizado';
import { alternarChave, guardarChave, removerChave, ROTULO_PROVEDOR, testarChave, type ProvedorCofre } from './servicos/cofre';
import { arquivarCanal, criarCanal, editarMensagem, enviarNoCanal, lerMensagens, listarCanais, mudarCanal, reagir, type CanalTela } from './servicos/canais';
import { pedirAoCopiloto } from './servicos/copiloto';
import { listarNotificacoes, marcarNotificacoesComoLidas, type NotificacaoTupla } from './servicos/notificacoes';
import { listarRelatorios, relatorioSemDados, type RelatoriosTela } from './servicos/relatorios';
import { listarSinais, sinaisSemDados, type SinaisTela } from './servicos/sinais';
import { listarProspeccao, prospeccaoSemDados, type ProspeccaoTela } from './servicos/prospeccao';
import { arquivarNegocio, atualizarNegocio, criarNegocio, criarQuadro, excluirQuadro, listarPipeline, moverNegocio, MOTIONS, pipelineVazio, reordenarEtapas, renomearQuadro, type Motion, type PipelineTela, type Resultado } from './servicos/pipeline';
import { adiarTarefa, criarTarefa, listarTarefas, mudarStatusTarefa, tarefasVazias, type TarefasTela } from './servicos/tarefas';
import { CANAIS_CAMPANHA, campanhasVazias, criarCampanha, listarCampanhas, mudarStatusCampanha, mudarVerba, type CampanhasTela } from './servicos/campanhas';
import { adicionarPasso, cadenciasVazias, CANAL_PASSO, DICA_VARIAVEIS, inscreverContato, listarCadencias, removerUltimoPasso, salvarCadencia, type CadenciasTela } from './servicos/cadencias';
import { nomeDoAgente } from './agentes-exibicao';
import { normalizarDominio } from './normalizacao';

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

  // Logo pelo site: mesma normalização do banco (www., MAIÚSCULAS, http/https, porta, caminho, ponto final).
  // Substitui a regex própria do protótipo (`dominio` em logic.generated.js). Texto que não é domínio vira ''.
  dominio(u: unknown): string {
    return normalizarDominio(typeof u === 'string' ? u : u == null ? '' : String(u)) ?? '';
  }

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
    this.publicarTarefas(null);
    this.publicarCampanhas(null);
    this.publicarCadencias(null);
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
    this.publicarTarefas(null);
    this.publicarCampanhas(null);
    this.publicarCadencias(null);
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
    this.formularioDoModulo(v);
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
      // Coluna "Último contato" (das nossas mensagens), logo depois do último sinal. Não duplica em chamadas repetidas.
      const colunas: Array<[string, string, string]> = (mod.accounts.colunas || []).filter((c: [string, string, string]) => c[0] !== 'ultimoContato');
      const depoisDoSinal = colunas.findIndex(c => c[0] === 'sinal');
      colunas.splice(depoisDoSinal >= 0 ? depoisDoSinal + 1 : colunas.length, 0, ['ultimoContato', 'Último contato', '1.5fr']);
      mod.accounts.colunas = colunas;
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
      return Promise.resolve({ kpis: [], operacao: [], acoes: [], timeline: [], mapa: {}, semLocalizacao: 0 });
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
        perfilPronto: true,
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
    // Salvar antes de o perfil chegar gravaria cargo e telefone vazios por cima dos reais.
    if (!(this.state as { perfilPronto?: boolean }).perfilPronto) {
      this.avisarCfg('Seus dados ainda estão carregando. Tente de novo em instantes.');
      return;
    }
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

  // ---- Aprendizado compartilhado entre contas (ADR 0052): começa desligado; o C-level vê o aviso uma vez só

  /** Dados do interruptor em Configurações → Aprendizado (o gerado só desenha). */
  aprendizadoTela() {
    const base = {
      titulo: 'Ajudar a melhorar o aprendizado dos agentes',
      desc: 'Quando as contas compartilham o que funciona, todos os agentes aprendem mais rápido, os seus também. Nada que identifique sua empresa ou seus contatos é compartilhado.'
    };
    if (this.modoDemo !== false) {
      const on = !!this.state.aprendizadoDemo;
      return { ...base, on: on ? 'true' : 'false', travado: false, nota: '', alternar: () => this.setState({ aprendizadoDemo: !on }) };
    }
    const est = this.state.aprendizadoReal as EstadoAprendizado | null | undefined;
    if (!est) return { ...base, on: 'false', travado: true, nota: 'Carregando…', alternar: () => {} };
    return { ...base, on: est.aceito ? 'true' : 'false', travado: !est.podeDecidir, nota: est.podeDecidir ? '' : 'Só o C-level do workspace decide.', alternar: () => void this.decidirAprendizado(!est.aceito) };
  }

  private async carregarAprendizado() {
    if (this.modoDemo !== false) return;
    const ws = this.workspaceAtual();
    this.setState({ aprendizadoReal: null });
    if (!ws?.membroId) return;
    const r = await lerConsentimento(this.props.supabase, ws.uuid, ws.membroId);
    if (!this.vivo || this.workspaceAtual()?.uuid !== ws.uuid || !r.ok) return;
    this.setState({ aprendizadoReal: r.estado });
    // O aviso aparece uma vez só, para quem decide e ainda não viu. O banco garante a "primeira vez"; se outra janela
    // estiver aberta, só uma mostra. Não atropela uma janela de confirmação que já esteja na tela.
    if (!r.estado.podeDecidir || r.estado.avisoVisto || r.estado.aceito || this.state.confirm) return;
    if (!(await marcarAvisoVisto(this.props.supabase, ws.uuid, ws.membroId))) return;
    if (!this.vivo || this.workspaceAtual()?.uuid !== ws.uuid || this.state.confirm) return;
    this.setState({ confirm: {
      titulo: 'Deixe seus agentes ainda mais espertos',
      texto: 'Quando as contas compartilham o que funciona, todos os agentes aprendem mais rápido, e os seus também. Ative para receber sugestões mais certeiras e ajudar a melhorar o aprendizado dos agentes. Nada que identifique sua empresa ou seus contatos é compartilhado. Você muda isso quando quiser em Configurações.',
      rotulo: 'Quero ajudar e melhorar',
      cancelar: 'Agora não',
      acao: () => void this.decidirAprendizado(true, 'aviso')
    } });
  }

  private async decidirAprendizado(aceito: boolean, origem: 'aviso' | 'cfg' = 'cfg') {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await decidirConsentimento(this.props.supabase, ws.uuid, ws.membroId, aceito);
    if (!this.vivo) return;
    if (!r.ok) return this.confirmar('Não foi possível salvar', r.mensagem, 'Entendi', () => {});
    const atual = (this.state.aprendizadoReal || { avisoVisto: true, podeDecidir: true }) as EstadoAprendizado;
    this.setState({ aprendizadoReal: { ...atual, aceito, avisoVisto: true } });
    // Vindo do aviso (qualquer página), o agradecimento tem que aparecer onde a pessoa está; em Configurações, o aviso da seção.
    if (origem === 'aviso') this.confirmar('Obrigado!', 'Seus agentes vão aprender com o que funciona em contas parecidas com a sua. Você pode desligar quando quiser em Configurações.', 'Fechar', () => {});
    else this.avisarCfg(aceito ? 'Obrigado! Seus agentes vão aprender com o que funciona em contas parecidas.' : 'Compartilhamento desligado.');
  }

  // ---- Páginas carregadas sob demanda (Claude): só buscam no banco quando a pessoa abre a página

  private carregarPaginaSobDemanda(prev: Readonly<Record<string, any>>) {
    const rota = this.state.rota || {}, antes = prev.rota || {};
    const entrou = rota.page !== antes.page || rota.ws !== antes.ws || (this.state.pronto && !prev.pronto);
    if (!entrou || !this.state.pronto) return;
    if (rota.page === 'inbox') void this.carregarCaixa();
    if (rota.page === 'pipeline') void this.carregarPipeline();
    if (rota.page === 'tasks') void this.carregarTarefas();
    if (rota.page === 'campaigns') void this.carregarCampanhas();
    if (rota.page === 'cadences') void this.carregarCadencias();
    if (String(rota.page || '').startsWith('admin/')) void this.carregarAdmin(rota.page);
    if (rota.ws !== antes.ws || (this.state.pronto && !prev.pronto)) { void this.carregarConexoes(); void this.carregarCanais(); void this.carregarAprendizado(); }
    if (rota.page === 'channels' && (rota.id !== antes.id || rota.page !== antes.page || rota.ws !== antes.ws || (this.state.pronto && !prev.pronto))) void this.carregarMensagens();
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

  /** Conectar a PRÓPRIA conta de mensagem: pede o link ao backend e abre a janela segura do provedor. */
  async conectarContaReal(canal: string, via?: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await iniciarConexaoConta(this.props.supabase, ws.uuid, ws.membroId, provedorDoCanal(canal, via));
    this.setState({ ixCon: null });
    if (!r.ok) return this.confirmar('Conta não conectada', r.mensagem, 'Entendi', () => {});
    this.abrirJanelaDeConexao(r.url);
  }

  /** Sai para a janela segura do provedor (separado para os testes não navegarem de verdade). */
  abrirJanelaDeConexao(url: string) {
    window.location.assign(url);
  }

  async desconectarContaReal(canal: string, conexao: { via?: string } | null) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await desconectarConta(this.props.supabase, ws.uuid, ws.membroId, provedorDoCanal(canal, conexao?.via));
    if (!r.ok) return this.confirmar('Conta não desconectada', r.mensagem, 'Entendi', () => {});
    await this.carregarConexoes();
    this.avisar('mod', 'Conta desconectada.');
  }

  // ---- Pipeline e Tarefas ligados ao banco (PR 07)

  /** No modo real o pipeline é o do banco; enquanto carrega, um quadro vazio "Carregando…" por motion (a tela exige um). */
  pipe() {
    if (this.modoDemo !== false) return (AlthiusLogic.prototype as any).pipe.call(this);
    const real = this.state.pipeReal as PipelineTela | null | undefined;
    const quadros: Record<string, any[]> = {};
    const ativo: Record<string, string> = {};
    for (const m of MOTIONS) {
      quadros[m] = real ? real.quadros[m] : [{ id: 'carregando-' + m, nome: 'Carregando…', ordem: null, deals: [] }];
      if (!quadros[m].length) quadros[m] = [{ id: 'carregando-' + m, nome: 'Sem quadro', ordem: null, deals: [] }];
      const escolhido = (this.state.pipeAtivo || {})[m];
      ativo[m] = quadros[m].some(q => q.id === escolhido) ? escolhido : quadros[m][0].id;
    }
    return { motion: (this.state.pipeMotion as Motion) || 'slg', quadros, ativo };
  }

  /** No modo real só a motion e o quadro em foco são estado da tela; todo o resto passa pelo banco. */
  mudarPipe(fn: (p: any) => void) {
    if (this.modoDemo !== false) return (AlthiusLogic.prototype as any).mudarPipe.call(this, fn);
    const p = JSON.parse(JSON.stringify(this.pipe()));
    fn(p);
    this.setState({ pipeMotion: p.motion, pipeAtivo: p.ativo });
  }

  private cargaPipeline = 0;

  async carregarPipeline() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaPipeline;
    this.setState({ pipeReal: null });
    if (!ws) return;
    try {
      const pipeReal = await listarPipeline(this.props.supabase, ws.uuid);
      if (this.vivo && carga === this.cargaPipeline) this.setState({ pipeReal });
    } catch (falha) {
      if (this.vivo && carga === this.cargaPipeline) {
        this.setState({ pipeReal: pipelineVazio() });
        this.avisarFalha('Não foi possível carregar o Pipeline', falha);
      }
    }
  }

  /** Mostra o erro do banco em linguagem de tela e recarrega (o que a tela mostra volta a ser o que o banco tem). */
  private async fecharAcaoPipeline(r: Resultado, titulo: string, aviso?: string): Promise<boolean> {
    await this.carregarPipeline();
    if (!this.vivo) return r.ok;
    if (!r.ok) { this.confirmar(titulo, r.mensagem, 'Entendi', () => {}); return false; }
    if (aviso) this.avisar('mod', aviso);
    return true;
  }

  private contextoPipeline() {
    const ws = this.workspaceAtual();
    return ws?.membroId ? { ws: ws.uuid, membro: ws.membroId } : null;
  }

  async moverNegocioReal(id: string, etapa: string, antesId: string | null) {
    const c = this.contextoPipeline();
    if (!c) return;
    const antes = this.pipe();
    const negocio = (antes.quadros[antes.motion] as any[]).flatMap(q => q.deals).find(d => d.id === id);
    const r = await moverNegocio(this.props.supabase, c.ws, c.membro, id, etapa, antesId);
    const ok = await this.fecharAcaoPipeline(r, 'Negócio não movido');
    if (ok && negocio && negocio.etapa !== etapa) this.avisar('mod', negocio.conta + (etapa === 'ganho' ? ' ganho.' : ' mudou de etapa.'));
  }

  async reordenarEtapasReal(quadroId: string, ordem: string[]) {
    const c = this.contextoPipeline();
    if (!c) return;
    await this.fecharAcaoPipeline(await reordenarEtapas(this.props.supabase, c.ws, c.membro, quadroId, ordem), 'Etapas não reordenadas');
  }

  async novoQuadroReal(motion: Motion, nome: string) {
    const c = this.contextoPipeline();
    if (!c) return;
    const r = await criarQuadro(this.props.supabase, c.ws, c.membro, motion, nome);
    if (r.ok && r.id) this.setState({ pipeAtivo: Object.assign({}, this.state.pipeAtivo, { [motion]: r.id }), pipeNome: nome });
    await this.fecharAcaoPipeline(r, 'Quadro não criado');
  }

  async renomearQuadroReal(quadroId: string, nome: string) {
    const c = this.contextoPipeline();
    if (!c) return;
    this.setState({ pipeNome: null });
    await this.fecharAcaoPipeline(await renomearQuadro(this.props.supabase, c.ws, c.membro, quadroId, nome), 'Quadro não renomeado');
  }

  async excluirQuadroReal(quadroId: string) {
    const c = this.contextoPipeline();
    if (!c) return;
    this.setState({ pipeNome: null });
    await this.fecharAcaoPipeline(await excluirQuadro(this.props.supabase, c.ws, c.membro, quadroId), 'Quadro não excluído');
  }

  async arquivarNegocioReal(id: string) {
    const c = this.contextoPipeline();
    if (!c) return;
    this.setState({ pipeCard: null });
    await this.fecharAcaoPipeline(await arquivarNegocio(this.props.supabase, c.ws, c.membro, id), 'Negócio não removido', 'Negócio removido do quadro.');
  }

  /** Id do membro (workspace_members) pelo nome que a tela mostra. */
  private membroPorNome(nome: string): string | null {
    const m = (this.membros(this.wsId()) as Array<{ id: string; nome: string }>).find(x => x.nome === nome);
    return m && /^[0-9a-f-]{36}$/i.test(m.id) ? m.id : null;
  }

  async salvarNegocioReal(x: any, quadroId: string) {
    const c = this.contextoPipeline();
    if (!c) return;
    if (quadroId.startsWith('carregando-') || quadroId === 'carregando') return;
    const donoId = this.membroPorNome(x.dono);
    if (!donoId) return this.confirmar('Negócio não salvo', 'Não achei o responsável escolhido neste workspace.', 'Entendi', () => {});
    const dados = { valor: +x.valor, fecha: x.fecha || '', prob: x.etapa === 'ganho' ? 100 : x.prob, etapa: x.etapa, status: x.status, donoId };
    this.setState({ pipeCard: null });
    const r = x.novo
      ? await criarNegocio(this.props.supabase, c.ws, c.membro, quadroId, { ...dados, contaId: x.cid })
      : await atualizarNegocio(this.props.supabase, c.ws, c.membro, x.id, dados);
    await this.fecharAcaoPipeline(r, 'Negócio não salvo', x.novo ? `${x.conta} entrou no quadro.` : 'Negócio atualizado.');
  }

  private cargaTarefas = 0;

  private publicarTarefas(t: TarefasTela | null) {
    if (typeof window === 'undefined') return;
    const mod = (window as any).ALTHIUS_MOD;
    if (!mod?.tasks || this.modoDemo !== false) return;
    const tela = t ?? tarefasVazias();
    mod.tasks.kpis = tela.kpis;
    mod.tasks.linhas = tela.linhas;
    mod.tasks.acoesLinha = t ? [['Concluir', 'Tarefa concluída.'], ['Adiar 1 dia', 'Tarefa movida para amanhã.']] : [];
  }

  async carregarTarefas() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaTarefas;
    this.publicarTarefas(null);
    if (!ws) return;
    try {
      const tarefas = await listarTarefas(this.props.supabase, ws.uuid);
      if (!this.vivo || carga !== this.cargaTarefas) return;
      this.publicarTarefas(tarefas);
      this.setState({ tarefasVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaTarefas) this.avisarFalha('Não foi possível carregar as tarefas', falha);
    }
  }

  private async acaoNaTarefa(acao: string, id: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = acao === 'Concluir'
      ? await mudarStatusTarefa(this.props.supabase, ws.uuid, ws.membroId, id, 'Concluída')
      : await adiarTarefa(this.props.supabase, ws.uuid, ws.membroId, id, 1);
    await this.carregarTarefas();
    if (!r.ok) this.confirmar('Tarefa não atualizada', r.mensagem, 'Entendi', () => {});
    else this.avisar('mod', acao === 'Concluir' ? 'Tarefa concluída.' : 'Tarefa movida para amanhã.');
  }

  /** Data e hora digitadas (horário de Brasília) viram o instante exato. */
  private static prazoEmBrasilia(data: string, hora: string): string {
    return new Date(`${data}T${hora || '09:00'}:00-03:00`).toISOString();
  }

  async criarTarefaReal(x: any) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const responsavelId = x.resp ? this.membroPorNome(x.resp) : ws.membroId;
    if (!responsavelId) return this.confirmar('Tarefa não criada', 'Não achei o responsável escolhido neste workspace.', 'Entendi', () => {});
    const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
    this.setState({ tarefa: null });
    const r = await criarTarefa(this.props.supabase, ws.uuid, ws.membroId, {
      titulo: x.titulo, canal: x.canal, contaId: uuid(x.conta), contatoId: uuid(x.contato), responsavelId, agente: x.agente || null,
      prazo: AlthiusApp.prazoEmBrasilia(x.data, x.hora), status: x.status || 'Pendente', nota: x.nota || ''
    });
    await this.carregarTarefas();
    if (!r.ok) this.confirmar('Tarefa não criada', r.mensagem, 'Entendi', () => {});
    else this.avisar('mod', 'Tarefa criada.');
  }

  // ---- Cadências e Campanhas ligadas ao banco (PR 08)

  private cargaCampanhas = 0;
  private cargaCadencias = 0;

  private publicarCampanhas(t: CampanhasTela | null) {
    if (typeof window === 'undefined' || this.modoDemo !== false) return;
    const mod = (window as any).ALTHIUS_MOD?.campaigns;
    if (!mod) return;
    const tela = t ?? campanhasVazias();
    // Sem fonte de investimento real, a tabela mostra a verba aprovada (e não "Investido" nem CPL).
    mod.colunas = [['nome', 'Campanha', '2fr'], ['canal', 'Canal', '1fr'], ['verba', 'Verba aprovada', '1fr'], ['leads', 'Leads', '80px'], ['status', 'Status', '1fr']];
    mod.kpis = tela.kpis;
    mod.linhas = tela.linhas;
    mod.acoesLinha = t ? [['Ativar', ''], ['Pausar', ''], ['Concluir', ''], ['Mudar verba', '']] : [];
  }

  private publicarCadencias(t: CadenciasTela | null) {
    if (typeof window === 'undefined' || this.modoDemo !== false) return;
    const mod = (window as any).ALTHIUS_MOD?.cadences;
    if (!mod) return;
    const tela = t ?? cadenciasVazias();
    mod.kpis = tela.kpis;
    mod.linhas = tela.linhas;
    mod.acoesLinha = t ? [['Adicionar passo', ''], ['Remover último passo', ''], ['Inscrever contato', ''], ['Pausar', ''], ['Retomar', ''], ['Arquivar', '']] : [];
  }

  async carregarCampanhas() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaCampanhas;
    this.publicarCampanhas(null);
    if (!ws) return;
    try {
      const t = await listarCampanhas(this.props.supabase, ws.uuid);
      if (!this.vivo || carga !== this.cargaCampanhas) return;
      this.publicarCampanhas(t);
      this.setState({ campanhasVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaCampanhas) this.avisarFalha('Não foi possível carregar as campanhas', falha);
    }
  }

  async carregarCadencias() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaCadencias;
    this.publicarCadencias(null);
    if (!ws) return;
    try {
      const t = await listarCadencias(this.props.supabase, ws.uuid);
      if (!this.vivo || carga !== this.cargaCadencias) return;
      this.publicarCadencias(t);
      this.setState({ cadenciasVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaCadencias) this.avisarFalha('Não foi possível carregar as cadências', falha);
    }
  }

  // Formulário genérico das listas (usa o mesmo bloco `md.form` do Superadmin)
  private abrirFormulario(def: { tipo: string; titulo: string; salvarLabel: string; id?: string; extra?: Record<string, unknown>; campos: Array<Record<string, any>> }) {
    this.setState({ formModulo: { ...def, erro: '' } });
  }

  private formularioDoModulo(v: Record<string, any>) {
    const f = this.state.formModulo as { tipo: string; titulo: string; salvarLabel: string; erro: string; campos: Array<Record<string, any>> } | undefined;
    const pagina = (this.state.rota || {}).page;
    if (!f || !v.md || (pagina !== 'campaigns' && pagina !== 'cadences' && pagina !== 'admin/providers')) return;
    v.md.form = {
      titulo: f.titulo,
      campos: f.campos.map(c => ({
        label: c.label, valor: c.valor, placeholder: c.placeholder, tipo: c.tipo, opcoes: c.opcoes, longo: !!c.longo,
        mudar: (e: { target: { value: string } }) => this.setState({ formModulo: Object.assign({}, this.state.formModulo, { erro: '', campos: this.state.formModulo.campos.map((x: any) => x.k === c.k ? Object.assign({}, x, { valor: e.target.value }) : x) }) })
      })),
      erro: f.erro,
      salvarLabel: f.salvarLabel,
      salvar: () => void this.enviarFormulario(),
      cancelar: () => this.setState({ formModulo: undefined })
    };
  }

  /** "5000", "5.000" e "5.000,50" viram número; vazio vira 0. */
  private static numeroBR(texto: string): number {
    const t = String(texto || '').replace(/[R$\s]/g, '');
    if (!t) return 0;
    const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/\.(?=\d{3}(\D|$))/g, '');
    const n = Number(limpo);
    return Number.isFinite(n) ? n : NaN;
  }

  private async enviarFormulario() {
    const f = this.state.formModulo as { tipo: string; id?: string; extra?: Record<string, any>; campos: Array<{ k: string; valor: string }> } | undefined;
    const ws = this.workspaceAtual();
    if (f?.tipo === 'cofre_nova') return this.enviarChaveNova(f.campos);
    if (!f || !ws?.membroId) return;
    const val = (k: string) => (f.campos.find(c => c.k === k)?.valor ?? '').trim();
    const falhou = (erro: string) => this.setState({ formModulo: Object.assign({}, this.state.formModulo, { erro }) });
    const sb = this.props.supabase;
    const verba = AlthiusApp.numeroBR(val('verba'));
    if (Number.isNaN(verba)) return falhou('Informe a verba só com números.');

    if (f.tipo === 'nova_campanha') {
      const r = await criarCampanha(sb, ws.uuid, ws.membroId, val('nome'), val('canal'), verba);
      if (!r.ok) return falhou(r.mensagem);
      this.setState({ formModulo: undefined });
      await this.carregarCampanhas();
      return this.avisar('mod', r.pedido ? 'Campanha criada em rascunho. O pedido de verba foi para o C-level aprovar.' : 'Campanha criada em rascunho.');
    }
    if (f.tipo === 'mudar_verba') {
      const r = await mudarVerba(sb, ws.uuid, ws.membroId, f.id!, verba);
      if (!r.ok) return falhou(r.mensagem);
      this.setState({ formModulo: undefined });
      await this.carregarCampanhas();
      const aviso: Record<string, string> = { requested: 'Pedido de verba enviado ao C-level.', pending_exists: 'Já existe um pedido de verba aguardando o C-level.', unchanged: 'A verba já era essa.', updated: 'Verba atualizada.' };
      return this.avisar('mod', aviso[r.acao ?? ''] ?? 'Verba atualizada.');
    }
    if (f.tipo === 'nova_cadencia') {
      const r = await salvarCadencia(sb, ws.uuid, ws.membroId, null, val('nome'), val('descricao'), 'Ativa');
      if (!r.ok) return falhou(r.mensagem);
      this.setState({ formModulo: undefined });
      await this.carregarCadencias();
      return this.avisar('mod', 'Cadência criada. Abra a linha e use "Adicionar passo".');
    }
    if (f.tipo === 'novo_passo') {
      const espera = Number(val('espera') || 0);
      if (!Number.isInteger(espera)) return falhou('A espera é um número inteiro de dias.');
      const r = await adicionarPasso(sb, ws.uuid, ws.membroId, f.id!, { canal: val('canal'), modo: val('modo') === 'Automático' ? 'auto' : 'manual', espera, assunto: val('assunto'), texto: val('texto') });
      if (!r.ok) return falhou(r.mensagem);
      this.setState({ formModulo: undefined });
      await this.carregarCadencias();
      return this.avisar('mod', 'Passo adicionado.');
    }
    if (f.tipo === 'inscrever') {
      if (!val('contato')) return falhou('Escolha o contato.');
      const r = await inscreverContato(sb, ws.uuid, ws.membroId, f.id!, val('contato'));
      if (!r.ok) return falhou(r.mensagem);
      this.setState({ formModulo: undefined });
      await this.carregarCadencias();
      return this.avisar('mod', 'Contato inscrito. O primeiro passo vence agora.');
    }
  }

  private async acaoNaCampanha(acao: string, linha: { id: string; nome: string; verbaNumero: number }) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    if (acao === 'Mudar verba') {
      return this.abrirFormulario({ tipo: 'mudar_verba', id: linha.id, titulo: `Verba de "${linha.nome}"`, salvarLabel: 'Salvar verba',
        campos: [{ k: 'verba', label: 'Verba de mídia (R$)', valor: linha.verbaNumero ? String(linha.verbaNumero) : '', placeholder: '0' }] });
    }
    const status = { Ativar: 'Ativa', Pausar: 'Pausada', Concluir: 'Concluída' }[acao as 'Ativar'];
    if (!status) return;
    const r = await mudarStatusCampanha(this.props.supabase, ws.uuid, ws.membroId, linha.id, status);
    await this.carregarCampanhas();
    if (!r.ok) this.confirmar('Campanha não atualizada', r.mensagem, 'Entendi', () => {});
    else this.avisar('mod', `Campanha: ${status.toLowerCase()}.`);
  }

  private contatosParaInscricao() {
    const mod = (window as any).ALTHIUS_MOD?.accounts?.linhas || [];
    const comites = (window as any).ALTHIUS_COMITES || {};
    const lista: Array<{ valor: string; label: string }> = [{ valor: '', label: 'Escolha o contato' }];
    for (const conta of mod) for (const p of comites[conta.id] || []) lista.push({ valor: p.id, label: `${p.nome} · ${conta.nome}` });
    return lista;
  }

  private async acaoNaCadencia(acao: string, linha: { id: string; nome: string; descricao: string; status: string }) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const sb = this.props.supabase;
    if (acao === 'Adicionar passo') {
      return this.abrirFormulario({ tipo: 'novo_passo', id: linha.id, titulo: `Novo passo em "${linha.nome}"`, salvarLabel: 'Adicionar passo', campos: [
        { k: 'canal', label: 'Canal', valor: 'E-mail', opcoes: Object.values(CANAL_PASSO).map(x => ({ valor: x, label: x })) },
        { k: 'modo', label: 'Como sai', valor: 'Manual', opcoes: [{ valor: 'Manual', label: 'Manual (vira tarefa)' }, { valor: 'Automático', label: 'Automático (só e-mail e WhatsApp)' }] },
        { k: 'espera', label: 'Espera depois do passo anterior (dias)', valor: '0', tipo: 'number' },
        { k: 'assunto', label: 'Assunto (e-mail)', valor: '', placeholder: 'Ex.: Olá {{primeiro_nome}}' },
        { k: 'texto', label: 'Texto ou roteiro', valor: '', longo: true, placeholder: 'Ex.: Vi a {{empresa}} e queria falar com você, {{primeiro_nome}}. ' + DICA_VARIAVEIS }
      ] });
    }
    if (acao === 'Inscrever contato') {
      return this.abrirFormulario({ tipo: 'inscrever', id: linha.id, titulo: `Inscrever em "${linha.nome}"`, salvarLabel: 'Inscrever',
        campos: [{ k: 'contato', label: 'Contato', valor: '', opcoes: this.contatosParaInscricao() }] });
    }
    let r;
    if (acao === 'Remover último passo') r = await removerUltimoPasso(sb, ws.uuid, ws.membroId, linha.id);
    else {
      const novo = { Pausar: 'Pausada', Retomar: 'Ativa', Arquivar: 'Arquivada' }[acao as 'Pausar'];
      if (!novo) return;
      r = await salvarCadencia(sb, ws.uuid, ws.membroId, linha.id, linha.nome, linha.descricao, novo);
    }
    await this.carregarCadencias();
    if (!r.ok) this.confirmar('Cadência não atualizada', r.mensagem, 'Entendi', () => {});
    else this.avisar('mod', acao === 'Remover último passo' ? 'Último passo removido.' : 'Cadência atualizada.');
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
    if (page === 'admin/providers') {
      void this.acaoNaChave(acao, linha as any);
      return true;
    }
    if (page === 'inbox') {
      void this.acaoNaConversa(acao, linha.id);
      return true;
    }
    if (page === 'tasks') {
      void this.acaoNaTarefa(acao, linha.id);
      return true;
    }
    if (page === 'campaigns') {
      void this.acaoNaCampanha(acao, linha as any);
      return true;
    }
    if (page === 'cadences') {
      void this.acaoNaCadencia(acao, linha as any);
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
      ['Sugerir resposta', `Pedido enviado para ${nomeDoAgente('copy')}. A sugestão aparece em Execuções.`],
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
      this.avisar('mod', `Pedido enviado para ${nomeDoAgente('copy')}. A sugestão aparece em Execuções.`);
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
      colunas: [['nome', 'Cliente', '2fr'], ['consumido', 'Consumido no ciclo', '1.4fr'], ['saldo', 'Saldo', '1.2fr'], ['execucoes', 'Execuções no mês', '1fr'], ['tokens', 'Tokens do modelo no mês', '1.2fr'], ['custoModelo', 'Custo real do modelo', '1.2fr'], ['ultimo', 'Último uso', '1fr']] },
    'admin/providers': { titulo: 'Fornecedores', sub: 'Chaves de coleta, mensagens e modelo de IA. Só os 4 últimos caracteres aparecem.', filtro: 'tipo',
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
        acao: pagina === 'admin/workspaces' ? { label: 'Novo workspace' } : pagina === 'admin/providers' ? { label: 'Nova chave' } : undefined };
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
      if (pagina === 'admin/providers') mod.acoesLinha = [
        ['Testar chave', ''],
        ['Ativar ou desativar', ''],
        ['Remover chave', '', null, true, 'A chave {x} é apagada do cofre. O sistema passa a usar as outras chaves do mesmo fornecedor (ou a do .env, se houver).']
      ];
      this.setState({ adminVersao: carga });
    } catch (falha) {
      if (this.vivo && carga === this.cargaAdmin) this.avisarFalha('Não foi possível carregar esta tela', falha);
    }
  }

  acaoDaPaginaReal(page: string): boolean {
    if (page === 'campaigns') {
      this.abrirFormulario({ tipo: 'nova_campanha', titulo: 'Nova campanha', salvarLabel: 'Criar campanha', campos: [
        { k: 'nome', label: 'Nome da campanha', valor: '', placeholder: 'Ex.: Importação sem risco · Q4' },
        { k: 'canal', label: 'Canal', valor: 'LinkedIn Ads', opcoes: Object.values(CANAIS_CAMPANHA).map(x => ({ valor: x, label: x })) },
        { k: 'verba', label: 'Verba de mídia (R$)', valor: '', placeholder: '0 se não houver verba', tipo: 'text' }
      ] });
      return true;
    }
    if (page === 'cadences') {
      this.abrirFormulario({ tipo: 'nova_cadencia', titulo: 'Nova cadência', salvarLabel: 'Criar cadência', campos: [
        { k: 'nome', label: 'Nome da cadência', valor: '', placeholder: 'Ex.: Importadores do Sudeste' },
        { k: 'descricao', label: 'Descrição (opcional)', valor: '', placeholder: 'Para quem é e o que ela faz' }
      ] });
      return true;
    }
    if (page === 'admin/providers') {
      this.abrirFormulario({ tipo: 'cofre_nova', titulo: 'Nova chave', salvarLabel: 'Guardar no cofre', campos: [
        { k: 'provedor', label: 'Fornecedor', valor: 'apify', opcoes: (Object.keys(ROTULO_PROVEDOR) as ProvedorCofre[]).map(k => ({ valor: k, label: ROTULO_PROVEDOR[k] })) },
        { k: 'rotulo', label: 'Nome da chave', valor: '', placeholder: 'Ex.: Apify conta 6 · Reserva' },
        { k: 'segredo', label: 'Chave (não aparece de novo)', valor: '', tipo: 'password', placeholder: 'Cole a chave aqui' },
        { k: 'api', label: 'Tipo de API (só modelo de IA)', valor: 'openai', opcoes: [{ valor: 'openai', label: 'OpenAI e compatíveis' }, { valor: 'anthropic', label: 'Claude (Anthropic)' }] },
        { k: 'endereco', label: 'Endereço da API (modelo de IA; na Claude pode ficar vazio)', valor: '', placeholder: 'https://api.openai.com/v1' },
        { k: 'modelo', label: 'Nome do modelo (só modelo de IA)', valor: '', placeholder: 'Copie o nome exato do painel do fornecedor' },
        { k: 'prioridade', label: 'Prioridade (1 = principal; números maiores = reserva)', valor: '', placeholder: 'Ex.: 1' },
        { k: 'preco_entrada', label: 'Preço por 1 milhão de tokens de entrada, em US$ (opcional, só superadmin)', valor: '', placeholder: 'Para calcular o custo real' },
        { k: 'preco_saida', label: 'Preço por 1 milhão de tokens de saída, em US$ (opcional, só superadmin)', valor: '', placeholder: 'Preencha os dois ou nenhum' }
      ] });
      return true;
    }
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

  private async enviarChaveNova(campos: Array<{ k: string; valor: string }>) {
    const val = (k: string) => (campos.find(c => c.k === k)?.valor ?? '').trim();
    const falhou = (erro: string) => this.setState({ formModulo: Object.assign({}, this.state.formModulo, { erro }) });
    const provedor = val('provedor') as ProvedorCofre;
    if (!val('rotulo')) return falhou('Dê um nome para a chave.');
    if (val('segredo').length < 8) return falhou('Cole a chave inteira.');
    const config: Record<string, string> = {};
    if (provedor === 'modelo_ia') {
      config.api = val('api');
      if (val('endereco')) config.base_url = val('endereco');
      config.modelo = val('modelo');
      if (val('prioridade')) config.prioridade = val('prioridade');
      if (val('preco_entrada')) config.preco_entrada = val('preco_entrada');
      if (val('preco_saida')) config.preco_saida = val('preco_saida');
    }
    else if (provedor === 'mensagens' && val('endereco')) config.url = val('endereco');
    const r = await guardarChave(this.props.supabase, { provedor, rotulo: val('rotulo'), segredo: val('segredo'), config });
    if (!this.vivo) return;
    if (!r.ok) return falhou(r.mensagem);
    this.setState({ formModulo: undefined });
    this.avisar('mod', 'Chave guardada no cofre. Use "Testar chave" para conferir.');
    await this.carregarAdmin('admin/providers');
  }

  private async acaoNaChave(acao: string, linha: { id: string; nome: string; cofre?: boolean; ativo?: boolean }) {
    if (!linha.cofre) {
      return this.confirmar('Esta linha não está no cofre', 'Só as chaves cadastradas na tela têm teste, desativar e remover. As demais vêm do .env do servidor.', 'Entendi', () => {});
    }
    const sb = this.props.supabase;
    if (acao === 'Testar chave') {
      const r = await testarChave(sb, linha.id);
      if (!this.vivo) return;
      await this.carregarAdmin('admin/providers');
      return this.confirmar(r.ok ? 'Chave funcionando' : 'Chave com problema', r.ok ? 'A chave ' + linha.nome + ' respondeu direitinho.' : r.mensagem, 'Entendi', () => {});
    }
    const r = acao === 'Remover chave' ? await removerChave(sb, linha.id) : await alternarChave(sb, linha.id, linha.ativo === false);
    if (!this.vivo) return;
    if (!r.ok) return this.confirmar('Não concluído', r.mensagem, 'Entendi', () => {});
    this.avisar('mod', acao === 'Remover chave' ? 'Chave removida do cofre.' : linha.ativo === false ? 'Chave ativada.' : 'Chave desativada.');
    await this.carregarAdmin('admin/providers');
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

  // ---- Canais (Claude): chat do time no banco; agente chamado vira pedido (sem resposta inventada)

  /** No modo real os canais vêm do banco. Enquanto carregam, só o #geral (vazio), para a tela não quebrar. */
  canais(): CanalTela[] {
    if (this.modoDemo !== false) return (AlthiusLogic.prototype as any).canais.call(this);
    const reais = this.state.canaisReais as CanalTela[] | undefined;
    return reais?.length ? reais : [{ id: 'geral', desc: 'Avisos do time', novas: 0, geral: true, pessoas: [], agentes: [], criador: '' }];
  }

  private cargaCanais = 0;

  async carregarCanais() {
    const ws = this.workspaceAtual();
    const carga = ++this.cargaCanais;
    if (!ws) return;
    try {
      const canaisReais = await listarCanais(this.props.supabase, ws.uuid);
      if (this.vivo && carga === this.cargaCanais) this.setState({ canaisReais });
    } catch (falha) {
      if (this.vivo && carga === this.cargaCanais) this.avisarFalha('Não foi possível carregar os canais', falha);
    }
  }

  private cargaMensagens = 0;

  async carregarMensagens(slug?: string) {
    const ws = this.workspaceAtual();
    const canal = slug || ((this.state.rota || {}).id as string) || this.canais()[0]?.id;
    const carga = ++this.cargaMensagens;
    if (!ws?.membroId || !canal) return;
    try {
      const msgs = await lerMensagens(this.props.supabase, ws.uuid, canal, ws.membroId);
      if (this.vivo && carga === this.cargaMensagens) this.setState({ canalMsgs: Object.assign({}, this.state.canalMsgs, { [canal]: msgs }) });
    } catch (falha) {
      if (this.vivo && carga === this.cargaMensagens) this.avisarFalha('Não foi possível carregar as mensagens', falha);
    }
  }

  /** Mesma regra do protótipo para saber qual agente foi chamado: o nome citado com @, ou o primeiro do canal. */
  async enviarNoCanalReal(canal: CanalTela, texto: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const citado = /@/.test(texto) ? (canal.agentes.find(a => texto.includes('@' + nomeDoAgente(a))) || canal.agentes[0] || null) : null;
    const resposta = this.state.respondendo ? { autor: this.state.respondendo, texto: this.state.respondendoTexto || '' } : null;
    this.setState({ canalTexto: '', respondendo: null });
    const r = await enviarNoCanal(this.props.supabase, ws.uuid, ws.membroId, canal.id, texto, resposta, citado);
    if (!this.vivo) return;
    if (!r.ok) {
      this.setState({ canalTexto: texto });
      return this.confirmar('Mensagem não enviada', r.mensagem, 'Entendi', () => {});
    }
    await this.carregarMensagens(canal.id);
  }

  private idsDosMembros(nomes: string[]): string[] {
    const ws = this.workspaceAtual();
    const lista = (this.membros((this.state.rota || {}).ws) || []) as Array<{ id: string; nome: string }>;
    return nomes.map(n => lista.find(m => m.nome === n)?.id).filter((id): id is string => !!id && id !== ws?.membroId);
  }

  async salvarCanalReal(x: { id?: string; nome: string; desc?: string; pessoas?: string[]; agentes?: string[] }, editando: boolean) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const pessoas = this.idsDosMembros(x.pessoas || []);
    const r = editando
      ? await mudarCanal(this.props.supabase, ws.uuid, ws.membroId, x.id!, pessoas.concat([ws.membroId]), x.agentes || [])
      : await criarCanal(this.props.supabase, ws.uuid, ws.membroId, { nome: x.nome, desc: x.desc || '', pessoas, agentes: x.agentes || [] });
    if (!this.vivo) return;
    if (!r.ok) return this.setState({ canalModal: Object.assign({}, this.state.canalModal, { erro: r.mensagem }) });
    this.setState({ canalModal: null });
    await this.carregarCanais();
    if (!editando && 'slug' in r) this.ir('app/' + (this.state.rota || {}).ws + '/channels/' + r.slug);
  }

  async arquivarCanalReal(slug: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return;
    const r = await arquivarCanal(this.props.supabase, ws.uuid, ws.membroId, slug);
    if (!r.ok) return this.confirmar('Canal não arquivado', r.mensagem, 'Entendi', () => {});
    this.setState({ canalModal: null });
    await this.carregarCanais();
    this.ir('app/' + (this.state.rota || {}).ws + '/channels/geral');
  }

  async editarMensagemReal(canal: CanalTela, mensagem: { id: string }, texto: string) {
    const ws = this.workspaceAtual();
    if (!ws?.membroId || !mensagem?.id) return;
    const r = await editarMensagem(this.props.supabase, ws.uuid, ws.membroId, mensagem.id, texto);
    if (!r.ok) return this.confirmar('Mensagem não editada', r.mensagem, 'Entendi', () => {});
    await this.carregarMensagens(canal.id);
  }

  async reagirReal(canal: CanalTela, mensagem: { id: string }, emoji: string) {
    const ws = this.workspaceAtual();
    this.setState({ picker: null });
    if (!ws?.membroId || !mensagem?.id) return;
    const r = await reagir(this.props.supabase, ws.uuid, ws.membroId, mensagem.id, emoji);
    if (!r.ok) return this.confirmar('Reação não registrada', r.mensagem, 'Entendi', () => {});
    await this.carregarMensagens(canal.id);
  }

  // ---- Copiloto (Claude): o pedido vai para a fila de Execuções; nada é encenado

  /** No modo real o histórico de pedidos fica em Execuções (com a situação verdadeira); sem conversas de exemplo. */
  copHist() {
    return this.modoDemo === false ? [] : (AlthiusLogic.prototype as any).copHist.call(this);
  }

  /** Pedido em andamento: repetir o mesmo texto reaproveita a chave, então nova tentativa não duplica nem cobra de novo. */
  private copPedido: { texto: string; chave: string } | null = null;
  private copEnviando = false;

  async pedirAoCopilotoReal(texto: string) {
    if (this.copEnviando) return;
    const ws = this.workspaceAtual();
    if (!ws?.membroId) return this.confirmar('Pedido não enviado', 'Você não participa deste workspace como membro.', 'Entendi', () => {});
    if (this.copPedido?.texto !== texto) this.copPedido = { texto, chave: crypto.randomUUID() };
    this.copEnviando = true;
    let r;
    try {
      r = await pedirAoCopiloto(this.props.supabase, ws.uuid, ws.membroId, texto, this.copPedido.chave);
    } finally {
      this.copEnviando = false;
    }
    if (!this.vivo) return;
    if (!r.ok) return this.confirmar('Pedido não enviado', r.mensagem, 'Entendi', () => {});
    this.copPedido = null;
    if (this.state.copTexto === texto) this.setState({ copTexto: '' });
    const slug = (this.state.rota || {}).ws;
    if (r.paraAprovacao) {
      return this.confirmar('Pedido enviado para Aprovações',
        (r.motivo || 'O pedido precisa de aprovação antes de rodar.') + ' Quem decide o gasto foi avisado.',
        'Ver aprovações', () => { this.setState({ cop: false }); this.ir('app/' + slug + '/approvals'); });
    }
    this.confirmar('Pedido registrado na fila',
      'O Hermes conferiu papel e créditos e registrou o pedido em Execuções. Ele ainda aguarda processamento: nada foi feito até agora.',
      'Ver execuções', () => { this.setState({ cop: false }); this.ir('app/' + slug + '/executions'); });
  }
}
