// Agentes: os 4 agentes fixos com a situação real do workspace (get_agents_overview) por cima do
// texto do produto (objetivo, escopo, integrações) que vem do protótipo v18.
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatarTempoRelativo } from './notificacoes';
import { nomesDosMembros } from './nomes';

export type Capacidades = Record<string, boolean>;

/** Definição do agente no produto (protótipo v18). Números e situação são substituídos pelo banco. */
export interface AgenteBase {
  id: string;
  nome: string;
  responsavel?: string;
  [campo: string]: unknown;
}

export interface AgenteTela extends AgenteBase {
  estado: 'ativo' | 'pausado';
  autonomia: string;
  responsavel: string;
  caps: Capacidades;
  execCiclo: number;
  ultima: string;
  sucesso: number | '—';
  pendencias: number;
  playbooks: Array<[nome: string, versao: string, responsavel: string, data: string]>;
  conhecimento: Array<[string, string]>;
}

interface ResumoBanco {
  agent_code: string;
  estado: 'ativo' | 'pausado';
  autonomia: string;
  responsavel: string | null;
  caps: Capacidades;
  exec_ciclo: number;
  ultima_em: string | null;
  sucesso: number | null;
  pendencias: number;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function listarAgentes(cliente: SupabaseClient, workspaceId: string, base: AgenteBase[]): Promise<AgenteTela[]> {
  const { data, error } = await cliente.rpc('get_agents_overview', { p_workspace_id: workspaceId });
  if (error) throw new Error('Não foi possível carregar os agentes.', { cause: error });
  const resumo = (data || []) as ResumoBanco[];
  if (!resumo.length) return [];

  const { data: playbooks, error: erroPlaybooks } = await cliente
    .from('agent_playbooks')
    .select('agent_id, version, created_at, author_member_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .order('version', { ascending: false });
  if (erroPlaybooks) throw new Error('Não foi possível carregar os playbooks dos agentes.', { cause: erroPlaybooks });

  const autores = await nomesDosMembros(cliente, (playbooks || []).map(p => p.author_member_id as string), 'Não foi possível carregar os autores dos playbooks.');
  const porCodigo = new Map(resumo.map(r => [r.agent_code, r]));
  return base.filter(b => porCodigo.has(b.id)).map(b => {
    const r = porCodigo.get(b.id)!;
    return {
      ...b,
      estado: r.estado,
      autonomia: r.autonomia,
      responsavel: r.responsavel || 'A definir',
      caps: r.caps,
      execCiclo: Number(r.exec_ciclo) || 0,
      ultima: r.ultima_em ? formatarTempoRelativo(r.ultima_em) : 'Sem execuções',
      sucesso: r.sucesso == null ? '—' : Number(r.sucesso),
      pendencias: Number(r.pendencias) || 0,
      playbooks: (playbooks || []).filter(p => p.agent_id === b.id).map(p => {
        const d = new Date(p.created_at);
        const autor = autores.get(p.author_member_id as string) || '—';
        return ['Playbook ' + b.nome.replace(/^Agente (de )?/, '').toLowerCase(), 'v' + p.version, autor, `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]}`];
      }),
      // Conhecimento do cliente ainda não tem tabela (memória do workspace, ADR 0024): vazio, nunca o do protótipo.
      conhecimento: []
    };
  });
}

export type ResultadoAgente = { ok: true } | { ok: false; mensagem: string };

async function chamar(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>, falhaGenerica: string): Promise<ResultadoAgente> {
  const { data, error } = await cliente.rpc(funcao, args);
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : falhaGenerica };
  }
  return data?.ok ? { ok: true } : { ok: false, mensagem: data?.erro || falhaGenerica };
}

export function pausarAgente(cliente: SupabaseClient, workspaceId: string, membroId: string, agente: string, pausar: boolean) {
  return chamar(cliente, 'agent_set_paused', { p_workspace_id: workspaceId, p_member_id: membroId, p_agent_code: agente, p_pausar: pausar },
    pausar ? 'Não foi possível pausar o agente. Tente de novo.' : 'Não foi possível retomar o agente. Tente de novo.');
}

export function salvarCapacidades(cliente: SupabaseClient, workspaceId: string, membroId: string, agente: string, caps: Capacidades) {
  return chamar(cliente, 'agent_set_caps', { p_workspace_id: workspaceId, p_member_id: membroId, p_agent_code: agente, p_caps: caps },
    'Não foi possível salvar as capacidades do agente. Tente de novo.');
}
