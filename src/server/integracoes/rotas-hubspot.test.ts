// @vitest-environment node
// HubSpot (ticket 04 das conexões): app registrado pela Althius, guardado no cofre (ID do cliente + segredo cifrado), sem
// registro automático. Servidor MCP e API do HubSpot são FALSOS; nenhum teste chama a rede. Endereços de autorização e token
// são os que o servidor real publica (lidos em 06/10/2026).
import { describe, expect, it } from 'vitest';
import { chaveMestra, decifrar } from '../cofre/cifra.ts';
import type { Cofre } from '../cofre/cofre.ts';
import { desconectar, ferramentas, iniciarConexao, retornoDoConsentimento, type DepsIntegracoes } from './rotas.ts';
import { bancoFalso } from './mundo-falso.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';

const CHAVE = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 9).toString('base64') });
const WS = 'ws-1';
const SITE = 'https://app.althius.test';
const MCP = 'https://mcp.hubspot.com';
const CID = '1b69203f-e24e-4bce-990e-c9471504ed73';
const SEGREDO = 'segredo-do-app-hubspot-123456';

function cofreCom(entradas: Array<{ rotulo: string; segredo: string; config: Record<string, unknown> }>): Cofre {
  return { ler: async p => (p === 'integracao_app' ? entradas.map((e, i) => ({ id: `c${i}`, ...e })) : []), marcarUso: async () => {}, invalidar: () => {} };
}

/** HubSpot falso: servidor MCP (com login), metadado OAuth sem registro automático, endpoint de token e consulta ao token. */
function hubspotFalso(opcoes: { hubId?: number | null; usuario?: string; semConsultaAoToken?: boolean } = {}) {
  const mcp = servidorMcpFalso({ token: 'acc-h1' });
  const chamadas: Array<{ metodo: string; url: string; corpo: string }> = [];
  const hubId = opcoes.hubId === undefined ? 4444 : opcoes.hubId;
  const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });
  const buscar = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const req = new Request(entrada, init);
    const corpo = req.method === 'GET' ? '' : await req.clone().text();
    chamadas.push({ metodo: req.method, url: req.url, corpo });
    if (req.url === MCP || req.url === `${MCP}/`) {
      if (!req.headers.get('authorization')) return new Response('{}', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${MCP}/.well-known/oauth-protected-resource"` } });
      return mcp.fetch(req);
    }
    if (req.url === `${MCP}/.well-known/oauth-protected-resource`) return json({ resource: MCP, authorization_servers: [MCP] });
    if (req.url === `${MCP}/.well-known/oauth-authorization-server`) {
      return json({ issuer: MCP, authorization_endpoint: `${MCP}/oauth/authorize/user`, token_endpoint: `${MCP}/oauth/v3/token`, code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['client_secret_post'] });
    }
    if (req.url === `${MCP}/oauth/v3/token`) {
      const p = new URLSearchParams(corpo);
      if (p.get('grant_type') === 'authorization_code') return json({ access_token: 'acc-h1', refresh_token: 'ref-h1', expires_in: 1800, token_type: 'bearer' });
      return json({ access_token: 'acc-h2', refresh_token: 'ref-h2', expires_in: 1800 });
    }
    if (req.url === 'https://api.hubapi.com/oauth/v1/access-tokens/acc-h1') {
      if (opcoes.semConsultaAoToken || hubId === null) return json({}, 404);
      return json({ hub_id: hubId, user: opcoes.usuario ?? 'ana@norte.test' });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { buscar, chamadas, mcp };
}

function montar(o: { cofre?: Cofre | null; banco?: ReturnType<typeof bancoFalso>; mundo?: ReturnType<typeof hubspotFalso>; agora?: () => number } = {}) {
  const banco = o.banco ?? bancoFalso();
  const mundo = o.mundo ?? hubspotFalso();
  let n = 0;
  const deps: DepsIntegracoes = {
    banco: banco.banco, chave: CHAVE, siteUrl: SITE, buscar: mundo.buscar, agora: o.agora ?? (() => 1_000_000),
    cofre: o.cofre === undefined ? cofreCom([{ rotulo: 'hubspot', segredo: SEGREDO, config: { client_id: CID } }]) : (o.cofre ?? undefined),
    aleatorio: (tamanho: number) => `aleatorio-${++n}-`.padEnd(tamanho, 'x')
  };
  return { deps, banco, mundo };
}

async function conectar(m: ReturnType<typeof montar>, jwt = 'jwt-aline') {
  const r = await iniciarConexao(m.deps, jwt, { workspaceId: WS, integracao: 'hubspot' });
  const url = new URL(String((r.corpo as { url: string }).url));
  const volta = await retornoDoConsentimento(m.deps, { code: 'codigo-h', state: url.searchParams.get('state')! });
  return { r, url, volta };
}

describe('HubSpot: iniciar a conexão', () => {
  it('sem o app cadastrado no cofre: "precisa configurar" (503) e nada é pedido ao HubSpot', async () => {
    const m = montar({ cofre: cofreCom([]) });
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    expect(r.status).toBe(503);
    expect((r.corpo as { erro: string }).erro).toBe('nao_configurada');
    expect(m.mundo.chamadas).toEqual([]);
  });

  it('cofre desligado (sem chave mestra): também "precisa configurar"', async () => {
    const m = montar({ cofre: null });
    expect((await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' })).status).toBe(503);
  });

  it('com o app no cofre: devolve o consentimento no endereço que o HubSpot publica, com o ID do cliente e PKCE; sem registrar cliente', async () => {
    const m = montar();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    expect(r.status).toBe(200);
    const url = new URL(String((r.corpo as { url: string }).url));
    expect(`${url.origin}${url.pathname}`).toBe(`${MCP}/oauth/authorize/user`);
    expect(url.searchParams.get('client_id')).toBe(CID);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(`${SITE}/integracoes/retorno`);
    expect(url.toString()).not.toContain(SEGREDO);
    expect(m.mundo.chamadas.some(c => c.url.endsWith('/register'))).toBe(false);
    const t = [...m.banco.tentativas.values()][0];
    expect(t.clientId).toBe(CID);
  });

  it('só quem pode conectar (o banco decide): 403 sem consultar o HubSpot', async () => {
    const m = montar({ banco: bancoFalso({ semPermissao: ['m-camila'] }) });
    expect((await iniciarConexao(m.deps, 'jwt-camila', { workspaceId: WS, integracao: 'hubspot' })).status).toBe(403);
    expect(m.mundo.chamadas).toEqual([]);
  });
});

describe('HubSpot: retorno do consentimento', () => {
  it('troca o código mandando o ID do cliente e o segredo do cofre no corpo (client_secret_post), guarda o acesso cifrado, a conta e o portal', async () => {
    const m = montar();
    const { volta } = await conectar(m);
    expect(volta.destino).toBe(`${SITE}/?conexao=ok&integracao=hubspot#/integrations`);
    const troca = m.mundo.chamadas.find(c => c.url === `${MCP}/oauth/v3/token`)!;
    const corpo = new URLSearchParams(troca.corpo);
    expect(corpo.get('client_id')).toBe(CID);
    expect(corpo.get('client_secret')).toBe(SEGREDO);
    expect(corpo.get('code')).toBe('codigo-h');
    expect(corpo.get('code_verifier')).toBeTruthy();
    const a = m.banco.acessos.get(`${WS}|m-aline|hubspot`)!;
    expect(a.conta).toBe('ana@norte.test');
    expect(decifrar(a.accessCifrado, CHAVE)).toBe('acc-h1');
    expect(a.accessCifrado).not.toContain('acc-h1');
    expect(a.clientId).toBe(CID);
  });

  it('o segredo do app só vai ao endpoint de token do HubSpot (nunca ao MCP, à API nem ao endereço de volta)', async () => {
    const m = montar();
    const { volta } = await conectar(m);
    expect(volta.destino).not.toContain(SEGREDO);
    for (const c of m.mundo.chamadas) {
      if (c.url === `${MCP}/oauth/v3/token`) continue;
      expect(`${c.url} ${c.corpo}`, c.url).not.toContain(SEGREDO);
    }
  });

  it('o portal do primeiro acesso fica fixado; outra pessoa com conta de OUTRO portal é recusada e nada é guardado', async () => {
    const banco = bancoFalso();
    const primeiro = montar({ banco, mundo: hubspotFalso({ hubId: 4444 }) });
    expect((await conectar(primeiro, 'jwt-aline')).volta.destino).toContain('conexao=ok');
    const outro = montar({ banco, mundo: hubspotFalso({ hubId: 9999, usuario: 'bruno@outro.test' }) });
    const { volta } = await conectar(outro, 'jwt-camila');
    expect(volta.destino).toContain('motivo=portal_diferente');
    expect(banco.acessos.has(`${WS}|m-camila|hubspot`)).toBe(false);
  });

  it('mesmo portal, outra pessoa: conecta (cada pessoa tem o próprio acesso)', async () => {
    const banco = bancoFalso();
    await conectar(montar({ banco }), 'jwt-aline');
    const { volta } = await conectar(montar({ banco }), 'jwt-camila');
    expect(volta.destino).toContain('conexao=ok');
    expect(banco.acessos.size).toBe(2);
  });

  it('não consegue descobrir o portal: RECUSA (o HubSpot fixa portal) e nada é guardado', async () => {
    const m = montar({ mundo: hubspotFalso({ hubId: null }) });
    const { volta } = await conectar(m);
    expect(volta.destino).toContain('motivo=portal_nao_identificado');
    expect(m.banco.acessos.size).toBe(0);
  });

  it('o ID do cliente do cofre mudou no meio do caminho: erro (a autorização vale para o app antigo)', async () => {
    const m = montar();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    const state = new URL(String((r.corpo as { url: string }).url)).searchParams.get('state')!;
    m.deps.cofre = cofreCom([{ rotulo: 'hubspot', segredo: SEGREDO, config: { client_id: 'outro-id' } }]);
    const volta = await retornoDoConsentimento(m.deps, { code: 'c', state });
    expect(volta.destino).toContain('conexao=erro');
    expect(m.banco.acessos.size).toBe(0);
  });

  it('o app foi tirado do cofre no meio do caminho: erro, nada guardado', async () => {
    const m = montar();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    const state = new URL(String((r.corpo as { url: string }).url)).searchParams.get('state')!;
    m.deps.cofre = cofreCom([]);
    expect((await retornoDoConsentimento(m.deps, { code: 'c', state })).destino).toContain('conexao=erro');
    expect(m.banco.acessos.size).toBe(0);
  });
});

describe('HubSpot: usar o acesso', () => {
  it('lista as ferramentas do servidor com o token da pessoa', async () => {
    const m = montar();
    await conectar(m);
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    expect(r.status).toBe(200);
    expect((r.corpo as { ferramentas: unknown[] }).ferramentas).toHaveLength(2);
  });

  it('token vencido: renova mandando o segredo do cofre, e grava o par novo cifrado', async () => {
    let agora = 1_000_000;
    const mundo = hubspotFalso();
    const m = montar({ agora: () => agora, mundo });
    await conectar(m);
    agora += 2 * 3600 * 1000;
    // O servidor MCP falso passa a aceitar só o token renovado.
    const trocado = servidorMcpFalso({ token: 'acc-h2' });
    const original = m.deps.buscar!;
    m.deps.buscar = (async (e: string | URL | Request, i?: RequestInit) => { const u = new Request(e, i).url; return u === MCP || u === `${MCP}/` ? trocado.fetch(e, i) : original(e, i); }) as typeof fetch;
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' });
    expect(r.status).toBe(200);
    const renov = mundo.chamadas.filter(c => c.url === `${MCP}/oauth/v3/token` && new URLSearchParams(c.corpo).get('grant_type') === 'refresh_token');
    expect(renov).toHaveLength(1);
    expect(new URLSearchParams(renov[0].corpo).get('client_secret')).toBe(SEGREDO);
    expect(decifrar(m.banco.acessos.get(`${WS}|m-aline|hubspot`)!.accessCifrado, CHAVE)).toBe('acc-h2');
  });

  it('desconectar tira só o acesso da pessoa, sem tocar no cofre', async () => {
    const m = montar();
    await conectar(m);
    expect((await desconectar(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'hubspot' })).status).toBe(200);
    expect(m.banco.acessos.size).toBe(0);
  });
});
