// Uma rodada do enriquecimento (ADR 0062). Mesmo desenho da coleta de sinais (ADR 0055): o banco escolhe e reserva o
// crédito (enrichment_next); aqui só se busca fora e se entrega (enrichment_finish) ou se avisa a falha (enrichment_fail,
// que devolve o crédito e tenta de novo mais tarde). Não achar nada não é falha: o banco devolve a reserva sem cobrar.
// O log só tem números.
import type { Coletor } from '../sinais/ciclo.ts';
import { enriquecerEmpresa, type ContaParaEnriquecer, type OpcoesEmpresa } from './empresa.ts';
import { acharPessoas, type FonteDeTelefone, type Persona } from './pessoas.ts';

interface Trabalho {
  job_id: string;
  etapa: 'empresa' | 'pessoas';
  workspace_id: string;
  creditos: number;
  teto_usd: number;
  conta: {
    id: string; nome: string; dominio: string | null; cnpj: string | null; razao_social: string | null; cidade: string | null; uf: string | null;
    cep: string | null; endereco: string | null; lat: number | null; lng: number | null; linkedin_nome: string | null; linkedin_url: string | null;
  };
  personas_alvo?: Persona[];
  max_pessoas?: number;
  ja_tem?: string[];
}

export interface OpcoesEnriquecimento {
  base: string;
  chaveServico: string;
  /** Apify (rodízio de chaves). Sem chave, a etapa "pessoas" falha com aviso claro e tenta de novo depois. */
  pool: Coletor;
  buscar?: typeof fetch;
  /** fontes públicas da etapa "empresa" (para teste) */
  empresa?: OpcoesEmpresa;
  telefone?: FonteDeTelefone | null;
  limite?: number;
  concorrencia?: number;
  esperaCustoMs?: number;
}
export type ResultadoRodadaEnriquecimento =
  | { ok: true; pedidos: number; concluidos: number; falhas: number }
  | { ok: false; erro: string };

const recorta = (m: string) => m.replace(/\s+/g, ' ').trim().slice(0, 300) || 'falha no enriquecimento';

export async function rodarEnriquecimento(o: OpcoesEnriquecimento): Promise<ResultadoRodadaEnriquecimento> {
  const buscar = o.buscar ?? fetch;
  const rpc = (nome: string, corpo: Record<string, unknown>) => buscar(`${o.base.replace(/\/$/, '')}/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });

  let trabalhos: Trabalho[];
  try {
    const r = await rpc('enrichment_next', { p_limit: o.limite ?? 10 });
    if (!r.ok) return { ok: false, erro: `banco recusou o pedido de enriquecimento (HTTP ${r.status})` };
    trabalhos = (await r.json().catch(() => [])) as Trabalho[];
  } catch { return { ok: false, erro: 'banco indisponível' }; }
  if (!Array.isArray(trabalhos)) trabalhos = [];

  let concluidos = 0, falhas = 0;
  const falhar = async (t: Trabalho, msg: string) => {
    falhas++;
    await rpc('enrichment_fail', { p_job_id: t.job_id, p_mensagem: recorta(msg) }).catch(() => undefined);
  };
  const entregar = async (t: Trabalho, resultado: Record<string, unknown>, custo: number | null) => {
    try {
      const r = await rpc('enrichment_finish', { p_job_id: t.job_id, p_resultado: resultado, p_custo_usd: custo });
      if (!r.ok) return falhar(t, `banco recusou o resultado (HTTP ${r.status})`);
      concluidos++;
    } catch { return falhar(t, 'banco indisponível ao entregar o resultado'); }
  };

  async function tratar(t: Trabalho) {
    const c = t.conta;
    try {
      if (t.etapa === 'empresa') {
        const conta: ContaParaEnriquecer = { id: c.id, nome: c.nome, dominio: c.dominio, cnpj: c.cnpj, cidade: c.cidade, uf: c.uf, cep: c.cep, endereco: c.endereco, lat: c.lat, lng: c.lng, linkedin_url: c.linkedin_url };
        const r = await enriquecerEmpresa(conta, { buscar, ...o.empresa });
        return entregar(t, { campos: r.campos, fontes: r.fontes }, 0);
      }
      const r = await acharPessoas({
        conta: { nome: c.nome, dominio: c.dominio, razao_social: c.razao_social, linkedin_url: c.linkedin_url },
        personas: Array.isArray(t.personas_alvo) ? t.personas_alvo.filter(p => p && typeof p.cargo === 'string' && p.cargo.trim()) : [],
        max: t.max_pessoas ?? 5,
        jaTem: Array.isArray(t.ja_tem) ? t.ja_tem : [],
        tetoUsd: Number(t.teto_usd) || 0
      }, { pool: o.pool, telefone: o.telefone, esperaCustoMs: o.esperaCustoMs });
      return entregar(t, { pessoas: r.pessoas }, r.custoUsd);
    } catch (e) {
      return falhar(t, e instanceof Error ? e.message : String(e));
    }
  }

  const fila = [...trabalhos];
  const trabalhadores = Array.from({ length: Math.max(1, Math.min(o.concorrencia ?? 2, fila.length || 1)) }, async () => {
    for (let t = fila.shift(); t; t = fila.shift()) await tratar(t);
  });
  await Promise.all(trabalhadores);
  return { ok: true, pedidos: trabalhos.length, concluidos, falhas };
}
