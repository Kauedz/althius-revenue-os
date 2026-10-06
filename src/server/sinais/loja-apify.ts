// Loja da Apify para o agente (ADR 0060): buscar fontes e ler o que uma fonte aceita e devolve. Só endereços PÚBLICOS da
// Apify (nenhuma chave, nenhum custo). O agente nunca vê dólar: o preço vira créditos estimados (preço do crédito e
// câmbio de referência, os mesmos do banco: internal.signal_teto_usd). O texto da loja vem de terceiros: é dado, nunca ordem.
import { PRECO_CREDITO_BRL } from '../../app/precos.ts';

/** Câmbio de referência do dono (ADR 0055). Só para estimar créditos; nunca aparece para ninguém. */
export const CAMBIO_REFERENCIA = 5.5;
const API = 'https://api.apify.com/v2';

export interface PrecoEmCreditos {
  /** como a fonte cobra, em palavras */
  modelo: 'por_resultado' | 'por_evento' | 'aluguel_mensal' | 'por_uso_de_maquina' | 'desconhecido';
  /** créditos estimados para 100 resultados (no plano mais caro da Apify); nulo quando não dá para saber */
  creditos_por_100_resultados: number | null;
  observacao?: string;
}
export interface FonteDaLoja {
  ator: string;
  titulo: string;
  descricao: string;
  usuarios_30_dias: number | null;
  avaliacao: number | null;
  /** % das execuções públicas dos últimos 30 dias que terminaram bem */
  sucesso_30_dias: number | null;
  preco: PrecoEmCreditos;
}
export interface ParametroDaFonte { nome: string; tipo: string; obrigatorio: boolean; descricao?: string; opcoes?: unknown[]; exemplo?: unknown }
export interface DetalheDaFonte extends FonteDaLoja {
  parametros: ParametroDaFonte[];
  exemplo_de_entrada: unknown;
  leia_me: string;
}

const emCreditos = (usd: number) => Math.round((usd * CAMBIO_REFERENCIA / PRECO_CREDITO_BRL) * 10) / 10;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Preço em dólar escrito pelo autor do ator ("$0.4/1K jobs") sai do texto: o agente fala em créditos (ADR 0021).
const semDolar = (t: string) => t.replace(/(US)?\$\s?\d[\d.,]*(\s?(\/|per|por)\s?[\w.]+)*/gi, '[preço omitido]');
const corta = (t: unknown, n: number) => { const s = typeof t === 'string' ? semDolar(t.replace(/\s+/g, ' ').trim()) : ''; return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'; };

/** O maior preço entre os planos (o pior caso), ou o preço único. */
function precoDoEvento(e: Record<string, unknown>): number | null {
  const unico = num(e.eventPriceUsd);
  if (unico !== null) return unico;
  const tiers = e.eventTieredPricingUsd && typeof e.eventTieredPricingUsd === 'object' ? Object.values(e.eventTieredPricingUsd as Record<string, { tieredEventPriceUsd?: unknown }>) : [];
  const valores = tiers.map(t => num(t?.tieredEventPriceUsd)).filter((x): x is number => x !== null);
  return valores.length ? Math.max(...valores) : null;
}

/** Converte a tabela de preço da Apify em créditos estimados. Nunca devolve dólar. */
export function precoEmCreditos(info: unknown): PrecoEmCreditos {
  const p = info && typeof info === 'object' ? (info as Record<string, unknown>) : {};
  switch (p.pricingModel) {
    case 'PRICE_PER_DATASET_ITEM': {
      const usd = num(p.pricePerUnitUsd);
      return { modelo: 'por_resultado', creditos_por_100_resultados: usd === null ? null : emCreditos(usd * 100) };
    }
    case 'PAY_PER_EVENT': {
      const eventos = ((p.pricingPerEvent as { actorChargeEvents?: Record<string, Record<string, unknown>> } | undefined)?.actorChargeEvents) ?? {};
      const lista = Object.entries(eventos);
      const principal = lista.find(([, e]) => e.isPrimaryEvent === true) ?? lista.find(([k]) => k === 'apify-default-dataset-item');
      const porResultado = principal ? precoDoEvento(principal[1]) : null;
      const inicio = lista.filter(([, e]) => e.isOneTimeEvent === true).map(([, e]) => precoDoEvento(e) ?? 0).reduce((a, b) => a + b, 0);
      return {
        modelo: 'por_evento',
        creditos_por_100_resultados: porResultado === null ? null : emCreditos(porResultado * 100 + inicio),
        ...(lista.length > 2 ? { observacao: 'Cobra mais de um tipo de evento: confira o custo real no teste.' } : {})
      };
    }
    case 'FLAT_PRICE_PER_MONTH':
      return { modelo: 'aluguel_mensal', creditos_por_100_resultados: null, observacao: 'Exige aluguel mensal do ator: evite.' };
    case 'FREE':
      return { modelo: 'por_uso_de_maquina', creditos_por_100_resultados: null, observacao: 'Cobra pelo uso de máquina; o custo só aparece no teste.' };
    default:
      return { modelo: 'desconhecido', creditos_por_100_resultados: null };
  }
}

function resumoDaLoja(it: Record<string, unknown>, preco: unknown): FonteDaLoja {
  const stats = (it.stats ?? {}) as Record<string, unknown>;
  const runs = (stats.publicActorRunStats30Days ?? {}) as Record<string, unknown>;
  const total = num(runs.TOTAL);
  const ok = num(runs.SUCCEEDED);
  return {
    ator: `${String(it.username)}/${String(it.name)}`,
    titulo: corta(it.title, 120),
    descricao: corta(it.description, 300),
    usuarios_30_dias: num(stats.totalUsers30Days),
    // Sem avaliação a loja diz 0: isso é "ninguém avaliou", não nota zero.
    avaliacao: (num(it.actorReviewRating ?? stats.actorReviewRating) ?? 0) > 0 ? Math.round(num(it.actorReviewRating ?? stats.actorReviewRating)! * 10) / 10 : null,
    sucesso_30_dias: total && ok !== null ? Math.round((ok / total) * 100) : null,
    preco: precoEmCreditos(preco)
  };
}

const ATOR = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

async function lerJson(buscar: typeof fetch, url: string): Promise<Record<string, unknown> | null> {
  let r: Response;
  try { r = await buscar(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); } catch { throw new Error('A loja da Apify não respondeu agora. Tente de novo em instantes.'); }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`A loja da Apify recusou a consulta (HTTP ${r.status}).`);
  const j = (await r.json().catch(() => null)) as { data?: unknown } | null;
  return j?.data && typeof j.data === 'object' && !Array.isArray(j.data) ? (j.data as Record<string, unknown>) : null;
}

/** Busca fontes na loja, mais usadas primeiro. Ator descontinuado ou de aluguel sai da lista. */
export async function buscarFontes(busca: string, limite = 8, buscar: typeof fetch = fetch): Promise<FonteDaLoja[]> {
  const termo = busca.trim().slice(0, 100);
  if (!termo) throw new Error('Diga o que procurar (ex.: "linkedin jobs", "google maps reviews").');
  const q = new URLSearchParams({ search: termo, limit: String(Math.min(Math.max(limite, 1), 15) + 5), sortBy: 'relevance' });
  const d = await lerJson(buscar, `${API}/store?${q}`);
  const itens = Array.isArray(d?.items) ? (d!.items as Array<Record<string, unknown>>) : [];
  return itens
    .filter(it => !it.isDeprecated && (it.currentPricingInfo as { pricingModel?: string } | undefined)?.pricingModel !== 'FLAT_PRICE_PER_MONTH')
    .map(it => resumoDaLoja(it, it.currentPricingInfo))
    .slice(0, Math.min(Math.max(limite, 1), 15));
}

/** O preço que vale agora: o último da lista que já começou. */
function precoAtual(lista: unknown, agora: number): unknown {
  if (!Array.isArray(lista)) return null;
  const validos = lista.filter(p => p && typeof p === 'object' && (!(p as { startedAt?: string }).startedAt || Date.parse((p as { startedAt: string }).startedAt) <= agora));
  return validos.length ? validos[validos.length - 1] : null;
}

/** O que a fonte aceita (parâmetros da entrada) e um pedaço do leia-me. */
export async function detalharFonte(ator: string, buscar: typeof fetch = fetch, agora = Date.now()): Promise<DetalheDaFonte | null> {
  if (!ATOR.test(ator)) throw new Error('Ator inválido (use dono/nome, como veio em sinais_buscar_fontes).');
  const id = ator.replace('/', '~');
  const act = await lerJson(buscar, `${API}/acts/${encodeURIComponent(id)}`);
  if (!act) return null;
  const buildId = ((act.taggedBuilds as Record<string, { buildId?: string }> | undefined)?.latest?.buildId) ?? null;
  const build = buildId ? await lerJson(buscar, `${API}/actor-builds/${encodeURIComponent(buildId)}`) : null;
  let esquema: Record<string, unknown> = {};
  try {
    const bruto = build?.inputSchema ?? (build?.actorDefinition as { input?: unknown } | undefined)?.input;
    esquema = (typeof bruto === 'string' ? JSON.parse(bruto) : bruto ?? {}) as Record<string, unknown>;
  } catch { esquema = {}; }
  const obrig = new Set(Array.isArray(esquema.required) ? (esquema.required as string[]) : []);
  const props = (esquema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const parametros: ParametroDaFonte[] = Object.entries(props).slice(0, 40).map(([nome, p]) => ({
    nome,
    tipo: String(p.type ?? (p.enum ? 'string' : 'desconhecido')),
    obrigatorio: obrig.has(nome),
    ...(p.description || p.title ? { descricao: corta(p.description ?? p.title, 200) } : {}),
    ...(Array.isArray(p.enum) ? { opcoes: (p.enum as unknown[]).slice(0, 15) } : {}),
    ...(p.prefill !== undefined || p.example !== undefined || p.default !== undefined ? { exemplo: p.prefill ?? p.example ?? p.default } : {})
  }));
  let exemplo: unknown = null;
  try {
    const corpo = (act.exampleRunInput as { body?: string } | undefined)?.body;
    exemplo = corpo ? JSON.parse(corpo) : null;
  } catch { exemplo = null; }
  return {
    ...resumoDaLoja({ ...act, actorReviewRating: (act.stats as Record<string, unknown> | undefined)?.actorReviewRating }, precoAtual(act.pricingInfos, agora)),
    descricao: corta(act.description ?? act.readmeSummary, 300),
    parametros,
    exemplo_de_entrada: exemplo,
    leia_me: corta(build?.readme ?? act.readmeSummary, 2500)
  };
}
