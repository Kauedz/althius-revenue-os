// Integração: motor de cadência + banco local de verdade (PostgREST). O provedor de mensagens é falso.
// Seed: Lucas (BDR, membro d..04) é dono da conta c..01; Aline Xavier (cb..01) tem e-mail; conta google do Lucas é demo-lucas-google.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';
import { bancoCadenciaViaApi } from './banco';
import { rodarCiclo, type Mensageiro } from './motor';

const WS = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const ALINE = 'cb000000-0000-0000-0000-000000000001';
const CAD = 'f6300000-0000-0000-0000-000000000001';
const INSC = 'f6300000-0000-0000-0000-0000000000a1';

describe.skipIf(!bancoLocalNoAr)('motor de cadência com o banco local', () => {
  const adm = adminLocal();
  const banco = bancoCadenciaViaApi(`${URL_LOCAL}/rest/v1`, SERVICE_LOCAL);
  let carteira: Record<string, number>;
  let enviados: Array<Record<string, unknown>>;
  let mensageiro: Mensageiro;

  const limpar = async () => {
    const { data: execs } = await adm.from('executions').select('id').like('metadata_json->>cadence_key', `${INSC}:%`);
    const ids = (execs ?? []).map(e => e.id);
    if (ids.length) {
      await adm.from('messages').delete().in('cadence_step_execution_id', ids);
      await adm.from('credit_transactions').delete().in('execution_id', ids);
      await adm.from('executions').delete().in('id', ids);
    }
    await adm.from('conversations').delete().eq('external_chat_id', 'chat-int-cad');
    await adm.from('tasks').delete().eq('contact_id', ALINE).eq('source', 'cadencia');
    await adm.from('notifications').delete().eq('entity_id', INSC);
    await adm.from('cadences').delete().eq('id', CAD);
    await adm.from('workspace_agents').update({ estado: 'ativo' }).eq('workspace_id', WS).eq('agent_code', 'copy');
    if (carteira) await adm.from('credit_wallets').update(carteira).eq('workspace_id', WS);
  };

  beforeEach(async () => {
    const { data } = await adm.from('credit_wallets').select('allowance_balance, topup_balance, reserved_balance, monthly_consumed').eq('workspace_id', WS).single();
    carteira = data as Record<string, number>;
    await limpar();
    enviados = [];
    mensageiro = { async enviar(p) { enviados.push(p as unknown as Record<string, unknown>); return { ok: true, mensagemId: `msg-${enviados.length}`, chatId: 'chat-int-cad' }; } };
    await adm.from('cadences').insert({ id: CAD, workspace_id: WS, name: 'Cadência de integração', status: 'ativa' });
    await adm.from('cadence_steps').insert([
      { workspace_id: WS, cadence_id: CAD, step_number: 1, channel: 'email', execution_mode: 'auto', subject: 'Olá', body: 'Primeira mensagem', delay_days: 0 },
      { workspace_id: WS, cadence_id: CAD, step_number: 2, channel: 'linkedin', execution_mode: 'manual', body: 'Roteiro do LinkedIn', delay_days: 0 }
    ]);
    await adm.from('cadence_enrollments').insert({ id: INSC, workspace_id: WS, cadence_id: CAD, contact_id: ALINE, owner_member_id: LUCAS, auto_send: true });
    await adm.from('cadence_enrollment_steps').insert([
      { enrollment_id: INSC, step_number: 1, scheduled_at: new Date(Date.now() - 1000).toISOString() },
      { enrollment_id: INSC, step_number: 2 }
    ]);
  });
  afterEach(limpar);

  const estado = async () => {
    const { data: x } = await adm.from('executions').select('status, actual_credits, agent_code').like('metadata_json->>cadence_key', `${INSC}:%`);
    const { data: w } = await adm.from('credit_wallets').select('reserved_balance, monthly_consumed').eq('workspace_id', WS).single();
    const { data: m } = await adm.from('messages').select('text, direction, sent_by').eq('workspace_id', WS).eq('sent_by', 'automation').eq('text', 'Primeira mensagem');
    return { execucoes: x ?? [], carteira: w!, mensagens: m ?? [] };
  };

  it('envia uma vez, consome os créditos, registra a mensagem e a repetição do ciclo não duplica', async () => {
    const r1 = await rodarCiclo({ banco, mensageiro, log: () => {} });
    expect(r1.enviados).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ contaExterna: 'demo-lucas-google', canal: 'email', destinatario: 'aline.xavier@serraazul.com.br', assunto: 'Olá', texto: 'Primeira mensagem' });

    const e = await estado();
    expect(e.execucoes).toEqual([{ status: 'completed', actual_credits: 4, agent_code: 'copy' }]);
    expect(e.carteira.reserved_balance).toBe(carteira.reserved_balance);
    expect(e.carteira.monthly_consumed).toBe(carteira.monthly_consumed + 4);
    expect(e.mensagens).toEqual([{ text: 'Primeira mensagem', direction: 'out', sent_by: 'automation' }]);

    // Segundo ciclo: o passo 1 já foi; o passo 2 (manual) só vence depois da espera de 0 dias, vira tarefa. Nada reenviado.
    const r2 = await rodarCiclo({ banco, mensageiro, log: () => {} });
    expect(r2.enviados).toBe(0);
    expect(enviados).toHaveLength(1);
    const e2 = await estado();
    expect(e2.execucoes).toHaveLength(1);
    expect(e2.carteira.monthly_consumed).toBe(carteira.monthly_consumed + 4);
  });

  it('passo manual vira uma tarefa do Lucas, uma só, mesmo se o ciclo repetir', async () => {
    await rodarCiclo({ banco, mensageiro, log: () => {} });
    await rodarCiclo({ banco, mensageiro, log: () => {} });
    await rodarCiclo({ banco, mensageiro, log: () => {} });
    const { data } = await adm.from('tasks').select('assignee_member_id, channel, note, source').eq('contact_id', ALINE).eq('source', 'cadencia');
    expect(data).toEqual([{ assignee_member_id: LUCAS, channel: 'linkedin', note: 'Roteiro do LinkedIn', source: 'cadencia' }]);
    const { data: insc } = await adm.from('cadence_enrollments').select('status').eq('id', INSC).single();
    expect(insc?.status).toBe('concluida');
  });

  it('agente pausado: não envia, não reserva créditos e avisa o dono uma vez', async () => {
    await adm.from('workspace_agents').update({ estado: 'pausado' }).eq('workspace_id', WS).eq('agent_code', 'copy');
    const r = await rodarCiclo({ banco, mensageiro, log: () => {} });
    expect(r.bloqueados).toBe(1);
    expect(enviados).toEqual([]);
    const e = await estado();
    expect(e.execucoes).toEqual([]);
    expect(e.carteira.reserved_balance).toBe(carteira.reserved_balance);
    const { data } = await adm.from('notifications').select('type, recipient_member_id').eq('entity_id', INSC);
    expect(data).toEqual([{ type: 'cadencia_bloqueada', recipient_member_id: LUCAS }]);
  });

  it('falta de crédito: não envia, pausa a inscrição e avisa', async () => {
    await adm.from('credit_wallets').update({ allowance_balance: 2, topup_balance: 0 }).eq('workspace_id', WS);
    const r = await rodarCiclo({ banco, mensageiro, log: () => {} });
    expect(r.bloqueados).toBe(1);
    expect(enviados).toEqual([]);
    const { data: insc } = await adm.from('cadence_enrollments').select('status, pause_reason').eq('id', INSC).single();
    expect(insc?.status).toBe('pausada');
    expect(insc?.pause_reason).toBeTruthy();
    const { data: avisos } = await adm.from('notifications').select('type').eq('entity_id', INSC);
    expect(avisos).toEqual([{ type: 'cadencia_pausada' }]);
    await adm.from('approvals').delete().eq('workspace_id', WS).like('title', 'Envio automático: Cadência de integração%');
  });

  it('o provedor recusa: libera a reserva, não cobra e mantém o passo para nova tentativa', async () => {
    const recusa: Mensageiro = { async enviar() { return { ok: false, erro: 'HTTP 422', definitivo: true }; } };
    const r = await rodarCiclo({ banco, mensageiro: recusa, log: () => {} });
    expect(r.falhas).toBe(1);
    const e = await estado();
    expect(e.execucoes).toEqual([{ status: 'failed', actual_credits: 0, agent_code: 'copy' }]);
    expect(e.carteira.reserved_balance).toBe(carteira.reserved_balance);
    expect(e.carteira.monthly_consumed).toBe(carteira.monthly_consumed);
    const { data } = await adm.from('cadence_enrollment_steps').select('status, attempts').eq('enrollment_id', INSC).eq('step_number', 1).single();
    expect(data).toEqual({ status: 'pendente', attempts: 1 });
  });

  it('resposta do contato pausa a cadência antes do envio', async () => {
    await adm.rpc('unipile_ingest_message', { p_unipile_account_id: 'demo-lucas-google', p_channel: 'email', p_sender_identifier: 'aline.xavier@serraazul.com.br', p_external_chat_id: 'chat-int-cad', p_external_message_id: 'int-resp-1', p_text: 'Pode me ligar?', p_is_group: false, p_intent: 'positiva' });
    try {
      const r = await rodarCiclo({ banco, mensageiro, log: () => {} });
      expect(r.vistos).toBe(0);
      expect(enviados).toEqual([]);
      const { data } = await adm.from('cadence_enrollments').select('status').eq('id', INSC).single();
      expect(data?.status).toBe('pausada_resposta');
    } finally {
      await adm.from('messages').delete().eq('external_message_id', 'int-resp-1');
      const { data: conv } = await adm.from('conversations').select('id').eq('external_chat_id', 'chat-int-cad');
      for (const c of conv ?? []) await adm.from('notifications').delete().eq('entity_id', c.id);
    }
  });

  it('variáveis: o provedor recebe o texto resolvido, sem {{...}}', async () => {
    await adm.from('cadence_steps').update({ subject: 'Olá {{primeiro_nome}}', body: 'Vi a {{empresa}} ({{cargo}}). Abraço, {{meu_nome}}' }).eq('cadence_id', CAD).eq('step_number', 1);
    const r = await rodarCiclo({ banco, mensageiro, log: () => {} });
    expect(r.enviados).toBe(1);
    expect(enviados[0]).toMatchObject({ assunto: 'Olá Aline', texto: 'Vi a Serra Azul Têxtil (Diretora de Supply Chain). Abraço, Lucas Teixeira' });
    expect(JSON.stringify(enviados)).not.toContain('{{');
  });

  it('variável sem dado: o provedor nem é chamado, nada é reservado e o dono é avisado', async () => {
    await adm.from('cadence_steps').update({ body: 'Oi {{primeiro_nome}}, e o {{cargo}}?' }).eq('cadence_id', CAD).eq('step_number', 1);
    await adm.from('contacts').update({ job_title: null }).eq('id', ALINE);
    try {
      const r = await rodarCiclo({ banco, mensageiro, log: () => {} });
      expect(r.bloqueados).toBe(1);
      expect(enviados).toEqual([]);
      const e = await estado();
      expect(e.execucoes).toEqual([]);
      expect(e.carteira.reserved_balance).toBe(carteira.reserved_balance);
      const { data } = await adm.from('notifications').select('type, body').eq('entity_id', INSC);
      expect(data).toHaveLength(1);
      expect(data![0].type).toBe('cadencia_bloqueada');
      expect(data![0].body).toContain('cargo');
    } finally {
      await adm.from('contacts').update({ job_title: 'Diretora de Supply Chain' }).eq('id', ALINE);
    }
  });
});
