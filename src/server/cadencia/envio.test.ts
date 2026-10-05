// Testes do envio real (e-mail e WhatsApp) com `fetch` falso. Nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import { mensageiroViaApi, whatsappId } from './envio';

const DSN = 'https://api-falsa.exemplo.test:1111';
const pedido = { contaExterna: 'acc-1', destinatario: 'a@b.com', assunto: 'Oi', texto: 'Olá', chaveIdempotencia: 'k' };

function fetchFalso(status: number, corpo: unknown = {}) {
  const chamadas: Array<{ url: string; headers: Record<string, string>; corpo: any }> = [];
  const f = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, headers: init.headers as Record<string, string>, corpo: JSON.parse(init.body as string) });
    return { ok: status < 300, status, json: async () => corpo };
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

describe('whatsappId', () => {
  it('completa número brasileiro de 10 ou 11 dígitos com 55', () => {
    expect(whatsappId('(11) 90000-0001')).toBe('5511900000001@s.whatsapp.net');
    expect(whatsappId('1130000001')).toBe('551130000001@s.whatsapp.net');
  });
  it('não mexe em número que já tem código do país', () => {
    expect(whatsappId('5511900000001')).toBe('5511900000001@s.whatsapp.net');
    expect(whatsappId('351912345678')).toBe('351912345678@s.whatsapp.net');
  });
  it('LIMITAÇÃO CONHECIDA: número estrangeiro de 10 ou 11 dígitos (ex.: EUA) é tratado como brasileiro', () => {
    // Só pelos dígitos não dá para distinguir. O produto é brasileiro; contatos de fora precisam do código do país com 12+ dígitos.
    expect(whatsappId('14155550100')).toBe('5514155550100@s.whatsapp.net');
  });
});

describe('mensageiroViaApi', () => {
  it('e-mail: assunto e corpo pela conta de e-mail, com a chave só no cabeçalho', async () => {
    const { f, chamadas } = fetchFalso(200, { tracking_id: 'trk-1', thread_id: 'th-1' });
    const r = await mensageiroViaApi({ dsn: DSN, apiKey: 'chave-x' }, f).enviar({ ...pedido, canal: 'email' });
    expect(r).toEqual({ ok: true, mensagemId: 'trk-1', chatId: 'th-1' });
    expect(chamadas[0].url).toBe(`${DSN}/api/v1/emails`);
    expect(chamadas[0].headers['X-API-KEY']).toBe('chave-x');
    expect(chamadas[0].corpo).toEqual({ account_id: 'acc-1', to: [{ identifier: 'a@b.com' }], subject: 'Oi', body: 'Olá' });
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain('chave-x');
  });
  it('WhatsApp: conversa nova com o número no formato do provedor', async () => {
    const { f, chamadas } = fetchFalso(201, { chat_id: 'chat-7', message_id: 'm-7' });
    const r = await mensageiroViaApi({ dsn: DSN, apiKey: 'k' }, f).enviar({ ...pedido, canal: 'whatsapp', destinatario: '11900000001', assunto: null });
    expect(r).toEqual({ ok: true, mensagemId: 'm-7', chatId: 'chat-7' });
    expect(chamadas[0].url).toBe(`${DSN}/api/v1/chats`);
    expect(chamadas[0].corpo).toEqual({ account_id: 'acc-1', attendees_ids: ['5511900000001@s.whatsapp.net'], text: 'Olá' });
  });
  it('sucesso sem ids no corpo continua sucesso', async () => {
    const r = await mensageiroViaApi({ dsn: DSN, apiKey: 'k' }, fetchFalso(200, {}).f).enviar({ ...pedido, canal: 'email' });
    expect(r).toEqual({ ok: true, mensagemId: null, chatId: null });
  });
  it('4xx é recusa definitiva (nada saiu); 408, 429 e 5xx são incertos', async () => {
    const com = async (s: number) => mensageiroViaApi({ dsn: DSN, apiKey: 'k' }, fetchFalso(s).f).enviar({ ...pedido, canal: 'email' });
    expect(await com(422)).toEqual({ ok: false, erro: 'HTTP 422', definitivo: true });
    expect(await com(401)).toMatchObject({ definitivo: true });
    expect(await com(408)).toMatchObject({ definitivo: false });
    expect(await com(429)).toMatchObject({ definitivo: false });
    expect(await com(500)).toMatchObject({ definitivo: false });
    expect(await com(503)).toMatchObject({ definitivo: false });
  });
  it('rede fora do ar é incerto', async () => {
    const f = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    expect(await mensageiroViaApi({ dsn: DSN, apiKey: 'k' }, f).enviar({ ...pedido, canal: 'email' })).toEqual({ ok: false, erro: 'ECONNRESET', definitivo: false });
  });
});
