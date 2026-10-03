// Front v18 ligado ao banco. Herda toda a tela e a lógica do protótipo (arquivos gerados)
// e sobrescreve só o que vem do banco. Novas versões do design entram por `npm run v18:sync`
// sem apagar esta camada (ADR 0020).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlthiusLogic } from '../v18/logic.generated.js';
import type { DadosAlthius } from './dados';
import { controlarExecucao, listarExecucoes } from './servicos/execucoes';
import { decidirAprovacao, listarAprovacoes, type AprovacaoTela, type DecisaoTela } from './servicos/aprovacoes';

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
    super.componentWillUnmount?.();
  }

  async carregarDadosIniciais() {
    // A carga inicial e as trocas compartilham a mesma geração: uma resposta antiga nunca substitui a atual.
    while (this.vivo) {
      const carga = ++this.cargaWorkspace;
      try {
        const D = this.props.dados;
        const [home, agents, execs, aprov, notifs] = await Promise.all([
          D.homeService.summary(), D.agentService.list(), this.carregarExecucoes(), this.carregarAprovacoes(), D.notificationService.list()
        ]);
        if (!this.vivo) return;
        if (carga !== this.cargaWorkspace) continue;
        this.setState({ home, agents, execs, aprov, notifs, pronto: true, carregandoRota: false });
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
    this.setState({ aprov: [], execs: [], decisoes: {}, apSel: null, falhaCarga: false, carregandoRota: true });
    try {
      const [aprov, execs] = await Promise.all([this.carregarAprovacoes(), this.carregarExecucoes()]);
      if (this.vivo && carga === this.cargaWorkspace) {
        this.setState({ aprov, execs, carregandoRota: false });
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
    return { ...super.renderVals(), modoDemo: this.modoDemo, sair: () => this.props.aoSair(), recarregar: () => this.recarregarWorkspace() };
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

  private avisarFalha(titulo: string, falha: unknown) {
    console.error(falha);
    this.confirmar(titulo, falha instanceof Error ? falha.message : 'Verifique a conexão e tente de novo em instantes.', 'Entendi', () => {});
  }
}
