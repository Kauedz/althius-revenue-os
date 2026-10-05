// Pipeline ligado ao banco: quadros por motion (máximo 5), negócios nas 6 etapas fixas, histórico de quem moveu.
// Formato de saída = o que o v18 já lê em `pipe()` (quadros por motion, negócios com `etapa`, `status` ok/risco/atraso).
import type { SupabaseClient } from '@supabase/supabase-js';
import { nomesDosMembros } from './nomes';

export type Motion = 'slg' | 'mlg' | 'plg';
export const MOTIONS: Motion[] = ['slg', 'mlg', 'plg'];
export const ETAPAS = ['entrada', 'qualificacao', 'descoberta', 'proposta', 'negociacao', 'ganho'];

export interface NegocioTela {
  id: string;
  /** id da conta (no v18, `cid`) */
  cid: string;
  conta: string;
  dono: string;
  donoId: string | null;
  cidade: string;
  /** AAAA-MM-DD ou vazio */
  fecha: string;
  valor: number;
  etapa: string;
  status: 'ok' | 'risco' | 'atraso';
  prob: number;
}

export interface QuadroTela {
  id: string;
  nome: string;
  /** ordem das etapas; null = a padrão */
  ordem: string[] | null;
  deals: NegocioTela[];
}

export interface PipelineTela {
  quadros: Record<Motion, QuadroTela[]>;
}

export const pipelineVazio = (): PipelineTela => ({ quadros: { slg: [], mlg: [], plg: [] } });

const SITUACAO: Record<string, NegocioTela['status']> = { no_prazo: 'ok', em_risco: 'risco', atrasado: 'atraso' };
const SITUACAO_BANCO: Record<NegocioTela['status'], string> = { ok: 'no_prazo', risco: 'em_risco', atraso: 'atrasado' };

export async function listarPipeline(cliente: SupabaseClient, workspaceId: string): Promise<PipelineTela> {
  const { data: quadros, error } = await cliente.from('pipelines')
    .select('id, motion, name, stage_order, created_at').eq('workspace_id', workspaceId).order('created_at').order('id');
  if (error) throw new Error('Não foi possível carregar os quadros do Pipeline.', { cause: error });

  const { data: negocios, error: erroNeg } = await cliente.from('opportunities')
    .select('id, pipeline_id, account_id, stage_key, amount, close_date, win_probability, health, position, created_at, owner_member_id, account:accounts(name, city, state_uf)')
    .eq('workspace_id', workspaceId).in('status', ['ativa', 'ganho']).order('position').order('created_at');
  if (erroNeg) throw new Error('Não foi possível carregar os negócios do Pipeline.', { cause: erroNeg });

  const nomes = await nomesDosMembros(cliente, (negocios || []).map(n => n.owner_member_id as string), 'Não foi possível carregar os responsáveis dos negócios.');

  const saida = pipelineVazio();
  const porQuadro = new Map<string, QuadroTela>();
  for (const q of quadros || []) {
    const ordem = Array.isArray(q.stage_order) ? (q.stage_order as string[]) : null;
    const padrao = ordem && ordem.length === ETAPAS.length && ordem.every((e, i) => e === ETAPAS[i]);
    const quadro: QuadroTela = { id: q.id, nome: q.name, ordem: padrao ? null : ordem, deals: [] };
    saida.quadros[q.motion as Motion].push(quadro);
    porQuadro.set(q.id, quadro);
  }
  for (const n of negocios || []) {
    const quadro = porQuadro.get(n.pipeline_id);
    if (!quadro) continue;
    const conta = (Array.isArray(n.account) ? n.account[0] : n.account) as { name: string; city: string | null; state_uf: string | null } | null;
    quadro.deals.push({
      id: n.id, cid: n.account_id, conta: conta?.name ?? '—', dono: nomes.get(n.owner_member_id) || '—', donoId: n.owner_member_id,
      cidade: [conta?.city, conta?.state_uf].filter(Boolean).join(', ') || '—', fecha: n.close_date ?? '', valor: Number(n.amount),
      etapa: n.stage_key, status: SITUACAO[n.health] ?? 'ok', prob: n.win_probability
    });
  }
  return saida;
}

export type Resultado = { ok: true; id?: string } | { ok: false; mensagem: string };

const CODIGOS_COM_MENSAGEM = ['42501', '22023', 'P0001'];
export function falhaDoBanco(error: { code?: string; message?: string }, generica: string): { ok: false; mensagem: string } {
  return { ok: false, mensagem: error.code && CODIGOS_COM_MENSAGEM.includes(error.code) && error.message ? error.message : generica };
}

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>, generica: string): Promise<Resultado> {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) return falhaDoBanco(error, generica);
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

export const criarQuadro = (c: SupabaseClient, ws: string, membro: string, motion: Motion, nome: string) =>
  chamar(c, 'pipeline_create', { p_workspace_id: ws, p_member_id: membro, p_motion: motion, p_name: nome }, 'Não foi possível criar o quadro. Tente de novo.');

export const renomearQuadro = (c: SupabaseClient, ws: string, membro: string, quadroId: string, nome: string) =>
  chamar(c, 'pipeline_rename', { p_workspace_id: ws, p_member_id: membro, p_pipeline_id: quadroId, p_name: nome }, 'Não foi possível renomear o quadro. Tente de novo.');

export const excluirQuadro = (c: SupabaseClient, ws: string, membro: string, quadroId: string) =>
  chamar(c, 'pipeline_delete', { p_workspace_id: ws, p_member_id: membro, p_pipeline_id: quadroId }, 'Não foi possível excluir o quadro. Tente de novo.');

export const reordenarEtapas = (c: SupabaseClient, ws: string, membro: string, quadroId: string, ordem: string[]) =>
  chamar(c, 'pipeline_reorder_stages', { p_workspace_id: ws, p_member_id: membro, p_pipeline_id: quadroId, p_stage_order: ordem }, 'Não foi possível reordenar as etapas. Tente de novo.');

export interface DadosNegocio {
  contaId: string;
  valor: number;
  /** AAAA-MM-DD ou vazio */
  fecha: string;
  prob: number;
  etapa: string;
  status: NegocioTela['status'];
  donoId: string;
}

export const criarNegocio = (c: SupabaseClient, ws: string, membro: string, quadroId: string, d: DadosNegocio) =>
  chamar(c, 'opportunity_create', {
    p_workspace_id: ws, p_member_id: membro, p_pipeline_id: quadroId, p_account_id: d.contaId, p_amount: d.valor, p_close_date: d.fecha || null,
    p_probability: d.prob, p_stage_key: d.etapa, p_health: SITUACAO_BANCO[d.status], p_owner_member_id: d.donoId
  }, 'Não foi possível criar o negócio. Tente de novo.');

export const atualizarNegocio = (c: SupabaseClient, ws: string, membro: string, negocioId: string, d: Omit<DadosNegocio, 'contaId'>) =>
  chamar(c, 'opportunity_update', {
    p_workspace_id: ws, p_member_id: membro, p_opportunity_id: negocioId, p_amount: d.valor, p_close_date: d.fecha || null,
    p_probability: d.prob, p_stage_key: d.etapa, p_health: SITUACAO_BANCO[d.status], p_owner_member_id: d.donoId
  }, 'Não foi possível salvar o negócio. Tente de novo.');

export const moverNegocio = (c: SupabaseClient, ws: string, membro: string, negocioId: string, etapa: string, antesId: string | null) =>
  chamar(c, 'opportunity_move', { p_workspace_id: ws, p_member_id: membro, p_opportunity_id: negocioId, p_to_stage: etapa, p_before_opportunity_id: antesId }, 'Não foi possível mover o negócio. Tente de novo.');

export const arquivarNegocio = (c: SupabaseClient, ws: string, membro: string, negocioId: string) =>
  chamar(c, 'opportunity_archive', { p_workspace_id: ws, p_member_id: membro, p_opportunity_id: negocioId }, 'Não foi possível remover o negócio. Tente de novo.');
