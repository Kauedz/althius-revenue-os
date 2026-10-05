// Campanhas ligadas ao banco, no formato da lista genérica do v18 (ALTHIUS_MOD.campaigns).
// Verba de mídia é GASTO: o estrategista pede, o C-level aprova; C-level e superadmin aplicam direto. Quem garante é o banco.
// Sem fonte de investimento real, CPL e pipeline influenciado NÃO aparecem (nada de número inventado).
import type { SupabaseClient } from '@supabase/supabase-js';
import { falhaDoBanco, type Resultado } from './pipeline';
import { SEM_DADOS } from './relatorios';

export const CANAIS_CAMPANHA: Record<string, string> = {
  linkedin_ads: 'LinkedIn Ads', meta_ads: 'Meta Ads', google_ads: 'Google Ads', organico: 'Orgânico', evento: 'Evento', seo_geo: 'SEO/GEO'
};
export const CANAL_CAMPANHA_BANCO: Record<string, string> = Object.fromEntries(Object.entries(CANAIS_CAMPANHA).map(([k, v]) => [v, k]));
const STATUS_TELA: Record<string, string> = { rascunho: 'Rascunho', ativa: 'Ativa', pausada: 'Pausada', concluida: 'Concluída' };
export const STATUS_CAMPANHA_BANCO: Record<string, string> = { Rascunho: 'rascunho', Ativa: 'ativa', Pausada: 'pausada', 'Concluída': 'concluida' };

export interface CampanhaLinha {
  id: string;
  nome: string;
  canal: string;
  /** verba aprovada, em reais */
  verba: string;
  verbaNumero: number;
  /** a tela de canais soma isto; sem fonte de investimento, fica vazio */
  investido: string;
  leads: number | string;
  cpl: string;
  status: string;
  desc?: string;
}

export interface CampanhasTela {
  kpis: string[][];
  linhas: CampanhaLinha[];
}

export const campanhasVazias = (): CampanhasTela => ({ kpis: [], linhas: [] });

export const reais = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

export async function listarCampanhas(cliente: SupabaseClient, workspaceId: string): Promise<CampanhasTela> {
  const { data, error } = await cliente.from('campaigns')
    .select('id, name, channel_type, status, budget_brl, leads_count').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar as campanhas.', { cause: error });

  // Pedidos de verba esperando o C-level (a tela avisa em cada campanha)
  const { data: pedidos, error: erroPedidos } = await cliente.from('approvals')
    .select('payload_json').eq('workspace_id', workspaceId).eq('status', 'pendente').eq('approval_type', 'orcamento');
  if (erroPedidos) throw new Error('Não foi possível carregar os pedidos de verba.', { cause: erroPedidos });
  const pedido = new Map<string, number>();
  for (const p of pedidos || []) {
    const j = p.payload_json as { acao?: string; campaign_id?: string; para?: number };
    if (j?.acao === 'verba_campanha' && j.campaign_id) pedido.set(j.campaign_id, Number(j.para));
  }

  const linhas: CampanhaLinha[] = (data || []).map(c => {
    const verba = Number(c.budget_brl);
    const espera = pedido.get(c.id);
    return {
      id: c.id, nome: c.name, canal: CANAIS_CAMPANHA[c.channel_type] ?? c.channel_type, verba: verba ? reais(verba) : '—', verbaNumero: verba,
      investido: SEM_DADOS, leads: c.leads_count > 0 ? c.leads_count : '—', cpl: '—', status: STATUS_TELA[c.status] ?? c.status,
      desc: espera !== undefined ? `Pedido de verba de ${reais(espera)} aguardando a aprovação do C-level.` : undefined
    };
  });
  const aprovada = linhas.reduce((s, l) => s + l.verbaNumero, 0);
  const leads = (data || []).reduce((s, c) => s + c.leads_count, 0);
  const kpis = [
    ['Verba aprovada', aprovada ? reais(aprovada) : '—', 'soma das campanhas'],
    ['Leads gerados', leads ? String(leads) : '—', ''],
    ['Pedidos de verba', String(pedido.size), pedido.size ? 'aguardando o C-level' : ''],
    ['Campanhas ativas', String(linhas.filter(l => l.status === 'Ativa').length), '']
  ];
  return { kpis, linhas };
}

export type ResultadoCampanha = Resultado & { acao?: string; pedido?: boolean };

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>, generica: string): Promise<ResultadoCampanha> {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) return falhaDoBanco(error, generica);
  const d = (data ?? {}) as { id?: string; action?: string; approval_id?: string | null };
  return { ok: true, id: d.id, acao: d.action, pedido: Boolean(d.approval_id) };
}

export const criarCampanha = (c: SupabaseClient, ws: string, membro: string, nome: string, canal: string, verba: number) =>
  chamar(c, 'campaign_create', { p_workspace_id: ws, p_member_id: membro, p_name: nome, p_channel: CANAL_CAMPANHA_BANCO[canal] ?? canal, p_budget: verba }, 'Não foi possível criar a campanha. Tente de novo.');

export const mudarVerba = (c: SupabaseClient, ws: string, membro: string, campanhaId: string, verba: number) =>
  chamar(c, 'campaign_set_budget', { p_workspace_id: ws, p_member_id: membro, p_campaign_id: campanhaId, p_amount: verba }, 'Não foi possível mudar a verba. Tente de novo.');

export const mudarStatusCampanha = (c: SupabaseClient, ws: string, membro: string, campanhaId: string, status: string) =>
  chamar(c, 'campaign_set_status', { p_workspace_id: ws, p_member_id: membro, p_campaign_id: campanhaId, p_status: STATUS_CAMPANHA_BANCO[status] ?? status }, 'Não foi possível mudar o status. Tente de novo.');
