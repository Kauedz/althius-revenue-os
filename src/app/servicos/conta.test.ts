// @vitest-environment node
// Seam: serviço "Minha conta" (Configurações) contra o Supabase local, com uma pessoa criada só para o teste.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { alterarSenha, lerMinhaConta, removerFoto, salvarMinhaConta, salvarPreferencias, trocarFoto } from './conta';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../../test/supabaseLocal';

const EMAIL = 'conta-teste@example.test';
const SENHA = 'senha-inicial-123';

describe.skipIf(!bancoLocalNoAr)('Minha conta (banco local)', () => {
  const admin = adminLocal();
  let id = '';
  let cliente: SupabaseClient;

  beforeAll(async () => {
    const antigos = await admin.auth.admin.listUsers();
    for (const u of antigos.data?.users || []) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
    const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true, user_metadata: { name: 'Pessoa Teste' } });
    if (error) throw error;
    id = data.user.id;
    cliente = novoClienteLocal();
    const login = await cliente.auth.signInWithPassword({ email: EMAIL, password: SENHA });
    if (login.error) throw login.error;
  });

  afterAll(async () => {
    if (!id) return;
    await admin.storage.from('avatars').remove([`${id}/foto.png`]);
    await admin.auth.admin.deleteUser(id);
  });

  it('grava nome, cargo e telefone e lê de volta', async () => {
    expect(await salvarMinhaConta(cliente, { nome: 'Pessoa Atualizada', cargo: 'Gerente', fone: '+55 11 90000-0000' })).toEqual({ ok: true });
    expect(await lerMinhaConta(cliente)).toMatchObject({ nome: 'Pessoa Atualizada', cargo: 'Gerente', fone: '+55 11 90000-0000' });
  });

  it('nome vazio é recusado com orientação', async () => {
    expect(await salvarMinhaConta(cliente, { nome: '   ', cargo: '', fone: '' })).toEqual({ ok: false, mensagem: 'Digite seu nome.' });
  });

  it('preferências de notificação ficam gravadas', async () => {
    expect(await salvarPreferencias(cliente, { notif: false, som: true })).toEqual({ ok: true });
    expect((await lerMinhaConta(cliente)).preferencias).toEqual({ notif: false, som: true });
  });

  it('foto vai para a pasta da pessoa e o perfil passa a apontar para ela; remover limpa', async () => {
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
    const r = await trocarFoto(cliente, png);
    expect(r.ok).toBe(true);
    const foto = (await lerMinhaConta(cliente)).foto;
    expect(foto).toContain(`/avatars/${id}/foto.png`);
    expect(await removerFoto(cliente)).toEqual({ ok: true });
    expect((await lerMinhaConta(cliente)).foto).toBe('');
  });

  it('foto acima de 2 MB é recusada antes de enviar', async () => {
    const grande = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/png' });
    expect(await trocarFoto(cliente, grande)).toEqual({ ok: false, mensagem: 'A foto passa de 2 MB. Escolha uma menor.' });
  });

  it('troca de senha confere a senha atual e a nova passa a valer', async () => {
    expect(await alterarSenha(cliente, EMAIL, 'errada-000', 'nova-senha-456')).toEqual({ ok: false, mensagem: 'A senha atual não confere.' });
    expect(await alterarSenha(cliente, EMAIL, SENHA, 'curta')).toEqual({ ok: false, mensagem: 'A nova senha precisa de 8 caracteres ou mais, com letras e números.' });
    expect(await alterarSenha(cliente, EMAIL, SENHA, 'nova-senha-456')).toEqual({ ok: true });
    const outro = novoClienteLocal();
    expect((await outro.auth.signInWithPassword({ email: EMAIL, password: 'nova-senha-456' })).error).toBeNull();
  });
});
