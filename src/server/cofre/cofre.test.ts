import { describe, expect, it } from 'vitest';
import { chaveMestra, cifrar } from './cifra.ts';
import { cofreViaApi } from './cofre.ts';
import { configDoCofre, segredoDoWebhook } from './consumidores.ts';

const K = chaveMestra({ COFRE_CHAVE_MESTRA: 'cd'.repeat(32) });

/** Banco de mentira: guarda o que o código pede e devolve o que foi "cifrado". */
function bancoFalso(itens: Record<string, Array<{ id: string; rotulo: string; segredo: string; config?: object }>>) {
  const chamadas: string[] = [];
  let derrubado = false;
  const buscar = (async (url: string, init: RequestInit) => {
    const rpc = String(url).split('/rpc/')[1];
    chamadas.push(rpc);
    if (derrubado) return new Response('{}', { status: 500 });
    const corpo = JSON.parse(String(init.body));
    if (rpc === 'cofre_ler') {
      return Response.json((itens[corpo.p_provedor] ?? []).map(i => ({ id: i.id, rotulo: i.rotulo, cifrado: cifrar(i.segredo, K), config: i.config ?? {} })));
    }
    if (rpc === 'cofre_marcar_uso') { chamadas.push(JSON.stringify(corpo)); return Response.json(null); }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  return { buscar, chamadas, derrubar: () => { derrubado = true; } };
}

describe('leitor do cofre', () => {
  it('decifra as chaves ativas', async () => {
    const b = bancoFalso({ apify: [{ id: '1', rotulo: 'A', segredo: 'tok-a' }, { id: '2', rotulo: 'B', segredo: 'tok-b' }] });
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar });
    expect((await c.ler('apify')).map(x => x.segredo)).toEqual(['tok-a', 'tok-b']);
  });
  it('guarda em memória por 30s (não bate no banco a cada pedido)', async () => {
    const b = bancoFalso({ apify: [{ id: '1', rotulo: 'A', segredo: 'tok-a' }] });
    let agora = 1000;
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar, agora: () => agora });
    await c.ler('apify'); await c.ler('apify');
    expect(b.chamadas.filter(x => x === 'cofre_ler')).toHaveLength(1);
    agora += 31_000;
    await c.ler('apify');
    expect(b.chamadas.filter(x => x === 'cofre_ler')).toHaveLength(2);
  });
  it('invalidar força reler (tela acabou de trocar a chave)', async () => {
    const b = bancoFalso({ apify: [{ id: '1', rotulo: 'A', segredo: 'tok-a' }] });
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar });
    await c.ler('apify'); c.invalidar(); await c.ler('apify');
    expect(b.chamadas.filter(x => x === 'cofre_ler')).toHaveLength(2);
  });
  it('banco fora: usa o que já tinha; sem nada guardado, erro claro (nunca inventa chave)', async () => {
    const b = bancoFalso({ apify: [{ id: '1', rotulo: 'A', segredo: 'tok-a' }] });
    let agora = 0;
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar, agora: () => agora });
    await c.ler('apify');
    b.derrubar(); agora += 60_000;
    expect((await c.ler('apify')).map(x => x.segredo)).toEqual(['tok-a']);
    await expect(c.ler('modelo_ia')).rejects.toThrow(/cofre/);
  });
  it('chave que não decifra (chave mestra trocada) é pulada, sem derrubar as outras', async () => {
    const b = bancoFalso({ apify: [{ id: '1', rotulo: 'A', segredo: 'tok-a' }] });
    const outra = chaveMestra({ COFRE_CHAVE_MESTRA: 'ef'.repeat(32) });
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: outra, buscar: b.buscar });
    expect(await c.ler('apify')).toEqual([]);
  });
});

describe('consumidores do cofre', () => {
  it('Unipile: cofre vale mais que o .env; sem cofre, o .env segue valendo', async () => {
    const b = bancoFalso({ unipile: [{ id: '1', rotulo: 'P', segredo: 'chave-do-cofre', config: { url: 'https://api9.unipile.com/' } }] });
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar });
    const cfg = await configDoCofre(c, { UNIPILE_API_KEY: 'chave-do-env', UNIPILE_API_URL: 'https://velha.exemplo' })();
    expect(cfg).toEqual({ apiKey: 'chave-do-cofre', url: 'https://api9.unipile.com' });
    const vazio = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: bancoFalso({}).buscar });
    expect(await configDoCofre(vazio, { UNIPILE_API_KEY: 'chave-do-env' })()).toEqual({ apiKey: 'chave-do-env', url: 'https://api.unipile.com' });
  });
  it('Unipile: cofre fora do ar cai no .env, sem derrubar o envio', async () => {
    const b = bancoFalso({});
    b.derrubar();
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar });
    expect((await configDoCofre(c, { UNIPILE_API_KEY: 'chave-do-env' })()).apiKey).toBe('chave-do-env');
  });
  it('Webhook: segredo do cofre, senão do .env, senão vazio (recusa tudo)', async () => {
    const b = bancoFalso({ unipile_webhook: [{ id: '1', rotulo: 'W', segredo: 'seg-cofre' }] });
    const c = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: b.buscar });
    expect(await segredoDoWebhook(c, { UNIPILE_WEBHOOK_SECRET: 'seg-env' })()).toBe('seg-cofre');
    const vazio = cofreViaApi({ base: 'http://banco', chaveServico: 's', chave: K, buscar: bancoFalso({}).buscar });
    expect(await segredoDoWebhook(vazio, { UNIPILE_WEBHOOK_SECRET: 'seg-env' })()).toBe('seg-env');
    expect(await segredoDoWebhook(vazio, {})()).toBe('');
  });
});
