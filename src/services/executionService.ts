import { supabase } from '../lib/supabase';

export interface ExecutionData {
  id: string;
  titulo: string;
  tipo: string;
  agente: string;
  campanha?: string;
  solicitante: string;
  horario: string;
  status: string;
  progresso: number;
  processados: number;
  validos: number;
  credEst: number;
  credRes: number;
  credCons: number;
  custo: string;
  integracoes: string[];
  aprovacao: string;
  plano: string[];
  etapaAtual: number;
  logs: string[];
  erros: string[];
}

export const executionService = {
  async list(workspaceId: string): Promise<ExecutionData[]> {
    const { data, error } = await supabase
      .from('executions')
      .select('id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, actual_credits, metadata_json, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      titulo: item.metadata_json?.titulo || `Execução ${item.capability_key}`,
      tipo: item.metadata_json?.tipo || 'Operação',
      agente: item.agent_code || 'comercial',
      campanha: item.metadata_json?.campanha || '—',
      solicitante: item.metadata_json?.solicitante || 'Membro do Time',
      horario: new Date(item.created_at).toLocaleString(),
      status: item.status === 'completed' ? 'Concluída' : item.status === 'running' ? 'Em execução' : item.status,
      progresso: item.status === 'completed' ? 100 : item.status === 'running' ? 50 : 0,
      processados: item.metadata_json?.processados || 0,
      validos: item.metadata_json?.validos || 0,
      credEst: item.estimated_credits,
      credRes: item.estimated_credits,
      credCons: item.actual_credits,
      custo: `US$ ${(item.actual_credits * 0.005).toFixed(2)}`,
      integracoes: item.metadata_json?.integracoes || ['CRM'],
      aprovacao: item.metadata_json?.aprovacao || 'Não exigida',
      plano: item.metadata_json?.plano || [],
      etapaAtual: item.status === 'completed' ? 3 : 1,
      logs: item.metadata_json?.logs || [],
      erros: item.metadata_json?.erros || []
    }));
  },

  async get(id: string): Promise<ExecutionData | null> {
    const { data, error } = await supabase
      .from('executions')
      .select('id, agent_code, capability_key, status, requested_by_member_id, estimated_credits, actual_credits, metadata_json, created_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      titulo: data.metadata_json?.titulo || `Execução ${data.capability_key}`,
      tipo: data.metadata_json?.tipo || 'Operação',
      agente: data.agent_code || 'comercial',
      campanha: data.metadata_json?.campanha || '—',
      solicitante: data.metadata_json?.solicitante || 'Membro do Time',
      horario: new Date(data.created_at).toLocaleString(),
      status: data.status === 'completed' ? 'Concluída' : data.status,
      progresso: data.status === 'completed' ? 100 : 50,
      processados: data.metadata_json?.processados || 0,
      validos: data.metadata_json?.validos || 0,
      credEst: data.estimated_credits,
      credRes: data.estimated_credits,
      credCons: data.actual_credits,
      custo: `US$ ${(data.actual_credits * 0.005).toFixed(2)}`,
      integracoes: data.metadata_json?.integracoes || ['CRM'],
      aprovacao: data.metadata_json?.aprovacao || 'Não exigida',
      plano: data.metadata_json?.plano || [],
      etapaAtual: 3,
      logs: data.metadata_json?.logs || [],
      erros: data.metadata_json?.erros || []
    };
  }
};
