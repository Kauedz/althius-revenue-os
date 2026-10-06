// Página de Integrações no modo real: o estado das conexões da pessoa e o início e o fim de cada conexão.
// Quem conecta de fato é o backend (`webhooks`, rotas /integracoes/*): a tela só pede com o login da pessoa e abre a
// janela segura do app. Nunca mostra token, dólar nem o nome do fornecedor de mensagens; todo erro vira uma mensagem.
import type { SupabaseClient } from '@supabase/supabase-js';
import { PERFIS } from '../../server/integracoes/perfis';
import type { ConexoesTela } from './caixa';

export type EstadoDoApp = { estado: 'conectado' | 'precisa_reconectar'; conta: string | null; conectados: number };
export type ResultadoLink = { ok: true; url: string } | { ok: false; mensagem: string };
export type ResultadoSimples = { ok: true } | { ok: false; mensagem: string };

const FALHA = 'Não foi possível iniciar a conexão. Tente de novo.';

/** O estado de cada app (OAuth) que a pessoa conectou neste workspace. Só o dela; nunca a conta de outro. */
export async function carregarIntegracoes(cliente: SupabaseClient, workspaceId: string): Promise<Record<string, EstadoDoApp>> {
  const { data, error } = await cliente.rpc('integration_estado', { p_workspace_id: workspaceId });
  if (error) throw new Error('Não foi possível carregar as integrações.', { cause: error });
  const saida: Record<string, EstadoDoApp> = {};
  if (!Array.isArray(data)) return saida;
  for (const e of data as Array<Record<string, unknown>>) {
    const estado = e.meu_estado;
    if (typeof e.integracao !== 'string' || (estado !== 'conectado' && estado !== 'precisa_reconectar')) continue;
    saida[e.integracao] = { estado, conta: typeof e.minha_conta === 'string' ? e.minha_conta : null, conectados: Number(e.conectados) || 0 };
  }
  return saida;
}

async function chamar(cliente: SupabaseClient, caminho: string, corpo: Record<string, unknown>, buscar: typeof fetch): Promise<{ status: number; corpo: Record<string, unknown> } | { semSessao: true } | { falhou: true }> {
  const { data } = await cliente.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { semSessao: true };
  try {
    const r = await buscar(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) });
    return { status: r.status, corpo: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch { return { falhou: true }; }
}

function mensagemDoErro(status: number, corpo: Record<string, unknown>): string {
  const erro = corpo.erro;
  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Só C-level, estrategista e superadmin conectam esta integração.';
  if (status === 409 && erro === 'em_breve') return typeof corpo.motivo === 'string' && corpo.motivo ? corpo.motivo : 'Esta integração ainda não está disponível.';
  if (status === 409 && erro === 'canal_de_mensagens') return 'Este canal é uma conta de mensagem: conecte e gerencie pela Caixa de entrada.';
  if (status === 409 && erro === 'precisa_reconectar') return 'Sua conexão expirou ou foi revogada. Conecte de novo.';
  if (status === 503 && erro === 'nao_configurada') return 'Esta integração ainda precisa ser configurada pela Althius.';
  if (status === 503) return 'A conexão de integrações ainda não está disponível neste ambiente. Peça ao administrador para configurar.';
  return FALHA;
}

/** Passo 1 da conexão: devolve o endereço do consentimento do app (ou, nos canais de mensagem, o do assistente seguro). */
export async function iniciarConexaoIntegracao(cliente: SupabaseClient, workspaceId: string, membroId: string, integracao: string, buscar: typeof fetch = fetch): Promise<ResultadoLink> {
  const r = await chamar(cliente, '/integracoes/iniciar', { workspaceId, membroId, integracao }, buscar);
  if ('semSessao' in r) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.' };
  if ('falhou' in r) return { ok: false, mensagem: FALHA };
  if (r.status !== 200) return { ok: false, mensagem: mensagemDoErro(r.status, r.corpo) };
  const url = r.corpo.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) return { ok: false, mensagem: FALHA };
  return { ok: true, url };
}

/** Tira só o acesso da própria pessoa (não mexe no dos outros nem nos dados já trazidos). */
export async function desconectarIntegracao(cliente: SupabaseClient, workspaceId: string, integracao: string, buscar: typeof fetch = fetch): Promise<ResultadoSimples> {
  const r = await chamar(cliente, '/integracoes/desconectar', { workspaceId, integracao }, buscar);
  if ('semSessao' in r) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.' };
  if ('falhou' in r) return { ok: false, mensagem: 'Não foi possível desconectar. Tente de novo.' };
  return r.status === 200 ? { ok: true } : { ok: false, mensagem: r.status === 403 ? mensagemDoErro(403, r.corpo) : 'Não foi possível desconectar. Tente de novo.' };
}

const MOTIVOS: Record<string, string> = {
  recusada: 'Você não autorizou a conexão.',
  expirada: 'O pedido de conexão venceu. Tente de novo.',
  usada: 'Este retorno já foi usado. Tente conectar de novo.',
  invalida: 'O retorno da conexão é inválido. Tente de novo.',
  portal_diferente: 'Esta conta é de outro portal: o workspace já está ligado a um. Use a conta do mesmo portal.',
  indisponivel: 'O app não respondeu. Tente de novo em instantes.',
  participacao_inativa: 'Você não participa mais deste workspace.'
};

/** O que a tela mostra quando o app devolve a pessoa (`?conexao=ok|erro&integracao=...&motivo=...`). Nunca ecoa texto da URL. */
export function resultadoDaConexao(search: string): { tipo: 'ok' | 'erro'; titulo: string; mensagem: string } | null {
  const q = new URLSearchParams(search);
  const resultado = q.get('conexao');
  const perfil = PERFIS[q.get('integracao') ?? ''];
  if (!perfil || (resultado !== 'ok' && resultado !== 'erro')) return null;
  if (resultado === 'ok') return { tipo: 'ok', titulo: `${perfil.nome} conectado`, mensagem: `Pronto: sua conta do ${perfil.nome} está conectada à Althius.` };
  return { tipo: 'erro', titulo: `${perfil.nome} não conectado`, mensagem: MOTIVOS[q.get('motivo') ?? ''] ?? 'Não foi possível concluir a conexão. Tente de novo.' };
}

export interface ConexaoDeCartao { conta: string; agentes: string[]; erro?: true }

/** Os cartões "conectados" do catálogo: apps (OAuth) mais as contas de mensagem da Caixa, pelo id do conector. */
export function montarConexoes(apps: Record<string, EstadoDoApp>, contas: ConexoesTela | null): Record<string, ConexaoDeCartao> {
  const mapa: Record<string, ConexaoDeCartao> = {};
  for (const [id, a] of Object.entries(apps)) mapa[id] = { conta: a.conta ?? 'Conta conectada', agentes: [], ...(a.estado === 'precisa_reconectar' ? { erro: true as const } : {}) };
  if (contas?.email) mapa[contas.email.via === 'outlook' ? 'outlook' : 'gmail'] = { conta: contas.email.conta, agentes: [] };
  if (contas?.linkedin) mapa.linkedin = { conta: contas.linkedin.conta, agentes: [] };
  if (contas?.whatsapp) mapa.whatsapp = { conta: contas.whatsapp.conta, agentes: [] };
  if (contas?.instagram) mapa.instagram = { conta: contas.instagram.conta, agentes: [] };
  return mapa;
}
