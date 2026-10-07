// Estratégia ligada ao banco (ADR 0064), no formato da lista genérica do v18 (ALTHIUS_MOD.strategy).
// Mostra só o que existe: o Playbook publicado de cada agente (onde mora o ICP, ADR 0057) e as personas alvo do workspace
// (workspace_settings.personas_alvo, que o enriquecimento procura). Não há tabela de ICP: nada de ICP, versão ou contagem inventados.
import type { SupabaseClient } from '@supabase/supabase-js';
import { nomeDoAgente } from '../agentes-exibicao';
import { nomesDosMembros } from './nomes';

export interface LinhaEstrategia { id: string; nome: string; tipo: 'Playbook' | 'Persona'; versao: string; status: string; resp: string; desc: string }
export interface EstrategiaTela { kpis: string[][]; linhas: LinhaEstrategia[] }

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

export async function listarEstrategia(cliente: SupabaseClient, workspaceId: string): Promise<EstrategiaTela> {
  const [playbooks, ajustes, contas] = await Promise.all([
    cliente.from('agent_playbooks').select('agent_id, version, author_member_id, content_markdown, created_at')
      .eq('workspace_id', workspaceId).eq('is_published', true),
    cliente.from('workspace_settings').select('personas_alvo').eq('workspace_id', workspaceId).maybeSingle(),
    cliente.from('accounts').select('segment').eq('workspace_id', workspaceId)
  ]);
  if (playbooks.error) throw new Error(FALHA, { cause: playbooks.error });
  if (ajustes.error) throw new Error(FALHA, { cause: ajustes.error });
  if (contas.error) throw new Error(FALHA, { cause: contas.error });

  const publicados = [...(playbooks.data || [])].sort((a, b) => ORDEM_AGENTES.indexOf(a.agent_id) - ORDEM_AGENTES.indexOf(b.agent_id));
  const autores = await nomesDosMembros(cliente, publicados.map(p => p.author_member_id).filter(Boolean) as string[], FALHA);
  const personas = (Array.isArray(ajustes.data?.personas_alvo) ? ajustes.data!.personas_alvo : [])
    .filter((p: unknown): p is { cargo: string; papel?: string } => !!p && typeof (p as { cargo?: unknown }).cargo === 'string' && !!(p as { cargo: string }).cargo.trim());
  const listaContas = contas.data || [];
  const segmentos = new Set(listaContas.map(c => (c.segment || '').trim()).filter(Boolean));

  const linhas: LinhaEstrategia[] = [
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
    linhas
  };
}
