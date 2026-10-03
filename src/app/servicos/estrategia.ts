// ICP e proposta de valor do workspace. Personas, segmentos e contas no ICP não existem no banco: ficam como "Sem dados ainda".
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEM_DADOS = 'Sem dados ainda';

export interface ItemEstrategia {
  id: string;
  nome: string;
  tipo: string;
  versao: string;
  status: string;
  resp: string;
  desc: string;
}

export interface EstrategiaTela {
  podeEditar: boolean;
  kpis: Array<[string, string, string]>;
  linhas: ItemEstrategia[];
}

export interface ItemEstrategiaInput {
  id?: string | null;
  tipo: string;
  nome: string;
  versao: string;
  texto: string;
}

const ERRO_CARGA = 'Não foi possível carregar a estratégia.';
const ERRO_GRAVAR = 'Não foi possível gravar a estratégia.';
const ERRO_SITUACAO = 'Não foi possível mudar a situação.';
const ESCOLHA = 'Escolha ICP ou proposta de valor.';
const NOME_OBRIGATORIO = 'Dê um nome ao item.';
const TIPO: Record<string, string> = { icp: 'ICP', oferta: 'Proposta de valor' };
const STATUS: Record<string, string> = { ativo: 'Ativo', rascunho: 'Rascunho', em_revisao: 'Em revisão' };

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function estrategiaSemDados(): EstrategiaTela {
  return {
    podeEditar: false,
    kpis: [
      ['ICP vigente', SEM_DADOS, SEM_DADOS],
      ['Personas', SEM_DADOS, SEM_DADOS],
      ['Segmentos', SEM_DADOS, SEM_DADOS],
      ['Contas no ICP', SEM_DADOS, SEM_DADOS]
    ],
    linhas: []
  };
}

function kindDe(tipo: string): string | null {
  const t = tipo.trim().toLowerCase();
  if (t === 'icp') return 'icp';
  if (t === 'oferta' || t === 'proposta de valor') return 'oferta';
  return null;
}

interface ItemBruto {
  id?: unknown;
  kind?: unknown;
  name?: unknown;
  version?: unknown;
  status?: unknown;
  body?: unknown;
  resp?: unknown;
}

function montar(data: { ok?: boolean; erro?: string; pode_editar?: boolean; itens?: ItemBruto[] } | null): EstrategiaTela {
  if (!data || data.ok !== true) {
    throw new Error(data && typeof data.erro === 'string' && data.erro ? data.erro : ERRO_CARGA);
  }
  const itens = Array.isArray(data.itens) ? data.itens : [];
  const linhas = itens.map(item => {
    const kind = texto(item.kind);
    const status = texto(item.status);
    const corpo = texto(item.body);
    const resp = texto(item.resp);
    return {
      id: texto(item.id),
      nome: texto(item.name) || SEM_DADOS,
      tipo: TIPO[kind] || SEM_DADOS,
      versao: texto(item.version) || SEM_DADOS,
      status: STATUS[status] || SEM_DADOS,
      resp: resp || SEM_DADOS,
      desc: corpo || SEM_DADOS
    };
  });
  const vigente = itens.find(item => texto(item.kind) === 'icp' && texto(item.status) === 'ativo');
  const kpis = estrategiaSemDados().kpis;
  kpis[0] = ['ICP vigente', vigente ? (texto(vigente.version) || SEM_DADOS) : SEM_DADOS, SEM_DADOS];
  return { podeEditar: data.pode_editar === true, kpis, linhas };
}

export async function listarEstrategia(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<EstrategiaTela> {
  const { data, error } = await cliente.rpc('strategy_list', { p_workspace_id: workspaceId, p_member_id: membroId });
  if (error) throw new Error(ERRO_CARGA, { cause: error });
  return montar(data);
}

async function resultado(cliente: SupabaseClient, nome: string, args: Record<string, unknown>, erroPadrao: string) {
  const { data, error } = await cliente.rpc(nome, args);
  if (error) return { ok: false as const, mensagem: erroPadrao };
  if (data?.ok) return data as { ok: true; id?: string };
  return { ok: false as const, mensagem: (typeof data?.erro === 'string' && data.erro) || erroPadrao };
}

export async function salvarEstrategia(
  cliente: SupabaseClient, workspaceId: string, membroId: string, item: ItemEstrategiaInput
): Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const kind = kindDe(item.tipo || '');
  if (!kind) return { ok: false, mensagem: ESCOLHA };
  if (!texto(item.nome)) return { ok: false, mensagem: NOME_OBRIGATORIO };
  const data = await resultado(cliente, 'strategy_save', {
    p_workspace_id: workspaceId,
    p_member_id: membroId,
    p_id: item.id || null,
    p_kind: kind,
    p_name: texto(item.nome),
    p_version: texto(item.versao),
    p_body: item.texto || ''
  }, ERRO_GRAVAR);
  if (!data.ok) return data;
  return { ok: true, id: String(data.id || '') };
}

export async function definirSituacaoEstrategia(
  cliente: SupabaseClient, workspaceId: string, membroId: string, id: string, status: 'ativo' | 'rascunho' | 'em_revisao'
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const data = await resultado(cliente, 'strategy_set_status', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_id: id, p_status: status
  }, ERRO_SITUACAO);
  return data.ok ? { ok: true } : data;
}
