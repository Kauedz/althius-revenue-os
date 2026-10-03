// Resumo do painel de Início (Home) alimentado pelo banco de dados.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface HomeResumoTela {
  kpis: Array<[string, string, string, string]>;
  operacao: Array<[string, number]>;
  acoes: Array<{ titulo: string; resp: string; prazo: string; origem: string; prioridade: string }>;
  timeline: Array<[string, string, string, string]>;
}

interface HomeSummaryRpcResult {
  contas_qualificadas: number;
  execucoes_ativas: number;
  alertas_bloqueios: number;
  aprovacoes_pendentes: number;
  creditos_disponiveis: number;
  creditos_limite: number;
  papel: string;
}

const nf = (n: number) => Math.round(n).toLocaleString('pt-BR');

export async function obterResumoHome(
  cliente: SupabaseClient,
  workspaceId: string,
  membroId: string
): Promise<HomeResumoTela> {
  const { data, error } = await cliente.rpc('get_home_summary', {
    p_workspace_id: workspaceId,
    p_member_id: membroId
  });

  if (error || !data) {
    throw new Error('Não foi possível carregar o resumo do Início.', { cause: error });
  }

  const r = data as HomeSummaryRpcResult;

  const kpis: Array<[string, string, string, string]> = [
    ['pipeline', 'Pipeline influenciado', 'R$ 4,8 mi', '+12% no período'],
    ['oportunidades', 'Oportunidades abertas', '37', '+5'],
    ['contas', 'Contas qualificadas', nf(r.contas_qualificadas), '+184'],
    ['leads', 'Leads prospectados', '1.946', '+620'],
    ['respostas', 'Respostas positivas', '64', '6,1% de taxa'],
    ['reunioes', 'Reuniões agendadas', '23', '+8'],
    ['midia', 'Investimento de mídia', 'R$ 30.000', '62% do orçamento'],
    ['creditos', 'Créditos disponíveis', nf(r.creditos_disponiveis), `de ${nf(r.creditos_limite)} no ciclo`]
  ];

  const operacao: Array<[string, number]> = [
    ['Execuções ativas', r.execucoes_ativas],
    ['Campanhas ativas', 4],
    ['Cadências ativas', 6],
    ['Agentes trabalhando', 3],
    ['Alertas e bloqueios', r.alertas_bloqueios]
  ];

  const acoes = [
    { titulo: 'Ligar para Aline Xavier — Serra Azul Têxtil', resp: 'Lucas Teixeira', prazo: 'Hoje, 11:00', origem: 'Agente', prioridade: 'Alta' },
    { titulo: 'Aprovar e-mails T1 da Serra Azul', resp: 'Aline Xavier', prazo: 'Hoje, 14:00', origem: 'Agente', prioridade: 'Alta' },
    { titulo: 'Reconectar mídia paga', resp: 'Camila Duarte', prazo: 'Hoje', origem: 'Integração', prioridade: 'Alta' },
    { titulo: 'Revisar ICP para região Nordeste', resp: 'Camila Duarte', prazo: 'Qua', origem: 'Estrategista', prioridade: 'Média' },
    { titulo: 'Follow-up Douglas Quites — Alvorada', resp: 'Lucas Teixeira', prazo: 'Amanhã', origem: 'CRM', prioridade: 'Média' }
  ];

  const timeline: Array<[string, string, string, string]> = [
    ['09:31', 'Lista enriquecida', '512 contas com fit acima de 70', 'ok'],
    ['09:20', 'Conta qualificada', 'Serra Azul Têxtil · fit 96', 'ok'],
    ['09:02', 'Execução concluída', 'Comitê de 48 contas · parcial', 'aviso'],
    ['08:48', 'Lead respondeu', 'Douglas Quites pediu proposta', 'ok'],
    ['08:10', 'Oportunidade criada', 'Grão Norte Alimentos · R$ 35.000', 'ok'],
    ['07:01', 'Integração com falha', 'Mídia paga · conexão expirou', 'erro'],
    ['Ontem', 'Campanha publicada', 'Importação sem risco · LinkedIn', 'ok']
  ];

  return { kpis, operacao, acoes, timeline };
}