// Uma rodada do aprendizado compartilhado (ADR 0052): pede ao banco para recalcular os padrões e emitir sugestões.
// Quem decide o que entra é o banco (só clientes que aceitaram, mínimo de clientes, sem cliente dominante).
export interface OpcoesCiclo {
  base: string;
  chaveServico: string;
  buscar?: typeof fetch;
  /** mínimo de clientes por padrão; o banco não deixa baixar de 3 */
  kMin?: number;
  /** mínimo de envios por padrão; o banco não deixa baixar de 20 */
  enviosMin?: number;
}
export type ResultadoCiclo = { ok: true; clientes_contribuindo: number; padroes: number; sugestoes_novas: number } | { ok: false; erro: string };

export async function rodarAprendizado(o: OpcoesCiclo): Promise<ResultadoCiclo> {
  const buscar = o.buscar ?? fetch;
  let r: Response;
  try {
    r = await buscar(`${o.base.replace(/\/$/, '')}/rpc/aprendizado_executar`, {
      method: 'POST',
      headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_k_min: Math.max(3, o.kMin ?? 3), p_envios_min: Math.max(20, o.enviosMin ?? 30) })
    });
  } catch { return { ok: false, erro: 'banco indisponível' }; }
  if (!r.ok) return { ok: false, erro: `banco recusou o motor (HTTP ${r.status})` };
  const j = (await r.json().catch(() => ({}))) as Record<string, number>;
  return { ok: true, clientes_contribuindo: Number(j.clientes_contribuindo) || 0, padroes: Number(j.padroes) || 0, sugestoes_novas: Number(j.sugestoes_novas) || 0 };
}
