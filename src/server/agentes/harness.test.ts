// Ciclo do harness com banco e executor FALSOS (nenhuma chamada real) e, no fim, com o banco local de verdade.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoHarnessViaApi, rodarCicloHarness, type BancoHarness, type ExecutorAgente, type LoteHarness } from './harness';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';

const lote = (run = 'r1'): LoteHarness => ({
  run_id: run, workspace_id: 'w', channel_id: 'c', canal: 'geral', agente: 'comercial', tentativa: 1,
  mensagens: [{ id: 'm1', autor_id: 'u1', texto: 'SEGREDO-DA-MENSAGEM', em: '2026-10-06T10:00:00Z' }], contexto: []
});

function bancoFalso(lotes: LoteHarness[], extra: Partial<BancoHarness> = {}) {
  const chamadas: Array<{ fn: string; args: unknown[] }> = [];
  const banco: BancoHarness = {
    recolher: async s => { chamadas.push({ fn: 'recolher', args: [s] }); return 0; },
    pegar: async () => { chamadas.push({ fn: 'pegar', args: [] }); return lotes; },
    batida: async id => { chamadas.push({ fn: 'batida', args: [id] }); return true; },
    terminar: async (id, r) => { chamadas.push({ fn: 'terminar', args: [id, r] }); },
    ...extra
  };
  return { banco, chamadas };
}
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('rodarCicloHarness (banco e executor falsos)', () => {
  it('recolhe lotes parados, pega os prontos, entrega ao executor e devolve a resposta', async () => {
    const { banco, chamadas } = bancoFalso([lote()]);
    const vistos: string[] = [];
    const executor: ExecutorAgente = { responder: async l => { vistos.push(l.mensagens[0].texto); return 'Resposta do agente'; } };
    const r = await rodarCicloHarness({ banco, executor, semBatidaS: 45 });
    expect(r).toEqual({ recolhidos: 0, lotes: 1, respondidos: 1, falhas: 0 });
    expect(vistos).toEqual(['SEGREDO-DA-MENSAGEM']);
    expect(chamadas.map(c => c.fn)).toEqual(['recolher', 'pegar', 'terminar']);
    expect(chamadas[0].args).toEqual([45]);
    expect(chamadas[2].args).toEqual(['r1', { ok: true, resposta: 'Resposta do agente' }]);
  });

  it('executor que falha: o lote é devolvido com erro curto, sem o texto das mensagens', async () => {
    const { banco, chamadas } = bancoFalso([lote()]);
    const logs: Array<Record<string, unknown>> = [];
    const executor: ExecutorAgente = { responder: async () => { throw new Error('Hermes fora do ar'); } };
    const r = await rodarCicloHarness({ banco, executor, log: l => logs.push(l) });
    expect(r).toMatchObject({ respondidos: 0, falhas: 1 });
    expect(chamadas.find(c => c.fn === 'terminar')?.args).toEqual(['r1', { ok: false, erro: 'Hermes fora do ar' }]);
    expect(JSON.stringify(logs)).not.toContain('SEGREDO-DA-MENSAGEM');
  });

  it('só pede ao banco os agentes que têm executor registrado (lista vazia = nenhum)', async () => {
    const pedidos: unknown[] = [];
    const { banco } = bancoFalso([], { pegar: async o => { pedidos.push(o); return []; } });
    const executor = { responder: async () => 'x' };
    await rodarCicloHarness({ banco, executor, executoresRegistrados: () => ['w/comercial'] });
    await rodarCicloHarness({ banco, executor, executoresRegistrados: async () => [] });
    await rodarCicloHarness({ banco, executor });
    expect(pedidos).toEqual([{ somente: ['w/comercial'] }, { somente: [] }, {}]);
  });

  it('sem lote pronto, nada é chamado no executor', async () => {
    const { banco } = bancoFalso([]);
    let chamou = 0;
    const r = await rodarCicloHarness({ banco, executor: { responder: async () => { chamou++; return 'x'; } } });
    expect(r.lotes).toBe(0);
    expect(chamou).toBe(0);
  });

  it('avisa que está vivo enquanto o executor trabalha', async () => {
    const { banco, chamadas } = bancoFalso([lote()]);
    await rodarCicloHarness({ banco, batidaMs: 5, executor: { responder: async () => { await espera(40); return 'ok'; } } });
    expect(chamadas.filter(c => c.fn === 'batida').length).toBeGreaterThanOrEqual(3);
  });

  it('batida recusada (lote já recolhido): para o executor e NÃO entrega resposta atrasada', async () => {
    const { banco, chamadas } = bancoFalso([lote()], { batida: async () => false });
    let abortado = false;
    const executor: ExecutorAgente = {
      responder: (_l, sinal) => new Promise((_ok, falha) => { sinal.addEventListener('abort', () => { abortado = true; falha(new Error('abortado')); }); })
    };
    const r = await rodarCicloHarness({ banco, executor, batidaMs: 5 });
    expect(abortado).toBe(true);
    expect(chamadas.some(c => c.fn === 'terminar')).toBe(false);
    expect(r).toMatchObject({ respondidos: 0, falhas: 0 });
  });

  it('dois lotes (agentes diferentes) rodam ao mesmo tempo', async () => {
    const { banco } = bancoFalso([lote('a'), { ...lote('b'), agente: 'marketing' }]);
    let simultaneos = 0, maximo = 0;
    const executor: ExecutorAgente = { responder: async () => { simultaneos++; maximo = Math.max(maximo, simultaneos); await espera(20); simultaneos--; return 'ok'; } };
    const r = await rodarCicloHarness({ banco, executor });
    expect(r.respondidos).toBe(2);
    expect(maximo).toBe(2);
  });

  it('falha ao devolver o lote não derruba o ciclo (o recolhimento por falta de batida cuida dele)', async () => {
    const { banco } = bancoFalso([lote()], { terminar: async () => { throw new Error('rede'); } });
    const r = await rodarCicloHarness({ banco, executor: { responder: async () => { throw new Error('x'); } } });
    expect(r.falhas).toBe(1);
  });
});

describe('bancoHarnessViaApi (fetch falso)', () => {
  it('chama as funções certas com a chave de serviço no cabeçalho', async () => {
    const chamadas: Array<{ url: string; h: Record<string, string>; corpo: any }> = [];
    const f = (async (url: string, init: RequestInit) => {
      chamadas.push({ url, h: init.headers as Record<string, string>, corpo: JSON.parse(init.body as string) });
      return { ok: true, status: 200, json: async () => (url.endsWith('heartbeat') ? true : url.endsWith('reap') ? 2 : []) };
    }) as unknown as typeof fetch;
    const b = bancoHarnessViaApi('http://rest:3000/', 'chave-servico', f);
    expect(await b.recolher(90)).toBe(2);
    await b.pegar({ silencioS: 1, limite: 2 });
    expect(await b.batida('r1')).toBe(true);
    await b.terminar('r1', { ok: false, erro: 'x' });
    expect(chamadas.map(c => c.url)).toEqual([
      'http://rest:3000/rpc/agent_harness_reap', 'http://rest:3000/rpc/agent_harness_claim',
      'http://rest:3000/rpc/agent_harness_heartbeat', 'http://rest:3000/rpc/agent_harness_finish'
    ]);
    expect(chamadas[1].corpo).toEqual({ p_quiet_seconds: 1, p_max_wait_seconds: 15, p_deadline_seconds: 300, p_limit: 2, p_only: null });
    expect(chamadas[3].corpo).toEqual({ p_run_id: 'r1', p_ok: false, p_reply: null, p_error: 'x' });
    expect(chamadas.every(c => c.h.apikey === 'chave-servico' && c.h.Authorization === 'Bearer chave-servico')).toBe(true);
  });
  it('erro do banco vira exceção com o nome da função (sem o corpo)', async () => {
    const f = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(bancoHarnessViaApi('http://x', 'k', f).recolher(90)).rejects.toThrow('banco recusou agent_harness_reap: HTTP 401');
  });
});

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';

describe.skipIf(!bancoLocalNoAr)('harness com o banco local', () => {
  const admin = adminLocal();
  const slug = 'harness-integracao';
  let canalId = '';
  let inicio = '';
  let carteira: Record<string, unknown> | null = null;

  beforeAll(async () => {
    // O pedido gasta créditos de verdade no banco local: guarda a carteira e o extrato para devolver como estavam.
    inicio = new Date().toISOString();
    carteira = (await admin.from('credit_wallets').select('allowance_balance, topup_balance, reserved_balance, monthly_consumed').eq('workspace_id', EVOLUT).single()).data;
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const { data } = await aline.rpc('chat_create_channel', { p_workspace_id: EVOLUT, p_member_id: ALINE, p_nome: 'Harness integração', p_descricao: 'x', p_pessoas: [CAMILA], p_agentes: ['comercial'] });
    expect(data.ok).toBe(true);
    canalId = (await admin.from('chat_channels').select('id').eq('workspace_id', EVOLUT).eq('slug', slug).single()).data!.id;
    // Sobras de outros testes (pedidos a agentes que ficaram na fila) não podem ser respondidas por este.
    await admin.from('agent_channel_queue').update({ status: 'dead', last_error: 'limpeza do teste do harness' }).eq('status', 'pending').neq('channel_id', canalId);
  });

  afterAll(async () => {
    const { data } = await admin.from('agent_channel_queue').select('execution_id').eq('channel_id', canalId);
    await admin.from('chat_channels').delete().eq('id', canalId);
    await admin.from('credit_transactions').delete().eq('workspace_id', EVOLUT).gte('created_at', inicio);
    if (carteira) await admin.from('credit_wallets').update(carteira).eq('workspace_id', EVOLUT);
    const ids = (data || []).map(d => d.execution_id).filter(Boolean);
    if (ids.length) await admin.from('executions').delete().in('id', ids);
  });

  it('pedido no canal vira lote, o executor responde, e a resposta aparece no canal', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const { data } = await aline.rpc('chat_send', { p_workspace_id: EVOLUT, p_member_id: ALINE, p_slug: slug, p_texto: '@Zoe, quantas contas quentes?', p_resposta: null, p_agente: 'comercial' });
    expect(data.ok).toBe(true);

    const recebidos: LoteHarness[] = [];
    const banco = bancoHarnessViaApi(`${URL_LOCAL}/rest/v1`, SERVICE_LOCAL);
    const r = await rodarCicloHarness({
      banco, pegar: { silencioS: 0, esperaMaximaS: 0 },
      executor: { responder: async l => { recebidos.push(l); return 'Há 3 contas quentes.'; } }
    });
    const meu = recebidos.filter(l => l.channel_id === canalId);
    expect(r.respondidos).toBeGreaterThanOrEqual(1);
    expect(meu).toHaveLength(1);
    expect(meu[0].mensagens.map(m => m.texto)).toEqual(['@Zoe, quantas contas quentes?']);
    expect(meu[0].workspace_id).toBe(EVOLUT);

    const { data: msgs } = await admin.from('chat_messages').select('sender_type, sender_agent_id, content').eq('channel_id', canalId).eq('sender_type', 'agent');
    expect(msgs).toEqual([{ sender_type: 'agent', sender_agent_id: 'comercial', content: 'Há 3 contas quentes.' }]);
    const { data: fila } = await admin.from('agent_channel_queue').select('status').eq('channel_id', canalId);
    expect(fila).toEqual([{ status: 'done' }]);
  });
});
