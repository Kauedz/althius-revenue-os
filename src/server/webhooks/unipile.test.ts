// Testes do receptor de webhook da Unipile (parte pura). Nenhuma chamada real: payloads e banco falsos.
// Os formatos de payload são os ASSUMIDOS (não verificados na documentação oficial): ver aviso em unipile.ts.
import { describe, expect, it } from 'vitest';
import { autenticado, interpretar, processar, type Banco, type EventoUnipile } from './unipile';

const msgWhats = (extra: Record<string, unknown> = {}) => ({
  event: 'message_received', account_id: 'acc1', account_type: 'WHATSAPP', chat_id: 'chat1', message_id: 'm1', message: 'Oi, pode ser terça?',
  is_sender: 0, attendees: [{}, {}], sender: { attendee_provider_id: '5511900000001@s.whatsapp.net' }, ...extra
});

describe('autenticado', () => {
  it('aceita só o segredo exato', () => {
    expect(autenticado('segredo-certo', 'segredo-certo')).toBe(true);
    expect(autenticado('segredo-errado', 'segredo-certo')).toBe(false);
    expect(autenticado('segredo-certo ', 'segredo-certo')).toBe(false);
  });
  it('recusa cabeçalho ausente, repetido ou vazio', () => {
    expect(autenticado(undefined, 'x')).toBe(false);
    expect(autenticado(['x', 'x'], 'x')).toBe(false);
    expect(autenticado('', 'x')).toBe(false);
  });
  it('sem segredo configurado recusa tudo, até cabeçalho vazio', () => {
    expect(autenticado('', '')).toBe(false);
    expect(autenticado('qualquer', '')).toBe(false);
  });
});

describe('interpretar', () => {
  it('mensagem de WhatsApp vira evento com id prefixado pela conta', () => {
    expect(interpretar(msgWhats())).toEqual({
      tipo: 'mensagem', conta: 'acc1', canal: 'whatsapp', remetentes: ['5511900000001@s.whatsapp.net'], chat: 'chat1', mensagemId: 'acc1:m1', texto: 'Oi, pode ser terça?'
    });
  });
  it('mesmo id de mensagem em contas diferentes não colide', () => {
    const a = interpretar(msgWhats()) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
    const b = interpretar(msgWhats({ account_id: 'acc2' })) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
    expect(a.mensagemId).not.toBe(b.mensagemId);
  });
  it('LinkedIn tenta primeiro o identificador público, depois o link e o id', () => {
    const e = interpretar(msgWhats({ account_type: 'LINKEDIN', sender: { attendee_provider_id: 'ACoAA1', attendee_public_identifier: 'fulano', attendee_profile_url: 'https://www.linkedin.com/in/fulano' } }));
    expect(e).toMatchObject({ tipo: 'mensagem', canal: 'linkedin', remetentes: ['fulano', 'https://www.linkedin.com/in/fulano', 'ACoAA1'] });
  });
  it('mensagem só com anexo não é perdida (resposta ainda pausa a cadência)', () => {
    expect(interpretar(msgWhats({ message: null }))).toMatchObject({ tipo: 'mensagem', texto: '[mensagem sem texto]' });
  });
  it('texto gigante é cortado', () => {
    const e = interpretar(msgWhats({ message: 'a'.repeat(50_000) })) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
    expect(e.texto.length).toBe(20_000);
  });
  it('ignora mensagem enviada pela própria pessoa', () => {
    expect(interpretar(msgWhats({ is_sender: 1 }))).toEqual({ tipo: 'ignorar', motivo: 'mensagem_propria' });
    expect(interpretar(msgWhats({ is_sender: true }))).toEqual({ tipo: 'ignorar', motivo: 'mensagem_propria' });
  });
  it('ignora grupo, por flag ou por mais de 2 participantes', () => {
    expect(interpretar(msgWhats({ is_group: true }))).toEqual({ tipo: 'ignorar', motivo: 'grupo' });
    expect(interpretar(msgWhats({ attendees: [{}, {}, {}] }))).toEqual({ tipo: 'ignorar', motivo: 'grupo' });
  });
  it('payload incompleto ou inválido é ignorado, nunca estoura', () => {
    expect(interpretar(null)).toEqual({ tipo: 'ignorar', motivo: 'payload_invalido' });
    expect(interpretar('texto')).toEqual({ tipo: 'ignorar', motivo: 'payload_invalido' });
    expect(interpretar([])).toEqual({ tipo: 'ignorar', motivo: 'payload_invalido' });
    expect(interpretar({})).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar(msgWhats({ message_id: undefined }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar(msgWhats({ sender: {} }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar({ event: 'algo_novo', account_id: 'a' })).toEqual({ tipo: 'ignorar', motivo: 'evento_desconhecido' });
  });
  it('canal desconhecido na mensagem é ignorado', () => {
    expect(interpretar(msgWhats({ account_type: 'TELEGRAM' }))).toEqual({ tipo: 'ignorar', motivo: 'canal_nao_suportado' });
  });

  it('e-mail recebido vira mensagem de canal email, com assunto e corpo', () => {
    const e = interpretar({ event: 'mail_received', account_id: 'acc9', email_id: 'e1', thread_id: 't1', subject: 'Reunião', body_plain: 'Posso quinta.', from_attendee: { identifier: 'Aline@Empresa.com' }, folders: ['INBOX'] });
    expect(e).toEqual({ tipo: 'mensagem', conta: 'acc9', canal: 'email', remetentes: ['Aline@Empresa.com'], chat: 't1', mensagemId: 'acc9:e1', texto: 'Reunião\n\nPosso quinta.' });
  });
  it('e-mail fora da caixa de entrada (enviado, lixo) é ignorado', () => {
    expect(interpretar({ event: 'mail_received', account_id: 'a', email_id: 'e', from_attendee: { identifier: 'x@y.com' }, folders: ['SENT'] }))
      .toEqual({ tipo: 'ignorar', motivo: 'email_fora_da_caixa_de_entrada' });
  });
  it('e-mail sem thread usa o id do e-mail como conversa', () => {
    expect(interpretar({ event: 'mail_received', account_id: 'a', email_id: 'e7', from_attendee: { identifier: 'x@y.com' } })).toMatchObject({ chat: 'e7' });
  });

  it('status da conta: OK conecta, credencial pede atenção, parada desconecta, conectando não muda nada', () => {
    const st = (message: string) => interpretar({ AccountStatus: { account_id: 'acc1', account_type: 'WHATSAPP', message } });
    expect(st('OK')).toEqual({ tipo: 'status', conta: 'acc1', status: 'connected' });
    expect(st('CREDENTIALS')).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(st('ERROR')).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(st('STOPPED')).toEqual({ tipo: 'status', conta: 'acc1', status: 'disconnected' });
    expect(st('CONNECTING')).toEqual({ tipo: 'ignorar', motivo: 'status_sem_efeito' });
    expect(st('ALGO_NOVO')).toEqual({ tipo: 'ignorar', motivo: 'status_sem_efeito' });
  });

  it('nova relação do LinkedIn traz os identificadores do perfil', () => {
    expect(interpretar({ event: 'new_relation', account_id: 'acc2', user_provider_id: 'ACoAA1', user_public_identifier: 'fulano', user_profile_url: 'https://www.linkedin.com/in/fulano' }))
      .toEqual({ tipo: 'relacao', conta: 'acc2', identificadores: ['fulano', 'https://www.linkedin.com/in/fulano', 'ACoAA1'] });
    expect(interpretar({ event: 'new_relation', account_id: 'acc2' })).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
  });
});

function bancoFalso(respostas: { ingestao?: (remetente: string) => any } = {}) {
  const chamadas: Array<{ fn: string; args: unknown[] }> = [];
  const banco: Banco = {
    async ingerirMensagem(p) { chamadas.push({ fn: 'ingerir', args: [p.remetente] }); return respostas.ingestao ? respostas.ingestao(p.remetente) : { action: 'persisted' }; },
    async definirStatus(conta, status) { chamadas.push({ fn: 'status', args: [conta, status] }); return { action: 'updated' }; },
    async novaRelacao(conta, id) { chamadas.push({ fn: 'relacao', args: [conta, id] }); return { action: id === 'fulano' ? 'connected' : 'ignored' }; }
  };
  return { banco, chamadas };
}

describe('processar', () => {
  it('evento ignorado não toca o banco', async () => {
    const { banco, chamadas } = bancoFalso();
    expect(await processar({ tipo: 'ignorar', motivo: 'grupo' }, banco)).toEqual({ tipo: 'ignorar', resultado: 'grupo' });
    expect(chamadas).toEqual([]);
  });
  it('mensagem de contato do CRM é gravada', async () => {
    const { banco, chamadas } = bancoFalso();
    const e = interpretar(msgWhats());
    expect(await processar(e, banco)).toEqual({ tipo: 'mensagem', resultado: 'persisted' });
    expect(chamadas).toHaveLength(1);
  });
  it('quem não é do CRM tenta cada identificador e termina descartado', async () => {
    const { banco, chamadas } = bancoFalso({ ingestao: () => ({ action: 'discarded', reason: 'non_crm_contact_privacy_filter' }) });
    const e = interpretar(msgWhats({ account_type: 'LINKEDIN', sender: { attendee_public_identifier: 'a', attendee_provider_id: 'b' } }));
    expect(await processar(e, banco)).toEqual({ tipo: 'mensagem', resultado: 'non_crm_contact_privacy_filter' });
    expect(chamadas.map(c => c.args[0])).toEqual(['a', 'b']);
  });
  it('segundo identificador acha o contato e para', async () => {
    const { banco, chamadas } = bancoFalso({ ingestao: r => (r === 'b' ? { action: 'persisted' } : { action: 'discarded', reason: 'non_crm_contact_privacy_filter' }) });
    const e = interpretar(msgWhats({ account_type: 'LINKEDIN', sender: { attendee_public_identifier: 'a', attendee_provider_id: 'b' } }));
    expect(await processar(e, banco)).toEqual({ tipo: 'mensagem', resultado: 'persisted' });
    expect(chamadas).toHaveLength(2);
  });
  it('conta desconhecida para na primeira tentativa', async () => {
    const { banco, chamadas } = bancoFalso({ ingestao: () => ({ action: 'discarded', reason: 'messaging_account_not_found' }) });
    const e = interpretar(msgWhats({ account_type: 'LINKEDIN', sender: { attendee_public_identifier: 'a', attendee_provider_id: 'b' } }));
    expect((await processar(e, banco)).resultado).toBe('messaging_account_not_found');
    expect(chamadas).toHaveLength(1);
  });
  it('replay idempotente é reportado como replay', async () => {
    const { banco } = bancoFalso({ ingestao: () => ({ action: 'persisted', idempotent_replay: true }) });
    expect((await processar(interpretar(msgWhats()), banco)).resultado).toBe('replay');
  });
  it('status e relação chamam a função certa', async () => {
    const { banco, chamadas } = bancoFalso();
    await processar({ tipo: 'status', conta: 'acc1', status: 'attention' }, banco);
    expect(await processar({ tipo: 'relacao', conta: 'acc2', identificadores: ['x', 'fulano', 'y'] }, banco)).toEqual({ tipo: 'relacao', resultado: 'connected' });
    expect(chamadas).toEqual([
      { fn: 'status', args: ['acc1', 'attention'] },
      { fn: 'relacao', args: ['acc2', 'x'] },
      { fn: 'relacao', args: ['acc2', 'fulano'] }
    ]);
  });
  it('o resumo devolvido para log não carrega remetente nem texto', async () => {
    const { banco } = bancoFalso();
    const r = JSON.stringify(await processar(interpretar(msgWhats()), banco));
    expect(r).not.toContain('5511900000001');
    expect(r).not.toContain('terça');
  });
});
