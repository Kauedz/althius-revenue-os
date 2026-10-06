// @vitest-environment node
// Rotas das integrações (ticket 01 das conexões), do pedido à resposta, contra um mundo falso: banco em memória, servidor de
// autorização OAuth e servidor MCP simulados. Nenhuma chamada real. Perfil usado: Notion (registro automático).
import { describe, expect, it } from 'vitest';
import { chaveMestra, decifrar } from '../cofre/cifra.ts';
import { desconectar, ferramentas, iniciarConexao, retirar, retornoDoConsentimento, type DepsIntegracoes } from './rotas.ts';
import { PERFIS } from './perfis.ts';
import { bancoFalso } from './mundo-falso.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';

const CHAVE = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 7).toString('base64') });
const WS = 'ws-1';
const SITE = 'https://app.althius.test';
const RETORNO = `${SITE}/integracoes/retorno`;
const MCP = 'https://mcp.notion.com/mcp';
const EMISSOR = 'https://mcp.notion.com';

/** O mundo de fora: servidor MCP (com e sem login), servidor de autorização com registro automático e endpoint de token. */
function mundoFalso(opcoes: { aoTrocar?: () => Response; tokenValido?: string; semRegistro?: boolean; ferramentas?: Parameters<typeof servidorMcpFalso>[0] } = {}) {
  const tokenValido = opcoes.tokenValido ?? 'acc-1';
  const mcp = servidorMcpFalso({ token: tokenValido, ...opcoes.ferramentas });
  const chamadas: Array<{ metodo: string; url: string; corpo: string }> = [];
  let registros = 0; let trocas = 0; let renovacoes = 0;
  const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });
  const buscar = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const req = new Request(entrada, init);
    const corpo = req.method === 'GET' ? '' : await req.clone().text();
    chamadas.push({ metodo: req.method, url: req.url, corpo });
    if (req.url === MCP) {
      if (!req.headers.get('authorization')) return new Response('{}', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${EMISSOR}/.well-known/oauth-protected-resource/mcp"` } });
      return mcp.fetch(req);
    }
    if (req.url === `${EMISSOR}/.well-known/oauth-protected-resource/mcp`) return json({ resource: MCP, authorization_servers: [EMISSOR] });
    if (req.url === `${EMISSOR}/.well-known/oauth-authorization-server`) {
      return json({ issuer: EMISSOR, authorization_endpoint: `${EMISSOR}/authorize`, token_endpoint: `${EMISSOR}/token`, ...(opcoes.semRegistro ? {} : { registration_endpoint: `${EMISSOR}/register` }), code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] });
    }
    if (req.url === `${EMISSOR}/register`) { registros++; return json({ client_id: 'cid-registrado' }, 201); }
    if (req.url === `${EMISSOR}/token`) {
      const p = new URLSearchParams(corpo);
      if (p.get('grant_type') === 'authorization_code') { trocas++; return opcoes.aoTrocar ? opcoes.aoTrocar() : json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600, workspace_name: 'Acme Ltda' }); }
      renovacoes++;
      return json({ access_token: 'acc-2', refresh_token: 'ref-2', expires_in: 3600 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { buscar, chamadas, mcp, contagem: () => ({ registros, trocas, renovacoes }) };
}

function montar(o: { banco?: ReturnType<typeof bancoFalso>; mundo?: ReturnType<typeof mundoFalso>; agora?: () => number } = {}) {
  const banco = o.banco ?? bancoFalso();
  const mundo = o.mundo ?? mundoFalso();
  let n = 0;
  const deps: DepsIntegracoes = {
    banco: banco.banco, chave: CHAVE, siteUrl: SITE, buscar: mundo.buscar, agora: o.agora ?? (() => 1_000_000),
    aleatorio: (bytes: number) => `aleatorio-${++n}-`.padEnd(bytes, 'x')
  };
  return { deps, banco, mundo };
}

/** Faz a conexão inteira (iniciar + retorno) e devolve o estado usado. */
async function conectar(m: ReturnType<typeof montar>, jwt = 'jwt-aline') {
  const r = await iniciarConexao(m.deps, jwt, { workspaceId: WS, integracao: 'notion' });
  const url = new URL(String((r.corpo as { url: string }).url));
  const state = url.searchParams.get('state')!;
  const volta = await retornoDoConsentimento(m.deps, { code: 'codigo-1', state });
  return { r, url, state, volta };
}

describe('iniciar a conexão', () => {
  it('devolve o endereço de consentimento do app, com PKCE S256, state e o recurso; guarda a tentativa com o verificador cifrado', async () => {
    const m = montar();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(200);
    const url = new URL(String((r.corpo as { url: string }).url));
    expect(`${url.origin}${url.pathname}`).toBe(`${EMISSOR}/authorize`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('redirect_uri')).toBe(RETORNO);
    expect(url.searchParams.get('resource')).toBe(MCP);
    expect(url.searchParams.get('client_id')).toBe('cid-registrado');
    const t = m.banco.tentativas.get(url.searchParams.get('state')!)!;
    expect(t.membroId).toBe('m-aline');
    expect(t.verifierCifrado.startsWith('v1:')).toBe(true);
    expect(decifrar(t.verifierCifrado, CHAVE).length).toBeGreaterThanOrEqual(43);
  });

  it('registra o cliente OAuth uma vez só e reaproveita nos pedidos seguintes', async () => {
    const m = montar();
    await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    await iniciarConexao(m.deps, 'jwt-camila', { workspaceId: WS, integracao: 'notion' });
    expect(m.mundo.contagem().registros).toBe(1);
  });

  it('sem login: 401; sem permissão (ex.: BDR): 403 e nada é pedido ao app', async () => {
    const m = montar({ banco: bancoFalso({ semPermissao: ['m-camila'] }) });
    expect((await iniciarConexao(m.deps, '', { workspaceId: WS, integracao: 'notion' })).status).toBe(401);
    expect((await iniciarConexao(m.deps, 'jwt-camila', { workspaceId: WS, integracao: 'notion' })).status).toBe(403);
    expect(m.mundo.chamadas).toEqual([]);
  });

  it('integração que não existe: 404; que ainda não pode conectar: 409 com o motivo, sem chamar o app', async () => {
    const m = montar();
    expect((await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'inventada' })).status).toBe(404);
    const removido = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'salesforce' });
    expect(removido.status).toBe(404); // saiu do catálogo (ADR 0063)
    const emBreve = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'rdstation' });
    expect(emBreve.status).toBe(409);
    expect((emBreve.corpo as { erro: string }).erro).toBe('em_breve');
    expect(String((emBreve.corpo as { motivo: string }).motivo).length).toBeGreaterThan(10);
    expect(m.mundo.chamadas).toEqual([]);
  });

  it('pedido sem workspace: 400', async () => {
    const m = montar();
    expect((await iniciarConexao(m.deps, 'jwt-aline', { integracao: 'notion' })).status).toBe(400);
  });

  it('servidor que não aceita registro automático e não tem app cadastrado: 503 "precisa configurar"', async () => {
    const m = montar({ mundo: mundoFalso({ semRegistro: true }) });
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(503);
    expect((r.corpo as { erro: string }).erro).toBe('nao_configurada');
  });

  it('app fora do ar na descoberta: 502, sem derrubar o servidor', async () => {
    const m = montar();
    m.deps.buscar = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect([502, 503]).toContain(r.status);
  });
});

describe('retorno do consentimento', () => {
  it('troca o código, guarda os tokens CIFRADOS e a conta, e volta para a tela com sucesso', async () => {
    const m = montar();
    const { volta } = await conectar(m);
    expect(volta.status).toBe(302);
    expect(volta.destino).toBe(`${SITE}/?conexao=ok&integracao=notion#/integrations`);
    const a = m.banco.acessos.get(`${WS}|m-aline|notion`)!;
    expect(a.conta).toBe('Acme Ltda');
    expect(a.accessCifrado).not.toContain('acc-1');
    expect(decifrar(a.accessCifrado, CHAVE)).toBe('acc-1');
    expect(decifrar(a.refreshCifrado!, CHAVE)).toBe('ref-1');
    expect(m.mundo.contagem().trocas).toBe(1);
  });

  it('o endereço de volta nunca leva token, código nem state', async () => {
    const m = montar();
    const { volta, state } = await conectar(m);
    expect(volta.destino).not.toMatch(/acc-1|ref-1|codigo-1/);
    expect(volta.destino).not.toContain(state);
  });

  it('estado inventado, repetido ou vencido: volta com o motivo e nada é guardado', async () => {
    const m = montar();
    const falso = await retornoDoConsentimento(m.deps, { code: 'x', state: 'inventado' });
    expect(falso.destino).toContain('conexao=erro');
    expect(falso.destino).toContain('motivo=invalida');
    const { state } = await conectar(m);
    const repetido = await retornoDoConsentimento(m.deps, { code: 'x', state });
    expect(repetido.destino).toContain('motivo=usada');
    const r2 = await iniciarConexao(m.deps, 'jwt-camila', { workspaceId: WS, integracao: 'notion' });
    const st2 = new URL(String((r2.corpo as { url: string }).url)).searchParams.get('state')!;
    m.banco.avancar(11 * 60 * 1000);
    const vencido = await retornoDoConsentimento(m.deps, { code: 'x', state: st2 });
    expect(vencido.destino).toContain('motivo=expirada');
    expect(m.banco.acessos.has(`${WS}|m-camila|notion`)).toBe(false);
  });

  it('o app avisa que a pessoa recusou: volta com "recusada" e a tentativa é gasta', async () => {
    const m = montar();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    const state = new URL(String((r.corpo as { url: string }).url)).searchParams.get('state')!;
    const volta = await retornoDoConsentimento(m.deps, { error: 'access_denied', state });
    expect(volta.destino).toContain('motivo=recusada');
    expect(m.mundo.contagem().trocas).toBe(0);
    expect((await retornoDoConsentimento(m.deps, { code: 'c', state })).destino).toContain('motivo=usada');
  });

  it('o servidor de autorização recusa o código: volta com erro e nada é guardado', async () => {
    const m = montar({ mundo: mundoFalso({ aoTrocar: () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }) }) });
    const { volta } = await conectar(m);
    expect(volta.destino).toContain('conexao=erro');
    expect(volta.destino).toContain('motivo=recusada');
    expect(m.banco.acessos.size).toBe(0);
  });

  it('portal diferente do que o workspace já fixou: recusado, nada guardado', async () => {
    const m = montar({
      banco: bancoFalso({ portal: 'portal-A' }),
      mundo: mundoFalso({ aoTrocar: () => new Response(JSON.stringify({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600, workspace_id: 'portal-B' }), { status: 200 }) })
    });
    // O Notion identifica o portal pelo `workspace_id` da resposta do token.
    const { volta } = await conectar(m);
    expect(volta.destino).toContain('motivo=portal_diferente');
    expect(m.banco.acessos.size).toBe(0);
  });

  it('retorno sem state: erro sem consultar o banco', async () => {
    const m = montar();
    const v = await retornoDoConsentimento(m.deps, {});
    expect(v.destino).toContain('motivo=invalida');
  });
});

describe('ferramentas da integração', () => {
  it('lista as ferramentas com o token da própria pessoa; marca as que escrevem', async () => {
    const m = montar();
    await conectar(m);
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(200);
    const lista = (r.corpo as { ferramentas: Array<{ nome: string; escreve: boolean }> }).ferramentas;
    expect(lista.map(f => f.nome)).toEqual(['buscar', 'criar']);
    expect(lista.find(f => f.nome === 'buscar')!.escreve).toBe(false);
    expect(lista.find(f => f.nome === 'criar')!.escreve).toBe(true);
    expect(JSON.stringify(r.corpo)).not.toMatch(/acc-1|ref-1/);
  });

  it('cada pessoa usa só o próprio acesso: quem não conectou não usa o de outra', async () => {
    const m = montar();
    await conectar(m, 'jwt-aline');
    const r = await ferramentas(m.deps, 'jwt-camila', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(409);
    expect((r.corpo as { erro: string; motivo: string }).erro).toBe('precisa_reconectar');
    expect((r.corpo as { motivo: string }).motivo).toBe('sem_acesso');
  });

  it('token vencido: renova com o refresh token e grava o novo par cifrado', async () => {
    let agora = 1_000_000;
    const m = montar({ agora: () => agora, mundo: mundoFalso({ tokenValido: 'acc-2' }) });
    await conectar(m);
    agora += 2 * 3600 * 1000;
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(200);
    expect(m.mundo.contagem().renovacoes).toBe(1);
    const a = m.banco.acessos.get(`${WS}|m-aline|notion`)!;
    expect(decifrar(a.accessCifrado, CHAVE)).toBe('acc-2');
    expect(decifrar(a.refreshCifrado!, CHAVE)).toBe('ref-2');
  });

  it('o app recusa o token (revogado): marca "precisa reconectar" e avisa', async () => {
    const m = montar({ mundo: mundoFalso({ tokenValido: 'outro-token' }) });
    await conectar(m);
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(409);
    expect((r.corpo as { motivo: string }).motivo).toBe('revogado');
    expect(m.banco.chamadas).toContain('marcar:precisa_reconectar');
    expect(m.banco.acessos.get(`${WS}|m-aline|notion`)!.estado).toBe('precisa_reconectar');
  });

  it('servidor da integração fora do ar: 502, sem marcar como revogado', async () => {
    const m = montar({ mundo: mundoFalso({ ferramentas: { statusFixo: 503 } }) });
    await conectar(m);
    const r = await ferramentas(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(502);
    expect(m.banco.chamadas).not.toContain('marcar:precisa_reconectar');
  });
});

describe('desconectar e retirar', () => {
  it('desconectar tira só o acesso da própria pessoa', async () => {
    const m = montar();
    await conectar(m, 'jwt-aline');
    await conectar(m, 'jwt-camila');
    const r = await desconectar(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' });
    expect(r.status).toBe(200);
    expect(m.banco.acessos.has(`${WS}|m-aline|notion`)).toBe(false);
    expect(m.banco.acessos.has(`${WS}|m-camila|notion`)).toBe(true);
  });

  it('retirar apaga os acessos de todos; quem não pode (banco recusa) recebe 403', async () => {
    const m = montar();
    await conectar(m, 'jwt-aline');
    await conectar(m, 'jwt-camila');
    expect((await retirar(m.deps, 'jwt-aline', { workspaceId: WS, integracao: 'notion' })).status).toBe(200);
    expect(m.banco.acessos.size).toBe(0);
    const bloqueado = montar({ banco: bancoFalso({ semPermissao: ['m-camila'] }) });
    expect((await retirar(bloqueado.deps, 'jwt-camila', { workspaceId: WS, integracao: 'notion' })).status).toBe(403);
  });

  it('sem login: 401 nas duas', async () => {
    const m = montar();
    expect((await desconectar(m.deps, '', { workspaceId: WS, integracao: 'notion' })).status).toBe(401);
    expect((await retirar(m.deps, '', { workspaceId: WS, integracao: 'notion' })).status).toBe(401);
  });
});

describe('canais de mensagem pela Unipile (o mesmo catálogo, sem outro conector)', () => {
  const UUID_WS = '11111111-1111-4111-8111-111111111111';
  const UUID_M = '22222222-2222-4222-8222-222222222222';
  const CANAIS: Array<[string, string]> = [['whatsapp', 'whatsapp'], ['gmail', 'google'], ['outlook', 'microsoft'], ['instagram', 'instagram'], ['linkedin', 'linkedin']];

  function comCanais(resposta = { status: 200, corpo: { url: 'https://hospedado.test/conectar' } as Record<string, unknown> }) {
    const m = montar();
    const vistos: Array<{ jwt: string; corpo: Record<string, unknown> }> = [];
    m.deps.canais = async (jwt, corpo) => { vistos.push({ jwt, corpo }); return resposta; };
    return { m, vistos };
  }

  it('os cinco cartões do catálogo estão disponíveis e conectam pela Unipile', () => {
    for (const [id, canal] of CANAIS) {
      expect(PERFIS[id].situacao, id).toBe('disponivel');
      expect(PERFIS[id].via, id).toBe('mensagens');
      expect(PERFIS[id].canal, id).toBe(canal);
      expect(PERFIS[id].mcp, id).toBeUndefined();
    }
  });

  for (const [id, canal] of CANAIS) it(`${id}: repassa o login e o pedido à conexão da Unipile com o provedor certo e devolve o link`, async () => {
    const { m, vistos } = comCanais();
    const r = await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: UUID_WS, membroId: UUID_M, integracao: id });
    expect(r).toEqual({ status: 200, corpo: { url: 'https://hospedado.test/conectar' } });
    expect(vistos).toEqual([{ jwt: 'jwt-aline', corpo: { workspace_id: UUID_WS, member_id: UUID_M, provider: canal } }]);
    expect(m.mundo.chamadas).toEqual([]); // nenhum OAuth nem MCP: é outro caminho
  });

  it('quem só tem a permissão da Caixa (ex.: BDR) conecta o canal: a permissão de integrações não é exigida aqui', async () => {
    const m = montar({ banco: bancoFalso({ semPermissao: ['m-camila'] }) });
    m.deps.canais = async () => ({ status: 200, corpo: { url: 'https://hospedado.test/x' } });
    const r = await iniciarConexao(m.deps, 'jwt-camila', { workspaceId: UUID_WS, membroId: UUID_M, integracao: 'gmail' });
    expect(r.status).toBe(200);
    expect(m.banco.chamadas).not.toContain('conferir');
  });

  it('quem decide é a conexão da Unipile (o banco): a recusa dela passa como está', async () => {
    const { m } = comCanais({ status: 403, corpo: { erro: 'sem_permissao' } });
    expect((await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: UUID_WS, membroId: UUID_M, integracao: 'whatsapp' })).status).toBe(403);
  });

  it('sem login: 401; sem o membro: 400; canal de mensagens desligado: 503', async () => {
    const { m } = comCanais();
    expect((await iniciarConexao(m.deps, '', { workspaceId: UUID_WS, membroId: UUID_M, integracao: 'gmail' })).status).toBe(401);
    expect((await iniciarConexao(m.deps, 'jwt-aline', { workspaceId: UUID_WS, integracao: 'gmail' })).status).toBe(400);
    const desligado = montar();
    const r = await iniciarConexao(desligado.deps, 'jwt-aline', { workspaceId: UUID_WS, membroId: UUID_M, integracao: 'gmail' });
    expect(r.status).toBe(503);
    expect((r.corpo as { erro: string }).erro).toBe('canais_indisponiveis');
  });

  it('listar ferramentas, desconectar e retirar de um canal não são desta rota: apontam para a Caixa de entrada', async () => {
    const { m } = comCanais();
    for (const rota of [ferramentas, desconectar, retirar]) {
      const r = await rota(m.deps, 'jwt-aline', { workspaceId: UUID_WS, integracao: 'gmail' });
      expect(r.status).toBe(409);
      expect((r.corpo as { erro: string }).erro).toBe('canal_de_mensagens');
    }
  });
});
