import { supabase } from '../lib/supabase';

export interface AgentData {
  id: 'comercial' | 'marketing' | 'copy' | 'revops';
  nome: string;
  sigla: string;
  funcao: string;
  estado: string;
  autonomia: string;
  precisaAprovacao: boolean;
  bdr: boolean;
  objetivo: string;
  escopo: string;
  responsavel?: string;
  execCiclo?: number;
  sucesso?: number;
  pendencias?: number;
}

const CANONICAL_AGENTS: AgentData[] = [
  { 
    id: 'comercial', 
    nome: 'Zoe', 
    sigla: 'ZO', 
    funcao: 'ICP, contas e comitê', 
    estado: 'ativo', 
    autonomia: 'Assistido', 
    precisaAprovacao: false, 
    bdr: true,
    objetivo: 'Encontra e prioriza contas dentro do ICP, mapeia o comitê de compra e acompanha sinais de compra.', 
    escopo: 'Lê o CRM, pesquisa dados públicos e da Receita Federal, monta listas e comitês. Não escreve no CRM sem aprovação.',
    responsavel: 'Camila Duarte',
    execCiclo: 280,
    sucesso: 95,
    pendencias: 1
  },
  { 
    id: 'marketing', 
    nome: 'Jax', 
    sigla: 'JA', 
    funcao: 'Mídia, SEO/GEO e eventos', 
    estado: 'ativo', 
    autonomia: 'Assistido', 
    precisaAprovacao: true, 
    bdr: false,
    objetivo: 'Planeja e lê campanhas pagas, orgânico, SEO/GEO e eventos, e aponta onde realocar orçamento.', 
    escopo: 'Lê dados de mídia e do site. Mudanças de orçamento e publicação exigem aprovação.',
    responsavel: 'Camila Duarte',
    execCiclo: 36,
    sucesso: 78,
    pendencias: 1
  },
  { 
    id: 'copy', 
    nome: 'Lia', 
    sigla: 'LI', 
    funcao: 'Copy, mensagens e conteúdo', 
    estado: 'ativo', 
    autonomia: 'Supervisionado', 
    precisaAprovacao: true, 
    bdr: true,
    objetivo: 'Escreve e-mails, mensagens, roteiros de ligação, anúncios e conteúdos no tom da marca.', 
    escopo: 'Gera textos. Envio automático só nos passos de cadência que você liberar.',
    responsavel: 'Mateus Maia',
    execCiclo: 61,
    sucesso: 88,
    pendencias: 3
  },
  { 
    id: 'revops', 
    nome: 'Neo', 
    sigla: 'NE', 
    funcao: 'CRM, pipeline e relatórios', 
    estado: 'ativo', 
    autonomia: 'Supervisionado', 
    precisaAprovacao: true, 
    bdr: false,
    objetivo: 'Mantém o CRM limpo, acompanha o pipeline, avisa sobre negócios parados e monta os relatórios do ciclo.', 
    escopo: 'Lê e escreve no CRM somente com aprovação. Publica relatórios internos.',
    responsavel: 'Rafael Nunes',
    execCiclo: 52,
    sucesso: 98,
    pendencias: 0
  }
];

export const agentService = {
  async list(workspaceId?: string): Promise<AgentData[]> {
    if (!workspaceId) {
      return CANONICAL_AGENTS;
    }

    try {
      // Query execution counts per agent in the workspace
      const { data: executions } = await supabase
        .from('executions')
        .select('agent_code, status')
        .eq('workspace_id', workspaceId);

      if (!executions) return CANONICAL_AGENTS;

      return CANONICAL_AGENTS.map(agent => {
        const agentExecs = executions.filter(e => e.agent_code === agent.id);
        const total = agentExecs.length;
        const successCount = agentExecs.filter(e => e.status === 'completed').length;
        const pendingCount = agentExecs.filter(e => e.status === 'pending' || e.status === 'pending_approval').length;

        return {
          ...agent,
          execCiclo: total > 0 ? total : agent.execCiclo,
          sucesso: total > 0 ? Math.round((successCount / total) * 100) : agent.sucesso,
          pendencias: total > 0 ? pendingCount : agent.pendencias
        };
      });
    } catch {
      return CANONICAL_AGENTS;
    }
  },

  async get(id: string, workspaceId?: string): Promise<AgentData | null> {
    const list = await this.list(workspaceId);
    return list.find(a => a.id === id) || null;
  }
};
