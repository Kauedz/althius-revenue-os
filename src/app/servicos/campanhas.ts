// Campanhas do workspace. Investimento e CPL não existem em creditos: ficam "Sem dados ainda". Nunca dolar.
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEM_DADOS = 'Sem dados ainda';

export interface CampanhaTela {
  id: string;
  nome: string;
  canal: string;
  investido: string;
  leads: string;
  cpl: string;
  status: string;
}

export interface CampanhasTela {
  podeEditar: boolean;
  kpis: Array<[string, string, string]>;
  linhas: CampanhaTela[];
}

export interface NovaCampanha {
  nome: string;
  canal: string;
}

const ERRO_CARGA = 'Não foi possível carregar as campanhas.';
const ERRO_GRAVAR = 'Não foi possível gravar a campanha.';
const ERRO_ATIVAR = 'Não foi possível ativar a campanha.';
const ERRO_PAUSAR = 'Não foi possível pausar a campanha.';
const CANAL_INVALIDO = 'Escolha o canal da campanha.';
const NOME_OBRIGATORIO = 'Dê um nome à campanha.';

const CANAL: Record<string, string> = {
  linkedin_ads: 'LinkedIn Ads',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organico: 'Orgânico',
  evento: 'Evento',
  seo_geo: 'SEO/GEO'
};
const STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  pausada: 'Pausada',
  concluida: 'Concluída'
};

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function canalDe(rotulo: string): string | null {
  const t = rotulo.trim().toLowerCase();
  const direto = Object.keys(CANAL).find(codigo => codigo === t);
  if (direto) return direto;
  const peloNome = Object.entries(CANAL).find(([, nome]) => nome.toLowerCase() === t);
  return peloNome ? peloNome[0] : null;
}

export function campanhasSemDados(): CampanhasTela {
  return {
    podeEditar: false,
    kpis: [
      ['Investimento', SEM_DADOS, SEM_DADOS],
      ['Leads gerados', '0', SEM_DADOS],
      ['Pipeline influenciado', SEM_DADOS, SEM_DADOS],
      ['Campanhas ativas', '0', SEM_DADOS]
    ],
    linhas: []
  };
}

interface ItemBruto {
  id?: unknown;
  name?: unknown;
  channel_type?: unknown;
  status?: unknown;
  leads_count?: unknown;
}

function montar(data: { ok?: boolean; erro?: string; pode_editar?: boolean; itens?: ItemBruto[] } | null): CampanhasTela {
  if (!data || data.ok !== true) {
    throw new Error(data && typeof data.erro === 'string' && data.erro ? data.erro : ERRO_CARGA);
  }
  const itens = Array.isArray(data.itens) ? data.itens : [];
  let leads = 0;
  let ativas = 0;
  const linhas = itens.map(item => {
    const n = typeof item.leads_count === 'number' ? item.leads_count : Number(item.leads_count);
    const qtd = Number.isFinite(n) ? Math.round(n) : 0;
    leads += qtd;
    if (texto(item.status) === 'ativa') ativas += 1;
    const canal = CANAL[texto(item.channel_type)] || SEM_DADOS;
    const status = STATUS[texto(item.status)] || SEM_DADOS;
    return {
      id: texto(item.id),
      nome: texto(item.name) || SEM_DADOS,
      canal,
      investido: SEM_DADOS,
      leads: String(qtd),
      cpl: SEM_DADOS,
      status
    };
  });
  return {
    podeEditar: data.pode_editar === true,
    kpis: [
      ['Investimento', SEM_DADOS, SEM_DADOS],
      ['Leads gerados', String(leads), SEM_DADOS],
      ['Pipeline influenciado', SEM_DADOS, SEM_DADOS],
      ['Campanhas ativas', String(ativas), SEM_DADOS]
    ],
    linhas
  };
}

export async function listarCampanhas(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<CampanhasTela> {
  const { data, error } = await cliente.rpc('campaign_list', { p_workspace_id: workspaceId, p_member_id: membroId });
  if (error) throw new Error(ERRO_CARGA, { cause: error });
  return montar(data);
}

async function resultado(cliente: SupabaseClient, nome: string, args: Record<string, unknown>, erroPadrao: string) {
  const { data, error } = await cliente.rpc(nome, args);
  if (error) return { ok: false as const, mensagem: erroPadrao };
  if (data?.ok) return data as { ok: true; id?: string; destino?: string; mensagem?: string };
  return { ok: false as const, mensagem: (typeof data?.erro === 'string' && data.erro) || erroPadrao };
}

export async function salvarCampanha(
  cliente: SupabaseClient, workspaceId: string, membroId: string, item: NovaCampanha
): Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const canal = canalDe(item.canal || '');
  if (!canal) return { ok: false, mensagem: CANAL_INVALIDO };
  if (!texto(item.nome)) return { ok: false, mensagem: NOME_OBRIGATORIO };
  const data = await resultado(cliente, 'campaign_save', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_name: texto(item.nome), p_channel: canal
  }, ERRO_GRAVAR);
  if (!data.ok) return data;
  return { ok: true, id: String(data.id || '') };
}

export async function ativarCampanha(
  cliente: SupabaseClient, workspaceId: string, membroId: string, id: string
): Promise<{ ok: true; destino: string; mensagem: string } | { ok: false; mensagem: string }> {
  const data = await resultado(cliente, 'campaign_activate', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_id: id
  }, ERRO_ATIVAR);
  if (!data.ok) return data;
  return { ok: true, destino: String(data.destino || ''), mensagem: data.mensagem || '' };
}

export async function pausarCampanha(
  cliente: SupabaseClient, workspaceId: string, membroId: string, id: string
): Promise<{ ok: true; mensagem: string } | { ok: false; mensagem: string }> {
  const data = await resultado(cliente, 'campaign_pause', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_id: id
  }, ERRO_PAUSAR);
  if (!data.ok) return data;
  return { ok: true, mensagem: data.mensagem || 'Campanha pausada.' };
}
