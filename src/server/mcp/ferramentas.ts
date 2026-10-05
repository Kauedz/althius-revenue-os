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

export interface FerramentasAgente {
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

export function ferramentasDoAgente(cliente: SupabaseClient, token: string): FerramentasAgente {
  return {
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
    }
  };
}
