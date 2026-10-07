// @vitest-environment node
// Ferramentas de ICP (ADR 0067, fatia 3), pelo protocolo MCP de verdade, com banco FALSO. Todos os agentes leem;
// só o Jax propõe (o banco confere). Nenhuma ferramenta deixa escolher cliente nem pessoa.
import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { criarServidorAlthius } from './althius.ts';
import { ferramentasDoAgente } from './ferramentas.ts';
import { POLITICA_DAS_FERRAMENTAS } from './execucao.ts';

const TOKEN = 'alt_agente_jax_segredo';
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

describe('ferramentas de ICP', () => {
  it('ler_icp é leitura e propor_icp é proposta; nenhuma deixa escolher cliente ou pessoa', async () => {
    const { tools } = await (await conectar()).listTools();
    for (const n of ['ler_icp', 'propor_icp']) {
      expect(tools.find(x => x.name === n), n).toBeTruthy();
      expect(JSON.stringify(tools.find(x => x.name === n)!.inputSchema), n).not.toMatch(/workspace|membro|member|token/i);
    }
    expect(POLITICA_DAS_FERRAMENTAS.ler_icp.tipo).toBe('leitura');
    expect(POLITICA_DAS_FERRAMENTAS.propor_icp.tipo).toBe('proposta');
  });

  it('ler_icp devolve o ICP e os cargos alvo do banco', async () => {
    rpcs.length = 0;
    resposta = { agent_icp: { data: { icp: { cnaes: ['8630504'] }, personas_alvo: [{ cargo: 'CEO' }] }, error: null } };
    const r = await (await conectar()).callTool({ name: 'ler_icp', arguments: {} });
    expect(rpcs).toEqual([{ nome: 'agent_icp', args: { p_token: TOKEN } }]);
    expect(texto(r)).toContain('8630504');
  });

  it('propor_icp manda o ICP e o motivo com chave de idempotência; nada muda até aprovar', async () => {
    rpcs.length = 0;
    resposta = { agent_propose_icp: { data: { ok: true, status: 'aguardando_aprovacao', approval_id: 'ap-1' }, error: null } };
    const r = await (await conectar()).callTool({ name: 'propor_icp', arguments: { icp: { ufs: ['SP'] }, motivo: 'Vendas vieram de SP' } });
    expect(rpcs[0].nome).toBe('agent_propose_icp');
    expect(rpcs[0].args).toMatchObject({ p_token: TOKEN, p_icp: { ufs: ['SP'] }, p_reason: 'Vendas vieram de SP' });
    expect(rpcs[0].args.p_idempotency_key).toMatch(/^agente:icp:/);
    expect(texto(r)).toMatch(/aguardando aprovação/);
  });

  it('recusa do banco (não é o Jax) vira erro com a mensagem do banco', async () => {
    resposta = { agent_propose_icp: { data: { ok: false, erro: 'Quem cuida do ICP é o Jax (estratégia). Peça a ele.' }, error: null } };
    const r = await (await conectar()).callTool({ name: 'propor_icp', arguments: { icp: { ufs: ['SP'] }, motivo: 'x' } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('Jax');
  });
});
