// Sinais da página signals: catálogo e eventos que o banco devolve.
// O que não existe no banco aparece como "Sem dados ainda". Nunca dólar. Nada é gravado.
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENTES_EXIBICAO } from '../agentes-exibicao';

export const SEM_DADOS = 'Sem dados ainda';

export interface KpiSinal {
  label: string;
  valor: string;
  delta: string;
}

export interface EventoSinal {
  id: string;
  conta: string;
  tipo: string;
  detalhe: string;
  fit: string;
  quando: string;
}

export interface ItemCatalogoSinal {
  nome: string;
  custo: string;
  ativo: boolean;
  /** o banco já coleta este sinal de verdade (receita ligada pelo superadmin) */
  coleta: boolean;
}

export interface GrupoCatalogoSinal {
  codigo: string;
  nome: string;
  sigla: string;
  ativos: string;
  itens: ItemCatalogoSinal[];
}

export interface SinaisTela {
  kpis: KpiSinal[];
  eventos: EventoSinal[];
  grupos: GrupoCatalogoSinal[];
  resumo: string;
  /** nomes dos sinais que já coletam de verdade */
  coletando: string[];
}

const ERRO_SINAIS = 'Não foi possível carregar os sinais de compra.';
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

const AGENTES: Record<string, { nome: string; sigla: string }> = AGENTES_EXIBICAO;

const ORDEM_AGENTES = ['comercial', 'marketing', 'copy', 'revops'];

const ROTULOS_KPI = ['Sinais na semana', 'Vagas abertas', 'Mídia paga', 'Novos empreendimentos'];
const CODIGOS_KPI = ['vagas_cargo', 'anuncios_ativos', 'nova_filial'];

function texto(valor: unknown): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : '';
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function um<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function eventoVazio(): EventoSinal {
  return { id: 'sem-dados', conta: SEM_DADOS, tipo: SEM_DADOS, detalhe: SEM_DADOS, fit: SEM_DADOS, quando: SEM_DADOS };
}

function resumoCatalogo(ativos: number, total: number): string {
  if (total === 0) return SEM_DADOS;
  const parte = ativos === 1 ? '1 sinal ativo' : ativos + ' sinais ativos';
  return parte + ' de ' + total;
}

/** Tela vazia de verdade: nenhum nome nem número do protótipo. */
export function sinaisSemDados(): SinaisTela {
  return {
    kpis: ROTULOS_KPI.map(label => ({ label, valor: SEM_DADOS, delta: '' })),
    eventos: [eventoVazio()],
    grupos: [{
      codigo: '',
      nome: SEM_DADOS,
      sigla: '--',
      ativos: SEM_DADOS,
      itens: [{ nome: SEM_DADOS, custo: SEM_DADOS, ativo: false, coleta: false }]
    }],
    resumo: SEM_DADOS,
    coletando: []
  };
}

function detalheDoPayload(payload: unknown): string {
  if (typeof payload === 'string') return texto(payload) || SEM_DADOS;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return SEM_DADOS;
  const registro = payload as Record<string, unknown>;
  for (const chave of ['texto', 'text', 'detalhe', 'detail', 'description', 'title']) {
    const valor = texto(registro[chave]);
    if (valor) return valor;
  }
  return SEM_DADOS;
}

function quando(iso: unknown): string {
  if (typeof iso !== 'string' || iso.trim() === '') return SEM_DADOS;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return SEM_DADOS;
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function naSemana(iso: unknown, agora: number): boolean {
  if (typeof iso !== 'string') return false;
  const data = new Date(iso).getTime();
  return Number.isFinite(data) && data >= agora - SEMANA_MS;
}

interface Definicao {
  id?: unknown;
  agent_code?: unknown;
  code?: unknown;
  name?: unknown;
  credits_per_account?: unknown;
  default_on?: unknown;
}

interface Ajuste {
  signal_id?: unknown;
  enabled?: unknown;
}

interface EventoBruto {
  id?: unknown;
  detected_at?: unknown;
  payload?: unknown;
  accounts?: { name?: unknown; fit?: unknown } | Array<{ name?: unknown; fit?: unknown }> | null;
  signal_definitions?: { name?: unknown; code?: unknown } | Array<{ name?: unknown; code?: unknown }> | null;
}

function montarCatalogo(definicoes: Definicao[], ajustes: Ajuste[], coletam: Set<string>): { grupos: GrupoCatalogoSinal[]; resumo: string; coletando: string[] } {
  const porId = new Map<string, boolean>();
  for (const ajuste of ajustes) {
    const id = texto(ajuste.signal_id);
    if (id) porId.set(id, ajuste.enabled === true);
  }
  const porAgente = new Map<string, ItemCatalogoSinal[]>();
  const ativosPorAgente = new Map<string, number>();
  let ativos = 0;
  const coletando: string[] = [];
  for (const definicao of definicoes) {
    const codigo = texto(definicao.agent_code) || SEM_DADOS;
    const id = texto(definicao.id);
    const ligado = id && porId.has(id) ? porId.get(id) === true : definicao.default_on === true;
    if (ligado) ativos += 1;
    const creditos = numero(definicao.credits_per_account);
    const coleta = coletam.has(texto(definicao.code));
    const item: ItemCatalogoSinal = {
      nome: texto(definicao.name) || SEM_DADOS,
      custo: creditos === null ? SEM_DADOS : String(Math.round(creditos)),
      ativo: ligado,
      coleta
    };
    if (coleta) coletando.push(item.nome);
    const lista = porAgente.get(codigo) || [];
    lista.push(item);
    porAgente.set(codigo, lista);
    if (ligado) ativosPorAgente.set(codigo, (ativosPorAgente.get(codigo) || 0) + 1);
  }
  const codigos = [...porAgente.keys()].sort((a, b) => {
    const ia = ORDEM_AGENTES.indexOf(a);
    const ib = ORDEM_AGENTES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, 'pt-BR');
  });
  const grupos = codigos.map(codigo => {
    const agente = AGENTES[codigo];
    const itens = (porAgente.get(codigo) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const nAtivos = ativosPorAgente.get(codigo) || 0;
    return {
      codigo,
      nome: agente ? agente.nome : codigo,
      sigla: agente ? agente.sigla : codigo.slice(0, 2).toUpperCase(),
      ativos: nAtivos + ' de ' + itens.length + ' ativos',
      itens
    };
  });
  return { grupos, resumo: resumoCatalogo(ativos, definicoes.length), coletando: coletando.sort((a, b) => a.localeCompare(b, 'pt-BR')) };
}

function montarEventos(brutos: EventoBruto[], agora: number): { eventos: EventoSinal[]; kpis: KpiSinal[] } {
  const contagem = [0, 0, 0, 0];
  const eventos = brutos.map(bruto => {
    const definicao = um(bruto.signal_definitions);
    const conta = um(bruto.accounts);
    const codigo = texto(definicao?.code);
    if (naSemana(bruto.detected_at, agora)) {
      contagem[0] += 1;
      const indice = CODIGOS_KPI.indexOf(codigo);
      if (indice >= 0) contagem[indice + 1] += 1;
    }
    const fit = numero(conta?.fit);
    return {
      id: texto(bruto.id) || SEM_DADOS,
      conta: texto(conta?.name) || SEM_DADOS,
      tipo: texto(definicao?.name) || SEM_DADOS,
      detalhe: detalheDoPayload(bruto.payload),
      fit: fit === null ? SEM_DADOS : String(Math.round(fit)),
      quando: quando(bruto.detected_at)
    };
  });
  return {
    eventos: eventos.length ? eventos : [eventoVazio()],
    kpis: ROTULOS_KPI.map((label, i) => ({ label, valor: String(contagem[i]), delta: '' }))
  };
}

async function ler(
  cliente: SupabaseClient,
  tabela: string,
  colunas: string,
  workspaceId: string | null
): Promise<unknown[]> {
  let consulta = cliente.from(tabela).select(colunas);
  if (workspaceId) consulta = consulta.eq('workspace_id', workspaceId);
  if (tabela === 'signal_events') consulta = consulta.order('detected_at', { ascending: false });
  const { data, error } = await consulta;
  if (error) throw new Error(ERRO_SINAIS, { cause: error });
  return data || [];
}

/**
 * Quais sinais já coletam de verdade. Se o banco não responder, ninguém é dado como "coletando": a tela segue dizendo
 * "em breve" em vez de prometer o que não sabe.
 */
async function sinaisQueColetam(cliente: SupabaseClient): Promise<Set<string>> {
  try {
    const { data, error } = await cliente.rpc('signal_codes_com_coleta');
    if (error || !Array.isArray(data)) return new Set();
    return new Set(data.filter((c): c is string => typeof c === 'string'));
  } catch {
    return new Set();
  }
}

/** O aviso da página de Sinais: só os sinais que já coletam saem do "em breve". */
export function avisoDeColeta(sinais: SinaisTela): string {
  const nomes = sinais.coletando || [];
  if (!nomes.length) return 'Coleta automática em breve.';
  return 'Coleta automática ativa para: ' + nomes.join(', ') + '. Os demais sinais chegam em breve.';
}

/** Lista o catálogo e os eventos de compra do workspace. Não grava nada. */
export async function listarSinais(cliente: SupabaseClient, workspaceId: string): Promise<SinaisTela> {
  const acesso = await cliente.rpc('get_revenue_funnel_summary', { p_workspace_id: workspaceId });
  if (acesso.error) {
    const msg = acesso.error.message || '';
    if (acesso.error.code === '42501' || /acesso|permiss/i.test(msg)) {
      throw new Error(msg || 'Sem acesso a este workspace.');
    }
    throw new Error(ERRO_SINAIS, { cause: acesso.error });
  }

  const [definicoes, ajustes, eventos, coletam] = await Promise.all([
    ler(cliente, 'signal_definitions', 'id, agent_code, code, name, credits_per_account, default_on', null),
    ler(cliente, 'workspace_signal_settings', 'signal_id, enabled', workspaceId),
    ler(cliente, 'signal_events', 'id, detected_at, payload, accounts(name, fit), signal_definitions(name, code)', workspaceId),
    sinaisQueColetam(cliente)
  ]);

  const catalogo = montarCatalogo(definicoes as Definicao[], ajustes as Ajuste[], coletam);
  const lista = montarEventos(eventos as EventoBruto[], Date.now());
  if (catalogo.grupos.length === 0) {
    const vazio = sinaisSemDados();
    return { ...vazio, ...lista, grupos: vazio.grupos, resumo: vazio.resumo };
  }
  return { kpis: lista.kpis, eventos: lista.eventos, grupos: catalogo.grupos, resumo: catalogo.resumo, coletando: catalogo.coletando };
}
