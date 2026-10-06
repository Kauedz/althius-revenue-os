// @vitest-environment node
// Seam: o banco de verdade (Supabase local) com a migration 119. Prova que os nomes, os tipos e as regras do `banco.ts`
// batem com as funções do banco (o resto dos testes usa um banco falso em memória).
import { afterAll, describe, expect, it } from 'vitest';
import { bancoIntegracoes } from './banco.ts';
import { ANON_LOCAL, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003'; // C-level da Evolut
const banco = bancoIntegracoes({ base: `${URL_LOCAL}/rest/v1`, chaveAnon: ANON_LOCAL, chaveServico: SERVICE_LOCAL });
const jwtDe = async (email: string) => (await (await entrarComoLocal(email)).auth.getSession()).data.session!.access_token;

describe.skipIf(!bancoLocalNoAr)('integrações no banco local', () => {
  afterAll(async () => { await banco.retirar(EVOLUT, ALINE, 'granola').catch(() => {}); });

  it('só quem pode conectar passa na conferência: C-level sim, BDR 403, token inválido 401', async () => {
    expect(await banco.conferir(await jwtDe('aline@evolut.com.br'), EVOLUT)).toEqual({ ok: true, membroId: ALINE });
    expect(await banco.conferir(await jwtDe('lucas@evolut.com.br'), EVOLUT)).toEqual({ ok: false, status: 403 });
    expect((await banco.conferir('token-invalido', EVOLUT)).ok).toBe(false);
  });

  it('a tentativa vale uma vez só', async () => {
    const state = `estado-teste-${Date.now()}`;
    await banco.tentativaAbrir({ membroId: ALINE, workspaceId: EVOLUT, integracao: 'granola', state, verifierCifrado: 'v1:x', redirectUri: 'https://app.test/r', clientId: 'cid', issuer: 'https://emissor.test', ttlSegundos: 600 });
    const a = await banco.tentativaConsumir(state);
    expect(a).toMatchObject({ ok: true, workspaceId: EVOLUT, membroId: ALINE, integracao: 'granola', clientId: 'cid' });
    expect(await banco.tentativaConsumir(state)).toEqual({ ok: false, motivo: 'usada' });
    expect(await banco.tentativaConsumir('nunca-existiu')).toEqual({ ok: false, motivo: 'invalida' });
  });

  it('guarda, lê, marca, renova, desconecta e retira o acesso (tokens só cifrados)', async () => {
    const r = await banco.acessoSalvar({ workspaceId: EVOLUT, membroId: ALINE, integracao: 'granola', conta: 'Acme', portal: 'p-1', accessCifrado: 'v1:acc', refreshCifrado: 'v1:ref', expiraEm: new Date(Date.now() + 3600_000).toISOString(), clientId: 'cid', issuer: 'https://emissor.test', escopo: null });
    expect(r).toEqual({ ok: true });
    const lido = await banco.acessoLer(EVOLUT, ALINE, 'granola');
    expect(lido).toMatchObject({ estado: 'conectado', conta: 'Acme', accessCifrado: 'v1:acc', refreshCifrado: 'v1:ref', clientId: 'cid' });
    expect((await banco.acessoSalvar({ workspaceId: EVOLUT, membroId: ALINE, integracao: 'granola', conta: 'Outra', portal: 'p-2', accessCifrado: 'v1:x', refreshCifrado: null, expiraEm: null, clientId: 'cid', issuer: 'https://emissor.test', escopo: null }))).toEqual({ ok: false, motivo: 'portal_diferente' });
    await banco.acessoMarcar(EVOLUT, ALINE, 'granola', 'precisa_reconectar');
    expect((await banco.acessoLer(EVOLUT, ALINE, 'granola'))!.estado).toBe('precisa_reconectar');
    await banco.acessoRenovar({ workspaceId: EVOLUT, membroId: ALINE, integracao: 'granola', accessCifrado: 'v1:acc2', refreshCifrado: 'v1:ref2', expiraEm: null });
    expect(await banco.acessoLer(EVOLUT, ALINE, 'granola')).toMatchObject({ estado: 'conectado', accessCifrado: 'v1:acc2', refreshCifrado: 'v1:ref2' });
    await banco.desconectar(EVOLUT, ALINE, 'granola');
    expect(await banco.acessoLer(EVOLUT, ALINE, 'granola')).toBeNull();
    await banco.retirar(EVOLUT, ALINE, 'granola');
  });

  it('o cliente OAuth do registro automático: o primeiro a chegar vale', async () => {
    const issuer = `https://emissor-${Date.now()}.test`;
    const a = await banco.clienteSalvar('granola', issuer, 'https://app.test/r', 'cliente-A', 'v1:seg');
    const b = await banco.clienteSalvar('granola', issuer, 'https://app.test/r', 'cliente-B', null);
    expect(a.clientId).toBe('cliente-A');
    expect(b).toEqual({ clientId: 'cliente-A', segredoCifrado: 'v1:seg' });
    expect(await banco.clienteLer('granola', issuer, 'https://app.test/r')).toEqual({ clientId: 'cliente-A', segredoCifrado: 'v1:seg' });
    expect(await banco.clienteLer('granola', 'https://outro.test', 'https://app.test/r')).toBeNull();
  });

  it('BDR não retira a integração (o banco recusa)', async () => {
    await expect(banco.retirar(EVOLUT, 'd0000000-0000-0000-0000-000000000004', 'granola')).rejects.toThrow();
  });
});
