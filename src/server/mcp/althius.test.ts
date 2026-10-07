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
const LUCAS_MEMBRO = 'd0000000-0000-0000-0000-000000000004';
const CAD_AUTO = 'f8000000-0000-0000-0000-0000000000d1';
const TAREFA_CANARIO = 'f7000000-0000-0000-0000-0000000000d1';
const NEGOCIO_CANARIO = 'f9000000-0000-0000-0000-0000000000d1';
const CONTA_EVOLUT = 'c0000000-0000-0000-0000-000000000001';
const CAMPANHA_CANARIO = 'fa000000-0000-0000-0000-0000000000d1';
const CONTA_SINAL = 'c0000000-0000-0000-0000-000000000001';
const SLUG_HABILIDADE = 'canario-mcp-9921';
const DETALHE_SINAL = 'CANÁRIO sinal MCP-5532';
const TITULO_TAREFA = 'Ligar para Aline (teste MCP fatia A)';

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
  let quadroEvolut = '';
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
    // Fixtures da fatia A: uma cadência com 1 passo automático e uma tarefa-canário na Evolut.
    await admin.from('cadences').upsert({ id: CAD_AUTO, workspace_id: EVOLUT, name: 'Cadência de teste MCP', status: 'ativa' });
    await admin.from('cadence_steps').upsert({ workspace_id: EVOLUT, cadence_id: CAD_AUTO, step_number: 1, channel: 'email', execution_mode: 'auto', subject: 'Oi', body: 'Olá', delay_days: 0 }, { onConflict: 'cadence_id,step_number' });
    await admin.from('campaigns').upsert({ id: CAMPANHA_CANARIO, workspace_id: EVOLUT, name: 'CANÁRIO campanha MCP-3307', channel_type: 'linkedin_ads', status: 'rascunho', budget_brl: 1000, created_by: CAMILA_EVOLUT });
    const { data: quadro } = await admin.from('pipelines').select('id').eq('workspace_id', EVOLUT).eq('motion', 'slg').order('created_at').limit(1).single();
    quadroEvolut = quadro!.id;
    const { error: erroNegocio } = await admin.from('opportunities').upsert({
      id: NEGOCIO_CANARIO, workspace_id: EVOLUT, pipeline_id: quadroEvolut, account_id: CONTA_EVOLUT, stage_key: 'qualificacao',
      title: 'CANÁRIO negócio MCP-8813', amount: 4321.5, owner_member_id: LUCAS_MEMBRO
    });
    if (erroNegocio) throw erroNegocio;
    // Fixtures do ticket 02 dos agentes: uma habilidade da Zoe da Evolut e um sinal numa conta da Evolut.
    await admin.from('agent_skills').upsert({ workspace_id: EVOLUT, agent_id: 'comercial', name: 'CANÁRIO habilidade MCP-9921', slug: SLUG_HABILIDADE, content_markdown: '# Passo a passo', enabled: true }, { onConflict: 'workspace_id,agent_id,slug' });
    const { data: def } = await admin.from('signal_definitions').select('id').order('code').limit(1).single();
    await admin.from('signal_events').insert({ workspace_id: EVOLUT, signal_id: def!.id, account_id: CONTA_SINAL, payload: { detalhe: DETALHE_SINAL }, temperature_bump: 2 });
    await admin.from('tasks').upsert({ id: TAREFA_CANARIO, workspace_id: EVOLUT, title: 'CANÁRIO tarefa MCP-5521', assignee_member_id: LUCAS_MEMBRO, status: 'pendente' });
  });

  afterAll(async () => {
    // Desfaz só o que este teste criou: tokens de agentes reais no mesmo banco continuam valendo.
    const hash = (t: string) => createHash('sha256').update(t).digest('hex');
    if (aprovacoesCriadas.length) {
      await admin.from('notifications').delete().in('entity_id', aprovacoesCriadas);
      await admin.from('approvals').delete().in('id', aprovacoesCriadas);
    }
    await admin.from('agent_skills').delete().eq('workspace_id', EVOLUT).eq('slug', SLUG_HABILIDADE);
    await admin.from('signal_events').delete().eq('workspace_id', EVOLUT).eq('payload->>detalhe', DETALHE_SINAL);
    await admin.from('tasks').delete().eq('workspace_id', EVOLUT).in('title', [TITULO_TAREFA, 'CANÁRIO tarefa MCP-5521']);
    await admin.from('campaigns').delete().eq('workspace_id', EVOLUT).in('name', ['CANÁRIO campanha MCP-3307', 'Campanha de teste MCP']);
    await admin.from('opportunities').delete().eq('workspace_id', EVOLUT).or(`id.eq.${NEGOCIO_CANARIO},amount.eq.88888`);
    await admin.from('cadence_enrollments').delete().eq('cadence_id', CAD_AUTO);
    await admin.from('cadences').delete().eq('id', CAD_AUTO);
    await admin.from('contacts').delete().eq('id', CANARIO_ID);
    await admin.from('contacts').update({ job_title: 'Diretora de Supply Chain' }).eq('id', ALINE_CONTATO);
    await admin.from('agent_runtime_tokens').delete().in('token_hash', [tokenEvolut, tokenGrao].filter(Boolean).map(hash));
  });

  it('expõe só as ferramentas da Althius, e nenhuma aceita escolher o workspace', async () => {
    const cliente = await conectar(tokenGrao);
    const { tools } = await cliente.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'buscar_contatos', 'integracao_ferramentas', 'integracao_ler', 'integracao_propor', 'listar_cadencias', 'listar_campanhas', 'listar_contas', 'listar_habilidades', 'listar_membros', 'listar_negocios', 'listar_quadros', 'listar_sinais', 'listar_tarefas',
      'propor_atualizacao', 'propor_campanha', 'propor_contas', 'propor_enriquecimento', 'propor_inscricao_cadencia', 'propor_levar_ao_pipeline', 'propor_mover_negocio', 'propor_negocio', 'propor_plano', 'propor_status_campanha', 'propor_tarefa',
      'propor_verba_campanha', 'sinais_buscar_fontes', 'sinais_catalogo', 'sinais_detalhar_fonte', 'sinais_propor_receita', 'sinais_testar_fonte'
    ]);
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

  it('CANÁRIO: tarefas, cadências e membros também não vazam entre clientes', async () => {
    const grao = await conectar(tokenGrao);
    const evolut = await conectar(tokenEvolut);
    expect(texto(await evolut.callTool({ name: 'listar_tarefas', arguments: {} }))).toContain('MCP-5521');
    expect(texto(await grao.callTool({ name: 'listar_tarefas', arguments: {} }))).not.toContain('MCP-5521');
    expect(texto(await evolut.callTool({ name: 'listar_cadencias', arguments: {} }))).toContain('Cadência de teste MCP');
    expect(texto(await grao.callTool({ name: 'listar_cadencias', arguments: {} }))).not.toContain('Cadência de teste MCP');
    expect(texto(await evolut.callTool({ name: 'listar_membros', arguments: {} }))).toContain(LUCAS_MEMBRO);
    expect(texto(await grao.callTool({ name: 'listar_membros', arguments: {} }))).not.toContain(LUCAS_MEMBRO);
  });

  it('a Grão Norte não propõe tarefa nem inscrição usando ids da Evolut', async () => {
    const grao = await conectar(tokenGrao);
    const t = await grao.callTool({ name: 'propor_tarefa', arguments: { titulo: TITULO_TAREFA, responsavel_id: LUCAS_MEMBRO, motivo: 'tentativa de outro workspace' } });
    expect(t.isError).toBe(true);
    const i = await grao.callTool({ name: 'propor_inscricao_cadencia', arguments: { cadencia_id: CAD_AUTO, contato_id: ALINE_CONTATO, motivo: 'tentativa de outro workspace' } });
    expect(i.isError).toBe(true);
    const { count } = await admin.from('approvals').select('id', { count: 'exact', head: true }).eq('workspace_id', GRAO).in('payload_json->>acao', ['criar_tarefa', 'inscrever_cadencia']);
    expect(count).toBe(0);
  });

  it('tarefa proposta pelo agente: nada é criado até a C-level aprovar; aprovada, vira tarefa do agente', async () => {
    const evolut = await conectar(tokenEvolut);
    const pedido = { titulo: TITULO_TAREFA, responsavel_id: LUCAS_MEMBRO, contato_id: ALINE_CONTATO, prazo_dias: 1, motivo: 'Aline abriu o e-mail 3 vezes' };
    const r1 = await evolut.callTool({ name: 'propor_tarefa', arguments: pedido });
    const r2 = await evolut.callTool({ name: 'propor_tarefa', arguments: pedido });
    expect(r1.isError).toBeFalsy();
    const id = (r1.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((r2.structuredContent as { approval_id: string }).approval_id).toBe(id);
    expect((await admin.from('tasks').select('id').eq('title', TITULO_TAREFA)).data).toEqual([]);

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(item).toBeDefined();
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    const { data } = await admin.from('tasks').select('source, agent_id, assignee_member_id, contact_id').eq('title', TITULO_TAREFA).single();
    expect(data).toEqual({ source: 'agente', agent_id: 'comercial', assignee_member_id: LUCAS_MEMBRO, contact_id: ALINE_CONTATO });
  });

  it('inscrição com envio automático é gasto: a estrategista não aprova, a C-level aprova e o contato entra', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_inscricao_cadencia', arguments: { cadencia_id: CAD_AUTO, contato_id: ALINE_CONTATO, motivo: 'Respondeu o convite' } });
    expect(r.isError).toBeFalsy();
    const id = (r.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    const { data: ap } = await admin.from('approvals').select('category, approval_type, estimated_credits').eq('id', id).single();
    expect(ap).toEqual({ category: 'gasto', approval_type: 'execucao_limite', estimated_credits: 4 });

    const camila = await entrarComoLocal('camila@althius.com.br');
    const itemCamila = (await listarAprovacoes(camila, EVOLUT)).find(a => a.id === id);
    if (itemCamila) {
      const negada = await decidirAprovacao(camila, { aprovacao: itemCamila, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' });
      expect(negada.ok).toBe(false);
    }
    expect((await admin.from('cadence_enrollments').select('id').eq('cadence_id', CAD_AUTO)).data).toEqual([]);

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect((await admin.from('cadence_enrollments').select('contact_id, status').eq('cadence_id', CAD_AUTO)).data).toEqual([{ contact_id: ALINE_CONTATO, status: 'ativa' }]);
  });

  it('CANÁRIO: negócios, quadros e contas também não vazam entre clientes', async () => {
    const grao = await conectar(tokenGrao);
    const evolut = await conectar(tokenEvolut);
    expect(texto(await evolut.callTool({ name: 'listar_negocios', arguments: {} }))).toContain('MCP-8813');
    expect(texto(await grao.callTool({ name: 'listar_negocios', arguments: {} }))).not.toContain('MCP-8813');
    expect(texto(await evolut.callTool({ name: 'listar_quadros', arguments: {} }))).toContain(quadroEvolut);
    expect(texto(await grao.callTool({ name: 'listar_quadros', arguments: {} }))).not.toContain(quadroEvolut);
    expect(texto(await evolut.callTool({ name: 'listar_contas', arguments: {} }))).toContain(CONTA_EVOLUT);
    expect(texto(await grao.callTool({ name: 'listar_contas', arguments: {} }))).not.toContain(CONTA_EVOLUT);
  });

  it('a Grão Norte não propõe mover nem criar negócio com ids da Evolut', async () => {
    const grao = await conectar(tokenGrao);
    const m = await grao.callTool({ name: 'propor_mover_negocio', arguments: { negocio_id: NEGOCIO_CANARIO, etapa: 'proposta', motivo: 'tentativa de outro workspace' } });
    expect(m.isError).toBe(true);
    const n = await grao.callTool({ name: 'propor_negocio', arguments: { quadro_id: quadroEvolut, conta_id: CONTA_EVOLUT, responsavel_id: LUCAS_MEMBRO, valor_reais: 88888, motivo: 'tentativa de outro workspace' } });
    expect(n.isError).toBe(true);
    const { count } = await admin.from('approvals').select('id', { count: 'exact', head: true }).eq('workspace_id', GRAO).in('payload_json->>acao', ['mover_negocio', 'criar_negocio']);
    expect(count).toBe(0);
  });

  it('mover negócio: nada muda até a C-level aprovar; aprovado, o negócio muda de etapa e o histórico mostra quem aprovou', async () => {
    const evolut = await conectar(tokenEvolut);
    const pedido = { negocio_id: NEGOCIO_CANARIO, etapa: 'proposta', motivo: 'Reunião de proposta marcada' };
    const r1 = await evolut.callTool({ name: 'propor_mover_negocio', arguments: pedido });
    const r2 = await evolut.callTool({ name: 'propor_mover_negocio', arguments: pedido });
    expect(r1.isError).toBeFalsy();
    const id = (r1.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((r2.structuredContent as { approval_id: string }).approval_id).toBe(id);
    expect((await admin.from('opportunities').select('stage_key').eq('id', NEGOCIO_CANARIO).single()).data?.stage_key).toBe('qualificacao');

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(item).toBeDefined();
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect((await admin.from('opportunities').select('stage_key').eq('id', NEGOCIO_CANARIO).single()).data?.stage_key).toBe('proposta');
    const { data: h } = await admin.from('opportunity_stage_history').select('from_stage_key, to_stage_key, moved_by_member_id').eq('opportunity_id', NEGOCIO_CANARIO);
    expect(h).toEqual([{ from_stage_key: 'qualificacao', to_stage_key: 'proposta', moved_by_member_id: ALINE_MEMBRO }]);
  });

  it('criar negócio: só existe depois da aprovação, na etapa de entrada, com o valor em reais', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_negocio', arguments: { quadro_id: quadroEvolut, conta_id: CONTA_EVOLUT, responsavel_id: LUCAS_MEMBRO, valor_reais: 88888, motivo: 'Sinal forte de compra' } });
    expect(r.isError).toBeFalsy();
    const id = (r.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((await admin.from('opportunities').select('id').eq('amount', 88888).eq('workspace_id', EVOLUT)).data).toEqual([]);
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    const { data } = await admin.from('opportunities').select('stage_key, status, owner_member_id').eq('amount', 88888).eq('workspace_id', EVOLUT);
    expect(data).toEqual([{ stage_key: 'entrada', status: 'ativa', owner_member_id: LUCAS_MEMBRO }]);
  });

  it('ADR 0065: propor_contas só cria a conta depois da aprovação, e ela entra no enriquecimento', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_contas', arguments: { contas: [{ nome: 'Conta do Agente MCP-0065', site: 'contaagente0065.com.br', uf: 'SP' }], motivo: 'Vista na feira' } });
    expect(r.isError).toBeFalsy();
    const id = (r.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((await admin.from('accounts').select('id').eq('domain', 'contaagente0065.com.br')).data).toEqual([]);
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    const { data: criada } = await admin.from('accounts').select('id, state_uf').eq('domain', 'contaagente0065.com.br').eq('workspace_id', EVOLUT).single();
    expect(criada?.state_uf).toBe('SP');
    await admin.from('accounts').delete().eq('id', criada!.id);
  });

  it('ADR 0065: propor_plano vira UM pedido na fila; aprovado, aplica todos os passos', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_plano', arguments: { titulo: 'Ativar a Campo Belo MCP-0065', motivo: 'Conta quente sem negócio', passos: [
      { tipo: 'levar_contas', quadro_id: quadroEvolut, conta_ids: ['c0000000-0000-0000-0000-000000000002'] },
      { tipo: 'criar_tarefa', titulo: 'Ligar para a Campo Belo MCP-0065', responsavel_id: LUCAS_MEMBRO, prazo_dias: 1 }
    ] } });
    expect(r.isError).toBeFalsy();
    const id = (r.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const fila = await listarAprovacoes(aline, EVOLUT);
    expect(fila.filter(a => a.titulo.includes('MCP-0065')).map(a => a.titulo)).toEqual(['Plano: Ativar a Campo Belo MCP-0065']);
    expect(await decidirAprovacao(aline, { aprovacao: fila.find(a => a.id === id)!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect((await admin.from('opportunities').select('id').eq('pipeline_id', quadroEvolut).eq('account_id', 'c0000000-0000-0000-0000-000000000002').eq('status', 'ativa')).data).toHaveLength(1);
    expect((await admin.from('tasks').select('id').eq('title', 'Ligar para a Campo Belo MCP-0065')).data).toHaveLength(1);
    await admin.from('opportunities').delete().eq('pipeline_id', quadroEvolut).eq('account_id', 'c0000000-0000-0000-0000-000000000002');
    await admin.from('tasks').delete().eq('title', 'Ligar para a Campo Belo MCP-0065');
  });

  it('ADR 0065: plano com passo inválido é recusado e diz qual passo', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_plano', arguments: { titulo: 'Plano ruim', motivo: 'x', passos: [
      { tipo: 'criar_tarefa', titulo: 'Tarefa MCP-0065b', responsavel_id: LUCAS_MEMBRO, prazo_dias: 1 },
      { tipo: 'levar_contas', quadro_id: '00000000-0000-0000-0000-000000000000', conta_ids: ['c0000000-0000-0000-0000-000000000002'] }
    ] } });
    expect(r.isError).toBe(true);
    expect(texto(r)).toContain('Passo 2');
  });

  it('o agente lê as habilidades dele e os sinais recentes das contas; nada vaza para outro cliente', async () => {
    const evolut = await conectar(tokenEvolut);
    const grao = await conectar(tokenGrao);
    const hab = await evolut.callTool({ name: 'listar_habilidades', arguments: {} });
    expect(hab.isError).not.toBe(true);
    expect(texto(hab)).toContain('MCP-9921');
    expect(texto(await grao.callTool({ name: 'listar_habilidades', arguments: {} }))).not.toContain('MCP-9921');
    expect(texto(await evolut.callTool({ name: 'listar_sinais', arguments: {} }))).toContain('MCP-5532');
    expect(texto(await evolut.callTool({ name: 'listar_sinais', arguments: { conta_id: CONTA_SINAL, limite: 5 } }))).toContain('MCP-5532');
    expect(texto(await grao.callTool({ name: 'listar_sinais', arguments: {} }))).not.toContain('MCP-5532');
    expect(texto(await grao.callTool({ name: 'listar_sinais', arguments: { conta_id: CONTA_SINAL } }))).toBe('[]');
  });

  it('as leituras novas são marcadas como somente leitura', async () => {
    const { tools } = await (await conectar(tokenEvolut)).listTools();
    for (const nome of ['listar_habilidades', 'listar_sinais']) expect(tools.find(t => t.name === nome)?.annotations?.readOnlyHint, nome).toBe(true);
  });

  it('CANÁRIO: campanhas também não vazam entre clientes, e a Grão Norte não mexe nas da Evolut', async () => {
    const grao = await conectar(tokenGrao);
    const evolut = await conectar(tokenEvolut);
    expect(texto(await evolut.callTool({ name: 'listar_campanhas', arguments: {} }))).toContain('MCP-3307');
    expect(texto(await grao.callTool({ name: 'listar_campanhas', arguments: {} }))).not.toContain('MCP-3307');
    const v = await grao.callTool({ name: 'propor_verba_campanha', arguments: { campanha_id: CAMPANHA_CANARIO, verba_reais: 9999, motivo: 'tentativa de outro workspace' } });
    expect(v.isError).toBe(true);
    const s = await grao.callTool({ name: 'propor_status_campanha', arguments: { campanha_id: CAMPANHA_CANARIO, status: 'ativa', motivo: 'tentativa de outro workspace' } });
    expect(s.isError).toBe(true);
    const { count } = await admin.from('approvals').select('id', { count: 'exact', head: true }).eq('workspace_id', GRAO).in('payload_json->>acao', ['verba_campanha', 'status_campanha']);
    expect(count).toBe(0);
  });

  it('verba é gasto: a estrategista não aprova, a C-level aprova e a verba entra; o pedido repetido não duplica', async () => {
    const evolut = await conectar(tokenEvolut);
    const pedido = { campanha_id: CAMPANHA_CANARIO, verba_reais: 6000, motivo: 'CPL abaixo da meta' };
    const r1 = await evolut.callTool({ name: 'propor_verba_campanha', arguments: pedido });
    const r2 = await evolut.callTool({ name: 'propor_verba_campanha', arguments: pedido });
    expect(r1.isError).toBeFalsy();
    const id = (r1.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((r2.structuredContent as { approval_id: string }).approval_id).toBe(id);
    const { data: ap } = await admin.from('approvals').select('category, approval_type').eq('id', id).single();
    expect(ap).toEqual({ category: 'gasto', approval_type: 'orcamento' });

    const camila = await entrarComoLocal('camila@althius.com.br');
    const itemCamila = (await listarAprovacoes(camila, EVOLUT)).find(a => a.id === id);
    if (itemCamila) expect((await decidirAprovacao(camila, { aprovacao: itemCamila, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' })).ok).toBe(false);
    expect(Number((await admin.from('campaigns').select('budget_brl').eq('id', CAMPANHA_CANARIO).single()).data?.budget_brl)).toBe(1000);

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect(Number((await admin.from('campaigns').select('budget_brl').eq('id', CAMPANHA_CANARIO).single()).data?.budget_brl)).toBe(6000);
  });

  it('criar campanha: só existe depois da aprovação, em rascunho e sem verba', async () => {
    const evolut = await conectar(tokenEvolut);
    const r = await evolut.callTool({ name: 'propor_campanha', arguments: { nome: 'Campanha de teste MCP', canal: 'evento', motivo: 'Pipeline de eventos vazio' } });
    expect(r.isError).toBeFalsy();
    const id = (r.structuredContent as { approval_id: string }).approval_id;
    aprovacoesCriadas.push(id);
    expect((await admin.from('campaigns').select('id').eq('name', 'Campanha de teste MCP')).data).toEqual([]);
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const item = (await listarAprovacoes(aline, EVOLUT)).find(a => a.id === id);
    expect(await decidirAprovacao(aline, { aprovacao: item!, membroId: ALINE_MEMBRO, decisao: 'Aprovada' })).toEqual({ ok: true });
    const { data } = await admin.from('campaigns').select('status, budget_brl, channel_type').eq('name', 'Campanha de teste MCP').single();
    expect({ ...data, budget_brl: Number(data?.budget_brl) }).toEqual({ status: 'rascunho', budget_brl: 0, channel_type: 'evento' });
  });

  it('agente pausado pelo cliente recebe o aviso e nenhum dado', async () => {
    await admin.from('workspace_agents').update({ estado: 'pausado' }).eq('workspace_id', EVOLUT).eq('agent_code', 'comercial');
    try {
      const r = await (await conectar(tokenEvolut)).callTool({ name: 'buscar_contatos', arguments: {} });
      expect(r.isError).toBe(true);
      expect(texto(r)).toMatch(/^Agente pausado pelo cliente\. Nada será feito até ele ser retomado\. Não tente de novo/);
    } finally {
      await admin.from('workspace_agents').update({ estado: 'ativo' }).eq('workspace_id', EVOLUT).eq('agent_code', 'comercial');
    }
  });

  it('token inválido recebe erro claro e nenhum dado', async () => {
    const intruso = await conectar('alt_agente_inventado');
    const r = await intruso.callTool({ name: 'buscar_contatos', arguments: {} });
    expect(r.isError).toBe(true);
    expect(texto(r)).toMatch(/^Token do agente inválido ou revogado\. Não tente de novo/);
  });
});
