// Testes do servidor HTTP do webhook: porta real em 127.0.0.1, banco falso. Nenhuma API externa.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { criarServidor } from './servidor';
import { assinarCorpo, type Banco } from './unipile';

const SEGREDO = 'segredo-de-teste-123';
const evento = (type: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id: 'ev1', type, account_id: 'acc1', ...extra, payload });
const msg = evento('message.new', { id: 'm1', chat_id: 'c1', text: 'Texto secreto do contato', is_sender: false, sender_id: '5511900000001@s.whatsapp.net' }, { account_provider: 'whatsapp' });
/** cabeçalho de assinatura como a Unipile manda: t=<segundos>,v0=<hex do HMAC de "<t>.<corpo>"> */
const assinado = (corpo: string, segredo = SEGREDO, t = String(Math.floor(Date.now() / 1000))) => ({ 'Unipile-Signature': `t=${t},v0=${assinarCorpo(corpo, t, segredo)}` });

let abertos: Array<() => Promise<void>> = [];
afterEach(async () => { for (const f of abertos) await f(); abertos = []; });

async function subir(banco: Partial<Banco> = {}, extra: { limiteBytes?: number; tentativas?: number } = {}) {
  const logs: Array<Record<string, unknown>> = [];
  const completo: Banco = {
    ingerirMensagem: async () => ({ action: 'persisted' }),
    definirStatus: async () => ({ action: 'updated' }),
    novaRelacao: async () => ({ action: 'connected' }),
    concluirConexao: async () => ({ action: 'connected' }),
    ...banco
  };
  const { servidor, ocioso } = criarServidor({ segredo: SEGREDO, banco: completo, log: l => logs.push(l), esperaMs: 1, ...extra });
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const enviar = (corpo: unknown, cabecalhos?: Record<string, string>, caminho = '/webhooks/unipile') => {
    const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    return fetch(url + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cabecalhos ?? assinado(texto)) }, body: texto });
  };
  return { url, enviar, ocioso, logs };
}

describe('servidor do webhook da Unipile', () => {
  it('assinatura errada, ausente, de aviso antigo ou de corpo alterado: 401 e nada vai ao banco', async () => {
    let chamou = 0;
    const s = await subir({ ingerirMensagem: async () => { chamou++; return { action: 'persisted' }; } });
    const texto = JSON.stringify(msg);
    expect((await s.enviar(msg, assinado(texto, 'segredo-errado'))).status).toBe(401);
    expect((await s.enviar(msg, {})).status).toBe(401);
    expect((await s.enviar(msg, assinado(texto, SEGREDO, String(Math.floor(Date.now() / 1000) - 3600)))).status).toBe(401);
    expect((await s.enviar(JSON.stringify({ ...msg, id: 'outro' }), assinado(texto))).status).toBe(401);
    await s.ocioso();
    expect(chamou).toBe(0);
  });

  it('mensagem válida: 200 na hora, mesmo com o banco lento, e grava depois', async () => {
    let liberar!: () => void;
    const trava = new Promise<void>(r => (liberar = r));
    const gravadas: string[] = [];
    const s = await subir({ ingerirMensagem: async p => { await trava; gravadas.push(p.mensagemId); return { action: 'persisted' }; } });
    const r = await s.enviar(msg);
    expect(r.status).toBe(200);
    expect(gravadas).toEqual([]); // respondeu antes de o banco terminar
    liberar();
    await s.ocioso();
    expect(gravadas).toEqual(['acc1:m1']);
  });

  it('mesma mensagem duas vezes: o banco recebe as duas e decide (idempotência é do banco)', async () => {
    const ids: string[] = [];
    const s = await subir({ ingerirMensagem: async p => { ids.push(p.mensagemId); return ids.length === 1 ? { action: 'persisted' } : { action: 'persisted', idempotent_replay: true }; } });
    await s.enviar(msg); await s.enviar(msg); await s.ocioso();
    expect(ids).toEqual(['acc1:m1', 'acc1:m1']);
  });

  it('grupo e mensagem própria não chegam ao banco', async () => {
    let chamou = 0;
    const s = await subir({ ingerirMensagem: async () => { chamou++; return { action: 'persisted' }; } });
    await s.enviar({ ...msg, payload: { ...msg.payload, is_group: true } }); await s.enviar({ ...msg, payload: { ...msg.payload, is_sender: true } }); await s.ocioso();
    expect(chamou).toBe(0);
  });

  it('evento de status e de relação chegam às funções certas', async () => {
    const vistos: string[] = [];
    const s = await subir({ definirStatus: async (c, st) => { vistos.push(`status:${c}:${st}`); return { action: 'updated' }; }, novaRelacao: async (c, i) => { vistos.push(`relacao:${c}:${i}`); return { action: 'connected' }; } });
    await s.enviar(evento('account.status.disconnected', {}));
    await s.enviar(evento('relation.new', { public_identifier: 'fulano' }, { account_id: 'acc2' }));
    await s.ocioso();
    expect(vistos).toEqual(['status:acc1:attention', 'relacao:acc2:fulano']);
  });

  it('banco fora do ar: responde 200, tenta de novo e na terceira desiste com erro no log', async () => {
    let tentativas = 0;
    const s = await subir({ ingerirMensagem: async () => { tentativas++; throw new Error('banco fora'); } });
    expect((await s.enviar(msg)).status).toBe(200);
    await s.ocioso();
    expect(tentativas).toBe(3);
    expect(s.logs.filter(l => l.nivel === 'erro')).toHaveLength(1);
  });

  it('falha passageira: a segunda tentativa grava', async () => {
    let n = 0;
    const s = await subir({ ingerirMensagem: async () => { if (++n === 1) throw new Error('piscou'); return { action: 'persisted' }; } });
    await s.enviar(msg); await s.ocioso();
    expect(n).toBe(2);
    expect(s.logs.some(l => l.nivel === 'erro')).toBe(false);
  });

  it('log nunca contém texto nem remetente (privacidade só-CRM)', async () => {
    const s = await subir({ ingerirMensagem: async () => { throw new Error('banco recusou unipile_ingest_message: HTTP 500'); } });
    await s.enviar(msg); await s.ocioso();
    const tudo = JSON.stringify(s.logs);
    expect(tudo).not.toContain('Texto secreto');
    expect(tudo).not.toContain('5511900000001');
  });

  it('JSON inválido: 400. Corpo grande demais: 413. Rota e método errados: 404 e 405', async () => {
    const s = await subir({}, { limiteBytes: 200 });
    expect((await s.enviar('{nao e json')).status).toBe(400); // assinado certo, mas não é JSON
    expect((await s.enviar({ lixo: 'x'.repeat(500) })).status).toBe(413);
    expect((await s.enviar(msg, undefined, '/outra')).status).toBe(404);
    expect((await fetch(s.url + '/webhooks/unipile')).status).toBe(405);
  });

  it('/saude responde sem segredo', async () => {
    const s = await subir();
    const r = await fetch(s.url + '/saude');
    expect(r.status).toBe(200);
  });
});
