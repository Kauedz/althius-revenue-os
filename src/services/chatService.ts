import { supabase } from '../lib/supabase';

export interface ChatChannel {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description?: string;
  is_general: boolean;
  agents: string[];
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_type: 'member' | 'agent' | 'system';
  sender_member_id?: string;
  sender_agent_id?: string;
  content: string;
  metadata?: any;
  created_at: string;
}

export const chatService = {
  async listChannels(workspaceId: string): Promise<ChatChannel[]> {
    const { data: channels, error: chError } = await supabase
      .from('chat_channels')
      .select('id, workspace_id, slug, name, description, is_general')
      .eq('workspace_id', workspaceId)
      .order('is_general', { ascending: false });

    if (chError || !channels) {
      return [
        {
          id: 'mock-geral',
          workspace_id: workspaceId,
          slug: 'geral',
          name: 'Geral',
          description: 'Canal geral da equipe e agentes',
          is_general: true,
          agents: ['comercial', 'marketing', 'copy', 'revops']
        }
      ];
    }

    const { data: agents } = await supabase
      .from('chat_channel_agents')
      .select('channel_id, agent_id')
      .eq('workspace_id', workspaceId);

    return channels.map(ch => ({
      ...ch,
      agents: (agents || [])
        .filter(a => a.channel_id === ch.id)
        .map(a => a.agent_id)
    }));
  },

  async listMessages(channelId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, channel_id, sender_type, sender_member_id, sender_agent_id, content, metadata, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data;
  },

  async sendAgentInteraction(
    workspaceId: string,
    callerMemberId: string,
    channelId: string,
    agentId: 'comercial' | 'marketing' | 'copy' | 'revops',
    userMessage: string,
    agentResponse: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; credits_consumed: number; error?: string }> {
    const { data, error } = await supabase.rpc('send_channel_agent_message', {
      p_workspace_id: workspaceId,
      p_caller_member_id: callerMemberId,
      p_channel_id: channelId,
      p_agent_id: agentId,
      p_user_message: userMessage,
      p_agent_response: agentResponse,
      p_idempotency_key: idempotencyKey || `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    });

    if (error) {
      return { success: false, credits_consumed: 0, error: error.message };
    }

    return data;
  }
};
