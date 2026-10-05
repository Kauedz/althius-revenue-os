// Integração: conexão de conta de ponta a ponta com o banco local de verdade. A Unipile é falsa; o login é o do seed.
// Seed: Lucas (BDR, lucas@evolut.com.br, membro d..04) tem linkedin conectado (ca5..02); Bruna (BDR) é d..06.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { adminLocal, ANON_LOCAL, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';
import { bancoViaApi } from './banco';
import { criarServidor } from './servidor';

const WS = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const BRUNA = 'd0000000-0000-0000-0000-000000000006';
const SEGREDO = 'segredo-integracao';
const DSN = 'https://api-falsa.exemplo.test:1111';

describe.skipIf(!bancoLocalNoAr)('conexão de conta com o banco local', () => {
  let url: string;
  let fechar: () => Promise<void>;
  let ocioso: () => Promise<void>;
  let pedidosAoProvedor: any[];
  let jwtLucas: string;

  const limpar = async () => {
    const adm = adminLocal();
    await adm.from('messaging_accounts').delete().eq('unipile_account_id', 'ig-lucas-int');
    await adm.from('messaging_connect_requests').delete().eq('member_id', LUCAS);
    await adm.from('messaging_connect_requests').delete().eq('member_id', BRUNA);
    await adm.from('messaging_accounts').update({ status: 'connected' }).eq('id', 'ca500000-0000-0000-0000-000000000002');
  };

  beforeEach(async () => {
    await limpar();
    pedidosAoProvedor = [];
    // Só o endereço do provedor é falso; o banco local é real.
    const buscar = (async (alvo: string, init?: RequestInit) => {
      if (alvo.startsWith(DSN)) {
        pedidosAoProvedor.push(JSON.parse(init!.body as string));
        return { ok: true, status: 200, json: async () => ({ url: 'https://conectar.exemplo.test/abc' }) } as Response;
      }
      return fetch(alvo, init);
    }) as typeof fetch;
    const base = `${URL_LOCAL}/rest/v1`;
    const { servidor, ocioso: o } = criarServidor({
      segredo: SEGREDO, banco: bancoViaApi(base, SERVICE_LOCAL), log: () => {}, esperaMs: 1,
      conexoes: { segredo: SEGREDO, siteUrl: 'https://app.exemplo.com.br', unipile: { dsn: DSN, apiKey: 'chave-falsa' }, baseBanco: base, chaveAnon: ANON_LOCAL, buscar }
    });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    ocioso = o;
    fechar = () => new Promise<void>(r => servidor.close(() => r()));
    const sessao = (await (await entrarComoLocal('lucas@evolut.com.br')).auth.getSession()).data.session!;
    jwtLucas = sessao.access_token;
  });
  afterEach(async () => { await fechar(); await limpar(); });

  const pedirLink = (corpo: unknown, jwt = jwtLucas) =>
    fetch(url + '/conexoes/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify(corpo) });
  const avisar = (notifyUrl: string, corpo: unknown) => {
    const u = new URL(notifyUrl);
    return fetch(url + u.pathname + u.search, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  };

  it('BDR conecta a própria conta: link gerado, aviso conclui, conta fica no membro dele', async () => {
    const r = await pedirLink({ workspace_id: WS, member_id: LUCAS, provider: 'instagram' });
    expect(r.status).toBe(200);
    expect((await r.json()).url).toBe('https://conectar.exemplo.test/abc');
    expect(pedidosAoProvedor[0]).toMatchObject({ type: 'create', providers: ['INSTAGRAM'] });

    const ok = await avisar(pedidosAoProvedor[0].notify_url, { status: 'CREATION_SUCCESS', account_id: 'ig-lucas-int', name: pedidosAoProvedor[0].name });
    expect(ok.status).toBe(200);
    await ocioso();
    const { data } = await adminLocal().from('messaging_accounts').select('member_id, workspace_id, provider, status').eq('unipile_account_id', 'ig-lucas-int').single();
    expect(data).toEqual({ member_id: LUCAS, workspace_id: WS, provider: 'instagram', status: 'connected' });

    // O mesmo aviso de novo não duplica
    await avisar(pedidosAoProvedor[0].notify_url, { status: 'CREATION_SUCCESS', account_id: 'ig-lucas-int', name: pedidosAoProvedor[0].name });
    await ocioso();
    const { count } = await adminLocal().from('messaging_accounts').select('id', { count: 'exact', head: true }).eq('unipile_account_id', 'ig-lucas-int');
    expect(count).toBe(1);
  });

  it('BDR não conecta em nome de outra pessoa: 403 e o provedor nem é chamado', async () => {
    const r = await pedirLink({ workspace_id: WS, member_id: BRUNA, provider: 'instagram' });
    expect(r.status).toBe(403);
    expect(pedidosAoProvedor).toHaveLength(0);
  });

  it('login inválido: 401 e o provedor nem é chamado', async () => {
    const r = await pedirLink({ workspace_id: WS, member_id: LUCAS, provider: 'instagram' }, 'jwt-falso');
    expect(r.status).toBe(401);
    expect(pedidosAoProvedor).toHaveLength(0);
  });

  it('reconectar mantém o mesmo registro', async () => {
    await adminLocal().from('messaging_accounts').update({ status: 'attention' }).eq('id', 'ca500000-0000-0000-0000-000000000002');
    const r = await pedirLink({ workspace_id: WS, member_id: LUCAS, provider: 'linkedin' });
    expect(r.status).toBe(200);
    expect(pedidosAoProvedor[0]).toMatchObject({ type: 'reconnect', providers: ['LINKEDIN'], reconnect_account: 'demo-lucas-linkedin' });
    await avisar(pedidosAoProvedor[0].notify_url, { status: 'RECONNECTED', account_id: 'demo-lucas-linkedin', name: pedidosAoProvedor[0].name });
    await ocioso();
    const { data } = await adminLocal().from('messaging_accounts').select('id, status').eq('member_id', LUCAS).eq('provider', 'linkedin');
    expect(data).toEqual([{ id: 'ca500000-0000-0000-0000-000000000002', status: 'connected' }]);
  });

  it('aviso com assinatura errada não conecta nada', async () => {
    await pedirLink({ workspace_id: WS, member_id: LUCAS, provider: 'instagram' });
    const u = new URL(pedidosAoProvedor[0].notify_url);
    const r = await fetch(`${url}${u.pathname}?r=${u.searchParams.get('r')}&t=falsa`, { method: 'POST', body: JSON.stringify({ status: 'CREATION_SUCCESS', account_id: 'ig-lucas-int', name: pedidosAoProvedor[0].name }) });
    expect(r.status).toBe(401);
    await ocioso();
    const { count } = await adminLocal().from('messaging_accounts').select('id', { count: 'exact', head: true }).eq('unipile_account_id', 'ig-lucas-int');
    expect(count).toBe(0);
  });
});
