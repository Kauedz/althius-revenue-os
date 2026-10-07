// Uma rodada da prospecção (ADR 0067). Mesmo desenho do enriquecimento (ADR 0062): o banco escolhe a busca e reserva o
// crédito máximo (prospect_next); aqui só se roda a fonte na Apify, com o teto em dólar, e se entrega o que veio no
// formato comum (prospect_finish, que cobra só as empresas novas e devolve o resto) ou se avisa a falha (prospect_fail,
// que devolve tudo). O log só tem números.
import type { Coletor } from '../sinais/ciclo.ts';
import { mapearItens, montarEntrada, type MapeamentoProspeccao } from './fonte.ts';

interface Busca {
  search_id: string;
  workspace_id: string;
  titulo: string;
  parametros: Record<string, unknown>;
  max_empresas: number;
  teto_usd: number;
  fonte: { codigo: string; nome: string; ator: string; entrada: Record<string, unknown>; mapeamento: MapeamentoProspeccao };
}

export interface OpcoesProspeccao {
  base: string;
  chaveServico: string;
  /** Apify (rodízio de chaves do cofre). Sem chave, a busca falha com aviso claro e o crédito volta. */
  pool: Coletor;
  buscar?: typeof fetch;
  limite?: number;
  /** prazo de cada execução do ator, em segundos */
  prazoSeg?: number;
  esperaCustoMs?: number;
}
export type ResultadoRodadaProspeccao =
  | { ok: true; pedidos: number; concluidos: number; falhas: number }
  | { ok: false; erro: string };

const recorta = (m: string) => m.replace(/\s+/g, ' ').trim().slice(0, 300) || 'Falha na busca.';

export async function rodarProspeccao(o: OpcoesProspeccao): Promise<ResultadoRodadaProspeccao> {
  const buscar = o.buscar ?? fetch;
  const rpc = (nome: string, corpo: Record<string, unknown>) => buscar(`${o.base.replace(/\/$/, '')}/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });

  let buscas: Busca[];
  try {
    const r = await rpc('prospect_next', { p_limit: o.limite ?? 5 });
    if (!r.ok) return { ok: false, erro: `banco recusou o pedido de buscas (HTTP ${r.status})` };
    buscas = (await r.json().catch(() => [])) as Busca[];
  } catch { return { ok: false, erro: 'banco indisponível' }; }
  if (!Array.isArray(buscas)) buscas = [];

  let concluidos = 0, falhas = 0;
  const falhar = async (b: Busca, msg: string) => {
    falhas++;
    await rpc('prospect_fail', { p_search_id: b.search_id, p_mensagem: recorta(msg) }).catch(() => undefined);
  };

  // Uma busca por vez: cada uma pode trazer centenas de itens e o teto já é por busca.
  for (const b of buscas) {
    try {
      const entrada = montarEntrada(b.fonte.entrada, b.parametros, b.max_empresas);
      const r = await o.pool.coletar(b.fonte.ator, entrada, {
        maxItens: b.max_empresas, tetoUsd: Number(b.teto_usd) || 0, prazoSeg: o.prazoSeg ?? 300, esperaCustoMs: o.esperaCustoMs
      });
      const itens = mapearItens(r.itens, b.fonte.mapeamento);
      const fim = await rpc('prospect_finish', { p_search_id: b.search_id, p_itens: itens, p_custo_usd: r.custoUsd });
      if (!fim.ok) { await falhar(b, `banco recusou o resultado (HTTP ${fim.status})`); continue; }
      concluidos++;
    } catch (e) {
      await falhar(b, e instanceof Error ? e.message : String(e));
    }
  }
  return { ok: true, pedidos: buscas.length, concluidos, falhas };
}
