// Painel de coleta do cliente (ADR 0069): quanto da capacidade de coleta do mês já foi usada, quantos créditos de sinais
// foram gastos e o teto de sinais (que o C-level ajusta). Nunca dólar: o banco só devolve porcentagem e créditos.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PainelColeta {
  coletaPercentual: number;
  coletaRestanteCreditos: number;
  coletaAtingida: boolean;
  sinaisTeto: number;
  sinaisGasto: number;
  contasMonitoradas: number;
  podeEditarTeto: boolean;
}

const FALHA = 'Não foi possível carregar a coleta do mês.';
const nf = (n: number) => n.toLocaleString('pt-BR');
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export async function lerPainelDeColeta(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<PainelColeta> {
  const { data, error } = await cliente.rpc('coleta_painel', { p_workspace_id: workspaceId, p_member_id: membroId });
  if (error || !data) throw new Error(FALHA, { cause: error });
  return {
    coletaPercentual: inteiro(data.coleta_percentual), coletaRestanteCreditos: inteiro(data.coleta_restante_creditos),
    coletaAtingida: data.coleta_atingida === true, sinaisTeto: inteiro(data.sinais_teto), sinaisGasto: inteiro(data.sinais_gasto),
    contasMonitoradas: inteiro(data.contas_monitoradas), podeEditarTeto: data.pode_editar_teto === true
  };
}

/** Os números do painel em linhas de KPI da página de Sinais. */
export function kpisDaColeta(p: PainelColeta): Array<[string, string, string]> {
  return [
    ['Coleta do mês', `${p.coletaPercentual}%`, p.coletaAtingida ? 'limite atingido: fale com a Althius' : `restam cerca de ${nf(p.coletaRestanteCreditos)} créditos de coleta`],
    ['Sinais no mês', `${nf(p.sinaisGasto)} de ${nf(p.sinaisTeto)}`, p.sinaisTeto === 0 ? 'sinais automáticos desligados' : 'créditos de sinais (teto mensal)'],
    ['Contas monitoradas', nf(p.contasMonitoradas), 'os sinais delas rodam sozinhos']
  ];
}

/** Só C-level e superadmin mudam o teto (regra de créditos); o banco valida e devolve a mensagem. */
export async function salvarTetoDeSinais(cliente: SupabaseClient, workspaceId: string, membroId: string, teto: number): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  if (!Number.isInteger(teto) || teto < 0) return { ok: false, mensagem: 'Informe o teto só com números inteiros (0 desliga os sinais automáticos).' };
  const { error } = await cliente.rpc('signal_budget_set', { p_workspace_id: workspaceId, p_member_id: membroId, p_teto: teto });
  if (error) return { ok: false, mensagem: error.message || 'Não foi possível salvar o teto.' };
  return { ok: true };
}
