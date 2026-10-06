// @vitest-environment node
// Camada de execução das ferramentas (ADR 0061): política, laço, prazo, nova tentativa só em leitura, corte da saída,
// erros tipados e um evento por chamada sem argumentos nem conteúdo. Nada de banco nem de rede.
import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { ErroDeFerramenta, POLITICA_DAS_FERRAMENTAS, cortarTexto, criarExecutor, espera, falhaTipada, tipoDoErro, type EventoDeFerramenta } from './execucao.ts';
import { criarServidorAlthius } from './althius.ts';
import { ferramentasDoAgente } from './ferramentas.ts';

const ok = (texto: string): CallToolResult => ({ content: [{ type: 'text', text: texto }] });
const textoDe = (r: CallToolResult) => (r.content ?? []).map(p => (p.type === 'text' ? p.text : '')).join('');
const politica = { ler: { tipo: 'leitura' as const }, propor: { tipo: 'proposta' as const }, gastar: { tipo: 'acao_externa' as const }, lento: { tipo: 'leitura' as const, prazoMs: 20 } };

function montar(extra: Partial<Parameters<typeof criarExecutor>[0]> = {}) {
  const eventos: EventoDeFerramenta[] = [];
  const esperas: number[] = [];
  let t = 1000;
  const ex = criarExecutor({ politica, registrar: e => eventos.push(e), dormir: async ms => { esperas.push(ms); }, aleatorio: () => 0.5, agora: () => (t += 7), ...extra });
  return { ex, eventos, esperas };
}

describe('camada de execução das ferramentas', () => {
  it('ferramenta sem política não roda (fecha em vez de abrir)', async () => {
    const { ex, eventos } = montar();
    let rodou = false;
    const r = await ex.envolver('nova_ferramenta', () => { rodou = true; return ok('x'); })({}, {});
    expect(rodou).toBe(false);
    expect(r.isError).toBe(true);
    expect(eventos[0]).toMatchObject({ nome: 'nova_ferramenta', resultado: 'erro', erro_tipo: 'sem_politica', tentativas: 0 });
  });

  it('leitura com falha passageira tenta de novo com espera crescente e para no sucesso', async () => {
    const { ex, eventos, esperas } = montar();
    let vezes = 0;
    const r = await ex.envolver('ler', () => { vezes++; if (vezes < 3) throw new ErroDeFerramenta('Banco fora do ar agora.', 'indisponivel'); return ok('dados'); })({}, {});
    expect(vezes).toBe(3);
    expect(textoDe(r)).toBe('dados');
    expect(esperas).toEqual([500, 1000]);
    expect(eventos[0]).toMatchObject({ resultado: 'ok', tentativas: 3, erro_tipo: null });
  });

  it('leitura desiste depois de 3 tentativas', async () => {
    const { ex, eventos } = montar();
    let vezes = 0;
    const r = await ex.envolver('ler', () => { vezes++; return falhaTipada('fora do ar', 'indisponivel'); })({}, {});
    expect(vezes).toBe(3);
    expect(r.isError).toBe(true);
    expect(eventos[0]).toMatchObject({ erro_tipo: 'indisponivel', tentativas: 3 });
  });

  it('proposta e ação externa NUNCA são repetidas sozinhas (poderiam duplicar)', async () => {
    const { ex } = montar();
    for (const nome of ['propor', 'gastar']) {
      let vezes = 0;
      await ex.envolver(nome, () => { vezes++; throw new ErroDeFerramenta('fora do ar', 'indisponivel'); })({ n: nome }, {});
      expect(vezes, nome).toBe(1);
    }
  });

  it('erro que não é passageiro não se repete; o definitivo pede para não tentar de novo', async () => {
    const { ex } = montar();
    let vezes = 0;
    const r = await ex.envolver('ler', () => { vezes++; throw new ErroDeFerramenta('Token do agente inválido ou revogado.', 'nao_autorizado'); })({}, {});
    expect(vezes).toBe(1);
    expect(textoDe(r)).toMatch(/^Token do agente inválido ou revogado\. Não tente de novo/);
  });

  it('prazo estourado vira erro claro (e não é repetido)', async () => {
    const { ex, eventos } = montar();
    let vezes = 0;
    const r = await ex.envolver('lento', () => { vezes++; return new Promise<CallToolResult>(res => setTimeout(() => res(ok('tarde')), 200)); })({}, {});
    expect(vezes).toBe(1);
    expect(textoDe(r)).toMatch(/passou de 0 s e foi interrompida/);
    expect(eventos[0].erro_tipo).toBe('tempo_esgotado');
  });

  it('a mesma chamada 5 vezes seguidas é laço: a 5ª não roda; mudar o argumento zera a conta', async () => {
    const { ex, eventos } = montar();
    let vezes = 0;
    const f = ex.envolver('ler', () => { vezes++; return ok('x'); });
    for (let i = 0; i < 4; i++) await f({ a: 1, b: 2 }, {});
    const quinta = await f({ b: 2, a: 1 }, {});
    expect(vezes).toBe(4);
    expect(quinta.isError).toBe(true);
    expect(textoDe(quinta)).toMatch(/laço/);
    expect(eventos.at(-1)!.erro_tipo).toBe('laco_detectado');
    await f({ a: 2 }, {});
    expect(vezes).toBe(5);
  });

  it('saída grande é cortada com aviso (início e fim)', async () => {
    const { ex, eventos } = montar({ limiteSaida: 100 });
    const grande = 'A'.repeat(50) + 'M'.repeat(500) + 'Z'.repeat(80);
    const r = await ex.envolver('ler', () => ok(grande))({}, {});
    const t = textoDe(r);
    expect(t.startsWith('A'.repeat(20))).toBe(true);
    expect(t.endsWith('Z'.repeat(80))).toBe(true);
    expect(t).toMatch(/caracteres omitidos/);
    expect(eventos[0].cortado).toBe(true);
  });

  it('o evento só tem nomes e números: nunca argumentos nem conteúdo', async () => {
    const { ex, eventos } = montar();
    await ex.envolver('ler', () => ok('CONTEUDO-SECRETO'))({ email: 'aline@cliente.test' }, {});
    expect(JSON.stringify(eventos)).not.toMatch(/SECRETO|aline@/);
    expect(eventos[0]).toEqual({ evento: 'ferramenta', chamada: 1, nome: 'ler', tipo: 'leitura', resultado: 'ok', erro_tipo: null, duracao_ms: 7, tentativas: 1, caracteres_saida: 16, cortado: false });
  });

  it('se registrar falhar, a ferramenta segue', async () => {
    const ex = criarExecutor({ politica, registrar: () => { throw new Error('log caiu'); } });
    expect(textoDe(await ex.envolver('ler', () => ok('ok'))({}, {}))).toBe('ok');
  });

  it('ajudas: espera com variação, corte e tipo de erro', () => {
    expect(espera(1, () => 0)).toBe(350);
    expect(espera(1, () => 1)).toBe(650);
    expect(espera(10, () => 0.5)).toBe(4000);
    expect(cortarTexto('abc', 10)).toEqual({ texto: 'abc', cortado: false });
    expect(tipoDoErro(Object.assign(new Error('x'), { transitorio: true }))).toBe('indisponivel');
    expect(tipoDoErro(new Error('x'))).toBe('inesperado');
  });
});

describe('servidor MCP da Althius com a camada de execução', () => {
  it('toda ferramenta registrada tem política, e o tipo bate com a marca de leitura', async () => {
    const servidor = criarServidorAlthius(ferramentasDoAgente({ rpc: async () => ({ data: [], error: null }) } as never, 'alt_agente_x'));
    const [c, s] = InMemoryTransport.createLinkedPair();
    await servidor.connect(s);
    const cliente = new Client({ name: 't', version: '1' });
    await cliente.connect(c);
    const { tools } = await cliente.listTools();
    expect(tools.length).toBeGreaterThan(20);
    for (const t of tools) {
      const p = POLITICA_DAS_FERRAMENTAS[t.name];
      expect(p, t.name).toBeTruthy();
      expect(t.annotations?.readOnlyHint === true, t.name).toBe(p.tipo === 'leitura');
    }
    expect(Object.keys(POLITICA_DAS_FERRAMENTAS).sort()).toEqual(tools.map(t => t.name).sort());
  });

  it('erro do banco sem resposta (rede) é repetido em leitura; com código do banco, não', async () => {
    let chamadas = 0;
    const eventos: EventoDeFerramenta[] = [];
    const banco = { rpc: async () => { chamadas++; return { data: null, error: chamadas < 2 ? { message: 'TypeError: fetch failed' } : { code: '42501', message: 'negado' } }; } } as never;
    const servidor = criarServidorAlthius(ferramentasDoAgente(banco, 'alt_agente_x'), { registrar: e => eventos.push(e), dormir: async () => undefined });
    const [c, s] = InMemoryTransport.createLinkedPair();
    await servidor.connect(s);
    const cliente = new Client({ name: 't', version: '1' });
    await cliente.connect(c);
    const r = await cliente.callTool({ name: 'listar_contas', arguments: {} });
    expect(r.isError).toBe(true);
    expect(chamadas).toBe(2);
    expect(eventos[0]).toMatchObject({ nome: 'listar_contas', erro_tipo: 'recusado', tentativas: 2 });
  });
});
