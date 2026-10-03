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

export interface FerramentasAgente {
  buscarContatos(): Promise<ContatoAgente[]>;
  proporAtualizacao(pedido: PedidoProposta): Promise<ResultadoProposta>;
}

export const TOKEN_INVALIDO = 'Token do agente inválido ou revogado.';

function erroDoBanco(error: { code?: string; message?: string }, mensagem: string): Error {
  if (error.code === '28000') return new Error(TOKEN_INVALIDO, { cause: error });
  // 55000: agente pausado pelo cliente (botão de emergência); a mensagem do banco é a que o agente deve ver.
  if (error.code === '55000' && error.message) return new Error(error.message, { cause: error });
  return new Error(mensagem, { cause: error });
}

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
    }
  };
}
