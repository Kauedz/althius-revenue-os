// @vitest-environment node
// Conectores de registro automático (tickets 03 e 08 das conexões): Apollo, Pipedrive, Granola, Confluence, Calendly e Otter passam pelo MESMO
// mecanismo do Notion. Aqui cada um é provado contra um mundo falso (nenhuma chamada real): o cliente é registrado sozinho,
// o consentimento sai com PKCE, o retorno guarda os tokens cifrados. Endereços dos servidores: docs/integracoes/servidores-mcp.md.
import { describe, expect, it } from 'vitest';
import { chaveMestra, decifrar } from '../cofre/cifra.ts';
import { iniciarConexao, retornoDoConsentimento, type DepsIntegracoes } from './rotas.ts';
import { PERFIS } from './perfis.ts';
import { bancoFalso } from './mundo-falso.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';

const CHAVE = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 5).toString('base64') });
const WS = 'ws-1';
const SITE = 'https://app.althius.test';
const ENDERECOS: Record<string, string> = {
  apollo: 'https://mcp.apollo.io/mcp',
  pipedrive: 'https://mcp.pipedrive.ai/mcp',
  granola: 'https://mcp.granola.ai/mcp',
  confluence: 'https://mcp.atlassian.com/v1/mcp',
  calendly: 'https://mcp.calendly.com/mcp',
  otter: 'https://mcp.otter.ai/mcp'
};

function mundo(url: string) {
  const emissor = new URL(url).origin;
  const mcp = servidorMcpFalso({ token: 'acc-1' });
  const chamadas: string[] = [];
  const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });
  const buscar = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const req = new Request(entrada, init);
    chamadas.push(`${req.method} ${req.url}`);
    if (req.url === url) {
      if (!req.headers.get('authorization')) return new Response('{}', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${emissor}/.well-known/oauth-protected-resource"` } });
      return mcp.fetch(req);
    }
    if (req.url === `${emissor}/.well-known/oauth-protected-resource`) return json({ resource: url, authorization_servers: [emissor] });
    if (req.url === `${emissor}/.well-known/oauth-authorization-server`) {
      return json({ issuer: emissor, authorization_endpoint: `${emissor}/authorize`, token_endpoint: `${emissor}/token`, registration_endpoint: `${emissor}/register`, code_challenge_methods_supported: ['S256'] });
    }
    if (req.url === `${emissor}/register`) return json({ client_id: 'cid-registrado' }, 201);
    if (req.url === `${emissor}/token`) return json({ access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 3600 });
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { buscar, chamadas, emissor };
}

function montar(url: string) {
  const banco = bancoFalso();
  const m = mundo(url);
  let n = 0;
  const deps: DepsIntegracoes = { banco: banco.banco, chave: CHAVE, siteUrl: SITE, buscar: m.buscar, agora: () => 1_000_000, aleatorio: (b: number) => `aleatorio-${++n}-`.padEnd(b, 'x') };
  return { deps, banco, m };
}

describe('conectores de registro automático (Apollo, Pipedrive, Granola, Confluence, Calendly, Otter)', () => {
  it('estão disponíveis no catálogo, com o servidor oficial e registro automático', () => {
    for (const [id, url] of Object.entries(ENDERECOS)) {
      const p = PERFIS[id];
      expect(p.situacao, id).toBe('disponivel');
      expect(p.mcp, id).toMatchObject({ url, registro: 'automatico' });
      expect(p.portalFixo, id).toBe(false);
    }
  });

  for (const [id, url] of Object.entries(ENDERECOS)) {
    it(`${id}: registra o cliente sozinho, abre o consentimento com PKCE e guarda os tokens cifrados`, async () => {
      const { deps, banco, m } = montar(url);
      const r = await iniciarConexao(deps, 'jwt-aline', { workspaceId: WS, integracao: id });
      expect(r.status, JSON.stringify(r.corpo)).toBe(200);
      const consentimento = new URL(String((r.corpo as { url: string }).url));
      expect(`${consentimento.origin}${consentimento.pathname}`).toBe(`${m.emissor}/authorize`);
      expect(consentimento.searchParams.get('code_challenge_method')).toBe('S256');
      expect(consentimento.searchParams.get('client_id')).toBe('cid-registrado');
      expect(consentimento.searchParams.get('redirect_uri')).toBe(`${SITE}/integracoes/retorno`);
      const volta = await retornoDoConsentimento(deps, { code: 'c', state: consentimento.searchParams.get('state')! });
      expect(volta.destino, id).toContain('conexao=ok');
      const acesso = [...banco.acessos.values()][0];
      expect(decifrar(acesso.accessCifrado, CHAVE)).toBe('acc-1');
      expect(JSON.stringify([...banco.acessos.values()])).not.toContain('"acc-1"');
    });
  }
});
