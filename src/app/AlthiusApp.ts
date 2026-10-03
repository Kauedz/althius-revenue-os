// Front v18 ligado ao banco. Herda toda a tela e a lógica do protótipo (arquivos gerados)
// e sobrescreve só o que vem do banco. Novas versões do design entram por `npm run v18:sync`
// sem apagar esta camada (ADR 0020).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlthiusLogic } from '../v18/logic.generated.js';
import type { DadosAlthius } from './dados';
import { controlarExecucao, listarExecucoes } from './servicos/execucoes';
import { comprarCreditos, lerCreditos, salvarPoliticaCreditos as gravarPoliticaCreditos } from './servicos/creditos';
import { precoEmReais } from './precos';
import { decidirAprovacao, listarAprovacoes, type AprovacaoTela, type DecisaoTela } from './servicos/aprovacoes';
import { listarContas, type ContaTela } from './servicos/contas';
import { obterResumoHome, type HomeResumoTela } from './servicos/inicio';
import { listarNotificacoes, marcarNotificacoesComoLidas, type NotificacaoTupla } from './servicos/notificacoes';

export interface AlthiusAppProps {
  dados: DadosAlthius;
  supabase: SupabaseClient;
  aoSair: () => void;
}

export class AlthiusApp extends AlthiusLogic<AlthiusAppProps> {
  // Fora da demonstração não existe troca de papel: o papel vem do banco.
  modoDemo = false;
  // Métodos herdados do protótipo, usados só pela camada real.
  declare avisar: (contexto: string, texto: string) => void;
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
      list: () => this.carregarContas()
    };
    this.props.dados.homeService = {
      summary: () => this.carregarHome()
    };
    this.props.dados.notificationService = {
      list: () => this.carregarNotificacoes()
    };
    super.componentDidMount?.();
  }

  private cargaWorkspace = 0;
  private vivo = true;

  componentDidUpdate(prevProps: Readonly<AlthiusAppProps>, prevState: Readonly<Record<string, any>>) {
    super.componentDidUpdate?.(prevProps, prevState);
    if (prevState.rota?.ws !== this.state.rota?.ws) {
      this.cargaWorkspace++;
      if (this.state.pronto) void this.recarregarWorkspace();
    }
  }

  componentWillUnmount() {
    this.vivo = false;
    this.cargaWorkspace++;
    this.publicarContas([]);
    super.componentWillUnmount?.();
  }

  async carregarDadosIniciais() {
    // A carga inicial e as trocas compartilham a mesma geração: uma resposta antiga nunca substitui a atual.
    while (this.vivo) {
      const carga = ++this.cargaWorkspace;
      try {
        const D = this.props.dados;
        const [home, agents, execs, aprov, notifs, creditos, contas] = await Promise.all([
          D.homeService.summary(), D.agentService.list(), this.carregarExecucoes(), this.carregarAprovacoes(), D.notificationService.list(), this.carregarCreditos(), this.carregarContas()
        ]);
        if (!this.vivo) return;
        if (carga !== this.cargaWorkspace) continue;
        this.publicarContas(contas);
        this.setState({ home, agents, execs, aprov, notifs, contas, ...creditos, pronto: true, carregandoRota: false });
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
    this.publicarContas([]);
    this.setState({ aprov: [], execs: [], contas: [], decisoes: {}, apSel: null, falhaCarga: false, carregandoRota: true });
    try {
      const [aprov, execs, creditos, contas, home, notifs] = await Promise.all([this.carregarAprovacoes(), this.carregarExecucoes(), this.carregarCreditos(), this.carregarContas(), this.carregarHome(), this.carregarNotificacoes()]);
      if (this.vivo && carga === this.cargaWorkspace) {
        this.publicarContas(contas);
        this.setState({ aprov, execs, contas, home, notifs, ...creditos, carregandoRota: false });
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

    return {
      ...base,
      modoDemo: this.modoDemo,
      sair: () => this.props.aoSair(),
      recarregar: () => this.recarregarWorkspace(),
      temNaoLidas,
      notifResumo,
      notifs,
      marcarLidas: () => this.marcarNotificacoesLidas()
    };
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

  carregarHome(): Promise<HomeResumoTela> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      return Promise.resolve(this.props.dados.HOME || { kpis: [], operacao: [], acoes: [], timeline: [] });
    }
    return obterResumoHome(this.props.supabase, ws.uuid, ws.membroId);
  }

  carregarNotificacoes(): Promise<NotificacaoTupla[]> {
    const ws = this.workspaceAtual();
    if (!ws?.membroId) {
      return Promise.resolve((this.props.dados.NOTIFICATIONS || []) as NotificacaoTupla[]);
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
}
