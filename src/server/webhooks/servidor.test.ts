// Testes do servidor HTTP do webhook: porta real em 127.0.0.1, banco falso. Nenhuma API externa.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { criarServidor } from './servidor';
import { assinarCorpo, type Banco } from './unipile';

const SEGREDO = 'segredo-de-teste-123';
const evento = (type: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id: 'ev1', type, account_id: 'acc1', ...extra, payload });
const msg = evento('message.new', { id: 'm1', chat_id: 'c1', text: 'Texto secreto do contato', is_sender: false, sender_id: '5511900000001@s.whatsapp.net' }, { account_provider: 'whatsapp' });
/** cabeçalho de assinatura como a Unipile manda: t=<segundos>,v0=<hex do HMAC de "<t>.<corpo>"> */
const assinado = (corpo: string, segredo = SEGREDO, t = String(Math.floor(Date.now() / 1000))) => ({ 'Unipile-Signature': `t=${t},v0=${assinarCorpo(corpo, t, segredo)}` });

let abertos: Array<() => Promise<void>> = [];
afterEach(async () => { for (const f of abertos) await f(); abertos = []; });

async function subir(banco: Partial<Banco> = {}, extra: { limiteBytes?: number; tentativas?: number } = {}) {
  const logs: Array<Record<string, unknown>> = [];
  const completo: Banco = {
    ingerirMensagem: async () => ({ action: 'persisted' }),
    definirStatus: async () => ({ action: 'updated' }),
    novaRelacao: async () => ({ action: 'connected' }),
    concluirConexao: async () => ({ action: 'connected' }),
    ...banco
  };
  const { servidor, ocioso } = criarServidor({ segredo: SEGREDO, banco: completo, log: l => logs.push(l), esperaMs: 1, ...extra });
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const enviar = (corpo: unknown, cabecalhos?: Record<string, string>, caminho = '/webhooks/unipile') => {
    const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    return fetch(url + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cabecalhos ?? assinado(texto)) }, body: texto });
  };
  return { url, enviar, ocioso, logs };
}

describe('servidor do webhook da Unipile', () => {
  it('assinatura errada, ausente, de aviso antigo ou de corpo alterado: 401 e nada vai ao banco', async () => {
    let chamou = 0;
    const s = await subir({ ingerirMensagem: async () => { chamou++; return { action: 'persisted' }; } });
    const texto = JSON.stringify(msg);
    expect((await s.enviar(msg, assinado(texto, 'segredo-errado'))).status).toBe(401);
    expect((await s.enviar(msg, {})).status).toBe(401);
    expect((await s.enviar(msg, assinado(texto, SEGREDO, String(Math.floor(Date.now() / 1000) - 3600)))).status).toBe(401);
    expect((await s.enviar(JSON.stringify({ ...msg, id: 'outro' }), assinado(texto))).status).toBe(401);
    await s.ocioso();
    expect(chamou).toBe(0);
  });

  it('mensagem válida: 200 na hora, mesmo com o banco lento, e grava depois', async () => {
    let liberar!: () => void;
    const trava = new Promise<void>(r => (liberar = r));
    const gravadas: string[] = [];
    const s = await subir({ ingerirMensagem: async p => { await trava; gravadas.push(p.mensagemId); return { action: 'persisted' }; } });
    const r = await s.enviar(msg);
    expect(r.status).toBe(200);
    expect(gravadas).toEqual([]); // respondeu antes de o banco terminar
    liberar();
    await s.ocioso();
    expect(gravadas).toEqual(['acc1:m1']);
  });

  it('mesma mensagem duas vezes: o banco recebe as duas e decide (idempotência é do banco)', async () => {
    const ids: string[] = [];
    const s = await subir({ ingerirMensagem: async p => { ids.push(p.mensagemId); return ids.length === 1 ? { action: 'persisted' } : { action: 'persisted', idempotent_replay: true }; } });
    await s.enviar(msg); await s.enviar(msg); await s.ocioso();
    expect(ids).toEqual(['acc1:m1', 'acc1:m1']);
  });

  it('grupo e mensagem própria não chegam ao banco', async () => {
    let chamou = 0;
    const s = await subir({ ingerirMensagem: async () => { chamou++; return { action: 'persisted' }; } });
    await s.enviar({ ...msg, payload: { ...msg.payload, is_group: true } }); await s.enviar({ ...msg, payload: { ...msg.payload, is_sender: true } }); await s.ocioso();
    expect(chamou).toBe(0);
  });

  it('evento de status e de relação chegam às funções certas', async () => {
    const vistos: string[] = [];
    const s = await subir({ definirStatus: async (c, st) => { vistos.push(`status:${c}:${st}`); return { action: 'updated' }; }, novaRelacao: async (c, i) => { vistos.push(`relacao:${c}:${i}`); return { action: 'connected' }; } });
    await s.enviar(evento('account.status.disconnected', {}));
    await s.enviar(evento('relation.new', { public_identifier: 'fulano' }, { account_id: 'acc2' }));
    await s.ocioso();
    expect(vistos).toEqual(['status:acc1:attention', 'relacao:acc2:fulano']);
  });

  it('banco fora do ar: responde 200, tenta de novo e na terceira desiste com erro no log', async () => {
    let tentativas = 0;
    const s = await subir({ ingerirMensagem: async () => { tentativas++; throw new Error('banco fora'); } });
    expect((await s.enviar(msg)).status).toBe(200);
    await s.ocioso();
    expect(tentativas).toBe(3);
    expect(s.logs.filter(l => l.nivel === 'erro')).toHaveLength(1);
  });

  it('falha passageira: a segunda tentativa grava', async () => {
    let n = 0;
    const s = await subir({ ingerirMensagem: async () => { if (++n === 1) throw new Error('piscou'); return { action: 'persisted' }; } });
    await s.enviar(msg); await s.ocioso();
    expect(n).toBe(2);
    expect(s.logs.some(l => l.nivel === 'erro')).toBe(false);
  });

  it('log nunca contém texto nem remetente (privacidade só-CRM)', async () => {
    const s = await subir({ ingerirMensagem: async () => { throw new Error('banco recusou unipile_ingest_message: HTTP 500'); } });
    await s.enviar(msg); await s.ocioso();
    const tudo = JSON.stringify(s.logs);
    expect(tudo).not.toContain('Texto secreto');
    expect(tudo).not.toContain('5511900000001');
  });

  it('JSON inválido: 400. Corpo grande demais: 413. Rota e método errados: 404 e 405', async () => {
    const s = await subir({}, { limiteBytes: 200 });
    expect((await s.enviar('{nao e json')).status).toBe(400); // assinado certo, mas não é JSON
    expect((await s.enviar({ lixo: 'x'.repeat(500) })).status).toBe(413);
    expect((await s.enviar(msg, undefined, '/outra')).status).toBe(404);
    expect((await fetch(s.url + '/webhooks/unipile')).status).toBe(405);
  });

  it('/saude responde sem segredo', async () => {
    const s = await subir();
    const r = await fetch(s.url + '/saude');
    expect(r.status).toBe(200);
  });
});

describe('servidor: cofre de chaves (ADR 0049)', () => {
  async function subirComCofre(segredo: string | (() => Promise<string>) = SEGREDO, cofre?: Parameters<typeof criarServidor>[0]['cofre']) {
    const { servidor } = criarServidor({ segredo, banco: { ingerirMensagem: async () => ({ action: 'persisted' }), definirStatus: async () => ({}), novaRelacao: async () => ({}), concluirConexao: async () => ({}) } as unknown as Banco, log: () => {}, cofre });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
    return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  }
  const post = (url: string, caminho: string, corpo: unknown, auth?: string) => fetch(url + caminho, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(corpo)
  });

  it('sem login: 401 (nem lê o corpo); com login mas sem cofre ligado: 503', async () => {
    const url = await subirComCofre();
    expect((await post(url, '/cofre/guardar', {})).status).toBe(401);
    expect((await post(url, '/cofre/testar', {}, 'jwt')).status).toBe(503);
  });

  it('com cofre ligado, a rota repassa o login ao banco (quem confere é o banco)', async () => {
    let visto = '';
    const buscar = (async (u: string, init: RequestInit) => {
      visto = `${u}|${(init.headers as Record<string, string>).Authorization}`;
      return new Response('{}', { status: 403 });
    }) as unknown as typeof fetch;
    const url = await subirComCofre(SEGREDO, { baseBanco: 'http://banco', chaveAnon: 'anon', chaveServico: 's', chave: Buffer.alloc(32, 1), buscar,
      cofre: { ler: async () => [], marcarUso: async () => {}, invalidar: () => {} } });
    const r = await post(url, '/cofre/guardar', { provedor: 'apify', rotulo: 'x', segredo: 'abcdefgh1234' }, 'meu-jwt');
    expect(r.status).toBe(403);
    expect(visto).toBe('http://banco/rpc/cofre_conferir_superadmin|Bearer meu-jwt');
  });

  it('GET na rota do cofre: 405', async () => {
    const url = await subirComCofre();
    expect((await fetch(url + '/cofre/guardar')).status).toBe(405);
  });

  it('segredo do webhook vindo do cofre é relido a cada aviso (trocar na tela vale na hora)', async () => {
    let atual = 'primeiro-segredo';
    const url = await subirComCofre(async () => atual);
    const corpo = JSON.stringify(msg);
    const com = (seg: string) => fetch(url + '/webhooks/unipile', { method: 'POST', headers: { 'Content-Type': 'application/json', ...assinado(corpo, seg) }, body: corpo });
    expect((await com('primeiro-segredo')).status).toBe(200);
    expect((await com('segundo-segredo')).status).toBe(401);
    atual = 'segundo-segredo';
    expect((await com('segundo-segredo')).status).toBe(200);
    expect((await com('primeiro-segredo')).status).toBe(401);
  });

  it('segredo vazio (nem cofre nem .env): recusa tudo', async () => {
    const url = await subirComCofre(async () => '');
    const corpo = JSON.stringify(msg);
    const r = await fetch(url + '/webhooks/unipile', { method: 'POST', headers: { 'Content-Type': 'application/json', ...assinado(corpo, 'qualquer') }, body: corpo });
    expect(r.status).toBe(401);
  });
});

describe('servidor: integrações do catálogo (ADR 0056)', () => {
  type Rotas = NonNullable<Parameters<typeof criarServidor>[0]['integracoes']>;
  async function subirComIntegracoes(integracoes?: Rotas) {
    const { servidor } = criarServidor({ segredo: SEGREDO, banco: { ingerirMensagem: async () => ({ action: 'persisted' }), definirStatus: async () => ({}), novaRelacao: async () => ({}), concluirConexao: async () => ({}) } as unknown as Banco, log: () => {}, integracoes });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
    return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  }
  const post = (url: string, caminho: string, corpo: unknown, auth?: string) => fetch(url + caminho, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(corpo)
  });
  const vistos: Array<[string, string, unknown]> = [];
  const rotas = (): Rotas => ({
    iniciar: async (jwt, corpo) => { vistos.push(['iniciar', jwt, corpo]); return { status: 200, corpo: { url: 'https://app.test/consentir' } }; },
    ferramentas: async (jwt, corpo) => { vistos.push(['ferramentas', jwt, corpo]); return { status: 200, corpo: { ferramentas: [] } }; },
    desconectar: async (jwt, corpo) => { vistos.push(['desconectar', jwt, corpo]); return { status: 200, corpo: { ok: true } }; },
    retirar: async (jwt, corpo) => { vistos.push(['retirar', jwt, corpo]); return { status: 200, corpo: { ok: true } }; },
    agenteFerramentas: async (token, corpo) => { vistos.push(['agenteFerramentas', token, corpo]); return { status: 200, corpo: { fonte: 'HubSpot', ferramentas: [] } }; },
    agentePropor: async (token, corpo) => { vistos.push(['agentePropor', token, corpo]); return { status: 200, corpo: { ok: true, status: 'aguardando_aprovacao' } }; },
    agenteChamar: async (token, corpo) => { vistos.push(['agenteChamar', token, corpo]); return { status: 200, corpo: { ok: true, fonte: 'HubSpot', resultado: '[]', cortado: false } }; },
    retorno: async query => { vistos.push(['retorno', '', query]); return { status: 302, destino: 'https://site.test/?conexao=ok&integracao=notion#/integrations' }; }
  });

  it('sem login: 401 antes de ler o corpo; com login mas sem as integrações ligadas: 503', async () => {
    const url = await subirComIntegracoes();
    expect((await post(url, '/integracoes/iniciar', {})).status).toBe(401);
    expect((await post(url, '/integracoes/iniciar', {}, 'jwt')).status).toBe(503);
  });

  it('cada rota repassa o login (JWT) e o corpo à função certa', async () => {
    vistos.length = 0;
    const url = await subirComIntegracoes(rotas());
    for (const nome of ['iniciar', 'ferramentas', 'desconectar', 'retirar']) {
      const r = await post(url, `/integracoes/${nome}`, { workspaceId: 'w', integracao: 'notion' }, 'meu-jwt');
      expect(r.status).toBe(200);
    }
    expect(vistos.map(v => v[0])).toEqual(['iniciar', 'ferramentas', 'desconectar', 'retirar']);
    expect(vistos.every(v => v[1] === 'meu-jwt')).toBe(true);
    expect(vistos[0][2]).toEqual({ workspaceId: 'w', integracao: 'notion' });
  });

  it('rotas do agente: o token do agente (não o login) vai à função certa; sem token 401; sem as integrações 503', async () => {
    vistos.length = 0;
    const url = await subirComIntegracoes(rotas());
    expect((await post(url, '/integracoes/agente/ferramentas', {})).status).toBe(401);
    expect((await post(url, '/integracoes/agente/ferramentas', { integracao: 'hubspot' }, 'alt_agente_zoe')).status).toBe(200);
    expect((await post(url, '/integracoes/agente/chamar', { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} }, 'alt_agente_zoe')).status).toBe(200);
    expect((await post(url, '/integracoes/agente/propor', { integracao: 'hubspot', ferramenta: 'manage_crm_objects', argumentos: {}, motivo: 'x' }, 'alt_agente_zoe')).status).toBe(200);
    expect(vistos.map(v => v[0])).toEqual(['agenteFerramentas', 'agenteChamar', 'agentePropor']);
    expect(vistos.every(v => v[1] === 'alt_agente_zoe')).toBe(true);
    expect(vistos[1][2]).toEqual({ integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} });
    const sem = await subirComIntegracoes();
    expect((await post(sem, '/integracoes/agente/chamar', {}, 'alt_agente_zoe')).status).toBe(503);
    expect((await post(url, '/integracoes/agente/inventada', {}, 'alt_agente_zoe')).status).toBe(404);
    expect((await fetch(url + '/integracoes/agente/chamar')).status).toBe(405);
  });

  it('o retorno do consentimento é um GET sem login: redireciona (302) para onde a função mandar, sem seguir o redirecionamento', async () => {
    vistos.length = 0;
    const url = await subirComIntegracoes(rotas());
    const r = await fetch(url + '/integracoes/retorno?code=abc&state=xyz', { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://site.test/?conexao=ok&integracao=notion#/integrations');
    expect(vistos[0]).toEqual(['retorno', '', { code: 'abc', state: 'xyz', error: undefined }]);
  });

  it('retorno com o app avisando erro (recusa) passa o error adiante', async () => {
    vistos.length = 0;
    const url = await subirComIntegracoes(rotas());
    await fetch(url + '/integracoes/retorno?error=access_denied&state=xyz', { redirect: 'manual' });
    expect(vistos[0][2]).toEqual({ code: undefined, state: 'xyz', error: 'access_denied' });
  });

  it('retorno sem as integrações ligadas: 503; método errado: 405; rota inventada: 404', async () => {
    const sem = await subirComIntegracoes();
    expect((await fetch(sem + '/integracoes/retorno?state=x', { redirect: 'manual' })).status).toBe(503);
    const url = await subirComIntegracoes(rotas());
    expect((await fetch(url + '/integracoes/iniciar')).status).toBe(405);
    expect((await post(url, '/integracoes/retorno', {}, 'jwt')).status).toBe(405);
    expect((await post(url, '/integracoes/inventada', {}, 'jwt')).status).toBe(404);
  });

  it('falha inesperada na função vira 502 sem vazar detalhe', async () => {
    const r = rotas();
    r.iniciar = async () => { throw new Error('segredo-que-nao-pode-vazar'); };
    const url = await subirComIntegracoes(r);
    const resp = await post(url, '/integracoes/iniciar', {}, 'jwt');
    expect(resp.status).toBe(502);
    expect(await resp.text()).not.toContain('segredo-que-nao-pode-vazar');
  });
});
