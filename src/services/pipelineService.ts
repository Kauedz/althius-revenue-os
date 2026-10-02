import { supabase } from '../lib/supabase';

export interface OpportunityCard {
  id: string;
  pipeline_id: string;
  stage_key: string;
  account_id: string;
  title: string;
  amount: number;
  win_probability: number;
  health: 'no_prazo' | 'em_risco' | 'atrasado';
  position: number;
}

export const pipelineService = {
  async listBoards(workspaceId: string, motion: 'slg' | 'mlg' | 'plg' = 'slg') {
    const { data, error } = await supabase
      .from('pipelines')
      .select('id, workspace_id, motion, name, description, stage_order, created_at')
      .eq('workspace_id', workspaceId)
      .eq('motion', motion)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return [{ id: 'default-board', name: 'SLG Principal', motion: 'slg' }];
    }
    return data;
  },

  async listOpportunities(pipelineId: string): Promise<OpportunityCard[]> {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, pipeline_id, stage_key, account_id, title, amount, win_probability, health, position')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });

    if (error || !data) return [];
    return data;
  },

  async moveStage(
    opportunityId: string, 
    targetStageKey: 'entrada' | 'qualificacao' | 'descoberta' | 'proposta' | 'negociacao' | 'ganho'
  ) {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ stage_key: targetStageKey })
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
