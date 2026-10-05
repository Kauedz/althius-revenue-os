// Resumo do painel de Início (Home) alimentado pelo banco de dados.
// Regra do projeto: nunca número nem pessoa inventados. Cada valor vem do banco; o que não tem fonte ainda
// mostra "Sem dados ainda" (mesmo padrão de Relatórios). Horários em Brasília.
import type { SupabaseClient } from '@supabase/supabase-js';
import { nomeDoAgente } from '../agentes-exibicao';
import { SEM_DADOS } from './relatorios';

export interface HomeResumoTela {
  kpis: Array<[string, string, string, string]>;
  operacao: Array<[string, number]>;
  acoes: Array<{ titulo: string; resp: string; prazo: string; origem: string; prioridade: string }>;
  timeline: Array<[string, string, string, string]>;
  /** Contas ativas por estado (UF -> quantidade), do banco. */
  mapa: Record<string, number>;
  /** Contas ativas sem estado informado. */
  semLocalizacao: number;
}

interface HomeSummaryRpcResult {
  contas_qualificadas: number;
  execucoes_ativas: number;
  alertas_bloqueios: number;
  aprovacoes_pendentes: number;
  creditos_disponiveis: number;
  creditos_limite: number;
  papel: string;
  oportunidades_abertas?: number;
  campanhas_ativas?: number;
  cadencias_ativas?: number;
  agentes_trabalhando?: number;
  acoes?: Array<{ titulo: string; responsavel: string | null; prazo: string | null; origem: string; agente: string | null }>;
  timeline?: Array<{ id: string; titulo: string | null; tipo: string | null; status: string; quando: string }>;
  mapa?: Record<string, number>;
  contas_sem_localizacao?: number;
}

const nf = (n: number) => Math.round(n).toLocaleString('pt-BR');
const FUSO = 'America/Sao_Paulo';

function partes(d: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}
export const diaCivil = (d: Date) => { const p = partes(d); return Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000; };
const hora = (d: Date) => { const p = partes(d); return `${p.hour}:${p.minute}`; };
const diaMes = (d: Date) => { const p = partes(d); return `${p.day}/${p.month}`; };

/** Prazo de uma tarefa em linguagem da tela, no horário de Brasília. */
export function prazoTexto(iso: string | null, agora: Date): { texto: string; dias: number | null } {
  if (!iso) return { texto: 'Sem prazo', dias: null };
  const d = new Date(iso);
  const dias = diaCivil(d) - diaCivil(agora);
  if (dias < 0) return { texto: `Atrasada · ${diaMes(d)}`, dias };
  if (dias === 0) return { texto: `Hoje, ${hora(d)}`, dias };
  if (dias === 1) return { texto: `Amanhã, ${hora(d)}`, dias };
  return { texto: `${diaMes(d)} · ${hora(d)}`, dias };
}

function origemTexto(origem: string, agente: string | null): string {
  if (origem === 'manual') return 'Manual';
  if (origem === 'cadencia') return 'Cadência';
  return agente ? nomeDoAgente(agente) : 'Agente';
}

const TOM_AVISO = ['partial', 'paused', 'pending_approval', 'cancelled'];
const tomDoStatus = (status: string) => (status === 'failed' ? 'erro' : TOM_AVISO.includes(status) ? 'aviso' : 'ok');

function quandoTexto(iso: string, agora: Date): string {
  const d = new Date(iso);
  const dias = diaCivil(d) - diaCivil(agora);
  if (dias === 0) return hora(d);
  if (dias === -1) return 'Ontem';
  return diaMes(d);
}

export async function obterResumoHome(
  cliente: SupabaseClient,
  workspaceId: string,
  membroId: string,
  agora: Date = new Date()
): Promise<HomeResumoTela> {
  const { data, error } = await cliente.rpc('get_home_summary', {
    p_workspace_id: workspaceId,
    p_member_id: membroId
  });

  if (error || !data) {
    throw new Error('Não foi possível carregar o resumo do Início.', { cause: error });
  }

  const r = data as HomeSummaryRpcResult;
  const numero = (v: number | undefined) => (typeof v === 'number' ? nf(v) : SEM_DADOS);

  // Sem fonte no banco (ainda): pipeline influenciado, leads, respostas, reuniões e mídia. Nada de variação inventada.
  const kpis: Array<[string, string, string, string]> = [
    ['pipeline', 'Pipeline influenciado', SEM_DADOS, ''],
    ['oportunidades', 'Oportunidades abertas', numero(r.oportunidades_abertas), ''],
    ['contas', 'Contas qualificadas', nf(r.contas_qualificadas), ''],
    ['leads', 'Leads prospectados', SEM_DADOS, ''],
    ['respostas', 'Respostas positivas', SEM_DADOS, ''],
    ['reunioes', 'Reuniões agendadas', SEM_DADOS, ''],
    ['midia', 'Investimento de mídia', SEM_DADOS, ''],
    ['creditos', 'Créditos disponíveis', nf(r.creditos_disponiveis), `de ${nf(r.creditos_limite)} no ciclo`]
  ];

  const operacao: Array<[string, number]> = [
    ['Execuções ativas', r.execucoes_ativas],
    ['Campanhas ativas', r.campanhas_ativas ?? 0],
    ['Cadências ativas', r.cadencias_ativas ?? 0],
    ['Agentes trabalhando', r.agentes_trabalhando ?? 0],
    ['Alertas e bloqueios', r.alertas_bloqueios]
  ];

  const acoes = (r.acoes ?? []).map(a => {
    const prazo = prazoTexto(a.prazo, agora);
    return {
      titulo: a.titulo,
      resp: a.responsavel || 'Sem responsável',
      prazo: prazo.texto,
      origem: origemTexto(a.origem, a.agente),
      prioridade: prazo.dias !== null && prazo.dias <= 0 ? 'Alta' : 'Média'
    };
  });

  const timeline: Array<[string, string, string, string]> = (r.timeline ?? []).map(e => [
    quandoTexto(e.quando, agora),
    e.tipo || 'Execução',
    e.titulo || '',
    tomDoStatus(e.status)
  ]);

  return { kpis, operacao, acoes, timeline, mapa: r.mapa ?? {}, semLocalizacao: r.contas_sem_localizacao ?? 0 };
}
