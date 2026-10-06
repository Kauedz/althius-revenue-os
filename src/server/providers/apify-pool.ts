// Rodízio de chaves da Apify (ADR 0049). O superadmin cadastra quantas quiser na tela (cofre); cada pedido vai para a
// chave menos ocupada, e chave que recusa ou estoura limite sai de cena por um tempo. Sem chave nenhuma, o pedido
// falha com mensagem clara: nada de resultado simulado. Sem cofre, valem as APIFY_TOKEN_* do `.env`.
import type { Cofre } from '../cofre/cofre.ts';

export interface ChaveApify { id: string | null; rotulo: string; segredo: string }
export interface ResultadoApify { runId: string; conta: string; status: string }

export interface OpcoesPoolApify {
  cofre: Cofre | null;
  buscar?: typeof fetch;
  env?: Record<string, string | undefined>;
  agora?: () => number;
  /** quanto tempo uma chave com problema fica de molho */
  deMolhoMs?: number;
}

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

  async function executar(ator: string, entrada: Record<string, unknown>): Promise<ResultadoApify> {
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
        const r = await buscar(`https://api.apify.com/v2/acts/${encodeURIComponent(ator)}/runs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${escolhida.segredo}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(entrada)
        });
        if (r.ok) {
          const corpo = (await r.json()) as { data: { id: string; status: string } };
          if (escolhida.id) await o.cofre?.marcarUso(escolhida.id, null);
          return { runId: corpo.data.id, conta: escolhida.rotulo, status: corpo.data.status };
        }
        if (r.status === 401 || r.status === 403) {
          ultimoErro = 'chave recusada pela Apify';
          if (escolhida.id) await o.cofre?.marcarUso(escolhida.id, 'Chave recusada pela Apify.');
        } else ultimoErro = r.status === 429 ? 'limite de uso da Apify' : `erro ${r.status} da Apify`;
        ateQuando.set(k, agora() + deMolho);
      } catch {
        ultimoErro = 'Apify fora do ar';
        ateQuando.set(k, agora() + deMolho);
      } finally {
        ocupadas.set(k, Math.max(0, (ocupadas.get(k) ?? 1) - 1));
      }
    }
    throw new Error(`Apify: nenhuma chave conseguiu rodar (${ultimoErro}).`);
  }

  return { executar, chaves };
}
