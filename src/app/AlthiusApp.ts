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
import { listarContas, type ContaTela } from './servicos/contas';
import { listarEquipe, convidarEquipe, mudarPapelEquipe, suspenderMembroEquipe, cancelarConviteEquipe, type Equipe } from './servicos/equipe';

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
      list: () => this.carregarContas()
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
    if (this.equipeAberta() && (!this.equipeAberta(prevState) || prevState.cfgWs !== this.state.cfgWs || prevState.rota?.ws !== this.state.rota?.ws)) {
      void this.carregarEquipeWs(this.workspaceEquipeSelecionado());
    } else if (!this.equipeAberta() && this.equipeAberta(prevState)) this.cargaEquipe++;
  }

  componentWillUnmount() {
    this.vivo = false;
    this.cargaEquipe++;
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
      const [aprov, execs, creditos, contas] = await Promise.all([this.carregarAprovacoes(), this.carregarExecucoes(), this.carregarCreditos(), this.carregarContas()]);
      if (this.vivo && carga === this.cargaWorkspace) {
        this.publicarContas(contas);
        this.setState({ aprov, execs, contas, ...creditos, carregandoRota: false });
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
    const v = { ...super.renderVals(), modoDemo: this.modoDemo, sair: () => this.props.aoSair(), recarregar: () => this.recarregarWorkspace() };
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
}
