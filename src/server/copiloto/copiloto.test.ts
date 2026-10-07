// @vitest-environment node
// Copiloto (ADR 0068): banco falso e modelo falso (nenhuma chamada real). O Copiloto responde com os números que o banco
// mandou, encaminha trabalho ao agente certo e, sem modelo, grava a verdade em vez de uma resposta inventada.
import { describe, expect, it } from 'vitest';
import { rodarCopiloto } from './ciclo.ts';
import { lerResposta, montarMensagens } from './prompts.ts';
import { modeloViaGateway } from './modelo.ts';

const pergunta = (extra: Record<string, unknown> = {}) => ({
  id: 'p-1', workspace_id: 'ws-1', papel: 'estrategista', pergunta: 'Quantas contas temos?',
  numeros: { cliente: 'Evolut', contas_ativas: 9, saldo_creditos: 1000 }, historico: [{ autor: 'pessoa' as const, texto: 'oi' }, { autor: 'copiloto' as const, texto: 'Olá!' }], ...extra
});

function bancoFalso(fila: unknown[]) {
  const rpc: Array<{ nome: string; corpo: Record<string, any> }> = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    const nome = url.split('/rpc/')[1];
    rpc.push({ nome, corpo: JSON.parse(String(init?.body)) });
    if (nome === 'copilot_next') return Response.json(fila);
    return Response.json({ acao: 'ok' });
  }) as unknown as typeof fetch;
  return { buscar, rpc };
}
const base = { base: 'http://rest:3000', chaveServico: 'svc' };

describe('mensagens do Copiloto', () => {
  it('o sistema diz que não é agente, não gasta crédito, não inventa e leva os números e o histórico', () => {
    const m = montarMensagens(pergunta());
    expect(m[0].role).toBe('system');
    expect(m[0].content).toMatch(/não é um dos agentes/);
    expect(m[0].content).toMatch(/Nunca invente/);
    expect(m[0].content).toMatch(/nunca em dólar/i);
    expect(m[0].content).toMatch(/"contas_ativas":9/);
    expect(m[0].content).toMatch(/ENCAMINHAR: comercial/);
    expect(m.slice(1)).toEqual([{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'Olá!' }, { role: 'user', content: 'Quantas contas temos?' }]);
  });

  it('a linha ENCAMINHAR vira o agente e sai do texto; agente que não existe é ignorado', () => {
    expect(lerResposta('Isso é com a Zoe.\nENCAMINHAR: comercial')).toEqual({ texto: 'Isso é com a Zoe.', encaminhar: 'comercial' });
    expect(lerResposta('Vocês têm 9 contas.')).toEqual({ texto: 'Vocês têm 9 contas.', encaminhar: null });
    expect(lerResposta('Ok.\nENCAMINHAR: quinto')).toEqual({ texto: 'Ok.', encaminhar: null });
  });
});

describe('modelo pelo gateway', () => {
  const g = (status: number, corpo: unknown) => ({ conversar: async () => ({ status, tipo: 'application/json', corpo: JSON.stringify(corpo) }) });
  it('resposta do modelo', async () => {
    expect(await modeloViaGateway(g(200, { choices: [{ message: { content: 'Vocês têm 9 contas.' } }] }))('ws', [])).toEqual({ ok: true, texto: 'Vocês têm 9 contas.' });
  });
  it('sem modelo cadastrado: diz a verdade', async () => {
    expect(await modeloViaGateway(g(503, { error: { message: 'Nenhum modelo' } }))('ws', [])).toEqual({ ok: false, motivo: 'o modelo de IA não está configurado (o superadmin cadastra em Fornecedores)' });
  });
  it('nenhum modelo respondeu: diz para tentar de novo', async () => {
    expect(await modeloViaGateway(g(502, {}))('ws', [])).toEqual({ ok: false, motivo: 'nenhum modelo de IA respondeu agora; tente de novo em instantes' });
  });
});

describe('uma rodada do Copiloto', () => {
  it('responde e encaminha', async () => {
    const { buscar, rpc } = bancoFalso([pergunta({ pergunta: 'Ache clínicas em Campinas' })]);
    const modelo = async () => ({ ok: true as const, texto: 'Buscar empresas novas é com a Zoe: ela diz o custo antes.\nENCAMINHAR: comercial' });
    const r = await rodarCopiloto({ ...base, buscar, modelo });
    expect(r).toEqual({ ok: true, perguntas: 1, respondidas: 1, falhas: 0 });
    expect(rpc.find(x => x.nome === 'copilot_answer')!.corpo).toEqual({ p_id: 'p-1', p_texto: 'Buscar empresas novas é com a Zoe: ela diz o custo antes.', p_encaminhar: 'comercial' });
  });

  it('sem modelo: grava a falha com o motivo verdadeiro', async () => {
    const { buscar, rpc } = bancoFalso([pergunta()]);
    const modelo = async () => ({ ok: false as const, motivo: 'o modelo de IA não está configurado (o superadmin cadastra em Fornecedores)' });
    const r = await rodarCopiloto({ ...base, buscar, modelo });
    expect(r).toMatchObject({ respondidas: 0, falhas: 1 });
    expect(rpc.find(x => x.nome === 'copilot_fail')!.corpo).toEqual({ p_id: 'p-1', p_motivo: 'o modelo de IA não está configurado (o superadmin cadastra em Fornecedores)' });
    expect(rpc.some(x => x.nome === 'copilot_answer')).toBe(false);
  });

  it('banco fora do ar', async () => {
    const buscar = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await rodarCopiloto({ ...base, buscar, modelo: async () => ({ ok: true as const, texto: 'x' }) })).toEqual({ ok: false, erro: 'banco indisponível' });
  });
});
