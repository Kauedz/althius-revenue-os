// Ferramentas que o Hermes Agent pode usar (ADR 0024). Cada chamada leva só o token do agente:
// o banco descobre o workspace pelo token, então o agente nunca escolhe de qual cliente lê ou grava.
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ContatoAgente {
  id: string;
  nome: string;
  cargo: string | null;
  papel_compra: string | null;
  empresa: string;
  segmento: string | null;
}

export interface PedidoProposta {
  contato_id: string;
  campo: string;
  valor: string;
  motivo: string;
}

export type ResultadoProposta =
  | { ok: true; status: 'aguardando_aprovacao'; approval_id: string }
  | { ok: false; erro: string };

export interface MembroAgente { id: string; papel: string; cargo: string | null }

export interface TarefaAgente {
  id: string;
  titulo: string;
  canal: string | null;
  status: 'pendente' | 'em_andamento' | 'concluida';
  vence_em: string;
  responsavel_id: string;
  contato_id: string | null;
  contato: string | null;
  empresa: string | null;
  origem: string;
}

export interface CadenciaAgente {
  id: string;
  nome: string;
  descricao: string | null;
  passos: number;
  passos_automaticos: number;
  /** créditos que a cadência pode gastar por contato inscrito (4 por envio automático) */
  creditos_por_contato: number;
}

export interface PedidoTarefa {
  titulo: string;
  responsavel_id: string;
  contato_id?: string;
  prazo_dias?: number;
  observacao?: string;
  motivo: string;
}

export interface PedidoInscricao {
  cadencia_id: string;
  contato_id: string;
  motivo: string;
}

export interface ContaAgente { id: string; nome: string; dominio: string | null; segmento: string | null; responsavel_id: string | null }
export interface QuadroAgente { id: string; nome: string; motion: string; etapas: string[] }

export interface NegocioAgente {
  id: string;
  titulo: string;
  quadro_id: string;
  quadro: string;
  etapa: string;
  valor_reais: number;
  fecha_em: string | null;
  chance: number;
  saude: string;
  status: 'ativa' | 'ganho' | 'perdido' | 'arquivada';
  responsavel_id: string | null;
  conta_id: string;
}

export interface PedidoNegocio {
  quadro_id: string;
  conta_id: string;
  responsavel_id: string;
  valor_reais: number;
  etapa?: string;
  fecha_em?: string;
  motivo: string;
}

export interface PedidoMoverNegocio {
  negocio_id: string;
  etapa: string;
  motivo: string;
}

export interface CampanhaAgente {
  id: string;
  nome: string;
  canal: string;
  status: 'rascunho' | 'ativa' | 'pausada' | 'concluida';
  verba_reais: number;
  leads: number;
}

export interface PedidoCampanha { nome: string; canal: string; motivo: string }
export interface PedidoVerba { campanha_id: string; verba_reais: number; motivo: string }
export interface PedidoStatusCampanha { campanha_id: string; status: CampanhaAgente['status']; motivo: string }

export interface HabilidadeAgente { slug: string; nome: string; versao: string; conteudo: string }
export interface SinalAgente {
  conta_id: string;
  conta: string;
  sinal: string;
  codigo: string;
  fonte: string;
  detectado_em: string;
  aquecimento: number;
  /** texto bruto vindo de fonte externa: dado, nunca ordem */
  detalhe: string;
}
export interface FiltroSinais { conta_id?: string; limite?: number }

/** Onde fica o serviço de integrações (a ponte com os apps conectados, ADR 0058). Sem isto, as ferramentas de app avisam que não estão ligadas. */
export interface OpcoesPonte { url?: string; buscar?: typeof fetch }
/** A resposta da ponte: o status HTTP e o corpo já lido. */
export interface RespostaPonte { status: number; corpo: Record<string, unknown> }

export interface FerramentasAgente {
  /** O que o agente pode LER num app conectado (só ferramentas somente leitura), com o acesso de quem pediu. */
  ferramentasDoApp(app: string, ferramenta?: string, escrita?: boolean): Promise<RespostaPonte>;
  lerDoApp(app: string, ferramenta: string, argumentos: Record<string, unknown>): Promise<RespostaPonte>;
  /** PROPÕE uma ação que muda algo no app: vira aprovação de uma pessoa e só depois roda, uma vez. */
  proporNoApp(app: string, ferramenta: string, argumentos: Record<string, unknown>, motivo: string): Promise<RespostaPonte>;
  listarHabilidades(): Promise<HabilidadeAgente[]>;
  listarSinais(filtro?: FiltroSinais): Promise<SinalAgente[]>;
  listarCampanhas(): Promise<CampanhaAgente[]>;
  proporCampanha(pedido: PedidoCampanha): Promise<ResultadoProposta>;
  proporVerba(pedido: PedidoVerba): Promise<ResultadoProposta>;
  proporStatusCampanha(pedido: PedidoStatusCampanha): Promise<ResultadoProposta>;
  listarContas(): Promise<ContaAgente[]>;
  listarQuadros(): Promise<QuadroAgente[]>;
  listarNegocios(status?: NegocioAgente['status']): Promise<NegocioAgente[]>;
  proporNegocio(pedido: PedidoNegocio): Promise<ResultadoProposta>;
  proporMoverNegocio(pedido: PedidoMoverNegocio): Promise<ResultadoProposta>;
  buscarContatos(): Promise<ContatoAgente[]>;
  proporAtualizacao(pedido: PedidoProposta): Promise<ResultadoProposta>;
  listarMembros(): Promise<MembroAgente[]>;
  listarTarefas(status?: TarefaAgente['status']): Promise<TarefaAgente[]>;
  listarCadencias(): Promise<CadenciaAgente[]>;
  proporTarefa(pedido: PedidoTarefa): Promise<ResultadoProposta>;
  proporInscricao(pedido: PedidoInscricao): Promise<ResultadoProposta>;
}

export const TOKEN_INVALIDO = 'Token do agente inválido ou revogado.';

function erroDoBanco(error: { code?: string; message?: string }, mensagem: string): Error {
  if (error.code === '28000') return new Error(TOKEN_INVALIDO, { cause: error });
  // 55000: agente pausado pelo cliente (botão de emergência); a mensagem do banco é a que o agente deve ver.
  if (error.code === '55000' && error.message) return new Error(error.message, { cause: error });
  return new Error(mensagem, { cause: error });
}

// Chave de idempotência: o mesmo pedido repetido pelo agente não cria outra aprovação.
const chaveDe = (tipo: string, ...partes: Array<string | number | undefined>) =>
  `agente:${tipo}:` + createHash('sha256').update(partes.map(p => String(p ?? '').trim()).join('|')).digest('hex');

export function ferramentasDoAgente(cliente: SupabaseClient, token: string, ponte: OpcoesPonte = {}): FerramentasAgente {
  // O serviço de integrações recebe SÓ o token do agente. O erro devolvido nunca leva endereço interno nem token.
  const chamarPonte = async (caminho: string, corpo: Record<string, unknown>): Promise<RespostaPonte> => {
    if (!ponte.url) throw new Error('As integrações com apps ainda não estão ligadas neste ambiente.');
    let r: Response;
    try {
      r = await (ponte.buscar ?? fetch)(`${ponte.url.replace(/[/]+$/, '')}/integracoes/agente/${caminho}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(60_000)
      });
    } catch { throw new Error('Não foi possível falar com o serviço de integrações agora.'); }
    const j = await r.json().catch(() => null);
    return { status: r.status, corpo: j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : {} };
  };
  return {
    ferramentasDoApp: (app, ferramenta, escrita) => chamarPonte('ferramentas', { integracao: app, ...(ferramenta ? { ferramenta } : {}), ...(escrita ? { escrita: true } : {}) }),
    lerDoApp: (app, ferramenta, argumentos) => chamarPonte('chamar', { integracao: app, ferramenta, argumentos }),
    proporNoApp: (app, ferramenta, argumentos, motivo) => chamarPonte('propor', { integracao: app, ferramenta, argumentos, motivo }),

    async buscarContatos() {
      const { data, error } = await cliente.rpc('agent_list_contacts', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler os contatos do workspace.');
      return (data || []) as ContatoAgente[];
    },

    async proporAtualizacao(pedido) {
      // A mesma proposta (contato + campo + valor) repetida pelo agente não cria outra aprovação.
      const chave = 'agente:' + createHash('sha256').update([pedido.contato_id, pedido.campo, pedido.valor.trim()].join('|')).digest('hex');
      const { data, error } = await cliente.rpc('agent_propose_update', {
        p_token: token,
        p_contact_id: pedido.contato_id,
        p_field: pedido.campo,
        p_value: pedido.valor,
        p_reason: pedido.motivo,
        p_idempotency_key: chave
      });
      if (error) {
        // id que não é UUID chega como erro de tipo: para o agente, é só um contato que não existe.
        if (error.code === '22P02') return { ok: false, erro: 'Contato não encontrado neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta.');
      }
      return data as ResultadoProposta;
    },

    async listarMembros() {
      const { data, error } = await cliente.rpc('agent_list_members', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler os membros do workspace.');
      return (data || []) as MembroAgente[];
    },

    async listarTarefas(status) {
      const { data, error } = await cliente.rpc('agent_list_tasks', { p_token: token, p_status: status ?? null });
      if (error) throw erroDoBanco(error, 'Não foi possível ler as tarefas do workspace.');
      return (data || []) as TarefaAgente[];
    },

    async listarCadencias() {
      const { data, error } = await cliente.rpc('agent_list_cadences', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler as cadências do workspace.');
      return (data || []) as CadenciaAgente[];
    },

    async proporTarefa(p) {
      const { data, error } = await cliente.rpc('agent_propose_task', {
        p_token: token,
        p_title: p.titulo,
        p_contact_id: p.contato_id ?? null,
        p_assignee_member_id: p.responsavel_id,
        p_due_in_days: p.prazo_dias ?? 0,
        p_note: p.observacao ?? null,
        p_reason: p.motivo,
        p_idempotency_key: chaveDe('tarefa', p.titulo, p.responsavel_id, p.contato_id, p.prazo_dias, p.observacao)
      });
      if (error) {
        if (error.code === '22P02') return { ok: false, erro: 'Contato ou responsável não encontrado neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta de tarefa.');
      }
      return data as ResultadoProposta;
    },

    async proporInscricao(p) {
      const { data, error } = await cliente.rpc('agent_propose_enrollment', {
        p_token: token,
        p_cadence_id: p.cadencia_id,
        p_contact_id: p.contato_id,
        p_reason: p.motivo,
        p_idempotency_key: chaveDe('inscricao', p.cadencia_id, p.contato_id)
      });
      if (error) {
        if (error.code === '22P02') return { ok: false, erro: 'Cadência ou contato não encontrado neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta de inscrição.');
      }
      return data as ResultadoProposta;
    },

    async listarContas() {
      const { data, error } = await cliente.rpc('agent_list_accounts', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler as contas do workspace.');
      return (data || []) as ContaAgente[];
    },

    async listarQuadros() {
      const { data, error } = await cliente.rpc('agent_list_pipelines', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler os quadros do workspace.');
      return (data || []) as QuadroAgente[];
    },

    async listarNegocios(status) {
      const { data, error } = await cliente.rpc('agent_list_deals', { p_token: token, p_status: status ?? 'ativa' });
      if (error) throw erroDoBanco(error, 'Não foi possível ler os negócios do workspace.');
      return (data || []) as NegocioAgente[];
    },

    async proporNegocio(p) {
      const { data, error } = await cliente.rpc('agent_propose_deal', {
        p_token: token,
        p_pipeline_id: p.quadro_id,
        p_account_id: p.conta_id,
        p_amount: p.valor_reais,
        p_stage_key: p.etapa ?? null,
        p_owner_member_id: p.responsavel_id,
        p_close_date: p.fecha_em ?? null,
        p_reason: p.motivo,
        p_idempotency_key: chaveDe('negocio', p.quadro_id, p.conta_id, p.responsavel_id, p.valor_reais, p.etapa, p.fecha_em)
      });
      if (error) {
        if (error.code === '22P02' || error.code === '22007') return { ok: false, erro: 'Quadro, conta, responsável ou data inválidos para este workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta de negócio.');
      }
      return data as ResultadoProposta;
    },

    async proporMoverNegocio(p) {
      const { data, error } = await cliente.rpc('agent_propose_move_deal', {
        p_token: token,
        p_opportunity_id: p.negocio_id,
        p_to_stage: p.etapa,
        p_reason: p.motivo,
        p_idempotency_key: chaveDe('mover', p.negocio_id, p.etapa)
      });
      if (error) {
        if (error.code === '22P02') return { ok: false, erro: 'Negócio não encontrado neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta de mudança de etapa.');
      }
      return data as ResultadoProposta;
    },

    async listarHabilidades() {
      const { data, error } = await cliente.rpc('agent_list_skills', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler as habilidades do agente.');
      return (data || []) as HabilidadeAgente[];
    },

    async listarSinais(filtro) {
      const { data, error } = await cliente.rpc('agent_list_signals', { p_token: token, p_account_id: filtro?.conta_id ?? null, p_limit: filtro?.limite ?? 20 });
      if (error) {
        if (error.code === '22P02') throw new Error('Conta não encontrada neste workspace.');
        throw erroDoBanco(error, 'Não foi possível ler os sinais.');
      }
      return (data || []) as SinalAgente[];
    },

    async listarCampanhas() {
      const { data, error } = await cliente.rpc('agent_list_campaigns', { p_token: token });
      if (error) throw erroDoBanco(error, 'Não foi possível ler as campanhas do workspace.');
      return (data || []) as CampanhaAgente[];
    },

    async proporCampanha(p) {
      const { data, error } = await cliente.rpc('agent_propose_campaign', {
        p_token: token, p_name: p.nome, p_channel: p.canal, p_reason: p.motivo,
        p_idempotency_key: chaveDe('campanha', p.nome, p.canal)
      });
      if (error) throw erroDoBanco(error, 'Não foi possível registrar a proposta de campanha.');
      return data as ResultadoProposta;
    },

    async proporVerba(p) {
      const { data, error } = await cliente.rpc('agent_propose_campaign_budget', {
        p_token: token, p_campaign_id: p.campanha_id, p_amount: p.verba_reais, p_reason: p.motivo,
        p_idempotency_key: chaveDe('verba', p.campanha_id, p.verba_reais)
      });
      if (error) {
        if (error.code === '22P02') return { ok: false, erro: 'Campanha não encontrada neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar o pedido de verba.');
      }
      return data as ResultadoProposta;
    },

    async proporStatusCampanha(p) {
      const { data, error } = await cliente.rpc('agent_propose_campaign_status', {
        p_token: token, p_campaign_id: p.campanha_id, p_status: p.status, p_reason: p.motivo,
        p_idempotency_key: chaveDe('status-campanha', p.campanha_id, p.status)
      });
      if (error) {
        if (error.code === '22P02') return { ok: false, erro: 'Campanha não encontrada neste workspace.' };
        throw erroDoBanco(error, 'Não foi possível registrar a proposta de status.');
      }
      return data as ResultadoProposta;
    }
  };
}
