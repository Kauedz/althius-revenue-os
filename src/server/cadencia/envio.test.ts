// Testes do envio real (e-mail e WhatsApp) com `fetch` falso. Nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import { CAMPO_USUARIOS_DO_CHAT, mensageiroViaApi, whatsappId } from './envio';

const URL = 'https://api-falsa.exemplo.test';
const cfg = (apiKey = 'k') => () => ({ apiKey, url: URL });
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
  it('e-mail (v2): rota da conta, campos do protótipo e a chave só no cabeçalho', async () => {
    const { f, chamadas } = fetchFalso(200, { object: 'EmailSent', id: 'em-1', message_id: '<abc@x>' });
    const r = await mensageiroViaApi(cfg('chave-x'), f).enviar({ ...pedido, canal: 'email' });
    expect(r).toEqual({ ok: true, mensagemId: '<abc@x>', chatId: null });
    expect(chamadas[0].url).toBe(`${URL}/v2/acc-1/emails/send`);
    expect(chamadas[0].headers['X-API-KEY']).toBe('chave-x');
    expect(chamadas[0].corpo).toEqual({ to: [{ email: 'a@b.com' }], subject: 'Oi', plain_text: 'Olá', custom_headers: [{ name: 'X-Althius-Envio', value: 'k' }] });
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain('chave-x');
  });
  it('WhatsApp: conversa nova com o número no formato do provedor', async () => {
    const { f, chamadas } = fetchFalso(201, { chat_id: 'chat-7', message_id: 'm-7' });
    const r = await mensageiroViaApi(cfg(), f).enviar({ ...pedido, canal: 'whatsapp', destinatario: '11900000001', assunto: null });
    expect(r).toEqual({ ok: true, mensagemId: 'm-7', chatId: 'chat-7' });
    expect(chamadas[0].url).toBe(`${URL}/v2/acc-1/chats/send`);
    expect(chamadas[0].corpo).toEqual({ [CAMPO_USUARIOS_DO_CHAT]: ['5511900000001@s.whatsapp.net'], text: 'Olá' });
  });
  it('trocar a chave vale no próximo envio, sem recriar o mensageiro', async () => {
    const { f, chamadas } = fetchFalso(200, { id: 'x' });
    let chave = 'antiga';
    const m = mensageiroViaApi(() => ({ apiKey: chave, url: URL }), f);
    await m.enviar({ ...pedido, canal: 'email' });
    chave = 'nova';
    await m.enviar({ ...pedido, canal: 'email' });
    expect(chamadas.map(c => c.headers['X-API-KEY'])).toEqual(['antiga', 'nova']);
  });
  it('sem chave: recusa clara e nenhuma chamada (nunca simula sucesso)', async () => {
    const { f, chamadas } = fetchFalso(200);
    const r = await mensageiroViaApi(cfg(''), f).enviar({ ...pedido, canal: 'email' });
    expect(r).toMatchObject({ ok: false, definitivo: true });
    expect(chamadas).toHaveLength(0);
  });
  it('sucesso sem ids no corpo continua sucesso', async () => {
    const r = await mensageiroViaApi(cfg(), fetchFalso(200, {}).f).enviar({ ...pedido, canal: 'email' });
    expect(r).toEqual({ ok: true, mensagemId: null, chatId: null });
  });
  it('4xx é recusa definitiva (nada saiu); 408, 429 e 5xx são incertos', async () => {
    const com = async (s: number) => mensageiroViaApi(cfg(), fetchFalso(s).f).enviar({ ...pedido, canal: 'email' });
    expect(await com(422)).toEqual({ ok: false, erro: 'HTTP 422', definitivo: true });
    expect(await com(401)).toMatchObject({ definitivo: true });
    expect(await com(408)).toMatchObject({ definitivo: false });
    expect(await com(429)).toMatchObject({ definitivo: false });
    expect(await com(500)).toMatchObject({ definitivo: false });
    expect(await com(503)).toMatchObject({ definitivo: false });
  });
  it('rede fora do ar é incerto', async () => {
    const f = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    expect(await mensageiroViaApi(cfg(), f).enviar({ ...pedido, canal: 'email' })).toEqual({ ok: false, erro: 'ECONNRESET', definitivo: false });
  });
});
