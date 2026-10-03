// Relatórios da página analytics: só números que o banco devolve.
// O que não existe no banco aparece como "Sem dados ainda". Nunca dólar.
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEM_DADOS = 'Sem dados ainda';

export interface KpiRelatorio {
  label: string;
  valor: string;
  delta: string;
}

export interface FunilRelatorio {
  label: string;
  fonte: string;
  n: string;
  pct: string;
}

export interface CelulaEtapa {
  v: string;
  n: string;
}

export interface EtapaRelatorio {
  nome: string;
  total: 'true' | 'false';
  cels: CelulaEtapa[];
}

export interface RelatoriosTela {
  kpis: KpiRelatorio[];
  motions: string[];
  etapas: EtapaRelatorio[];
  funil: FunilRelatorio[];
  cadencias: Array<{ nome: string; contatos: string; resposta: string; cor: string }>;
  cadNota: string;
  canais: Array<{ nome: string; inv: string; leads: string; cpl: string }>;
  creditos: Array<{ nome: string; creditos: string; usd: string }>;
  custoReuniao: string;
  linhas: Array<{ id: string; nome: string; fonte: string; frequencia: string; ultimo: string; dest: string }>;
}

const MOTIONS = ['slg', 'mlg', 'plg'] as const;
const ROTULOS_MOTION = ['SLG', 'MLG', 'PLG'];

const NOMES_AGENTE: Record<string, string> = {
  comercial: 'Agente Comercial',
  marketing: 'Agente de Marketing',
  copy: 'Agente de Copy',
  revops: 'Agente de RevOps'
};

const NOMES_CANAL: Record<string, string> = {
  linkedin_ads: 'LinkedIn Ads',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  organico: 'Orgânico',
  evento: 'Evento',
  seo_geo: 'SEO/GEO'
};

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inteiro(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function reais(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function negocios(n: number): string {
  return inteiro(n) + (Math.round(n) === 1 ? ' negócio' : ' negócios');
}

function linhaSemDados() {
  return { id: 'sem-dados', nome: SEM_DADOS, fonte: SEM_DADOS, frequencia: SEM_DADOS, ultimo: SEM_DADOS, dest: SEM_DADOS };
}

function funilVazio(): FunilRelatorio[] {
  return ['Contas qualificadas', 'Contas com sinal', 'Leads em cadência', 'Respostas', 'Reuniões', 'Negócios abertos'].map(label => ({
    label, fonte: SEM_DADOS, n: SEM_DADOS, pct: '0%'
  }));
}

/** Relatório vazio de verdade: nenhum número do protótipo. */
export function relatorioSemDados(): RelatoriosTela {
  const celula = { v: SEM_DADOS, n: SEM_DADOS };
  return {
    kpis: [
      { label: 'Pipeline em aberto', valor: SEM_DADOS, delta: SEM_DADOS },
      { label: 'Pipeline ponderado', valor: SEM_DADOS, delta: SEM_DADOS },
      { label: 'Receita ganha', valor: SEM_DADOS, delta: SEM_DADOS },
      { label: 'Leads de campanha', valor: SEM_DADOS, delta: SEM_DADOS }
    ],
    motions: ROTULOS_MOTION.slice(),
    etapas: [{ nome: SEM_DADOS, total: 'false', cels: [celula, celula, celula, celula] }],
    funil: funilVazio(),
    cadencias: [{ nome: SEM_DADOS, contatos: SEM_DADOS, resposta: SEM_DADOS, cor: 'var(--neutral)' }],
    cadNota: SEM_DADOS,
    canais: [{ nome: SEM_DADOS, inv: SEM_DADOS, leads: SEM_DADOS, cpl: SEM_DADOS }],
    creditos: [{ nome: SEM_DADOS, creditos: SEM_DADOS, usd: '' }],
    custoReuniao: SEM_DADOS,
    linhas: [linhaSemDados()]
  };
}

function kpiNumero(label: string, valor: number | null, delta: string, comoReais: boolean): KpiRelatorio {
  return { label, valor: valor === null ? SEM_DADOS : (comoReais ? reais(valor) : inteiro(valor)), delta: valor === null ? SEM_DADOS : delta };
}

function percentual(valor: unknown): string {
  const n = numero(valor);
  if (n === null) return SEM_DADOS;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
}

interface EtapaFunil {
  stage_key?: string;
  label?: string;
  order_index?: number;
  deals_count?: unknown;
  total_amount?: unknown;
}

interface LinhaPipeline {
  motion?: string;
  stage_key?: string;
  order_index?: number;
  deals_count?: unknown;
  total_amount?: unknown;
}

function montarEtapas(stages: EtapaFunil[], linhas: LinhaPipeline[]): EtapaRelatorio[] {
  const porChave = new Map<string, { nome: string; ordem: number; cels: Array<{ valor: number; qtd: number }> }>();
  const garantir = (chave: string, nome: string, ordem: number) => {
    let etapa = porChave.get(chave);
    if (!etapa) {
      etapa = { nome, ordem, cels: MOTIONS.map(() => ({ valor: 0, qtd: 0 })) };
      porChave.set(chave, etapa);
    } else if (nome !== SEM_DADOS && etapa.nome === SEM_DADOS) {
      etapa.nome = nome;
      etapa.ordem = ordem;
    }
    return etapa;
  };
  stages.forEach((s, i) => {
    if (!s.stage_key) return;
    garantir(s.stage_key, s.label || SEM_DADOS, numero(s.order_index) ?? i + 1);
  });
  for (const linha of linhas) {
    if (!linha.stage_key) continue;
    const idx = MOTIONS.indexOf(linha.motion as typeof MOTIONS[number]);
    if (idx < 0) continue;
    const etapa = garantir(linha.stage_key, SEM_DADOS, numero(linha.order_index) ?? 99);
    const valor = numero(linha.total_amount);
    const qtd = numero(linha.deals_count);
    if (valor !== null) etapa.cels[idx].valor += valor;
    if (qtd !== null) etapa.cels[idx].qtd += qtd;
  }
  const ordenadas = [...porChave.values()].sort((a, b) => a.ordem - b.ordem);
  if (!ordenadas.length) return relatorioSemDados().etapas;
  const linhasTela: EtapaRelatorio[] = ordenadas.map(etapa => {
    const totalValor = etapa.cels.reduce((s, c) => s + c.valor, 0);
    const totalQtd = etapa.cels.reduce((s, c) => s + c.qtd, 0);
    const cels = etapa.cels.map(c => ({ v: reais(c.valor), n: negocios(c.qtd) })).concat([{ v: reais(totalValor), n: negocios(totalQtd) }]);
    return { nome: etapa.nome, total: 'false', cels };
  });
  const totais = MOTIONS.map((_, idx) => ordenadas.reduce((s, e) => s + e.cels[idx].valor, 0));
  const qtds = MOTIONS.map((_, idx) => ordenadas.reduce((s, e) => s + e.cels[idx].qtd, 0));
  const totalValor = totais.reduce((s, n) => s + n, 0);
  const totalQtd = qtds.reduce((s, n) => s + n, 0);
  linhasTela.push({
    nome: 'Total',
    total: 'true',
    cels: totais.map((v, i) => ({ v: reais(v), n: negocios(qtds[i]) })).concat([{ v: reais(totalValor), n: negocios(totalQtd) }])
  });
  return linhasTela;
}

function montarFunil(opcoes: {
  contas: number | null;
  comSinal: number | null;
  inscritos: number | null;
  respostas: number | null;
  negociosAbertos: number | null;
}): FunilRelatorio[] {
  const item = (label: string, fonte: string, n: number | null): FunilRelatorio => ({
    label, fonte: n === null ? SEM_DADOS : fonte, n: n === null ? SEM_DADOS : inteiro(n), pct: '0%'
  });
  const itens = [
    item('Contas qualificadas', 'Contas e leads', opcoes.contas),
    item('Contas com sinal', 'Contas e leads', opcoes.comSinal),
    item('Leads em cadência', 'Cadências', opcoes.inscritos),
    item('Respostas', 'Cadências', opcoes.respostas),
    item('Reuniões', SEM_DADOS, null),
    item('Negócios abertos', 'Pipeline', opcoes.negociosAbertos)
  ];
  const max = Math.max(0, ...itens.map(f => {
    const bruto = f.n.replace(/\./g, '').replace(',', '.');
    return numero(bruto) ?? 0;
  }));
  if (max > 0) {
    for (const f of itens) {
      const n = numero(f.n.replace(/\./g, '').replace(',', '.'));
      if (n !== null && f.n !== SEM_DADOS) f.pct = Math.round(n / max * 100) + '%';
    }
  }
  return itens;
}

/** Lê o funil, o pipeline, as cadências, as campanhas e os créditos do workspace. */
export async function listarRelatorios(cliente: SupabaseClient, workspaceId: string): Promise<RelatoriosTela> {
  const funilRes = await cliente.rpc('get_revenue_funnel_summary', { p_workspace_id: workspaceId });
  if (funilRes.error) {
    const msg = funilRes.error.message || '';
    if (funilRes.error.code === '42501' || /acesso|permiss/i.test(msg)) {
      throw new Error(msg || 'Sem acesso a este workspace.');
    }
    throw new Error('Não foi possível carregar o funil dos relatórios.', { cause: funilRes.error });
  }
  const funil = funilRes.data;
  if (!funil || typeof funil !== 'object' || Array.isArray(funil)) return relatorioSemDados();

  const [pipeline, cadencias, campanhas, creditos, contas] = await Promise.all([
    lerTabela(cliente, 'view_pipeline_analytics', 'motion, stage_key, order_index, deals_count, total_amount', workspaceId, 'Não foi possível carregar o pipeline dos relatórios.'),
    lerTabela(cliente, 'view_cadence_performance', 'cadence_name, total_enrolled, responded_count, response_rate_pct', workspaceId, 'Não foi possível carregar as cadências dos relatórios.'),
    lerTabela(cliente, 'campaigns', 'channel_type, leads_count', workspaceId, 'Não foi possível carregar as campanhas dos relatórios.'),
    lerTabela(cliente, 'credit_transactions', 'type, amount, agent_code', workspaceId, 'Não foi possível carregar os créditos dos relatórios.', ['type', 'consume']),
    lerTabela(cliente, 'accounts', 'id, last_signal_text', workspaceId, 'Não foi possível carregar as contas dos relatórios.', ['status', 'ativa'])
  ]);

  const resumo = funil as Record<string, unknown>;
  const stages = Array.isArray(resumo.stages) ? resumo.stages as EtapaFunil[] : [];
  const negociosAbertos = Array.isArray(resumo.stages)
    ? stages.reduce((s, e) => e.stage_key === 'ganho' ? s : s + (numero(e.deals_count) ?? 0), 0)
    : null;

  const inscritos = cadencias.length
    ? cadencias.reduce((s, c) => s + (numero(c.total_enrolled) ?? 0), 0)
    : null;
  const respostas = cadencias.length
    ? cadencias.reduce((s, c) => s + (numero(c.responded_count) ?? 0), 0)
    : null;

  const porCanal = new Map<string, number>();
  for (const c of campanhas) {
    const n = numero(c.leads_count);
    if (n === null) continue;
    const chave = String(c.channel_type || '');
    porCanal.set(chave, (porCanal.get(chave) || 0) + n);
  }

  const porAgente = new Map<string, number>();
  for (const c of creditos) {
    if (c.type !== 'consume') continue;
    const n = numero(c.amount);
    if (n === null) continue;
    const chave = String(c.agent_code || '');
    porAgente.set(chave, (porAgente.get(chave) || 0) + n);
  }

  const base = relatorioSemDados();
  return {
    ...base,
    kpis: [
      kpiNumero('Pipeline em aberto', numero(resumo.total_active_pipeline_amount), 'negócios ativos', true),
      kpiNumero('Pipeline ponderado', numero(resumo.weighted_pipeline_amount), 'valor ponderado pela probabilidade', true),
      kpiNumero('Receita ganha', numero(resumo.won_revenue_amount), 'negócios ganhos', true),
      kpiNumero('Leads de campanha', numero(resumo.campaign_leads_count), 'soma das campanhas', false)
    ],
    etapas: montarEtapas(stages, pipeline as LinhaPipeline[]),
    funil: montarFunil({
      contas: contas.length,
      comSinal: contas.filter(c => typeof c.last_signal_text === 'string' && c.last_signal_text.trim() !== '').length,
      inscritos,
      respostas,
      negociosAbertos
    }),
    cadencias: cadencias.length
      ? cadencias.map(c => ({
        nome: typeof c.cadence_name === 'string' && c.cadence_name ? c.cadence_name : SEM_DADOS,
        contatos: numero(c.total_enrolled) === null ? SEM_DADOS : inteiro(numero(c.total_enrolled) as number) + ' contatos',
        resposta: percentual(c.response_rate_pct),
        cor: (numero(c.responded_count) || 0) > 0 ? 'var(--ok)' : 'var(--neutral)'
      }))
      : base.cadencias,
    cadNota: SEM_DADOS,
    canais: porCanal.size
      ? [...porCanal.entries()].map(([chave, leads]) => ({
        nome: NOMES_CANAL[chave] || chave || SEM_DADOS,
        inv: SEM_DADOS,
        leads: inteiro(leads) + ' leads',
        cpl: SEM_DADOS
      }))
      : base.canais,
    creditos: porAgente.size
      ? [...porAgente.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([codigo, total]) => ({
          nome: NOMES_AGENTE[codigo] || (codigo ? codigo : SEM_DADOS),
          creditos: inteiro(total),
          usd: ''
        }))
        
      : base.creditos,
    custoReuniao: SEM_DADOS,
    linhas: [linhaSemDados()]
  };
}

async function lerTabela(
  cliente: SupabaseClient,
  tabela: string,
  colunas: string,
  workspaceId: string,
  mensagem: string,
  filtroExtra?: [string, string]
): Promise<Array<Record<string, unknown>>> {
  let consulta = cliente.from(tabela).select(colunas).eq('workspace_id', workspaceId);
  if (filtroExtra) consulta = consulta.eq(filtroExtra[0], filtroExtra[1]);
  const { data, error } = await consulta;
  if (error) throw new Error(mensagem, { cause: error });
  return (data || []) as unknown as Array<Record<string, unknown>>;
}
