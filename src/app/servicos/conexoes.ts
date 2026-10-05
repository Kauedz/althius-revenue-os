// Conexão das contas de mensagem da PRÓPRIA pessoa (ADR 0017). Quem gera o link é o backend (`webhooks`),
// que guarda a chave do provedor; a tela só pede o link com o login da pessoa e abre a janela segura.
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProvedorMensagem = 'linkedin' | 'whatsapp' | 'instagram' | 'google' | 'microsoft' | 'imap';
export type ResultadoLink = { ok: true; url: string } | { ok: false; mensagem: string };
export type ResultadoDesconexao = { ok: true } | { ok: false; mensagem: string };

const VIA_EMAIL: Record<string, ProvedorMensagem> = { gmail: 'google', outlook: 'microsoft', imap: 'imap' };

/** Canal da Caixa de entrada (email, whatsapp, linkedin, instagram) + via do e-mail → provedor guardado no banco. */
export function provedorDoCanal(canal: string, via?: string): ProvedorMensagem {
  if (canal === 'email') return VIA_EMAIL[via ?? 'gmail'] ?? 'google';
  if (canal === 'whatsapp' || canal === 'linkedin' || canal === 'instagram') return canal;
  throw new Error('Canal de mensagem desconhecido.');
}

const FALHA = 'Não foi possível iniciar a conexão. Tente de novo.';

export async function iniciarConexaoConta(
  cliente: SupabaseClient, workspaceId: string, membroId: string, provider: ProvedorMensagem,
  buscar: typeof fetch = fetch
): Promise<ResultadoLink> {
  const { data } = await cliente.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.' };
  let r: Response;
  try {
    r = await buscar('/conexoes/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ workspace_id: workspaceId, member_id: membroId, provider })
    });
  } catch {
    return { ok: false, mensagem: FALHA };
  }
  if (r.status === 503) return { ok: false, mensagem: 'A conexão de contas ainda não está disponível neste ambiente. Peça ao administrador para configurar.' };
  if (r.status === 403) return { ok: false, mensagem: 'Você só pode conectar as suas próprias contas.' };
  if (r.status === 401) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.' };
  if (!r.ok) return { ok: false, mensagem: FALHA };
  const corpo = (await r.json().catch(() => ({}))) as { url?: unknown };
  if (typeof corpo.url !== 'string' || !corpo.url.startsWith('https://')) return { ok: false, mensagem: FALHA };
  return { ok: true, url: corpo.url };
}

export async function desconectarConta(cliente: SupabaseClient, workspaceId: string, membroId: string, provider: ProvedorMensagem): Promise<ResultadoDesconexao> {
  const { error } = await cliente.rpc('messaging_disconnect', { p_workspace_id: workspaceId, p_member_id: membroId, p_provider: provider });
  return error ? { ok: false, mensagem: 'Não foi possível desconectar. Tente de novo.' } : { ok: true };
}
