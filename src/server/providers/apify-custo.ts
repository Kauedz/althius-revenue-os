// Custo real de uma execução da Apify (só o superadmin vê; ADR 0021). Portado do protótipo AppAlthius
// (supabase/functions/signal-scan/apify.ts), onde foi conferido em execução real: a Apify fecha a conta alguns
// segundos depois de a execução terminar, então vale o maior entre o total da plataforma e a soma dos eventos cobrados.
const numeroValido = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const registro = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const cobraPorEvento = (run: Record<string, unknown>) => registro(run.pricingInfo).pricingModel === 'PAY_PER_EVENT';

export const eventosCobrados = (run: Record<string, unknown>): Array<[string, number]> =>
  Object.entries(registro(run.chargedEventCounts)).filter(([, n]) => numeroValido(n)) as Array<[string, number]>;

/** A cobrança como texto: duas leituras com o mesmo texto não mudaram. */
export function assinaturaDaCobranca(run: Record<string, unknown>): string {
  return JSON.stringify([numeroValido(run.usageTotalUsd), eventosCobrados(run).sort(([a], [b]) => (a < b ? -1 : 1))]);
}

/**
 * `usageTotalUsd` já inclui os eventos que o ator cobrou, mas só depois que a Apify fecha a conta. Enquanto não fechou,
 * a soma dos eventos (quantidade × preço da faixa Free) vale no lugar: fica o maior dos dois. Ator por evento sem nenhum
 * evento, ou evento sem preço sem o total da Apify, deixa o custo nulo, em vez de um valor menor que o real.
 */
export function custoDaExecucaoLida(execucao: unknown): number | null {
  const run = registro(execucao);
  const plataforma = numeroValido(run.usageTotalUsd);
  const contagens = eventosCobrados(run);
  if (!contagens.length) return cobraPorEvento(run) ? null : plataforma;
  const eventos = registro(registro(registro(run.pricingInfo).pricingPerEvent).actorChargeEvents);
  let total = 0;
  for (const [nome, quantidade] of contagens) {
    const e = registro(eventos[nome]);
    const preco = numeroValido(e.eventPriceUsd) ?? numeroValido(registro(registro(e.eventTieredPricingUsd).FREE).tieredEventPriceUsd);
    if (preco === null) return plataforma ? plataforma : null;
    total += quantidade * preco;
  }
  return Math.round(Math.max(plataforma ?? 0, total) * 1e6) / 1e6;
}
