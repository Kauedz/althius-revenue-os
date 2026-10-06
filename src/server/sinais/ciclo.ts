// Uma rodada da coleta de sinais (spec .scratch/coleta-de-sinais, ADR 0055). O banco decide o que coletar e reserva o
// crédito (signal_collect_next); aqui só se busca o dado fora e se entrega o resultado (signal_collect_finish) ou a falha
// (signal_collect_fail, que devolve o crédito). Falha de coleta nunca vira acontecimento. O resultado só tem números.
import type { OpcoesColeta, ResultadoColeta } from '../providers/apify-pool.ts';
import type { AdaptadorApify, Frequencia } from './adaptadores/tipos.ts';
import { adaptadorDePosts } from './adaptadores/posts.ts';
import { adaptadorDeTrocaDeCargo } from './adaptadores/troca-cargo.ts';
import { adaptadorDeVagas } from './adaptadores/vagas.ts';
import { criarAdaptadorGenerico, type FonteGenerica } from './adaptadores/generico.ts';

export const ADAPTADORES: Record<string, AdaptadorApify> = {
  vagas_cargo: adaptadorDeVagas,
  troca_cargo: adaptadorDeTrocaDeCargo,
  posts_decisor: adaptadorDePosts
};

// `entrada` + `mapeamento`: receita montada pelo agente e aprovada pelo cliente (ADR 0060), lida pelo adaptador genérico.
interface FonteDaReceita {
  fonte: string; ator?: string; teto_usd?: number; max_itens?: number; build?: string; memoria_mb?: number; reserva?: boolean;
  entrada?: Record<string, unknown>; mapeamento?: FonteGenerica['mapeamento']; descricao?: string;
}
interface ContatoBruto { id: string; nome: string; papel?: string | null; linkedin_url: string; snapshot?: Record<string, unknown> | null }
interface Pedido {
  run_id: string; account_name: string; account_domain: string; signal_code: string;
  linkedin_company_name?: string | null; linkedin_company_url?: string | null; contatos?: ContatoBruto[];
  frequencia?: Frequencia; fontes: FonteDaReceita[];
}

export interface Coletor {
  coletar(ator: string, entrada: Record<string, unknown>, op: OpcoesColeta): Promise<ResultadoColeta>;
}

export interface OpcoesRodada {
  base: string;
  chaveServico: string;
  pool: Coletor;
  adaptadores?: Record<string, AdaptadorApify>;
  buscar?: typeof fetch;
  agora?: () => number;
  /** quantos pedidos por rodada */
  limite?: number;
  /** execuções ao mesmo tempo (a conta grátis da Apify aceita 5) */
  concorrencia?: number;
  esperaCustoMs?: number;
}
export type ResultadoRodada =
  | { ok: true; pedidos: number; concluidos: number; falhas: number; eventos_novos: number }
  | { ok: false; erro: string };

const recorta = (m: string) => m.replace(/\s+/g, ' ').trim().slice(0, 300) || 'falha na coleta';

export async function rodarSinais(o: OpcoesRodada): Promise<ResultadoRodada> {
  const buscar = o.buscar ?? fetch;
  const agora = o.agora ?? Date.now;
  const adaptadores = o.adaptadores ?? ADAPTADORES;
  const rpc = (nome: string, corpo: Record<string, unknown>) => buscar(`${o.base.replace(/\/$/, '')}/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });

  let pedidos: Pedido[];
  try {
    const r = await rpc('signal_collect_next', { p_limit: o.limite ?? 20 });
    if (!r.ok) return { ok: false, erro: `banco recusou o pedido de coleta (HTTP ${r.status})` };
    pedidos = (await r.json().catch(() => [])) as Pedido[];
  } catch { return { ok: false, erro: 'banco indisponível' }; }
  if (!Array.isArray(pedidos)) pedidos = [];

  let concluidos = 0, falhas = 0, eventosNovos = 0;

  async function falhar(p: Pedido, mensagem: string) {
    falhas++;
    await rpc('signal_collect_fail', { p_run_id: p.run_id, p_mensagem: recorta(mensagem) }).catch(() => undefined);
  }

  async function tratar(p: Pedido) {
    const fontes = Array.isArray(p.fontes) ? p.fontes : [];
    // Fonte com mapeamento usa o adaptador genérico; as outras, o adaptador escrito pela equipe para o sinal.
    const adaptadorDe = (f: FonteDaReceita): AdaptadorApify | undefined =>
      f.mapeamento && f.ator ? criarAdaptadorGenerico({ ator: f.ator, entrada: f.entrada ?? {}, mapeamento: f.mapeamento, descricao: f.descricao }) : adaptadores[p.signal_code];
    if (fontes.length ? fontes.some(f => !adaptadorDe(f)) : !adaptadores[p.signal_code]) return falhar(p, `Sinal ${p.signal_code} sem adaptador de coleta.`);
    if (!fontes.length || fontes.some(f => f.fonte !== 'apify' || !f.ator)) return falhar(p, 'Fonte ainda não suportada pelo coletor.');
    const conta = {
      nome: p.account_name, dominio: p.account_domain, linkedinNome: p.linkedin_company_name ?? null, linkedinUrl: p.linkedin_company_url ?? null,
      contatos: (p.contatos ?? []).map(c => ({ id: c.id, nome: c.nome, papel: c.papel ?? null, linkedinUrl: c.linkedin_url, snapshot: c.snapshot ?? null }))
    };
    const ctx = { agora: agora(), frequencia: p.frequencia ?? 'semanal' };

    const itensTotal: unknown[] = [];
    const eventos: ReturnType<AdaptadorApify['eventos']> = [];
    const retratos: NonNullable<ReturnType<NonNullable<AdaptadorApify['retratos']>>> = [];
    let custo: number | null = null;
    let custoConhecido = true;
    let algumaOk = false;
    let ultimoErro = 'nenhuma fonte respondeu';

    const rodar = async (f: FonteDaReceita) => {
      const adaptador = adaptadorDe(f)!;
      try {
        const entrada = adaptador.entrada(f.ator!, conta, ctx);
        const r = await o.pool.coletar(f.ator!, entrada, { maxItens: f.max_itens ?? 25, tetoUsd: f.teto_usd ?? 0, build: f.build, memoriaMb: f.memoria_mb, esperaCustoMs: o.esperaCustoMs });
        if (r.custoUsd === null) custoConhecido = false; else custo = (custo ?? 0) + r.custoUsd;
        // Só itens de erro (ex.: o ator recusou a entrada) não é "sem novidade": é falha.
        const erros = r.itens.map(i => (i && typeof i === 'object' && !Array.isArray(i) ? (i as Record<string, unknown>).error : undefined));
        if (r.itens.length > 0 && erros.every(Boolean)) throw new Error(`A fonte devolveu só erros: ${String(erros[0]).slice(0, 120)}`);
        itensTotal.push(...r.itens);
        eventos.push(...adaptador.eventos(f.ator!, r.itens, conta, ctx));
        if (adaptador.retratos) retratos.push(...adaptador.retratos(f.ator!, r.itens, conta));
        algumaOk = true;
      } catch (e) { ultimoErro = e instanceof Error ? e.message : String(e); }
    };

    for (const f of fontes.filter(x => !x.reserva)) await rodar(f);
    if (!algumaOk) for (const f of fontes.filter(x => x.reserva)) { await rodar(f); if (algumaOk) break; }
    if (!algumaOk) return falhar(p, ultimoErro);

    // Deduplica dentro da própria rodada (duas fontes podem ver a mesma vaga); o banco repete a conferência.
    const unicos = [...new Map(eventos.map(e => [e.chave, e])).values()];
    try {
      const r = await rpc('signal_collect_finish', { p_run_id: p.run_id, p_eventos: unicos, p_itens: itensTotal.length, p_custo_usd: custoConhecido ? custo : null });
      if (!r.ok) return falhar(p, `banco recusou o resultado (HTTP ${r.status})`);
      const j = (await r.json().catch(() => ({}))) as { eventos_novos?: number };
      concluidos++;
      eventosNovos += Number(j.eventos_novos) || 0;
    } catch { return falhar(p, 'banco indisponível ao entregar o resultado'); }
    // O retrato só vale depois de o resultado entregue. Se falhar, a próxima rodada compara com o retrato antigo e o
    // banco não repete o acontecimento (mesma chave), então nada se perde nem se duplica.
    if (retratos.length) await rpc('signal_snapshot_save', { p_run_id: p.run_id, p_snapshots: retratos }).catch(() => undefined);
  }

  // Poucas execuções ao mesmo tempo: cada trabalhador pega o próximo pedido da fila.
  const fila = [...pedidos];
  const trabalhadores = Array.from({ length: Math.max(1, Math.min(o.concorrencia ?? 3, fila.length || 1)) }, async () => {
    for (let p = fila.shift(); p; p = fila.shift()) await tratar(p);
  });
  await Promise.all(trabalhadores);
  return { ok: true, pedidos: pedidos.length, concluidos, falhas, eventos_novos: eventosNovos };
}
