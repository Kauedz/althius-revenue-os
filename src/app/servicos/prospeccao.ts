// Listas da página prospecting: só Lista e Enriquecimento que o banco devolve.
// O que não existe aparece como "Sem dados ainda". Nunca dólar. Nada é gravado.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENTES_EXIBICAO } from '../agentes-exibicao';

export const SEM_DADOS = 'Sem dados ainda';

export interface KpiProspeccao {
  label: string;
  valor: string;
  delta: string;
}

export interface ListaProspeccao {
  id: string;
  nome: string;
  origem: string;
  contas: string;
  validos: string;
  status: string;
}

export interface ProspeccaoTela {
  kpis: KpiProspeccao[];
  listas: ListaProspeccao[];
}

const ERRO = 'Não foi possível carregar as listas de prospecção.';

const STATUS: Record<string, string> = {
  pending_approval: 'Aguardando aprovação',
  scheduled: 'Agendada',
  queued: 'Na fila',
  reserving_credits: 'Reservando créditos',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  partial: 'Concluída parcialmente',
  failed: 'Falhou',
  cancelled: 'Cancelada'
};

const AGENTES: Record<string, string> = Object.fromEntries(Object.entries(AGENTES_EXIBICAO).map(([codigo, a]) => [codigo, a.nome]));

const ROTULOS = ['Listas', 'Contas', 'Válidos', 'Créditos'];

function texto(valor: unknown): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : '';
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inteiro(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function soma(valores: Array<number | null>): string {
  if (valores.length === 0) return '0';
  let total = 0;
  for (const valor of valores) {
    if (valor === null) return SEM_DADOS;
    total += valor;
  }
  return inteiro(total);
}

function listaVazia(): ListaProspeccao {
  return { id: 'sem-dados', nome: SEM_DADOS, origem: SEM_DADOS, contas: SEM_DADOS, validos: SEM_DADOS, status: SEM_DADOS };
}

/** Tela vazia de verdade: nenhum nome nem número do protótipo. */
export function prospeccaoSemDados(): ProspeccaoTela {
  return {
    kpis: ROTULOS.map(label => ({ label, valor: SEM_DADOS, delta: SEM_DADOS })),
    listas: [listaVazia()]
  };
}

interface ExecucaoLista {
  id?: unknown;
  title?: unknown;
  agent_code?: unknown;
  status?: unknown;
  processed_count?: unknown;
  valid_count?: unknown;
  actual_credits?: unknown;
}

function montar(brutos: ExecucaoLista[]): ProspeccaoTela {
  const listas = brutos.map(bruto => {
    const codigo = texto(bruto.agent_code);
    const estado = texto(bruto.status);
    const contas = numero(bruto.processed_count);
    const validos = numero(bruto.valid_count);
    return {
      id: texto(bruto.id) || SEM_DADOS,
      nome: texto(bruto.title) || SEM_DADOS,
      origem: (codigo && AGENTES[codigo]) || (codigo ? codigo : SEM_DADOS),
      contas: contas === null ? SEM_DADOS : inteiro(contas),
      validos: validos === null ? SEM_DADOS : inteiro(validos),
      status: (estado && STATUS[estado]) || SEM_DADOS
    };
  });
  const contas = brutos.map(b => numero(b.processed_count));
  const validos = brutos.map(b => numero(b.valid_count));
  const creditos = brutos.map(b => numero(b.actual_credits));
  const valores = [String(brutos.length), soma(contas), soma(validos), soma(creditos)];
  return {
    kpis: ROTULOS.map((label, i) => ({ label, valor: valores[i], delta: SEM_DADOS })),
    listas: listas.length ? listas : [listaVazia()]
  };
}

/** Lê as listas de prospecção do workspace. Não grava nada. */
export async function listarProspeccao(cliente: SupabaseClient, workspaceId: string): Promise<ProspeccaoTela> {
  const acesso = await cliente.rpc('get_revenue_funnel_summary', { p_workspace_id: workspaceId });
  if (acesso.error) {
    const msg = acesso.error.message || '';
    if (acesso.error.code === '42501' || /acesso|permiss/i.test(msg)) {
      throw new Error(msg || 'Sem acesso a este workspace.');
    }
    throw new Error(ERRO, { cause: acesso.error });
  }

  const { data, error } = await cliente
    .from('executions')
    .select('id, title, execution_type, agent_code, status, processed_count, valid_count, actual_credits')
    .eq('workspace_id', workspaceId)
    .in('execution_type', ['Lista', 'Enriquecimento'])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw new Error(ERRO, { cause: error });
  return montar((data || []) as ExecucaoLista[]);
}
