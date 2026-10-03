// @vitest-environment node
// Seam: servidor MCP da Althius (a "porta" que o Hermes Agent usa), falando MCP de verdade
// com um cliente em memória e o banco local. Faz o papel de um agente que tenta sair do próprio workspace.
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { criarServidorAlthius } from './althius';
import { ferramentasDoAgente } from './ferramentas';
import { decidirAprovacao, listarAprovacoes } from '../../app/servicos/aprovacoes';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, novoClienteLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA_EVOLUT = 'd0000000-0000-0000-0000-000000000002';
const CAMILA_GRAO = 'd0000000-0000-0000-0000-000000000008';
const ALINE_CONTATO = 'cb000000-0000-0000-0000-000000000001';
const ALINE_MEMBRO = 'd0000000-0000-0000-0000-000000000003';
const CANARIO = 'Canário PIPOCA-7731';
const CANARIO_ID = 'cc000000-0000-0000-0000-0000000000d1';

async function conectar(token: string) {
  const servidor = criarServidorAlthius(ferramentasDoAgente(novoClienteLocal(), token));
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(ladoServidor);
  const cliente = new Client({ name: 'agente-de-teste', version: '1.0.0' });
  await cliente.connect(ladoCliente);
  return cliente;
}

const texto = (r: { content?: unknown }) =>
  ((r.content as Array<{ type: string; text?: string }>) || []).map(c => c.text || '').join('\n');

describe.skipIf(!bancoLocalNoAr)('MCP da Althius (banco local)', () => {
  const admin = adminLocal();
  let tokenEvolut = '';
  let tokenGrao = '';
  const aprovacoesCriadas: string[] = [];

  beforeAll(async () => {
    const criar = async (ws: string, membro: string) => {
      const { data, error } = await admin.rpc('agent_runtime_token_create', { p_workspace_id: ws, p_agent_code: 'comercial', p_member_id: membro });
      if (error) throw error;
      return data as string;
    };
    tokenEvolut = await criar(EVOLUT, CAMILA_EVOLUT);
    tokenGrao = await criar(GRAO, CAMILA_GRAO);
    const { error } = await admin.from('contacts').upsert({
      id: CANARIO_ID, workspace_id: EVOLUT, account_id: 'c0000000-0000-0000-0000-000000000001', name: CANARIO, job_title: 'Teste'
    });
    if (error) throw error;
  });

  afterAll(async () => {
    // Desfaz só o que este teste criou: tokens de agentes reais no mesmo banco continuam valendo.
    const hash = (t: string) => createHash('sha256').update(t).digest('hex');
    if (aprovacoesCriadas.length) await admin.from('approvals').delete().in('id', aprovacoesCriadas);
    await admin.from('contacts').delete().eq('id', CANARIO_ID);
    await admin.from('contacts').update({ job_title: 'Diretora de Supply Chain' }).eq('id', ALINE_CONTATO);
    await admin.from('agent_runtime_tokens').delete().in('token_hash', [tokenEvolut, tokenGrao].filter(Boolean).map(hash));
  });

  it('expõe só as ferramentas da Althius, e nenhuma aceita escolher o workspace', async () => {
    const cliente = await conectar(tokenGrao);
    const { tools } = await cliente.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['buscar_contatos', 'propor_atualizacao']);
    for (const t of tools) expect(JSON.stringify(t.inputSchema)).not.toMatch(/workspace/i);
  });

  it('CANÁRIO: a Grão Norte nunca enxerga o contato da Evolut; a Evolut enxerga o próprio', async () => {
    const grao = await conectar(tokenGrao);
    const evolut = await conectar(tokenEvolut);
    const daGrao = texto(await grao.callTool({ name: 'buscar_contatos', arguments: {} }));
    const daEvolut = texto(await evolut.callTool({ name: 'buscar_contatos', arguments: {} }));
    expect(daEvolut).toContain('PIPOCA-7731');
    expect(daGrao).not.toContain('PIPOCA-7731');
    expect(daGrao).not.toContain('Aline Xavier');
  });

  it('a lista vai uma vez só (o Hermes repassa tudo ao modelo e o limite de tamanho é curto)', async () => {
    const r = await (await conectar(tokenEvolut)).callTool({ name: 'buscar_contatos', arguments: {} });
    expect(r.structuredContent).toBeUndefined();
    expect(JSON.parse(texto(r)).length).toBeGreaterThan(0);
  });

  it('a Grão Norte não consegue propor mudança num contato da Evolut, nem passando o id dele', async () => {
    const grao = await conectar(tokenGrao);
    const r = await grao.callTool({
      name: 'propor_atualizacao',
      arguments: { contato_id: ALINE_CONTATO, campo: 'cargo', valor: 'CEO', motivo: 'tentativa de outro workspace' }
    });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('Contato não encontrado neste workspace.');
    const { count } = await admin.from('approvals').select('id', { count: 'exact', head: true }).eq('payload_json->>para', 'CEO');
    expect(count).toBe(0);
  });

  it('a Evolut propõe uma mudança: vira aprovação pendente e o CRM não muda; repetir não duplica', async () => {
    const evolut = await conectar(tokenEvolut);
    const pedido = { contato_id: ALINE_CONTATO, campo: 'cargo', valor: 'Diretora Comercial', motivo: 'Assinatura de e-mail atualizada' };
    const r1 = await evolut.callTool({ name: 'propor_atualizacao', arguments: pedido });
    const r2 = await evolut.callTool({ name: 'propor_atualizacao', arguments: pedido });
    expect(r1.isError).toBeFalsy();
    const id = (r1.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((r2.structuredContent as { approval_id: string }).approval_id).toBe(id);
    expect(texto(r1)).toContain('aguardando aprovação');
    const { data } = await admin.from('approvals').select('status, approval_type, agent_code, workspace_id').eq('id', id).single();
    expect(data).toEqual({ status: 'pendente', approval_type: 'crm', agent_code: 'comercial', workspace_id: EVOLUT });
    const { data: contato } = await admin.from('contacts').select('job_title').eq('id', ALINE_CONTATO).single();
    expect(contato?.job_title).toBe('Diretora de Supply Chain');
  });

  it('ciclo completo: a proposta aparece na fila da C-level e, aprovada por ela, muda o cargo', async () => {
    const id = aprovacoesCriadas[0];
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(item).toMatchObject({
      tipo: 'Alteração de CRM', agente: 'comercial', solicitante: 'Camila Duarte',
      previa: 'Cargo de Aline Xavier: Diretora de Supply Chain → Diretora Comercial'
    });
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    const { data: contato } = await admin.from('contacts').select('job_title').eq('id', ALINE_CONTATO).single();
    expect(contato?.job_title).toBe('Diretora Comercial');
  });

  it('token inválido recebe erro claro e nenhum dado', async () => {
    const intruso = await conectar('alt_agente_inventado');
    const r = await intruso.callTool({ name: 'buscar_contatos', arguments: {} });
    expect(r.isError).toBe(true);
    expect(texto(r)).toBe('Token do agente inválido ou revogado.');
  });
});
