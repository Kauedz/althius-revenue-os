import { describe, expect, it } from 'vitest';
import { alternarChave, guardarChave, removerChave, testarChave } from './cofre';

const cliente = (opcoes: { token?: string | null; rpc?: (f: string, a: unknown) => { error: { code?: string } | null } } = {}) => ({
  auth: { getSession: async () => ({ data: { session: opcoes.token === null ? null : { access_token: opcoes.token ?? 'jwt-1' } } }) },
  rpc: async (f: string, a: unknown) => (opcoes.rpc ?? (() => ({ error: null })))(f, a)
}) as any;

describe('serviço do cofre (tela do superadmin)', () => {
  it('guardar: manda a chave ao backend com o login, e só para lá', async () => {
    let visto: { url: string; auth: string; corpo: any } | null = null;
    const buscar = (async (url: string, init: RequestInit) => {
      visto = { url, auth: (init.headers as Record<string, string>).Authorization, corpo: JSON.parse(String(init.body)) };
      return Response.json({ ok: true, id: 'x' });
    }) as unknown as typeof fetch;
    const r = await guardarChave(cliente(), { provedor: 'apify', rotulo: 'Conta 1', segredo: 'abcdefgh1234' }, buscar);
    expect(r).toEqual({ ok: true });
    expect(visto!.url).toBe('/cofre/guardar');
    expect(visto!.auth).toBe('Bearer jwt-1');
    expect(visto!.corpo).toEqual({ provedor: 'apify', rotulo: 'Conta 1', segredo: 'abcdefgh1234', config: {} });
  });
  it('guardar: mensagens em português para cada falha', async () => {
    const com = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch;
    const pedido = { provedor: 'apify' as const, rotulo: 'x', segredo: 'abcdefgh1234' };
    expect((await guardarChave(cliente({ token: null }), pedido, com(200))).ok).toBe(false);
    expect(await guardarChave(cliente(), pedido, com(403))).toEqual({ ok: false, mensagem: 'Só o superadmin da Althius cadastra chaves.' });
    expect((await guardarChave(cliente(), pedido, com(401)) as any).mensagem).toMatch(/sessão/);
    expect((await guardarChave(cliente(), pedido, com(503)) as any).mensagem).toMatch(/cofre/i);
    expect((await guardarChave(cliente(), pedido, com(400)) as any).mensagem).toMatch(/confira/i);
    expect((await guardarChave(cliente(), pedido, com(502)) as any).mensagem).toMatch(/tente de novo/i);
    const cai = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    expect((await guardarChave(cliente(), pedido, cai) as any).mensagem).toMatch(/tente de novo/i);
  });
  it('testar: devolve o veredito do fornecedor', async () => {
    const buscar = (async () => Response.json({ ok: false, mensagem: 'Chave recusada pelo fornecedor.' })) as unknown as typeof fetch;
    expect(await testarChave(cliente(), 'id1', buscar)).toEqual({ ok: false, mensagem: 'Chave recusada pelo fornecedor.' });
    const bom = (async () => Response.json({ ok: true })) as unknown as typeof fetch;
    expect(await testarChave(cliente(), 'id1', bom)).toEqual({ ok: true, mensagem: 'A chave funciona.' });
  });
  it('ativar/desativar e remover chamam o banco com o id', async () => {
    const vistos: Array<[string, unknown]> = [];
    const c = cliente({ rpc: (f, a) => { vistos.push([f, a]); return { error: null }; } });
    expect(await alternarChave(c, 'id1', false)).toEqual({ ok: true });
    expect(await removerChave(c, 'id1')).toEqual({ ok: true });
    expect(vistos).toEqual([['cofre_alternar', { p_id: 'id1', p_ativo: false }], ['cofre_remover', { p_id: 'id1' }]]);
  });
  it('banco recusa quem não é superadmin com mensagem clara', async () => {
    const c = cliente({ rpc: () => ({ error: { code: '42501' } }) });
    expect(await removerChave(c, 'id1')).toEqual({ ok: false, mensagem: 'Só o superadmin da Althius faz isso.' });
  });
});
