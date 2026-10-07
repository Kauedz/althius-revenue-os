// @vitest-environment node
// TESTE DE PONTA A PONTA COM A UNIPILE DE VERDADE (ADR 0070). Fica PULADO no dia a dia: só roda quando você pede, com a
// chave de teste e o texto aprovado, porque ENVIA UMA MENSAGEM REAL de WhatsApp.
//
//   $env:UNIPILE_E2E_TEXTO = "<o texto aprovado>"; $env:UNIPILE_API_KEY = "<chave>"; $env:UNIPILE_API_URL = "<endereço>"
//   $env:UNIPILE_E2E_NUMERO = "+55 11 90000-0000"      (o número que vai receber; precisa ser de uma pessoa que sabe do teste)
//   npx vitest run src/server/ponta-a-ponta.unipile.test.ts
//
// O caminho inteiro, com o banco local de verdade e a ponte de verdade:
//   conexão (aviso da ponte -> webhook -> banco) -> mensagem recebida (webhook -> contato do CRM -> conversa)
//   -> resposta pela Caixa (banco confere a política e reserva os créditos) -> serviço de envio -> Unipile -> mensagem na conversa.
// Tudo o que o teste cria no banco é apagado no fim.
import { afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../test/supabaseLocal';
import { lerConfig } from './unipile/config.ts';
import { ponteViaApi } from './conexoes/sincronizar.ts';
import { criarServidor } from './webhooks/servidor.ts';
import { bancoViaApi } from './webhooks/banco.ts';
import { chaveDoAviso } from './webhooks/unipile.ts';
import { bancoRespostasViaApi } from './cadencia/banco.ts';
import { rodarRespostas } from './cadencia/respostas.ts';
import { mensageiroViaApi } from './cadencia/envio.ts';

const TEXTO = (process.env.UNIPILE_E2E_TEXTO ?? '').trim();
const NUMERO = (process.env.UNIPILE_E2E_NUMERO ?? '').trim();
const cfg = lerConfig();
const ligado = bancoLocalNoAr && !!TEXTO && !!NUMERO && !!cfg.apiKey;

const WS = 'a0000000-0000-0000-0000-000000000001';
const BRUNA = 'd0000000-0000-0000-0000-000000000006';
const SEGREDO = 'segredo-e2e-local';
const REST = URL_LOCAL + '/rest/v1';
const MARCA = 'e2e-unipile';

describe.skipIf(!ligado)('ponta a ponta com a Unipile de verdade (envia 1 mensagem real)', () => {
  const adm = adminLocal();
  let contaWhatsapp = '';

  async function limpar() {
    const { data: contas } = await adm.from('messaging_accounts').select('id').eq('member_id', BRUNA).eq('provider', 'whatsapp');
    const ids = (contas ?? []).map(c => c.id);
    const { data: contatos } = await adm.from('contacts').select('id').like('name', MARCA + '%');
    const cids = (contatos ?? []).map(c => c.id);
    const { data: convs } = ids.length ? await adm.from('conversations').select('id').in('messaging_account_id', ids) : { data: [] as Array<{ id: string }> };
    const vids = (convs ?? []).map(c => c.id);
    if (vids.length) {
      const { data: reps } = await adm.from('inbox_replies').select('id, execution_id').in('conversation_id', vids);
      for (const r of reps ?? []) {
        await adm.from('credit_transactions').delete().like('idempotency_key', 'resposta:' + r.id + '%');
        await adm.from('inbox_replies').delete().eq('id', r.id);
        if (r.execution_id) { await adm.from('credit_transactions').delete().eq('execution_id', r.execution_id); await adm.from('executions').delete().eq('id', r.execution_id); }
      }
      await adm.from('messages').delete().in('conversation_id', vids);
      await adm.from('notifications').delete().in('entity_id', vids);
      await adm.from('conversations').delete().in('id', vids);
    }
    if (ids.length) await adm.from('messaging_accounts').delete().in('id', ids);
    await adm.from('messaging_connect_requests').delete().eq('member_id', BRUNA).eq('provider', 'whatsapp');
    if (cids.length) { await adm.from('contact_channels').delete().in('contact_id', cids); await adm.from('contacts').delete().in('id', cids); }
    await adm.from('accounts').delete().eq('domain', 'e2e-unipile.test');
    await adm.from('credit_wallets').update({ reserved_balance: 0 }).eq('workspace_id', WS);
    await adm.from('notifications').delete().eq('type', 'resposta_falhou');
  }
  afterAll(async () => { if (ligado) await limpar(); });

  it('a ponte lista a conta de WhatsApp conectada', async () => {
    const { contas } = await ponteViaApi(() => cfg).listarContas();
    const wa = contas.find(c => c.provedor === 'whatsapp');
    expect(wa, 'conecte um WhatsApp na Unipile antes').toBeDefined();
    contaWhatsapp = wa!.id;
  });

  it('conexão -> mensagem recebida -> resposta pela Caixa -> envio real -> mensagem na conversa', async () => {
    await limpar();
    const bruna = await entrarComoLocal('bruna@evolut.com.br');

    // 1. A pessoa clica em Conectar: o banco abre o pedido que fixa o dono da conta.
    const { data: pedido, error } = await bruna.rpc('messaging_connect_start', { p_workspace_id: WS, p_member_id: BRUNA, p_provider: 'whatsapp' });
    expect(error).toBeNull();
    const pedidoId = (pedido as { request_id: string }).request_id;

    // 2. O receptor de webhook de verdade (v1), com o banco local de verdade.
    const logs: Array<Record<string, unknown>> = [];
    const { servidor, ocioso } = criarServidor({ segredo: SEGREDO, banco: bancoViaApi(REST, SERVICE_LOCAL), log: l => logs.push(l), esperaMs: 1 });
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/webhooks/unipile`;
    try {
      // 2a. A ponte avisa que a conta foi conectada (endereço de aviso com a chave só deste pedido).
      const aviso = await fetch(`${url}?k=${chaveDoAviso(SEGREDO, pedidoId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CREATION_SUCCESS', account_id: contaWhatsapp, name: pedidoId }) });
      expect(aviso.status).toBe(200);
      await ocioso();
      const { data: ma } = await adm.from('messaging_accounts').select('id, member_id, status').eq('unipile_account_id', contaWhatsapp).single();
      expect(ma).toMatchObject({ member_id: BRUNA, status: 'connected' });

      // 3. A pessoa é contato do CRM (cadastrada como o CRM costuma ter: sem o 55).
      const { data: conta } = await adm.from('accounts').insert({ workspace_id: WS, name: MARCA + ' empresa', domain: 'e2e-unipile.test', status: 'ativa' }).select('id').single();
      const { data: contato } = await adm.from('contacts').insert({ workspace_id: WS, account_id: conta!.id, name: MARCA + ' Contato' }).select('id').single();
      await adm.from('contact_channels').insert({ workspace_id: WS, contact_id: contato!.id, type: 'whatsapp', value: NUMERO.replace(/^\+55\s*/, ''), value_normalized: '', position: 1 });
      const so = NUMERO.replace(/\D/g, '');

      // 4. Ela escreve: aviso de mensagem recebida da v1, com o número no formato do provedor.
      const recebida = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Unipile-Auth': SEGREDO }, body: JSON.stringify({
        event: 'message_received', account_id: contaWhatsapp, account_type: 'WHATSAPP', chat_id: 'chat-e2e', message_id: 'msg-e2e-1', message: 'Oi! (mensagem de teste recebida)',
        sender: { attendee_provider_id: so + '@s.whatsapp.net', attendee_name: 'Contato' }, attendees: [{ attendee_provider_id: so + '@s.whatsapp.net' }, { attendee_provider_id: '5511977770000@s.whatsapp.net' }],
        account_info: { user_id: '5511977770000@s.whatsapp.net' } }) });
      expect(recebida.status).toBe(200);
      await ocioso();
      const { data: conv } = await adm.from('conversations').select('id, channel, contact_id, unread').eq('messaging_account_id', ma!.id).single();
      expect(conv).toMatchObject({ channel: 'whatsapp', contact_id: contato!.id, unread: true });

      // 5. A BDR vê a conversa e responde pela Caixa: o banco confere a política e reserva os créditos.
      const { data: vista } = await bruna.from('messages').select('text, direction').eq('conversation_id', conv!.id);
      expect(vista).toEqual([{ text: 'Oi! (mensagem de teste recebida)', direction: 'in' }]);
      const { data: r } = await bruna.rpc('inbox_reply', { p_workspace_id: WS, p_member_id: BRUNA, p_conversation_id: conv!.id, p_texto: TEXTO, p_assunto: null, p_chave: crypto.randomUUID() });
      expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
    } finally {
      await new Promise<void>(r => servidor.close(() => r()));
    }

    // 6. O serviço de envio pega, manda pela Unipile de verdade e conclui.
    const resumo = await rodarRespostas({ banco: bancoRespostasViaApi(REST, SERVICE_LOCAL), mensageiro: mensageiroViaApi(() => cfg), log: () => {} });
    expect(resumo).toMatchObject({ vistas: 1, enviadas: 1, falhas: 0, incertas: 0 });

    // 7. O banco registrou: resposta enviada, mensagem na conversa, 4 créditos cobrados.
    const { data: resposta } = await adm.from('inbox_replies').select('estado, erro, execution_id').like('texto', TEXTO.slice(0, 20) + '%').eq('workspace_id', WS).order('created_at', { ascending: false }).limit(1).single();
    expect(resposta).toMatchObject({ estado: 'enviada', erro: null });
    const { data: saida } = await adm.from('messages').select('text, direction, sent_by').eq('direction', 'out').eq('text', TEXTO);
    expect(saida?.length).toBeGreaterThanOrEqual(1);
    const { data: exec } = await adm.from('executions').select('status, actual_credits').eq('id', resposta!.execution_id!).single();
    expect(exec).toMatchObject({ status: 'completed', actual_credits: 4 });
  });
});
