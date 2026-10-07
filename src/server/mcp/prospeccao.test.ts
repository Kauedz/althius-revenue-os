// @vitest-environment node
// Ferramentas de prospecção da Zoe (ADR 0067), pelo protocolo MCP de verdade, com banco FALSO. O MCP não decide
// permissão (só a Zoe, quem pediu, teto): o banco decide. Nenhuma ferramenta deixa escolher cliente, pessoa, teto nem dólar.
import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { criarServidorAlthius } from './althius.ts';
import { ferramentasDoAgente } from './ferramentas.ts';
import { POLITICA_DAS_FERRAMENTAS } from './execucao.ts';

const TOKEN = 'alt_agente_zoe_segredo';
const rpcs: Array<{ nome: string; args: any }> = [];
let resposta: Record<string, { data: unknown; error: unknown }> = {};
const clienteFalso = { rpc: async (nome: string, args: any) => {
  rpcs.push({ nome, args });
  return resposta[nome] ?? { data: null, error: { message: 'inesperado' } };
} } as never;

async function conectar() {
  const servidor = criarServidorAlthius(ferramentasDoAgente(clienteFalso, TOKEN));
  const [c, s] = InMemoryTransport.createLinkedPair();
  await servidor.connect(s);
  const cliente = new Client({ name: 'teste', version: '1' });
  await cliente.connect(c);
  return cliente;
}
const texto = (r: { content?: unknown }) => ((r.content as Array<{ text?: string }>) || []).map(c => c.text || '').join('\n');

describe('ferramentas de prospecção', () => {
  it('existem as 4, com a política certa, e nenhuma deixa escolher cliente, pessoa, teto ou dólar', async () => {
    const { tools } = await (await conectar()).listTools();
    for (const n of ['prospeccao_fontes', 'prospeccao_buscas', 'prospeccao_estimar', 'prospeccao_rodar']) {
      const t = tools.find(x => x.name === n);
      expect(t, n).toBeTruthy();
      expect(JSON.stringify(t!.inputSchema), n).not.toMatch(/workspace|membro|member|token|teto|usd|d[oó]lar/i);
    }
    expect(POLITICA_DAS_FERRAMENTAS.prospeccao_fontes.tipo).toBe('leitura');
    expect(POLITICA_DAS_FERRAMENTAS.prospeccao_buscas.tipo).toBe('leitura');
    expect(POLITICA_DAS_FERRAMENTAS.prospeccao_estimar.tipo).toBe('proposta');
    expect(POLITICA_DAS_FERRAMENTAS.prospeccao_rodar.tipo).toBe('acao_externa');
  });

  it('estimar manda dizer o custo e esperar o "pode rodar"', async () => {
    const { tools } = await (await conectar()).listTools();
    const estimar = tools.find(x => x.name === 'prospeccao_estimar')!.description ?? '';
    expect(estimar).toMatch(/custo/i);
    expect(estimar).toMatch(/pode rodar/i);
    expect(tools.find(x => x.name === 'prospeccao_rodar')!.description).toMatch(/prospeccao_estimar/);
  });

  it('estimar vai ao banco pelo token e devolve o custo em créditos', async () => {
    rpcs.length = 0;
    resposta = { agent_prospect_estimate: { data: { ok: true, estimativa_id: 'e-1', creditos: 50, aviso: 'Isso vai custar até 50 créditos' }, error: null } };
    const r = await (await conectar()).callTool({ name: 'prospeccao_estimar', arguments: { fonte: 'google_maps', parametros: { busca: 'clínica', local: 'Campinas, SP' }, max_empresas: 50 } });
    expect(rpcs).toEqual([{ nome: 'agent_prospect_estimate', args: { p_token: TOKEN, p_source_code: 'google_maps', p_parametros: { busca: 'clínica', local: 'Campinas, SP' }, p_max_empresas: 50 } }]);
    expect(r.isError).toBeFalsy();
    expect(texto(r)).toContain('50 créditos');
    expect(texto(r)).toContain('e-1');
  });

  it('recusa do banco (ex.: não é a Zoe) volta como erro com a mensagem do banco', async () => {
    resposta = { agent_prospect_estimate: { data: { ok: false, erro: 'Só a Zoe prospecta. Peça à Zoe (agente comercial).' }, error: null } };
    const r = await (await conectar()).callTool({ name: 'prospeccao_estimar', arguments: { fonte: 'google_maps', parametros: {}, max_empresas: 5 } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('Só a Zoe prospecta');
  });

  it('rodar manda só a estimativa; o resto o banco confere', async () => {
    rpcs.length = 0;
    resposta = { agent_prospect_run: { data: { ok: true, estado: 'pendente', creditos: 50, mensagem: 'Busca na fila.' }, error: null } };
    const r = await (await conectar()).callTool({ name: 'prospeccao_rodar', arguments: { estimativa_id: 'e-1' } });
    expect(rpcs).toEqual([{ nome: 'agent_prospect_run', args: { p_token: TOKEN, p_estimativa_id: 'e-1' } }]);
    expect(texto(r)).toContain('Busca na fila.');
  });

  it('fontes e buscas são leitura do banco', async () => {
    rpcs.length = 0;
    resposta = {
      agent_prospect_sources: { data: [{ codigo: 'google_maps', creditos_por_empresa: 1 }], error: null },
      agent_prospect_searches: { data: [{ id: 's-1', estado: 'concluida', encontradas: 3 }], error: null }
    };
    const cli = await conectar();
    expect(texto(await cli.callTool({ name: 'prospeccao_fontes', arguments: {} }))).toContain('google_maps');
    expect(texto(await cli.callTool({ name: 'prospeccao_buscas', arguments: {} }))).toContain('concluida');
    expect(rpcs.map(x => x.nome)).toEqual(['agent_prospect_sources', 'agent_prospect_searches']);
  });
});
