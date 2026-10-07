// Estratégia ligada ao banco (ADR 0064), no formato da lista genérica do v18 (ALTHIUS_MOD.strategy).
// Mostra só o que existe: o ICP estruturado do cliente (workspace_settings.icp, ADR 0067), o Playbook publicado de cada
// agente (ADR 0057) e as personas alvo (workspace_settings.personas_alvo, que o enriquecimento procura). Sem ICP, a linha
// diz "Não definido": nada de ICP, versão ou contagem inventados.
import type { SupabaseClient } from '@supabase/supabase-js';
import { nomeDoAgente } from '../agentes-exibicao';
import { nomesDosMembros } from './nomes';

export interface LinhaEstrategia { id: string; nome: string; tipo: 'ICP' | 'Playbook' | 'Persona'; versao: string; status: string; resp: string; desc: string }
export interface EstrategiaTela { kpis: string[][]; linhas: LinhaEstrategia[]; icp?: Record<string, unknown> }

export const estrategiaVazia = (): EstrategiaTela => ({ kpis: [], linhas: [] });

const ORDEM_AGENTES = ['comercial', 'marketing', 'copy', 'revops'];
const PAPEL: Record<string, string> = { decisor: 'Decisor', campeao: 'Campeão', influenciador: 'Influenciador' };
const FALHA = 'Não foi possível carregar a estratégia.';

/** Primeiras linhas do Playbook em texto corrido (sem os "#"), para a coluna de descrição. */
export function resumoDoPlaybook(markdown: string, max = 240): string {
  const texto = markdown.split('\n').map(l => l.replace(/^\s*(#+|[-*])\s*/, '').trim()).filter(Boolean)
    .map(l => (/[.!?:;]$/.test(l) ? l : l + '.')).join(' ');
  return texto.length > max ? texto.slice(0, max - 1).trimEnd() + '…' : texto;
}

const reais = (v: unknown) => 'R$ ' + Math.round(Number(v)).toLocaleString('pt-BR');
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
function faixa(min: unknown, max: unknown, fmt: (v: unknown) => string): string {
  const temMin = typeof min === 'number' && Number.isFinite(min), temMax = typeof max === 'number' && Number.isFinite(max);
  if (temMin && temMax) return `${fmt(min)} a ${fmt(max)}`;
  if (temMin) return `a partir de ${fmt(min)}`;
  if (temMax) return `até ${fmt(max)}`;
  return '';
}

/** O ICP em uma frase por campo, só com o que foi definido. */
export function resumoDoIcp(icp: Record<string, unknown>): string {
  const partes: string[] = [];
  const add = (rotulo: string, valor: string) => { if (valor) partes.push(`${rotulo}: ${valor}.`); };
  add('Setores', lista(icp.setores).join(', '));
  add('CNAE', lista(icp.cnaes).join(', '));
  add('Porte', lista(icp.portes).join(', '));
  add('Funcionários', faixa(icp.funcionarios_min, icp.funcionarios_max, v => Math.round(Number(v)).toLocaleString('pt-BR')));
  add('Faturamento', faixa(icp.faturamento_min, icp.faturamento_max, reais));
  add('Capital social', faixa(icp.capital_min, icp.capital_max, reais));
  add('Estados', lista(icp.ufs).join(', '));
  add('Cidades', lista(icp.cidades).join(', '));
  if (typeof icp.observacoes === 'string' && icp.observacoes.trim()) partes.push(icp.observacoes.trim().replace(/[.!?]?$/, '.'));
  return partes.join(' ');
}

export async function listarEstrategia(cliente: SupabaseClient, workspaceId: string): Promise<EstrategiaTela> {
  const [playbooks, ajustes, contas] = await Promise.all([
    cliente.from('agent_playbooks').select('agent_id, version, author_member_id, content_markdown, created_at')
      .eq('workspace_id', workspaceId).eq('is_published', true),
    cliente.from('workspace_settings').select('personas_alvo, icp').eq('workspace_id', workspaceId).maybeSingle(),
    cliente.from('accounts').select('segment').eq('workspace_id', workspaceId)
  ]);
  if (playbooks.error) throw new Error(FALHA, { cause: playbooks.error });
  if (ajustes.error) throw new Error(FALHA, { cause: ajustes.error });
  if (contas.error) throw new Error(FALHA, { cause: contas.error });

  const publicados = [...(playbooks.data || [])].sort((a, b) => ORDEM_AGENTES.indexOf(a.agent_id) - ORDEM_AGENTES.indexOf(b.agent_id));
  const icp = (ajustes.data?.icp && typeof ajustes.data.icp === 'object' ? ajustes.data.icp : {}) as Record<string, unknown>;
  const quemIcp = typeof icp.atualizado_por === 'string' ? icp.atualizado_por : '';
  const autores = await nomesDosMembros(cliente, [...publicados.map(p => p.author_member_id), /^[0-9a-f-]{36}$/i.test(quemIcp) ? quemIcp : null].filter(Boolean) as string[], FALHA);
  const resumoIcp = resumoDoIcp(icp);
  const personas = (Array.isArray(ajustes.data?.personas_alvo) ? ajustes.data!.personas_alvo : [])
    .filter((p: unknown): p is { cargo: string; papel?: string } => !!p && typeof (p as { cargo?: unknown }).cargo === 'string' && !!(p as { cargo: string }).cargo.trim());
  const listaContas = contas.data || [];
  const segmentos = new Set(listaContas.map(c => (c.segment || '').trim()).filter(Boolean));

  const linhas: LinhaEstrategia[] = [
    {
      id: 'icp', nome: 'ICP', tipo: 'ICP', versao: '—', status: resumoIcp ? 'Definido' : 'Não definido',
      resp: quemIcp.startsWith('agente:') ? nomeDoAgente(quemIcp.slice(7)) : (quemIcp && autores.get(quemIcp)) || '—',
      desc: resumoIcp || 'Ainda não definido. Use "Editar ICP" ou peça ao Jax: a Zoe usa o ICP para montar as buscas.'
    },
    ...publicados.map(p => ({
      id: 'playbook-' + p.agent_id, nome: 'Playbook · ' + nomeDoAgente(p.agent_id), tipo: 'Playbook' as const, versao: 'v' + p.version,
      status: 'Publicado', resp: (p.author_member_id && autores.get(p.author_member_id)) || '—', desc: resumoDoPlaybook(p.content_markdown || '')
    })),
    ...personas.map((p, i) => ({
      id: 'persona-' + i, nome: p.cargo.trim(), tipo: 'Persona' as const, versao: '—', status: 'Ativa', resp: '—',
      desc: 'Papel na compra: ' + (PAPEL[p.papel || ''] || 'Influenciador') + '. O enriquecimento procura este cargo nas contas.'
    }))
  ];

  return {
    kpis: [
      ['Playbooks publicados', String(publicados.length), 'de 4 agentes'],
      ['Personas alvo', String(personas.length), 'cargos que o enriquecimento procura'],
      ['Segmentos', String(segmentos.size), 'das contas do workspace'],
      ['Contas', String(listaContas.length), 'no workspace']
    ],
    linhas,
    icp
  };
}

/** Grava o ICP (só gestores; o banco valida e normaliza). Listas podem vir como texto separado por vírgula. */
export async function salvarIcp(cliente: SupabaseClient, workspaceId: string, membroId: string, icp: Record<string, unknown>): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const limpo = Object.fromEntries(Object.entries(icp).filter(([, v]) => !(typeof v === 'string' && !v.trim())));
  const { error } = await cliente.rpc('workspace_icp_set', { p_workspace_id: workspaceId, p_member_id: membroId, p_icp: limpo });
  if (error) return { ok: false, mensagem: error.message || 'Não foi possível salvar o ICP.' };
  return { ok: true };
}
