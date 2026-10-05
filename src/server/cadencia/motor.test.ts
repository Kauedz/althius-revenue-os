// Testes do ciclo do motor de cadência. Banco e provedor falsos: nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import { rodarCiclo, type BancoCadencia, type Mensageiro, type Preparo, type ResultadoEnvio } from './motor';

const ENVIO: Extract<Preparo, { action: 'send' }> = {
  action: 'send', execution_id: 'x1', channel: 'email', recipient: 'contato@empresa.com.br', subject: 'Oi', body: 'Texto secreto', unipile_account_id: 'conta-1', idempotency_key: 'i:1:a1'
};

function bancoFalso(preparos: Record<string, Preparo | Error>, vencidos = Object.keys(preparos)) {
  const concluidos: Array<unknown[]> = [];
  const pedidos: Array<[number, boolean]> = [];
  const banco: BancoCadencia = {
    async buscarVencidos(limite, incluirAuto) { pedidos.push([limite, incluirAuto]); return vencidos.map(id => ({ enrollment_id: id, step_number: 1 })); },
    async preparar(id) { const p = preparos[id]; if (p instanceof Error) throw p; return p; },
    async concluir(...args) { concluidos.push(args); return { action: 'ok' }; }
  };
  return { banco, concluidos, pedidos };
}
const mensageiro = (r: ResultadoEnvio | (() => ResultadoEnvio)) => {
  const enviados: unknown[] = [];
  const m: Mensageiro = { async enviar(p) { enviados.push(p); return typeof r === 'function' ? r() : r; } };
  return { m, enviados };
};
const mudo = () => {};

describe('rodarCiclo', () => {
  it('envio feito: manda pela conta do dono e conclui com os ids do provedor', async () => {
    const { banco, concluidos } = bancoFalso({ a: ENVIO });
    const { m, enviados } = mensageiro({ ok: true, mensagemId: 'm-9', chatId: 'c-9' });
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r).toMatchObject({ vistos: 1, enviados: 1 });
    expect(enviados).toEqual([{ contaExterna: 'conta-1', canal: 'email', destinatario: 'contato@empresa.com.br', assunto: 'Oi', texto: 'Texto secreto', chaveIdempotencia: 'i:1:a1' }]);
    expect(concluidos).toEqual([['x1', true, 'm-9', null, 'c-9']]);
  });

  it('passo manual vira tarefa e não envia nada', async () => {
    const { banco, concluidos } = bancoFalso({ a: { action: 'task_created', task_id: 't1' } });
    const { m, enviados } = mensageiro({ ok: true, mensagemId: null, chatId: null });
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r).toMatchObject({ tarefas: 1, enviados: 0 });
    expect(enviados).toEqual([]);
    expect(concluidos).toEqual([]);
  });

  it('bloqueado (agente pausado, falta de crédito...) e em andamento: não envia', async () => {
    const { banco, concluidos } = bancoFalso({ a: { action: 'blocked', reason: 'agent_paused' }, b: { action: 'in_flight' }, c: { action: 'skip', reason: 'x' } });
    const { m, enviados } = mensageiro({ ok: true, mensagemId: null, chatId: null });
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r).toMatchObject({ vistos: 3, bloqueados: 1, enviados: 0 });
    expect(enviados).toEqual([]);
    expect(concluidos).toEqual([]);
  });

  it('provedor recusa (4xx): conclui como falha para liberar a reserva', async () => {
    const { banco, concluidos } = bancoFalso({ a: ENVIO });
    const { m } = mensageiro({ ok: false, erro: 'HTTP 422', definitivo: true });
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r.falhas).toBe(1);
    expect(concluidos).toEqual([['x1', false, null, 'HTTP 422', null]]);
  });

  it('resultado incerto (5xx, rede): NÃO conclui nem reenvia; vira alerta', async () => {
    const { banco, concluidos } = bancoFalso({ a: ENVIO });
    const logs: Array<Record<string, unknown>> = [];
    const { m, enviados } = mensageiro({ ok: false, erro: 'HTTP 503', definitivo: false });
    const r = await rodarCiclo({ banco, mensageiro: m, log: l => logs.push(l) });
    expect(r.incertos).toBe(1);
    expect(concluidos).toEqual([]);
    expect(enviados).toHaveLength(1);
    expect(logs.some(l => l.msg === 'cadencia_envio_incerto' && l.nivel === 'erro')).toBe(true);
  });

  it('o provedor lançar exceção também é incerto (pode ter saído)', async () => {
    const { banco, concluidos } = bancoFalso({ a: ENVIO });
    const m: Mensageiro = { async enviar() { throw new Error('socket hang up'); } };
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r.incertos).toBe(1);
    expect(concluidos).toEqual([]);
  });

  it('enviou mas o registro falhou: não reenvia e alerta', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const banco: BancoCadencia = {
      async buscarVencidos() { return [{ enrollment_id: 'a', step_number: 1 }]; },
      async preparar() { return ENVIO; },
      async concluir() { throw new Error('banco fora'); }
    };
    const { m, enviados } = mensageiro({ ok: true, mensagemId: 'm', chatId: 'c' });
    const r = await rodarCiclo({ banco, mensageiro: m, log: l => logs.push(l) });
    expect(r).toMatchObject({ enviados: 0, erros: 1 });
    expect(enviados).toHaveLength(1);
    expect(logs.some(l => l.msg === 'cadencia_enviada_sem_registro')).toBe(true);
  });

  it('sem provedor configurado: só pede passos que viram tarefa e nunca envia', async () => {
    const { banco, pedidos } = bancoFalso({ a: { action: 'task_created', task_id: 't' } });
    const r = await rodarCiclo({ banco, mensageiro: null, log: mudo });
    expect(pedidos).toEqual([[20, false]]);
    expect(r.tarefas).toBe(1);
  });

  it('um passo com erro não derruba os outros', async () => {
    const { banco } = bancoFalso({ a: new Error('boom'), b: ENVIO });
    const { m } = mensageiro({ ok: true, mensagemId: null, chatId: null });
    const r = await rodarCiclo({ banco, mensageiro: m, log: mudo });
    expect(r).toMatchObject({ vistos: 2, erros: 1, enviados: 1 });
  });

  it('o log nunca carrega destinatário nem texto', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const { banco } = bancoFalso({ a: ENVIO, b: ENVIO });
    const { m } = mensageiro(() => ({ ok: false, erro: 'HTTP 422', definitivo: true }));
    await rodarCiclo({ banco, mensageiro: m, log: l => logs.push(l) });
    const tudo = JSON.stringify(logs);
    expect(tudo).not.toContain('contato@empresa.com.br');
    expect(tudo).not.toContain('Texto secreto');
  });

  it('respeita o limite pedido ao banco', async () => {
    const { banco, pedidos } = bancoFalso({});
    await rodarCiclo({ banco, mensageiro: null, limite: 5, log: mudo });
    expect(pedidos).toEqual([[5, false]]);
  });
});
