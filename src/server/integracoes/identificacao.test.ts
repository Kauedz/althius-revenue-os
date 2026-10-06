// @vitest-environment node
// Depois do login, descobre a conta do app (o cartão mostra "Conta: ...") e o portal (o primeiro acesso fixa o portal do
// workspace, para dois CRMs nunca se misturarem). Portado dos testes do protótipo, no formato token OAuth.
import { describe, expect, it } from 'vitest';
import { identificarConta } from './identificacao.ts';
import { PERFIS } from './perfis.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';

function api(rotas: Record<string, () => Response>) {
  const urls: string[] = [];
  const buscar = ((entrada: string | URL | Request, init?: RequestInit) => {
    const req = new Request(entrada, init);
    urls.push(req.url);
    const rota = rotas[req.url];
    return Promise.resolve(rota ? rota() : new Response('{}', { status: 404 }));
  }) as typeof fetch;
  return { fetch: buscar, urls };
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const hubspot = () => PERFIS.hubspot.identificacao;

describe('identificar a conta e o portal', () => {
  it('HubSpot: o hub_id e o usuário vêm da consulta ao token (o token vai codificado no endereço)', async () => {
    const { fetch, urls } = api({ 'https://api.hubapi.com/oauth/v1/access-tokens/tok%2F1': () => json({ hub_id: 1234, user: 'ana@norte.test' }) });
    const r = await identificarConta(hubspot(), 'tok/1', { fetch });
    expect(r).toEqual({ ok: true, portal: '1234', conta: 'ana@norte.test' });
    expect(urls).toHaveLength(1);
  });

  it('HubSpot: se a API recusa o token do MCP, cai na ferramenta get_user_details do próprio servidor', async () => {
    const recusada = api({ 'https://api.hubapi.com/oauth/v1/access-tokens/tok-2': () => json({}, 401) });
    const mcp = servidorMcpFalso({
      ferramentas: [{ name: 'get_user_details', annotations: { readOnlyHint: true } }],
      resultados: { get_user_details: { content: [{ type: 'text', text: JSON.stringify({ hubId: 5678, email: 'bruno@norte.test' }) }] } }
    });
    const r = await identificarConta(hubspot(), 'tok-2', { fetch: recusada.fetch, mcp: { url: 'https://mcp.hubspot.com', cabecalhos: { Authorization: 'Bearer tok-2' }, fetch: mcp.fetch } });
    expect(r).toEqual({ ok: true, portal: '5678', conta: 'bruno@norte.test' });
  });

  it('o portal e a conta podem vir da própria resposta do endpoint de token (sem nenhuma chamada)', async () => {
    const { fetch, urls } = api({});
    const r = await identificarConta(hubspot(), 'tok-3', { fetch, respostaDoToken: { access_token: 'tok-3', hub_id: 777, user: 'carla@norte.test' } });
    expect(r).toEqual({ ok: true, portal: '777', conta: 'carla@norte.test' });
    expect(urls).toEqual([]);
  });

  it('sem como identificar nada: "não identificada" (quem chama recusa, porque o HubSpot fixa portal)', async () => {
    const { fetch } = api({});
    expect(await identificarConta(hubspot(), 'tok-4', { fetch })).toEqual({ ok: false, motivo: 'nao_identificada' });
  });

  it('app fora do ar (503) sem achar nada: "indisponível", não "não identificada"', async () => {
    const { fetch } = api({ 'https://api.hubapi.com/oauth/v1/access-tokens/tok-5': () => json({}, 503) });
    expect(await identificarConta(hubspot(), 'tok-5', { fetch })).toEqual({ ok: false, motivo: 'indisponivel' });
  });

  it('Notion: a conta e o portal vêm dos campos da resposta do endpoint de token', async () => {
    const r = await identificarConta(PERFIS.notion.identificacao, 'tok', { respostaDoToken: { access_token: 'tok', workspace_id: 'ws-9', workspace_name: 'Norte Ltda' } });
    expect(r).toEqual({ ok: true, portal: 'ws-9', conta: 'Norte Ltda' });
  });

  it('perfil sem nenhuma regra de identificação: segue sem conta nem portal (a conexão vale; o cartão diz "Conta conectada")', async () => {
    expect(await identificarConta(undefined, 'tok', {})).toEqual({ ok: false, motivo: 'nao_identificada' });
  });

  it('só lista os NOMES dos campos recebidos quando pedirem diagnóstico, nunca valores (nada de token em log)', async () => {
    const { fetch } = api({});
    const r = await identificarConta(hubspot(), 'tok-6', { fetch, respostaDoToken: { access_token: 'tok-6', refresh_token: 'ref-6', expires_in: 1800 } });
    expect(JSON.stringify(r)).not.toMatch(/tok-6|ref-6/);
  });
});
