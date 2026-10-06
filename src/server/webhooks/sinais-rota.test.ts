// Rota interna do teste de fonte (ADR 0060): fica debaixo de /integracoes/agente/ (o Caddy público responde 404 ali),
// exige o token do agente antes de ler o corpo e só repassa à função. Porta real em 127.0.0.1; nada externo.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { criarServidor, type OpcoesServidor } from './servidor';

let abertos: Array<() => Promise<void>> = [];
afterEach(async () => { for (const f of abertos) await f(); abertos = []; });

async function subir(sinaisDoAgente?: OpcoesServidor['sinaisDoAgente']) {
  const banco = { ingerirMensagem: async () => ({ action: 'persisted' }), definirStatus: async () => ({ action: 'updated' }), novaRelacao: async () => ({ action: 'connected' }), concluirConexao: async () => ({ action: 'connected' }) };
  const { servidor } = criarServidor({ segredo: 's', banco: banco as never, log: () => undefined, sinaisDoAgente });
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}
const post = (url: string, corpo: unknown, token?: string) =>
  fetch(url + '/integracoes/agente/sinais/testar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) });

describe('rota do teste de fonte do agente', () => {
  it('sem token 401; desligada 503; com token repassa token e corpo', async () => {
    const vistos: unknown[] = [];
    const url = await subir({ testar: async (token, corpo) => { vistos.push([token, corpo]); return { status: 200, corpo: { ok: true } }; } });
    expect((await post(url, {})).status).toBe(401);
    const r = await post(url, { sinal: 'x' }, 'alt_agente_lia');
    expect(r.status).toBe(200);
    expect(vistos).toEqual([['alt_agente_lia', { sinal: 'x' }]]);
    expect((await fetch(url + '/integracoes/agente/sinais/testar')).status).toBe(405);
    expect((await post(await subir(), {}, 'alt_agente_lia')).status).toBe(503);
  });
});
