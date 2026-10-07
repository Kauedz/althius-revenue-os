// Uma rodada do Copiloto (ADR 0068): o banco entrega as perguntas com os números lidos agora (copilot_next); aqui se
// chama o modelo e se grava a resposta (copilot_answer) ou a falha verdadeira (copilot_fail). O log só tem números.
import type { Modelo } from './modelo.ts';
import { lerResposta, montarMensagens, type PerguntaCopiloto } from './prompts.ts';

export interface OpcoesCopiloto {
  base: string;
  chaveServico: string;
  modelo: Modelo;
  buscar?: typeof fetch;
  limite?: number;
}
export type ResultadoRodadaCopiloto = { ok: true; perguntas: number; respondidas: number; falhas: number } | { ok: false; erro: string };

export async function rodarCopiloto(o: OpcoesCopiloto): Promise<ResultadoRodadaCopiloto> {
  const buscar = o.buscar ?? fetch;
  const rpc = (nome: string, corpo: Record<string, unknown>) => buscar(`${o.base.replace(/\/$/, '')}/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });

  let perguntas: PerguntaCopiloto[];
  try {
    const r = await rpc('copilot_next', { p_limit: o.limite ?? 5 });
    if (!r.ok) return { ok: false, erro: `banco recusou o pedido de perguntas (HTTP ${r.status})` };
    perguntas = (await r.json().catch(() => [])) as PerguntaCopiloto[];
  } catch { return { ok: false, erro: 'banco indisponível' }; }
  if (!Array.isArray(perguntas)) perguntas = [];

  let respondidas = 0, falhas = 0;
  await Promise.all(perguntas.map(async p => {
    const r = await o.modelo(p.workspace_id, montarMensagens(p)).catch(() => ({ ok: false as const, motivo: 'falha inesperada no Copiloto' }));
    if (r.ok) {
      const { texto, encaminhar } = lerResposta(r.texto);
      if (texto) {
        const g = await rpc('copilot_answer', { p_id: p.id, p_texto: texto, p_encaminhar: encaminhar }).catch(() => null);
        if (g?.ok) { respondidas++; return; }
      }
    }
    falhas++;
    await rpc('copilot_fail', { p_id: p.id, p_motivo: r.ok ? 'não consegui gravar a resposta' : r.motivo }).catch(() => undefined);
  }));
  return { ok: true, perguntas: perguntas.length, respondidas, falhas };
}
