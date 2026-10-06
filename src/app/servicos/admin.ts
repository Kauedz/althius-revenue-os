// Superadmin: clientes da Althius (criar, chaves dos agentes) e telas só leitura de operação.
// O banco recusa qualquer outro papel (42501). Fornecedores nunca trazem chave nem segredo.
import type { SupabaseClient } from '@supabase/supabase-js';

type Kpi = [rotulo: string, valor: string, detalhe: string];
export interface TelaAdmin<L> { kpis: Kpi[]; linhas: L[] }

const SO_SUPERADMIN = 'Só o superadmin da Althius faz isso.';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nf = (n: number) => n.toLocaleString('pt-BR');
const data = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`;
};
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${data(iso)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

async function ler<T>(cliente: SupabaseClient, funcao: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const { data: resp, error } = await cliente.rpc(funcao, args);
  if (error) throw new Error(error.code === '42501' ? SO_SUPERADMIN : 'Não foi possível carregar os dados do superadmin.', { cause: error });
  return (resp || []) as T[];
}

// ---------------------------------------------------------------- Workspaces (clientes)

export interface ClienteTela { id: string; nome: string; slug: string; status: string; clevel: string; membros: number; saldo: string; criado: string }

const STATUS_WS: Record<string, string> = { active: 'Ativo', suspended: 'Suspenso', archived: 'Arquivado' };

export async function listarClientes(cliente: SupabaseClient): Promise<TelaAdmin<ClienteTela>> {
  const lista = await ler<{ id: string; nome: string; slug: string; status: string; clevel: string | null; convites: number; membros: number; saldo: number | null; criado_em: string }>(cliente, 'admin_workspaces');
  const linhas = lista.map(w => ({
    id: w.id, nome: w.nome, slug: w.slug, status: STATUS_WS[w.status] || w.status,
    clevel: w.clevel || (Number(w.convites) > 0 ? 'Convite pendente' : '—'),
    membros: Number(w.membros) || 0,
    saldo: w.saldo == null ? '—' : nf(Number(w.saldo)) + ' créditos',
    criado: data(w.criado_em)
  }));
  return {
    kpis: [
      ['Clientes', String(linhas.length), ''],
      ['Ativos', String(linhas.filter(l => l.status === 'Ativo').length), ''],
      ['Convites de C-level pendentes', String(lista.filter(w => !w.clevel && Number(w.convites) > 0).length), ''],
      ['Créditos em carteira', nf(lista.reduce((s, w) => s + (Number(w.saldo) || 0), 0)), 'soma dos clientes']
    ],
    linhas
  };
}

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; mensagem: string };

export async function criarCliente(
  cliente: SupabaseClient, dados: { nome: string; slug: string; emailClevel: string; emailEstrategista: string }
): Promise<Resultado<{ slug: string }>> {
  const { data: r, error } = await cliente.rpc('admin_create_workspace', {
    p_nome: dados.nome, p_slug: dados.slug, p_clevel_email: dados.emailClevel, p_estrategista_email: dados.emailEstrategista || null
  });
  if (error) return { ok: false, mensagem: error.code === '42501' ? SO_SUPERADMIN : 'Não foi possível criar o cliente. Tente de novo.' };
  return r?.ok ? { ok: true, slug: r.slug } : { ok: false, mensagem: r?.erro || 'Não foi possível criar o cliente. Tente de novo.' };
}

export async function gerarChavesDosAgentes(cliente: SupabaseClient, workspaceId: string): Promise<Resultado<{ chaves: Record<string, string> }>> {
  const { data: r, error } = await cliente.rpc('admin_agent_tokens', { p_workspace_id: workspaceId });
  if (error) return { ok: false, mensagem: error.code === '42501' ? SO_SUPERADMIN : 'Não foi possível gerar as chaves. Tente de novo.' };
  return { ok: true, chaves: r as Record<string, string> };
}

export async function revogarChavesDosAgentes(cliente: SupabaseClient, workspaceId: string): Promise<Resultado<{ revogadas: number }>> {
  const { data: r, error } = await cliente.rpc('admin_revoke_agent_tokens', { p_workspace_id: workspaceId });
  if (error) return { ok: false, mensagem: error.code === '42501' ? SO_SUPERADMIN : 'Não foi possível revogar as chaves. Tente de novo.' };
  return { ok: true, revogadas: Number(r?.revogadas) || 0 };
}

// ---------------------------------------------------------------- Telas só leitura

export async function usoGlobal(cliente: SupabaseClient) {
  const lista = await ler<{ id: string; nome: string; consumido: number; saldo: number; execucoes_mes: number; ultimo_uso: string | null; tokens_mes?: number; custo_modelo_usd?: number }>(cliente, 'admin_usage');
  return {
    kpis: [
      ['Créditos consumidos no ciclo', nf(lista.reduce((s, u) => s + Number(u.consumido), 0)), 'todos os clientes'],
      ['Execuções no mês', nf(lista.reduce((s, u) => s + Number(u.execucoes_mes), 0)), '']
    ] as Kpi[],
    linhas: lista.map(u => ({ id: u.id, nome: u.nome, consumido: nf(Number(u.consumido)) + ' créditos', saldo: nf(Number(u.saldo)) + ' créditos',
      execucoes: nf(Number(u.execucoes_mes)), ultimo: data(u.ultimo_uso), tokens: nf(Number(u.tokens_mes ?? 0)),
      custoModelo: Number(u.custo_modelo_usd ?? 0) > 0 ? 'US$ ' + Number(u.custo_modelo_usd).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—' })) // custo real do modelo: só superadmin
  };
}

export async function fornecedores(cliente: SupabaseClient) {
  const lista = await ler<{ id?: string; ativo?: boolean; nome: string; tipo: string; status: string; uso: number | null; detalhe: string; ultimo_uso: string | null }>(cliente, 'admin_providers');
  return {
    kpis: [['Fornecedores', String(lista.length), ''], ['Ativos', String(lista.filter(f => f.status === 'Ativo' || f.status === 'Configurado').length), '']] as Kpi[],
    linhas: lista.map((f, i) => ({ id: f.id ?? 'f' + i, cofre: !!f.id, ativo: f.ativo !== false, nome: f.nome, tipo: f.tipo, status: f.status, detalhe: f.detalhe,
      uso: f.uso == null ? '—' : 'US$ ' + Number(f.uso).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })) // custo real: só superadmin
  };
}

export async function margens(cliente: SupabaseClient) {
  const lista = await ler<{ capacidade: string; creditos_base: number; margem: number; risco: number; ativo: boolean }>(cliente, 'admin_margins');
  return {
    kpis: [['Capacidades precificadas', String(lista.length), '']] as Kpi[],
    linhas: lista.map(m => ({ id: m.capacidade, capacidade: m.capacidade, base: nf(Number(m.creditos_base)) + ' créditos',
      margem: Number(m.margem).toLocaleString('pt-BR') + '%', risco: Number(m.risco).toLocaleString('pt-BR') + '×', status: m.ativo ? 'Ativo' : 'Inativo' }))
  };
}

export async function auditoriaGlobal(cliente: SupabaseClient, limite = 200) {
  const lista = await ler<{ id: string; quando: string; cliente: string | null; quem: string; acao: string; entidade: string }>(cliente, 'admin_audit', { p_limite: limite });
  return {
    kpis: [['Eventos', String(lista.length), 'mais recentes']] as Kpi[],
    linhas: lista.map(l => ({ id: l.id, quando: dataHora(l.quando), cliente: l.cliente || '—', quem: l.quem, acao: l.acao, entidade: l.entidade }))
  };
}

export async function saude(cliente: SupabaseClient) {
  const lista = await ler<{ nome: string; status: 'OK' | 'Atenção' | 'Falha'; detalhe: string }>(cliente, 'admin_health');
  return {
    kpis: [['Verificações', String(lista.length), ''], ['Pedem atenção', String(lista.filter(h => h.status !== 'OK').length), '']] as Kpi[],
    linhas: lista.map((h, i) => ({ id: 'h' + i, nome: h.nome, status: h.status, detalhe: h.detalhe }))
  };
}
