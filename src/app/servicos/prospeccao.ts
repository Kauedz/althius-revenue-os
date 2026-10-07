// Página Prospecção (ADR 0067): as CANDIDATAS que as buscas da Zoe trouxeram e o estado de cada busca, lidos do banco.
// A pessoa inclui (vira conta e entra no enriquecimento) ou exclui; o crédito da busca já foi gasto e não volta.
// Só créditos, nunca dólar. Falha de leitura vira erro claro (nunca número inventado).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LinhaCandidata {
  id: string;
  nome: string;
  site: string;
  local: string;
  categoria: string;
  busca: string;
  status: 'Candidata' | 'Incluída' | 'Excluída';
  semSite: boolean;
}

export interface ProspeccaoTela {
  /** [rótulo, valor, detalhe] como o protótipo usa */
  kpis: Array<[string, string, string]>;
  linhas: LinhaCandidata[];
  /** uma frase por busca recente, do mais novo */
  buscas: string[];
}

const ERRO = 'Não foi possível carregar a prospecção.';

const ESTADO_CANDIDATA: Record<string, LinhaCandidata['status']> = { candidata: 'Candidata', incluida: 'Incluída', excluida: 'Excluída' };
const ESTADO_BUSCA: Record<string, string> = {
  estimada: 'estimada, esperando o pedido', aprovacao: 'aguardando aprovação do gasto', pendente: 'na fila', reservada: 'rodando',
  concluida: 'concluída', sem_resultado: 'sem empresa nova', erro: 'erro', cancelada: 'cancelada'
};

interface Busca {
  id: string; titulo: string; estado: string; creditos_cobrados: number; creditos_estimados: number; encontradas: number; repetidas: number;
  fora_do_filtro: number; mensagem: string | null; created_at: string;
}
interface Candidata { id: string; search_id: string; nome: string; dominio: string | null; cidade: string | null; uf: string | null; categoria: string | null; estado: string }

const n = (x: number) => Math.round(x || 0).toLocaleString('pt-BR');
const plural = (q: number, um: string, varios: string) => `${n(q)} ${q === 1 ? um : varios}`;

/** Tela vazia de verdade: nenhum nome nem número do protótipo. */
export function prospeccaoVazia(): ProspeccaoTela {
  return { kpis: [['Buscas', '0', ''], ['Candidatas', '0', 'esperando decisão'], ['Incluídas', '0', 'viraram contas'], ['Créditos em buscas', '0', '']], linhas: [], buscas: [] };
}

function frase(b: Busca): string {
  const estado = ESTADO_BUSCA[b.estado] ?? b.estado;
  if (b.estado === 'concluida' || b.estado === 'sem_resultado') {
    const partes = [estado, plural(b.encontradas, 'nova', 'novas')];
    if (b.repetidas) partes.push(plural(b.repetidas, 'repetida', 'repetidas'));
    if (b.fora_do_filtro) partes.push(`${n(b.fora_do_filtro)} fora do ICP`);
    partes.push(plural(b.creditos_cobrados, 'crédito', 'créditos'));
    return `${b.titulo}: ${partes.join(', ')}`;
  }
  if (b.estado === 'erro') return `${b.titulo}: erro${b.mensagem ? ` (${b.mensagem})` : ''}, crédito devolvido`;
  if (b.estado === 'estimada' || b.estado === 'aprovacao' || b.estado === 'pendente' || b.estado === 'reservada') {
    return `${b.titulo}: ${estado}, até ${plural(b.creditos_estimados, 'crédito', 'créditos')}`;
  }
  return `${b.titulo}: ${estado}`;
}

/** Lê buscas e candidatas do workspace (o banco só devolve as do próprio cliente). Não grava nada. */
export async function listarProspeccao(cliente: SupabaseClient, workspaceId: string): Promise<ProspeccaoTela> {
  const [buscas, candidatas] = await Promise.all([
    cliente.from('prospect_searches')
      .select('id, titulo, estado, creditos_cobrados, creditos_estimados, encontradas, repetidas, fora_do_filtro, mensagem, created_at')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200),
    cliente.from('prospect_candidates')
      .select('id, search_id, nome, dominio, cidade, uf, categoria, estado')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1000)
  ]);
  if (buscas.error || candidatas.error) throw new Error(ERRO, { cause: buscas.error || candidatas.error });
  const bs = (buscas.data || []) as Busca[];
  const cs = (candidatas.data || []) as Candidata[];
  if (!bs.length && !cs.length) return prospeccaoVazia();

  const titulo = new Map(bs.map(b => [b.id, b.titulo]));
  // Candidatas esperando decisão primeiro; depois as já decididas.
  const ordem = (c: Candidata) => (c.estado === 'candidata' ? 0 : 1);
  const linhas = [...cs].sort((a, b) => ordem(a) - ordem(b)).map<LinhaCandidata>(c => ({
    id: c.id,
    nome: c.nome,
    site: c.dominio || 'Sem site',
    local: [c.cidade, c.uf].filter(Boolean).join('/') || '—',
    categoria: c.categoria || '—',
    busca: titulo.get(c.search_id) || '—',
    status: ESTADO_CANDIDATA[c.estado] ?? 'Candidata',
    semSite: !c.dominio
  }));
  const rodando = bs.filter(b => b.estado === 'pendente' || b.estado === 'reservada').length;
  const aprovacao = bs.filter(b => b.estado === 'aprovacao').length;
  const detalhe = [rodando ? `${n(rodando)} rodando` : '', aprovacao ? `${n(aprovacao)} aguardando aprovação` : ''].filter(Boolean).join(' · ');
  return {
    kpis: [
      ['Buscas', n(bs.length), detalhe],
      ['Candidatas', n(cs.filter(c => c.estado === 'candidata').length), 'esperando decisão'],
      ['Incluídas', n(cs.filter(c => c.estado === 'incluida').length), 'viraram contas'],
      ['Créditos em buscas', n(bs.reduce((s, b) => s + (b.creditos_cobrados || 0), 0)), '']
    ],
    linhas,
    buscas: bs.slice(0, 5).map(frase)
  };
}

export type ResultadoDecisao =
  | { ok: true; incluidas: number; ligadas: number; semSite: number; excluidas: number }
  | { ok: false; mensagem: string };

/** Incluir (vira conta; site que já é conta só liga) ou excluir candidatas. `dominios`: site digitado para quem não tinha. */
export async function decidirCandidatas(cliente: SupabaseClient, workspaceId: string, membroId: string, ids: string[], acao: 'incluir' | 'excluir',
  dominios: Record<string, string> = {}): Promise<ResultadoDecisao> {
  const { data, error } = await cliente.rpc('prospect_candidates_decide', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_ids: ids, p_acao: acao, p_dominios: dominios
  });
  if (error) return { ok: false, mensagem: error.message || 'Não foi possível registrar a decisão.' };
  const r = (data || {}) as Record<string, number>;
  return { ok: true, incluidas: r.incluidas ?? 0, ligadas: r.ligadas ?? 0, semSite: r.sem_site ?? 0, excluidas: r.excluidas ?? 0 };
}
