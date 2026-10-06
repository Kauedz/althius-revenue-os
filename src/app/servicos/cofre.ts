// Cofre de chaves na tela do superadmin (ADR 0049). A chave digitada vai SÓ para o backend (`/cofre/guardar`), que
// confere o superadmin, cifra e guarda. A tela nunca recebe a chave de volta: só os 4 últimos caracteres na lista.
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProvedorCofre = 'apify' | 'unipile' | 'unipile_webhook' | 'modelo_ia';
export type ResultadoCofre = { ok: true; mensagem?: string } | { ok: false; mensagem: string };
export interface NovaChave { provedor: ProvedorCofre; rotulo: string; segredo: string; config?: Record<string, string> }

export const ROTULO_PROVEDOR: Record<ProvedorCofre, string> = {
  apify: 'Apify (coleta de dados)',
  modelo_ia: 'Modelo de IA do Hermes (fica guardada; entra em uso na próxima etapa)',
  unipile: 'Unipile (chave da API)',
  unipile_webhook: 'Unipile (segredo do webhook)'
};

const FALHA = 'Não foi possível falar com o servidor agora. Tente de novo.';

async function chamar(cliente: SupabaseClient, rota: string, corpo: unknown, buscar: typeof fetch): Promise<{ r: Response } | { erro: string }> {
  const { data } = await cliente.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { erro: 'Sua sessão expirou. Entre de novo.' };
  try {
    return { r: await buscar(rota, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(corpo) }) };
  } catch {
    return { erro: FALHA };
  }
}

function erroDoStatus(status: number): string {
  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Só o superadmin da Althius cadastra chaves.';
  if (status === 503) return 'O cofre de chaves ainda não está ligado neste ambiente (falta a chave mestra no servidor).';
  if (status === 400) return 'Confira os campos: nome, chave e, para o modelo de IA, endereço https e nome do modelo.';
  return FALHA;
}

export async function guardarChave(cliente: SupabaseClient, n: NovaChave, buscar: typeof fetch = fetch): Promise<ResultadoCofre> {
  const res = await chamar(cliente, '/cofre/guardar', { provedor: n.provedor, rotulo: n.rotulo, segredo: n.segredo, config: n.config ?? {} }, buscar);
  if ('erro' in res) return { ok: false, mensagem: res.erro };
  return res.r.ok ? { ok: true } : { ok: false, mensagem: erroDoStatus(res.r.status) };
}

export async function testarChave(cliente: SupabaseClient, id: string, buscar: typeof fetch = fetch): Promise<ResultadoCofre> {
  const res = await chamar(cliente, '/cofre/testar', { id }, buscar);
  if ('erro' in res) return { ok: false, mensagem: res.erro };
  if (!res.r.ok) return { ok: false, mensagem: res.r.status === 404 ? 'Chave não encontrada ou desativada.' : erroDoStatus(res.r.status) };
  const corpo = (await res.r.json().catch(() => ({}))) as { ok?: boolean; mensagem?: string };
  return corpo.ok ? { ok: true, mensagem: 'A chave funciona.' } : { ok: false, mensagem: corpo.mensagem || FALHA };
}

async function mexer(cliente: SupabaseClient, funcao: string, args: Record<string, unknown>): Promise<ResultadoCofre> {
  const { error } = await cliente.rpc(funcao, args);
  if (!error) return { ok: true };
  return { ok: false, mensagem: error.code === '42501' ? 'Só o superadmin da Althius faz isso.' : 'Não foi possível concluir. Tente de novo.' };
}

export const alternarChave = (cliente: SupabaseClient, id: string, ativo: boolean) => mexer(cliente, 'cofre_alternar', { p_id: id, p_ativo: ativo });
export const removerChave = (cliente: SupabaseClient, id: string) => mexer(cliente, 'cofre_remover', { p_id: id });
