import { supabase } from '../lib/supabase';

export interface ApprovalData {
  id: string;
  category: 'operacao' | 'gasto';
  tipo: string;
  titulo: string;
  solicitante: string;
  agente?: string;
  motivo?: string;
  impacto?: string;
  previa?: string;
  creditos?: number;
  prazo?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  payload_hash: string;
  historico?: string[];
}

export const approvalService = {
  async list(workspaceId: string): Promise<ApprovalData[]> {
    const { data, error } = await supabase
      .from('approvals')
      .select('id, category, title, description, status, payload_json, payload_hash, created_at, requested_by_member_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      category: item.category as 'operacao' | 'gasto',
      tipo: item.payload_json?.tipo || (item.category === 'gasto' ? 'Orçamento' : 'Operação'),
      titulo: item.title,
      solicitante: item.payload_json?.solicitante || 'Membro do Workspace',
      agente: item.payload_json?.agente || 'comercial',
      motivo: item.description,
      impacto: item.payload_json?.impacto || 'Impacto sob avaliação',
      previa: item.payload_json?.previa || '',
      creditos: item.payload_json?.creditos || 0,
      prazo: 'Pendente',
      status: item.status as 'pendente' | 'aprovado' | 'rejeitado',
      payload_hash: item.payload_hash,
      historico: [new Date(item.created_at).toLocaleTimeString() + ' Criada']
    }));
  },

  async decide(
    approvalId: string, 
    decidedByMemberId: string, 
    status: 'aprovado' | 'rejeitado', 
    submittedPayload: any
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('approval_decide', {
      p_approval_id: approvalId,
      p_decider_member_id: decidedByMemberId,
      p_decision: status,
      p_payload_to_verify: submittedPayload
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, ...data };
  }
};
