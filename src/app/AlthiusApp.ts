// Front v18 ligado ao banco. Herda toda a tela e a lógica do protótipo (arquivos gerados)
// e sobrescreve só o que vem do banco. Novas versões do design entram por `npm run v18:sync`
// sem apagar esta camada (ADR 0020).
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlthiusLogic } from '../v18/logic.generated.js';
import type { DadosAlthius } from './dados';
import { decidirAprovacao, listarAprovacoes, type AprovacaoTela, type DecisaoTela } from './servicos/aprovacoes';

export interface AlthiusAppProps {
  dados: DadosAlthius;
  supabase: SupabaseClient;
  aoSair: () => void;
}

export class AlthiusApp extends AlthiusLogic<AlthiusAppProps> {
  // Fora da demonstração não existe troca de papel: o papel vem do banco.
  modoDemo = false;

  componentDidMount() {
    // Os "services" do protótipo são o ponto de troca: as telas chamam list/decide sem saber de onde vêm os dados.
    this.props.dados.approvalService = {
      list: () => this.carregarAprovacoes(),
      decide: (id: string, decisao: DecisaoTela) => this.registrarDecisao(id, decisao)
    };
    super.componentDidMount?.();
  }

  componentDidUpdate(prevProps: Readonly<AlthiusAppProps>, prevState: Readonly<Record<string, any>>) {
    super.componentDidUpdate?.(prevProps, prevState);
    // Trocou de workspace: a fila de aprovações passa a ser a do novo workspace.
    if (this.state.pronto && prevState.rota?.ws !== this.state.rota?.ws) {
      this.carregarAprovacoes()
        .then(aprov => this.setState({ aprov, decisoes: {}, apSel: null }))
        .catch(falha => this.avisarFalha('Não foi possível carregar as aprovações', falha));
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
    return { ...super.renderVals(), modoDemo: this.modoDemo, sair: () => this.props.aoSair() };
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
    this.confirmar(titulo, 'Verifique a conexão e tente de novo em instantes.', 'Entendi', () => {});
  }
}
