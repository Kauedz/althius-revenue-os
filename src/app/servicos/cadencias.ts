// Cadências ligadas ao banco, no formato da lista genérica do v18 (ALTHIUS_MOD.cadences).
// BDR cria e edita só as dele; C-level só lê; passo automático só em e-mail e WhatsApp. Quem garante é o banco.
import type { SupabaseClient } from '@supabase/supabase-js';
import { falhaDoBanco, type Resultado } from './pipeline';

export interface CadenciaLinha {
  id: string;
  nome: string;
  passos: number;
  contatos: number;
  resposta: string;
  status: string;
  /** passos em texto corrido, para o detalhe */
  desc: string;
  /** descrição digitada (para salvar de novo sem perder) */
  descricao: string;
}

export interface CadenciasTela {
  kpis: string[][];
  linhas: CadenciaLinha[];
}

export const cadenciasVazias = (): CadenciasTela => ({ kpis: [], linhas: [] });

export const CANAL_PASSO: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', instagram: 'Instagram', call: 'Ligação' };
export const CANAL_PASSO_BANCO: Record<string, string> = Object.fromEntries(Object.entries(CANAL_PASSO).map(([k, v]) => [v, k]));
const STATUS_TELA: Record<string, string> = { ativa: 'Ativa', pausada: 'Pausada', arquivada: 'Arquivada' };
export const STATUS_CADENCIA_BANCO: Record<string, string> = { Ativa: 'ativa', Pausada: 'pausada', Arquivada: 'arquivada' };

const porcento = (parte: number, total: number) => (total > 0 ? (Math.round((parte / total) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—');

export async function listarCadencias(cliente: SupabaseClient, workspaceId: string): Promise<CadenciasTela> {
  const { data: cads, error } = await cliente.from('cadences').select('id, name, description, status').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar as cadências.', { cause: error });
  const { data: passos, error: erroPassos } = await cliente.from('cadence_steps')
    .select('cadence_id, step_number, channel, execution_mode, delay_days').eq('workspace_id', workspaceId).order('step_number');
  if (erroPassos) throw new Error('Não foi possível carregar os passos das cadências.', { cause: erroPassos });
  const { data: desempenho, error: erroDesempenho } = await cliente.from('view_cadence_performance')
    .select('cadence_id, total_enrolled, active_count, responded_count').eq('workspace_id', workspaceId);
  if (erroDesempenho) throw new Error('Não foi possível carregar o desempenho das cadências.', { cause: erroDesempenho });

  const dePasso = new Map<string, Array<{ step_number: number; channel: string; execution_mode: string; delay_days: number }>>();
  for (const p of passos || []) dePasso.set(p.cadence_id, (dePasso.get(p.cadence_id) || []).concat([p]));
  const dePerf = new Map((desempenho || []).map(d => [d.cadence_id, d]));

  const linhas: CadenciaLinha[] = (cads || []).map(c => {
    const ps = dePasso.get(c.id) || [];
    const perf = dePerf.get(c.id);
    const texto = ps.map(p => `Passo ${p.step_number}: ${CANAL_PASSO[p.channel] ?? p.channel}, ${p.execution_mode === 'auto' ? 'automático' : 'manual'}${p.delay_days ? `, espera ${p.delay_days} ${p.delay_days === 1 ? 'dia' : 'dias'}` : ''}.`).join(' ');
    return {
      id: c.id, nome: c.name, passos: ps.length, contatos: perf?.total_enrolled ?? 0, resposta: porcento(perf?.responded_count ?? 0, perf?.total_enrolled ?? 0),
      status: STATUS_TELA[c.status] ?? c.status, desc: [c.description, texto || 'Sem passos ainda. Use "Adicionar passo".'].filter(Boolean).join(' · '), descricao: c.description ?? ''
    };
  });

  const inscritos = (desempenho || []).reduce((s, d) => s + d.total_enrolled, 0);
  const responderam = (desempenho || []).reduce((s, d) => s + d.responded_count, 0);
  const emAndamento = (desempenho || []).reduce((s, d) => s + d.active_count, 0);
  const pausadas = linhas.filter(l => l.status === 'Pausada').length;
  const kpis = [
    ['Cadências ativas', String(linhas.filter(l => l.status === 'Ativa').length), pausadas ? `${pausadas} pausada${pausadas === 1 ? '' : 's'}` : ''],
    ['Contatos em cadência', String(emAndamento), ''],
    ['Taxa de resposta', porcento(responderam, inscritos), inscritos ? 'dos contatos inscritos' : ''],
    ['Contatos que responderam', String(responderam), 'a cadência pausa sozinha']
  ];
  return { kpis, linhas };
}

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>, generica: string): Promise<Resultado> {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) return falhaDoBanco(error, generica);
  return { ok: true, id: (data as { id?: string } | null)?.id };
}

export const salvarCadencia = (c: SupabaseClient, ws: string, membro: string, id: string | null, nome: string, descricao: string, status: string) =>
  chamar(c, 'cadence_save', { p_workspace_id: ws, p_member_id: membro, p_cadence_id: id, p_name: nome, p_description: descricao, p_status: STATUS_CADENCIA_BANCO[status] ?? status }, 'Não foi possível salvar a cadência. Tente de novo.');

export const adicionarPasso = (c: SupabaseClient, ws: string, membro: string, cadenciaId: string, p: { canal: string; modo: 'auto' | 'manual'; espera: number; assunto: string; texto: string }) =>
  chamar(c, 'cadence_add_step', { p_workspace_id: ws, p_member_id: membro, p_cadence_id: cadenciaId, p_channel: CANAL_PASSO_BANCO[p.canal] ?? p.canal, p_mode: p.modo, p_delay_days: p.espera, p_subject: p.assunto, p_body: p.texto }, 'Não foi possível adicionar o passo. Tente de novo.');

export const removerUltimoPasso = (c: SupabaseClient, ws: string, membro: string, cadenciaId: string) =>
  chamar(c, 'cadence_remove_last_step', { p_workspace_id: ws, p_member_id: membro, p_cadence_id: cadenciaId }, 'Não foi possível remover o passo. Tente de novo.');

export const inscreverContato = (c: SupabaseClient, ws: string, membro: string, cadenciaId: string, contatoId: string) =>
  chamar(c, 'cadence_enroll', { p_workspace_id: ws, p_member_id: membro, p_cadence_id: cadenciaId, p_contact_id: contatoId }, 'Não foi possível inscrever o contato. Tente de novo.');
