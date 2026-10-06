// @vitest-environment node
// O executor contra um "Hermes" falso (servidor HTTP de verdade, na porta 0): nenhuma API real.
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { executorHermes } from './hermes';
import type { LoteHarness } from './harness';

const lote: LoteHarness = {
  run_id: 'r', workspace_id: 'a0000000-0000-0000-0000-000000000001', channel_id: 'c', canal: 'vendas', agente: 'comercial', tentativa: 1,
  mensagens: [{ id: 'm', autor_id: 'u', autor: 'Aline Xavier', papel: 'clevel', texto: 'Quais contas estão quentes?', em: 'x' }], contexto: []
};

let servidor: Server | null = null;
afterEach(async () => { if (servidor) await new Promise<void>(r => servidor!.close(() => r())); servidor = null; });

async function hermesFalso(resposta: (req: { url: string; auth: string | undefined; corpo: any }) => { status?: number; corpo?: unknown; bruto?: string; demora?: number }) {
  const vistos: Array<{ url: string; auth: string | undefined; corpo: any }> = [];
  servidor = createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const v = { url: req.url ?? '', auth: req.headers.authorization, corpo: b ? JSON.parse(b) : null };
      vistos.push(v);
      const r = resposta(v);
      setTimeout(() => {
        res.writeHead(r.status ?? 200, { 'Content-Type': 'application/json' });
        res.end(r.bruto ?? JSON.stringify(r.corpo ?? {}));
      }, r.demora ?? 0);
    });
  });
  await new Promise<void>(r => servidor!.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(servidor!.address() as AddressInfo).port}`, vistos };
}
const ok = (texto: string) => ({ corpo: { choices: [{ index: 0, message: { role: 'assistant', content: texto }, finish_reason: 'stop' }] } });
const resolverPara = (url: string) => () => ({ url, chave: 'chave-secreta-do-hermes', modelo: 'comercial' });

describe('executorHermes', () => {
  it('entrega o lote ao Hermes (rota, chave e corpo certos) e devolve o texto da resposta', async () => {
    const h = await hermesFalso(() => ok('Há 3 contas quentes.'));
    const e = executorHermes({ resolver: resolverPara(h.url + '/p/comercial') });
    expect(await e.responder(lote, new AbortController().signal)).toBe('Há 3 contas quentes.');
    expect(h.vistos[0].url).toBe('/p/comercial/v1/chat/completions');
    expect(h.vistos[0].auth).toBe('Bearer chave-secreta-do-hermes');
    expect(h.vistos[0].corpo).toMatchObject({ model: 'comercial', stream: false });
    expect(h.vistos[0].corpo.messages.map((m: any) => m.role)).toEqual(['system', 'user']);
    expect(h.vistos[0].corpo.messages[1].content).toContain('[Aline Xavier · C-level] Quais contas estão quentes?');
    expect(JSON.stringify(h.vistos[0].corpo)).not.toContain('chave-secreta-do-hermes');
  });

  it('Hermes sem login do modelo (Codex): vira erro com a instrução, nunca resposta do agente no canal (ADR 0051)', async () => {
    const h = await hermesFalso(() => ok('Provider authentication failed: No Codex credentials stored. Run hermes auth add openai-codex.'));
    const e = executorHermes({ resolver: resolverPara(h.url) });
    await expect(e.responder(lote, new AbortController().signal)).rejects.toThrow('sem login do modelo');
  });

  it('resposta grande demais é cortada para caber no banco', async () => {
    const h = await hermesFalso(() => ok('x'.repeat(9000)));
    const t = await executorHermes({ resolver: resolverPara(h.url) }).responder(lote, new AbortController().signal);
    expect(t.length).toBeLessThanOrEqual(4000);
  });

  it('sem executor registrado para o agente: erro claro e nenhuma chamada', async () => {
    const h = await hermesFalso(() => ok('x'));
    await expect(executorHermes({ resolver: () => null }).responder(lote, new AbortController().signal)).rejects.toThrow('sem executor registrado');
    expect(h.vistos).toHaveLength(0);
  });

  it.each([[401, 'o executor respondeu HTTP 401'], [500, 'o executor respondeu HTTP 500']])('HTTP %i vira erro curto, sem a chave nem o corpo', async (status, msg) => {
    const h = await hermesFalso(() => ({ status, corpo: { error: 'detalhe interno com chave-secreta-do-hermes' } }));
    const falha = await executorHermes({ resolver: resolverPara(h.url) }).responder(lote, new AbortController().signal).catch(e => e as Error);
    expect((falha as Error).message).toBe(msg);
    expect((falha as Error).message).not.toContain('chave-secreta');
  });

  it('resposta vazia, sem choices ou ilegível: erro (o lote volta para a fila)', async () => {
    for (const r of [ok('   '), { corpo: { choices: [] } }, { corpo: { choices: [{ message: { content: null } }] } }, { bruto: 'não é json' }]) {
      const h = await hermesFalso(() => r);
      await expect(executorHermes({ resolver: resolverPara(h.url) }).responder(lote, new AbortController().signal)).rejects.toThrow(/vazia|ilegível/);
      await new Promise<void>(res => servidor!.close(() => res())); servidor = null;
    }
  });

  it('rede fora do ar e demora demais viram erros distintos', async () => {
    await expect(executorHermes({ resolver: resolverPara('http://127.0.0.1:1') }).responder(lote, new AbortController().signal)).rejects.toThrow('não respondeu (rede)');
    const h = await hermesFalso(() => ({ ...ok('tarde'), demora: 300 }));
    await expect(executorHermes({ resolver: resolverPara(h.url), limiteMs: 50 }).responder(lote, new AbortController().signal)).rejects.toThrow('demorou demais');
  });

  it('o sinal de parada (lote recolhido) interrompe a chamada', async () => {
    const h = await hermesFalso(() => ({ ...ok('tarde'), demora: 2000 }));
    const c = new AbortController();
    const p = executorHermes({ resolver: resolverPara(h.url) }).responder(lote, c.signal);
    setTimeout(() => c.abort(), 30);
    await expect(p).rejects.toThrow();
  });
});
