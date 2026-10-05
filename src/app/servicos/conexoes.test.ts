// Serviço de conexão de contas de mensagem (front). Backend falso; nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import { desconectarConta, iniciarConexaoConta, provedorDoCanal } from './conexoes';

const clienteComSessao = (token: string | null, rpc = async () => ({ error: null as unknown })) =>
  ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) }, rpc }) as any;
const resposta = (status: number, corpo: unknown = {}) => (async () => ({ ok: status < 300, status, json: async () => corpo })) as unknown as typeof fetch;

describe('provedorDoCanal', () => {
  it('traduz canal da Caixa de entrada em provedor do banco', () => {
    expect(provedorDoCanal('whatsapp')).toBe('whatsapp');
    expect(provedorDoCanal('linkedin')).toBe('linkedin');
    expect(provedorDoCanal('instagram')).toBe('instagram');
    expect(provedorDoCanal('email', 'gmail')).toBe('google');
    expect(provedorDoCanal('email', 'outlook')).toBe('microsoft');
    expect(provedorDoCanal('email')).toBe('google');
    expect(() => provedorDoCanal('telegram')).toThrow();
  });
});

describe('iniciarConexaoConta', () => {
  it('pede o link com o login da pessoa e devolve a janela segura', async () => {
    let visto: { url: string; init: RequestInit } | undefined;
    const buscar = (async (url: string, init: RequestInit) => { visto = { url, init }; return { ok: true, status: 200, json: async () => ({ url: 'https://conectar.exemplo.test/x' }) }; }) as unknown as typeof fetch;
    const r = await iniciarConexaoConta(clienteComSessao('jwt-1'), 'ws-1', 'mb-1', 'instagram', buscar);
    expect(r).toEqual({ ok: true, url: 'https://conectar.exemplo.test/x' });
    expect(visto!.url).toBe('/conexoes/link');
    expect((visto!.init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
    expect(JSON.parse(visto!.init.body as string)).toEqual({ workspace_id: 'ws-1', member_id: 'mb-1', provider: 'instagram' });
  });
  it('sem sessão não chama o backend', async () => {
    let chamou = false;
    const r = await iniciarConexaoConta(clienteComSessao(null), 'w', 'm', 'google', (async () => { chamou = true; return {} as Response; }) as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(chamou).toBe(false);
  });
  it('mensagens claras para indisponível, sem permissão e falha', async () => {
    const msg = async (status: number) => { const r = await iniciarConexaoConta(clienteComSessao('j'), 'w', 'm', 'google', resposta(status)); return r.ok ? '' : r.mensagem; };
    expect(await msg(503)).toMatch(/ainda não está disponível/);
    expect(await msg(403)).toMatch(/suas próprias contas/);
    expect(await msg(401)).toMatch(/sessão expirou/);
    expect(await msg(502)).toMatch(/Tente de novo/);
  });
  it('rede fora do ar ou link inseguro: falha clara, nunca abre o link', async () => {
    const fora = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    expect((await iniciarConexaoConta(clienteComSessao('j'), 'w', 'm', 'google', fora)).ok).toBe(false);
    expect((await iniciarConexaoConta(clienteComSessao('j'), 'w', 'm', 'google', resposta(200, { url: 'http://inseguro' }))).ok).toBe(false);
    expect((await iniciarConexaoConta(clienteComSessao('j'), 'w', 'm', 'google', resposta(200, {}))).ok).toBe(false);
  });
  it('a mensagem de erro nunca cita o nome do provedor externo', async () => {
    for (const s of [503, 403, 401, 502]) {
      const r = await iniciarConexaoConta(clienteComSessao('j'), 'w', 'm', 'google', resposta(s));
      expect(r.ok ? '' : r.mensagem).not.toMatch(/unipile/i);
    }
  });
});

describe('desconectarConta', () => {
  it('chama a função do banco e reporta erro em linguagem simples', async () => {
    let args: unknown;
    const ok = await desconectarConta({ rpc: async (_n: string, a: unknown) => { args = a; return { error: null }; } } as any, 'w', 'm', 'whatsapp');
    expect(ok).toEqual({ ok: true });
    expect(args).toEqual({ p_workspace_id: 'w', p_member_id: 'm', p_provider: 'whatsapp' });
    const falha = await desconectarConta({ rpc: async () => ({ error: { message: 'x' } }) } as any, 'w', 'm', 'whatsapp');
    expect(falha).toEqual({ ok: false, mensagem: 'Não foi possível desconectar. Tente de novo.' });
  });
});
