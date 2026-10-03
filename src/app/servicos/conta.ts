// Configurações → Minha conta e Notificações: perfil da própria pessoa (tabela profiles),
// foto no depósito "avatars" e senha pelo login do Supabase.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MinhaConta {
  nome: string;
  cargo: string;
  fone: string;
  foto: string;
  preferencias: Record<string, boolean>;
}

export type ResultadoConta = { ok: true } | { ok: false; mensagem: string };

const FALHA = 'Não foi possível salvar agora. Tente de novo.';
const LIMITE_FOTO = 2 * 1024 * 1024;

async function quemSou(cliente: SupabaseClient): Promise<string> {
  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user) throw new Error('Sua sessão expirou. Entre de novo.', { cause: error });
  return data.user.id;
}

export async function lerMinhaConta(cliente: SupabaseClient): Promise<MinhaConta> {
  const id = await quemSou(cliente);
  const { data, error } = await cliente.from('profiles').select('name, job_title, phone, avatar_url, preferences').eq('id', id).single();
  if (error) throw new Error('Não foi possível carregar seus dados.', { cause: error });
  return {
    nome: data.name || '',
    cargo: data.job_title || '',
    fone: data.phone || '',
    foto: data.avatar_url || '',
    preferencias: (data.preferences || {}) as Record<string, boolean>
  };
}

async function atualizarPerfil(cliente: SupabaseClient, campos: Record<string, unknown>): Promise<ResultadoConta> {
  try {
    const id = await quemSou(cliente);
    const { error } = await cliente.from('profiles').update(campos).eq('id', id);
    if (error) {
      console.error('[conta]', error);
      return { ok: false, mensagem: FALHA };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : FALHA };
  }
}

export function salvarMinhaConta(cliente: SupabaseClient, dados: { nome: string; cargo: string; fone: string }): Promise<ResultadoConta> {
  const nome = dados.nome.trim();
  if (!nome) return Promise.resolve({ ok: false, mensagem: 'Digite seu nome.' });
  return atualizarPerfil(cliente, { name: nome, job_title: dados.cargo.trim() || null, phone: dados.fone.trim() || null });
}

export function salvarPreferencias(cliente: SupabaseClient, preferencias: Record<string, boolean>): Promise<ResultadoConta> {
  return atualizarPerfil(cliente, { preferences: preferencias });
}

export async function trocarFoto(cliente: SupabaseClient, arquivo: Blob): Promise<ResultadoConta> {
  if (arquivo.size > LIMITE_FOTO) return { ok: false, mensagem: 'A foto passa de 2 MB. Escolha uma menor.' };
  const extensao = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[arquivo.type];
  if (!extensao) return { ok: false, mensagem: 'Use uma foto PNG, JPG ou WEBP.' };
  try {
    const id = await quemSou(cliente);
    const caminho = `${id}/foto.${extensao}`;
    const { error } = await cliente.storage.from('avatars').upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    if (error) {
      console.error('[conta foto]', error);
      return { ok: false, mensagem: 'Não foi possível enviar a foto. Tente de novo.' };
    }
    // O endereço muda a cada troca para o navegador não mostrar a foto antiga.
    const url = cliente.storage.from('avatars').getPublicUrl(caminho).data.publicUrl + '?v=' + Date.now();
    return atualizarPerfil(cliente, { avatar_url: url });
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : FALHA };
  }
}

export function removerFoto(cliente: SupabaseClient): Promise<ResultadoConta> {
  return atualizarPerfil(cliente, { avatar_url: null });
}

export async function alterarSenha(cliente: SupabaseClient, email: string, atual: string, nova: string): Promise<ResultadoConta> {
  if (!nova || nova.length < 8 || !/[0-9]/.test(nova) || !/[a-zA-Z]/.test(nova)) {
    return { ok: false, mensagem: 'A nova senha precisa de 8 caracteres ou mais, com letras e números.' };
  }
  const confere = await cliente.auth.signInWithPassword({ email, password: atual });
  if (confere.error) return { ok: false, mensagem: 'A senha atual não confere.' };
  const { error } = await cliente.auth.updateUser({ password: nova });
  if (error) {
    console.error('[conta senha]', error);
    return { ok: false, mensagem: 'Não foi possível trocar a senha. Tente de novo.' };
  }
  // Os outros aparelhos precisam entrar de novo com a senha nova.
  await cliente.auth.signOut({ scope: 'others' });
  return { ok: true };
}

export async function sairDosOutrosDispositivos(cliente: SupabaseClient): Promise<ResultadoConta> {
  const { error } = await cliente.auth.signOut({ scope: 'others' });
  if (error) return { ok: false, mensagem: 'Não foi possível encerrar as outras sessões. Tente de novo.' };
  return { ok: true };
}
