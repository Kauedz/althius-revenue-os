// Integração: receptor de webhook + banco local de verdade (PostgREST). Nenhuma API externa.
// Seed: contas de mensagem da Evolut (demo-lucas-google, demo-lucas-linkedin, demo-bruna-google);
//       Aline Xavier (aline.xavier@serraazul.com.br) é contato do CRM da Evolut.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { adminLocal, bancoLocalNoAr, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';
import { bancoViaApi } from './banco';
import { assinarCorpo } from './unipile';
import { criarServidor } from './servidor';

const SEGREDO = 'segredo-integracao';
const EXTERNOS = ['demo-lucas-google:mail-int-1', 'demo-lucas-google:mail-int-2', 'demo-lucas-google:mail-int-spam'];

describe.skipIf(!bancoLocalNoAr)('webhook da Unipile com o banco local', () => {
  let enviar: (corpo: unknown, segredo?: string) => Promise<Response>;
  let ocioso: () => Promise<void>;
  let fechar: () => Promise<void>;

  const limpar = async () => {
    const adm = adminLocal();
    const { data } = await adm.from('messages').select('conversation_id').in('external_message_id', EXTERNOS);
    const conversas = [...new Set((data ?? []).map(m => m.conversation_id))];
    await adm.from('messages').delete().in('external_message_id', EXTERNOS);
    if (conversas.length) {
      await adm.from('notifications').delete().in('entity_id', conversas);
      await adm.from('conversations').delete().in('id', conversas);
    }
    await adm.from('messaging_accounts').update({ status: 'connected' }).eq('unipile_account_id', 'demo-bruna-google');
  };

  beforeEach(async () => {
    await limpar();
    const { servidor, ocioso: o } = criarServidor({ segredo: SEGREDO, banco: bancoViaApi(`${URL_LOCAL}/rest/v1`, SERVICE_LOCAL), log: () => {}, esperaMs: 1 });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/webhooks/unipile`;
    // Aviso como a Unipile v2 manda: envelope { id, type, account_id, payload } assinado com HMAC sobre "<t>.<corpo>".
    enviar = (corpo, segredo = SEGREDO) => {
      const texto = JSON.stringify(corpo);
      const t = String(Math.floor(Date.now() / 1000));
      return fetch(url, { method: 'POST', headers: { 'Unipile-Signature': `t=${t},v0=${assinarCorpo(texto, t, segredo)}`, 'Content-Type': 'application/json' }, body: texto });
    };
    ocioso = o;
    fechar = () => new Promise<void>(r => servidor.close(() => r()));
  });
  afterEach(async () => { await fechar(); await limpar(); });

  const email = (id: string, de: string, envelope: Record<string, unknown> = {}) =>
    ({ id: `ev-${id}`, type: 'email.new', account_id: 'demo-lucas-google', account_name: 'lucas@evolut.com.br', ...envelope,
      payload: { email: { id, thread_id: 'thread-int', subject: 'Re: proposta', plain_text: 'Pode ser terça?', from: [{ email: de }] } } });

  const contar = async (externo: string) => {
    const { count } = await adminLocal().from('messages').select('id', { count: 'exact', head: true }).eq('external_message_id', externo);
    return count;
  };

  it('e-mail de contato do CRM entra na caixa de entrada; repetido não duplica', async () => {
    expect((await enviar(email('mail-int-1', 'Aline.Xavier@serraazul.com.br'))).status).toBe(200);
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-1')).toBe(1);
    await enviar(email('mail-int-1', 'aline.xavier@serraazul.com.br'));
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-1')).toBe(1);
  });

  it('mesma mensagem enviada ao mesmo tempo grava uma vez só', async () => {
    await Promise.all([enviar(email('mail-int-2', 'aline.xavier@serraazul.com.br')), enviar(email('mail-int-2', 'aline.xavier@serraazul.com.br'))]);
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-2')).toBe(1);
  });

  it('quem não é do CRM é descartado sem gravar mensagem, conversa nem notificação', async () => {
    const adm = adminLocal();
    const antesConversas = (await adm.from('conversations').select('id', { count: 'exact', head: true })).count;
    const antesNotif = (await adm.from('notifications').select('id', { count: 'exact', head: true })).count;
    await enviar(email('mail-int-spam', 'desconhecido@spam.com'));
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-spam')).toBe(0);
    expect((await adm.from('conversations').select('id', { count: 'exact', head: true })).count).toBe(antesConversas);
    expect((await adm.from('notifications').select('id', { count: 'exact', head: true })).count).toBe(antesNotif);
  });

  it('e-mail do próprio titular (eco do envio) não grava nada', async () => {
    await enviar(email('mail-int-1', 'Lucas@Evolut.com.br'));
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-1')).toBe(0);
  });

  it('assinatura errada: 401 e nada gravado', async () => {
    expect((await enviar(email('mail-int-1', 'aline.xavier@serraazul.com.br'), 'segredo-errado')).status).toBe(401);
    await ocioso();
    expect(await contar('demo-lucas-google:mail-int-1')).toBe(0);
  });

  it('conexão que pede credencial vira "attention" e volta a "connected"', async () => {
    const status = async () => (await adminLocal().from('messaging_accounts').select('status').eq('unipile_account_id', 'demo-bruna-google').single()).data?.status;
    await enviar({ id: 'ev-s1', type: 'account.status.disconnected', account_id: 'demo-bruna-google', payload: {} });
    await ocioso();
    expect(await status()).toBe('attention');
    await enviar({ id: 'ev-s2', type: 'account.status.running', account_id: 'demo-bruna-google', payload: {} });
    await ocioso();
    expect(await status()).toBe('connected');
  });

  it('conta desconhecida não gera erro nem dado', async () => {
    expect((await enviar({ id: 'ev-s3', type: 'account.status.errored', account_id: 'conta-que-nao-existe', payload: {} })).status).toBe(200);
    await ocioso();
  });
});
