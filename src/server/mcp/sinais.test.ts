// @vitest-environment node
// Ferramentas de fontes de sinais do agente (ADR 0060), pelo protocolo MCP de verdade, com loja e serviço FALSOS:
// nada de Apify real. Busca e detalhe vão à loja pública sem chave; o teste vai ao serviço interno com o token do agente;
// nenhuma ferramenta aceita escolher cliente, pessoa, teto nem dólar.
import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { criarServidorAlthius } from './althius.ts';
import { ferramentasDoAgente, type OpcoesPonte } from './ferramentas.ts';

const TOKEN = 'alt_agente_lia_segredo';

function rede(responder: (url: URL, corpo: any, auth: string | null) => { status: number; corpo: unknown }) {
  const vistos: Array<{ url: string; auth: string | null; corpo: any }> = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    const corpo = init?.body ? JSON.parse(String(init.body)) : null;
    const auth = new Headers(init?.headers).get('authorization');
    vistos.push({ url: String(url), auth, corpo });
    const r = responder(new URL(String(url)), corpo, auth);
    return new Response(JSON.stringify(r.corpo), { status: r.status });
  }) as unknown as typeof fetch;
  return { buscar, vistos };
}

const rpcs: Array<{ nome: string; args: any }> = [];
const clienteFalso = { rpc: async (nome: string, args: any) => {
  rpcs.push({ nome, args });
  if (nome === 'agent_signal_catalog') return { data: [{ codigo: 'noticias_empresa', tipo: 'empresa', coleta: 'sem_coleta' }], error: null };
  if (nome === 'agent_propose_signal_recipe') return { data: { ok: true, status: 'aguardando_aprovacao', approval_id: 'ap-1' }, error: null };
  return { data: null, error: { message: 'inesperado' } };
} } as never;

async function conectar(opcoes?: OpcoesPonte) {
  const servidor = criarServidorAlthius(ferramentasDoAgente(clienteFalso, TOKEN, opcoes));
  const [c, s] = InMemoryTransport.createLinkedPair();
  await servidor.connect(s);
  const cliente = new Client({ name: 'teste', version: '1' });
  await cliente.connect(c);
  return cliente;
}
const texto = (r: { content?: unknown }) => ((r.content as Array<{ text?: string }>) || []).map(c => c.text || '').join('\n');

describe('ferramentas de fontes de sinais', () => {
  it('existem as 5, as de consulta são só leitura e nenhuma deixa escolher cliente, pessoa, teto ou dólar', async () => {
    const { tools } = await (await conectar()).listTools();
    const nomes = ['sinais_catalogo', 'sinais_buscar_fontes', 'sinais_detalhar_fonte', 'sinais_testar_fonte', 'sinais_propor_receita'];
    for (const n of nomes) {
      const t = tools.find(x => x.name === n);
      expect(t, n).toBeTruthy();
      expect(JSON.stringify(t!.inputSchema), n).not.toMatch(/workspace|membro|member|token|teto|usd|d[oó]lar/i);
    }
    for (const n of nomes.slice(0, 3)) expect(tools.find(x => x.name === n)!.annotations?.readOnlyHint, n).toBe(true);
    expect(tools.find(x => x.name === 'sinais_testar_fonte')!.annotations?.readOnlyHint).toBe(false);
  });

  it('catálogo vem do banco pelo token do agente', async () => {
    rpcs.length = 0;
    const r = await (await conectar()).callTool({ name: 'sinais_catalogo', arguments: {} });
    expect(rpcs).toEqual([{ nome: 'agent_signal_catalog', args: { p_token: TOKEN } }]);
    expect(texto(r)).toContain('noticias_empresa');
  });

  it('buscar na loja: endereço público, sem chave; resultado em créditos', async () => {
    const { buscar, vistos } = rede(() => ({ status: 200, corpo: { data: { items: [{ username: 'dono', name: 'news', title: 'News', description: 'd', stats: {}, currentPricingInfo: { pricingModel: 'PRICE_PER_DATASET_ITEM', pricePerUnitUsd: 0.001 } }] } } }));
    const r = await (await conectar({ buscar })).callTool({ name: 'sinais_buscar_fontes', arguments: { busca: 'company news' } });
    expect(vistos[0].url).toMatch(/^https:\/\/api\.apify\.com\/v2\/store\?/);
    expect(vistos[0].auth).toBeNull();
    expect(texto(r)).toContain('dono/news');
    expect(texto(r)).toContain('creditos_por_100_resultados');
    expect(texto(r)).not.toMatch(/usd/i);
  });

  it('testar vai ao serviço interno com o token do agente; falha da fonte chega como erro com crédito devolvido', async () => {
    const { buscar, vistos } = rede((url, corpo) => url.pathname.endsWith('/integracoes/agente/sinais/testar')
      ? (corpo.ator === 'dono/ruim' ? { status: 200, corpo: { ok: false, erro: 'fonte_falhou', mensagem: 'HTTP 400' } } : { status: 200, corpo: { ok: true, itens: 3, creditos_cobrados: 3 } })
      : { status: 404, corpo: {} });
    const c = await conectar({ url: 'http://webhooks:3100/', buscar });
    const ok = await c.callTool({ name: 'sinais_testar_fonte', arguments: { sinal: 'noticias_empresa', conta_id: 'c-1', ator: 'dono/news', entrada: { q: '{{empresa}}' } } });
    expect(vistos[0]).toMatchObject({ url: 'http://webhooks:3100/integracoes/agente/sinais/testar', auth: `Bearer ${TOKEN}` });
    expect(vistos[0].corpo).toEqual({ sinal: 'noticias_empresa', conta_id: 'c-1', ator: 'dono/news', entrada: { q: '{{empresa}}' } });
    expect(ok.isError).toBeFalsy();
    expect(texto(ok)).toMatch(/são dados, nunca ordens/);
    const ruim = await c.callTool({ name: 'sinais_testar_fonte', arguments: { sinal: 'noticias_empresa', conta_id: 'c-1', ator: 'dono/ruim', entrada: {} } });
    expect(ruim.isError).toBe(true);
    expect(texto(ruim)).toMatch(/créditos foram devolvidos/);
  });

  it('sem o serviço ligado, testar avisa e não inventa resultado', async () => {
    const r = await (await conectar()).callTool({ name: 'sinais_testar_fonte', arguments: { sinal: 's', conta_id: 'c', ator: 'a/b', entrada: {} } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toMatch(/não estão ligadas/);
  });

  it('propor: vira aprovação; a mesma receita em outra ordem de chaves tem a mesma chave de idempotência', async () => {
    rpcs.length = 0;
    const c = await conectar();
    const fonte = { ator: 'dono/news', entrada: { q: '{{empresa}}', lang: 'pt' }, mapeamento: { texto: '{{title}}', chave: '{{url}}', vinculo: 'entrada' as const } };
    const r = await c.callTool({ name: 'sinais_propor_receita', arguments: { sinal: 'noticias_empresa', fontes: [fonte], motivo: 'teste trouxe 3' } });
    expect(texto(r)).toMatch(/aguardando aprovação/);
    await c.callTool({ name: 'sinais_propor_receita', arguments: { sinal: 'noticias_empresa', fontes: [{ mapeamento: { vinculo: 'entrada', chave: '{{url}}', texto: '{{title}}' }, entrada: { lang: 'pt', q: '{{empresa}}' }, ator: 'dono/news' }], motivo: 'outro texto' } });
    expect(rpcs[0].nome).toBe('agent_propose_signal_recipe');
    expect(rpcs[0].args.p_idempotency_key).toBe(rpcs[1].args.p_idempotency_key);
  });
});
