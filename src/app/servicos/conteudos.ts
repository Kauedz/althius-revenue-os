// Biblioteca de conteudos. Persona vazia fica "Sem dados ainda". Publicar segue o Hermes e nunca mostra dolar.
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEM_DADOS = 'Sem dados ainda';

export interface ConteudoTela {
  id: string;
  nome: string;
  formato: string;
  persona: string;
  status: string;
  texto: string;
}

export interface ConteudosTela {
  podeEditar: boolean;
  linhas: ConteudoTela[];
}

export interface ConteudoInput {
  id?: string | null;
  nome: string;
  formato: string;
  persona: string;
  texto: string;
}

const ERRO_CARGA = 'Não foi possível carregar os conteúdos.';
const ERRO_GRAVAR = 'Não foi possível gravar o conteúdo.';
const ERRO_PUBLICAR = 'Não foi possível publicar o conteúdo.';
const FORMATO_INVALIDO = 'Escolha o formato do conteúdo.';
const NOME_OBRIGATORIO = 'Dê um nome ao conteúdo.';

const FORMATO: Record<string, string> = {
  email: 'E-mail',
  pdf: 'PDF',
  anuncio: 'Anúncio',
  roteiro: 'Roteiro',
  post: 'Post'
};
const STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Aguardando aprovação',
  ativo: 'Ativo'
};

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function formatoDe(rotulo: string): string | null {
  const t = rotulo.trim().toLowerCase();
  if (FORMATO[t]) return t;
  const peloNome = Object.entries(FORMATO).find(([, nome]) => nome.toLowerCase() === t);
  return peloNome ? peloNome[0] : null;
}

interface ItemBruto {
  id?: unknown;
  name?: unknown;
  format?: unknown;
  persona?: unknown;
  body?: unknown;
  status?: unknown;
}

function montar(data: { ok?: boolean; erro?: string; pode_editar?: boolean; itens?: ItemBruto[] } | null): ConteudosTela {
  if (!data || data.ok !== true) {
    throw new Error(data && typeof data.erro === 'string' && data.erro ? data.erro : ERRO_CARGA);
  }
  const itens = Array.isArray(data.itens) ? data.itens : [];
  return {
    podeEditar: data.pode_editar === true,
    linhas: itens.map(item => {
      const persona = texto(item.persona);
      const corpo = texto(item.body);
      return {
        id: texto(item.id),
        nome: texto(item.name) || SEM_DADOS,
        formato: FORMATO[texto(item.format)] || SEM_DADOS,
        persona: persona || SEM_DADOS,
        status: STATUS[texto(item.status)] || SEM_DADOS,
        texto: corpo || SEM_DADOS
      };
    })
  };
}

export async function listarConteudos(cliente: SupabaseClient, workspaceId: string, membroId: string): Promise<ConteudosTela> {
  const { data, error } = await cliente.rpc('content_list', { p_workspace_id: workspaceId, p_member_id: membroId });
  if (error) throw new Error(ERRO_CARGA, { cause: error });
  return montar(data);
}

async function resultado(cliente: SupabaseClient, nome: string, args: Record<string, unknown>, erroPadrao: string) {
  const { data, error } = await cliente.rpc(nome, args);
  if (error) return { ok: false as const, mensagem: erroPadrao };
  if (data?.ok) return data as { ok: true; id?: string; destino?: string; mensagem?: string };
  return { ok: false as const, mensagem: (typeof data?.erro === 'string' && data.erro) || erroPadrao };
}

export async function salvarConteudo(
  cliente: SupabaseClient, workspaceId: string, membroId: string, item: ConteudoInput
): Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const formato = formatoDe(item.formato || '');
  if (!formato) return { ok: false, mensagem: FORMATO_INVALIDO };
  if (!texto(item.nome)) return { ok: false, mensagem: NOME_OBRIGATORIO };
  const data = await resultado(cliente, 'content_save', {
    p_workspace_id: workspaceId,
    p_member_id: membroId,
    p_id: item.id || null,
    p_name: texto(item.nome),
    p_format: formato,
    p_persona: texto(item.persona),
    p_body: item.texto || ''
  }, ERRO_GRAVAR);
  if (!data.ok) return data;
  return { ok: true, id: String(data.id || '') };
}

export async function publicarConteudo(
  cliente: SupabaseClient, workspaceId: string, membroId: string, id: string
): Promise<{ ok: true; destino: string; mensagem: string } | { ok: false; mensagem: string }> {
  const data = await resultado(cliente, 'content_publish', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_id: id
  }, ERRO_PUBLICAR);
  if (!data.ok) return data;
  return { ok: true, destino: String(data.destino || ''), mensagem: data.mensagem || '' };
}
