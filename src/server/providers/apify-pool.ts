// Rodízio de chaves da Apify (ADR 0049). O superadmin cadastra quantas quiser na tela (cofre); cada pedido vai para a
// chave menos ocupada, e chave que recusa ou estoura limite sai de cena por um tempo. Sem chave nenhuma, o pedido
// falha com mensagem clara: nada de resultado simulado. Sem cofre, valem as APIFY_TOKEN_* do `.env`.
import type { Cofre } from '../cofre/cofre.ts';
import { assinaturaDaCobranca, cobraPorEvento, custoDaExecucaoLida } from './apify-custo.ts';

export interface ChaveApify { id: string | null; rotulo: string; segredo: string }
export interface ResultadoApify { runId: string; conta: string; status: string }
export interface OpcoesColeta {
  /** quantos itens, no máximo, o ator devolve (e cobra) */
  maxItens: number;
  /** teto de gasto da execução, em dólar (custo real do fornecedor; nunca aparece para o cliente). Sem teto, não roda. */
  tetoUsd: number;
  /** versão do ator (ex.: 'latest'); alguns atores rodam por padrão uma versão antiga */
  build?: string;
  memoriaMb?: number;
  /** prazo da execução no ator, em segundos */
  prazoSeg?: number;
  /** espera antes de reler o custo: a Apify fecha a conta alguns segundos depois (0 lê uma vez só) */
  esperaCustoMs?: number;
}
export interface ResultadoColeta { itens: unknown[]; runId: string | null; conta: string; custoUsd: number | null }

/** Erro que não é culpa da chave (entrada recusada, prazo): não troca de chave nem a marca como ruim. */
class ErroFatalApify extends Error {}

export interface OpcoesPoolApify {
  cofre: Cofre | null;
  buscar?: typeof fetch;
  env?: Record<string, string | undefined>;
  agora?: () => number;
  /** quanto tempo uma chave com problema fica de molho */
  deMolhoMs?: number;
}

type Tentativa<T> = { ok: true; valor: T } | { ok: false; status: number };

export function criarPoolApify(o: OpcoesPoolApify) {
  const buscar = o.buscar ?? fetch;
  const env = o.env ?? process.env;
  const agora = o.agora ?? Date.now;
  const deMolho = o.deMolhoMs ?? 60_000;
  const ocupadas = new Map<string, number>();
  const ateQuando = new Map<string, number>();
  const chaveDe = (c: ChaveApify) => c.id ?? `env:${c.rotulo}`;

  async function chaves(): Promise<ChaveApify[]> {
    if (o.cofre) {
      try {
        const doCofre = await o.cofre.ler('apify');
        if (doCofre.length) return doCofre.map(c => ({ id: c.id, rotulo: c.rotulo, segredo: c.segredo }));
      } catch { /* cofre fora do ar: cai no .env */ }
    }
    return Object.entries(env)
      .filter(([k, v]) => /^APIFY_TOKEN_\d+$/.test(k) && (v ?? '').trim())
      .sort((a, b) => Number(a[0].split('_')[2]) - Number(b[0].split('_')[2]))
      .map(([k, v]) => ({ id: null, rotulo: `Conta ${k.split('_')[2]} (.env)`, segredo: String(v).trim() }));
  }

  /** Roda `fn` com a chave menos ocupada; chave recusada ou com limite sai de cena por um tempo e a próxima assume. */
  async function comRodizio<T>(fn: (c: ChaveApify) => Promise<Tentativa<T>>): Promise<T> {
    const todas = await chaves();
    if (!todas.length) throw new Error('Nenhuma chave da Apify cadastrada. O superadmin cadastra em Fornecedores.');
    const tentadas = new Set<string>();
    let ultimoErro = 'sem resposta';
    while (tentadas.size < todas.length) {
      const livres = todas.filter(c => !tentadas.has(chaveDe(c)) && (ateQuando.get(chaveDe(c)) ?? 0) <= agora());
      // Se todas estão de molho, tenta mesmo assim a que sai primeiro (melhor tentar do que parar tudo).
      const candidatas = livres.length ? livres : todas.filter(c => !tentadas.has(chaveDe(c)));
      const escolhida = [...candidatas].sort((a, b) => (ocupadas.get(chaveDe(a)) ?? 0) - (ocupadas.get(chaveDe(b)) ?? 0))[0];
      const k = chaveDe(escolhida);
      tentadas.add(k);
      ocupadas.set(k, (ocupadas.get(k) ?? 0) + 1);
      try {
        const r = await fn(escolhida);
        if (r.ok) {
          if (escolhida.id) await o.cofre?.marcarUso(escolhida.id, null);
          return r.valor;
        }
        if (r.status === 401 || r.status === 403) {
          ultimoErro = 'chave recusada pela Apify';
          if (escolhida.id) await o.cofre?.marcarUso(escolhida.id, 'Chave recusada pela Apify.');
        } else ultimoErro = r.status === 429 ? 'limite de uso da Apify' : `erro ${r.status} da Apify`;
        ateQuando.set(k, agora() + deMolho);
      } catch (e) {
        if (e instanceof ErroFatalApify) throw e;
        ultimoErro = 'Apify fora do ar';
        ateQuando.set(k, agora() + deMolho);
      } finally {
        ocupadas.set(k, Math.max(0, (ocupadas.get(k) ?? 1) - 1));
      }
    }
    throw new Error(`Apify: nenhuma chave conseguiu rodar (${ultimoErro}).`);
  }

  async function executar(ator: string, entrada: Record<string, unknown>): Promise<ResultadoApify> {
    return comRodizio<ResultadoApify>(async c => {
      const r = await buscar(`https://api.apify.com/v2/acts/${encodeURIComponent(ator)}/runs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.segredo}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada)
      });
      if (!r.ok) return { ok: false, status: r.status };
      const corpo = (await r.json()) as { data: { id: string; status: string } };
      return { ok: true, valor: { runId: corpo.data.id, conta: c.rotulo, status: corpo.data.status } };
    });
  }

  const lerRegistro = async (url: string, segredo: string): Promise<Record<string, unknown> | null> => {
    try {
      const r = await buscar(url, { headers: { Authorization: `Bearer ${segredo}` } });
      if (!r.ok) return null;
      const d = ((await r.json().catch(() => null)) as { data?: unknown } | null)?.data;
      return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
    } catch { return null; }
  };

  // Nas rotas de coleta a Apify entende o ator como dono~nome (com %2F a consulta da última execução dá 404).
  const idDoAtor = (ator: string) => ator.replace('/', '~');

  /** Roda o ator e devolve os itens na hora (endpoint síncrono), sempre com teto de gasto. Nunca devolve item inventado. */
  async function coletar(ator: string, entrada: Record<string, unknown>, op: OpcoesColeta): Promise<ResultadoColeta> {
    if (!(op.tetoUsd > 0)) throw new Error('Coleta sem teto de gasto: recusada.');
    return comRodizio<ResultadoColeta>(async c => {
      const q = new URLSearchParams({
        timeout: String(op.prazoSeg ?? 120),
        maxItems: String(op.maxItens),
        limit: String(op.maxItens),
        maxTotalChargeUsd: String(op.tetoUsd)
      });
      if (op.build) q.set('build', op.build);
      if (op.memoriaMb) q.set('memory', String(op.memoriaMb));
      const inicio = agora();
      const r = await buscar(`https://api.apify.com/v2/acts/${idDoAtor(ator)}/run-sync-get-dataset-items?${q}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.segredo}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada)
      });
      if (r.status === 408) throw new ErroFatalApify('Apify: o ator demorou demais e foi interrompido.');
      if (r.status === 400 || r.status === 404 || r.status === 422) throw new ErroFatalApify(`Apify recusou a entrada do ator (HTTP ${r.status}).`);
      if (!r.ok) return { ok: false, status: r.status };
      const itens = await r.json().catch(() => null);
      if (!Array.isArray(itens)) throw new ErroFatalApify('Apify: resposta inesperada (não veio uma lista de itens).');
      let runId = r.headers.get('x-apify-run-id');
      if (!runId) {
        // Sem o cabeçalho: a última execução do ator nesta conta, aceita só se começou depois da chamada.
        const ultima = await lerRegistro(`https://api.apify.com/v2/acts/${idDoAtor(ator)}/runs/last`, c.segredo);
        const comecou = typeof ultima?.startedAt === 'string' ? Date.parse(ultima.startedAt) : NaN;
        runId = typeof ultima?.id === 'string' && comecou >= inicio - 10_000 ? ultima.id : null;
      }
      let custoUsd: number | null = null;
      if (runId) {
        const url = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`;
        let run = await lerRegistro(url, c.segredo);
        const espera = op.esperaCustoMs ?? 3000;
        // A Apify fecha a conta alguns segundos depois: relê (no máximo 4 vezes) até duas leituras seguidas coincidirem.
        for (let i = 0; run && espera > 0 && cobraPorEvento(run) && i < 4; i++) {
          await new Promise(res => setTimeout(res, espera));
          const nova = await lerRegistro(url, c.segredo);
          if (!nova) break;
          const estavel = assinaturaDaCobranca(nova) === assinaturaDaCobranca(run);
          run = nova;
          if (estavel) break;
        }
        custoUsd = custoDaExecucaoLida(run);
      }
      return { ok: true, valor: { itens, runId, conta: c.rotulo, custoUsd } };
    });
  }

  return { executar, coletar, chaves };
}
