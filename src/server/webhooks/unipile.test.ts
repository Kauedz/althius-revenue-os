// Testes do receptor de webhook da Unipile (parte pura). Nenhuma chamada real: payloads e banco falsos.
// Os formatos de payload são os ASSUMIDOS (não verificados na documentação oficial): ver aviso em unipile.ts.
import { describe, expect, it } from 'vitest';
import { assinarCorpo, assinaturaValida, interpretar, processar, type Banco, type EventoUnipile } from './unipile';

// Envelope v2: { id, type, account_id, account_provider, payload }.
const env = (type: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id: 'ev1', type, account_id: 'acc1', ...extra, payload });
const msgWhats = (extra: Record<string, unknown> = {}, envelope: Record<string, unknown> = {}) =>
  env('message.new', { id: 'm1', chat_id: 'chat1', text: 'Oi, pode ser terça?', is_sender: false, sender_id: '5511900000001@s.whatsapp.net', ...extra }, { account_provider: 'whatsapp', ...envelope });
const PEDIDO = 'f6000000-0000-0000-0000-000000000001';

describe('assinaturaValida', () => {
  const corpo = '{"type":"email.new"}';
  const agora = 1_800_000_000_000;
  const t = String(Math.floor(agora / 1000));
  const cab = (segredo = 'segredo-certo', ts = t) => `t=${ts},v0=${assinarCorpo(corpo, ts, segredo)}`;
  it('aceita a assinatura certa, dentro de 5 minutos', () => {
    expect(assinaturaValida(corpo, cab(), 'segredo-certo', agora)).toBe(true);
    expect(assinaturaValida(corpo, cab(), 'segredo-certo', agora + 4 * 60_000)).toBe(true);
  });
  it('recusa segredo errado, corpo alterado e aviso antigo (repetição)', () => {
    expect(assinaturaValida(corpo, cab('outro'), 'segredo-certo', agora)).toBe(false);
    expect(assinaturaValida(corpo + ' ', cab(), 'segredo-certo', agora)).toBe(false);
    expect(assinaturaValida(corpo, cab(), 'segredo-certo', agora + 6 * 60_000)).toBe(false);
  });
  it('recusa cabeçalho ausente, repetido, torto ou vazio', () => {
    expect(assinaturaValida(corpo, undefined, 'x', agora)).toBe(false);
    expect(assinaturaValida(corpo, [cab(), cab()], 'segredo-certo', agora)).toBe(false);
    expect(assinaturaValida(corpo, '', 'segredo-certo', agora)).toBe(false);
    expect(assinaturaValida(corpo, 't=abc,v0=123', 'segredo-certo', agora)).toBe(false);
    expect(assinaturaValida(corpo, `t=${t}`, 'segredo-certo', agora)).toBe(false);
  });
  it('sem segredo configurado recusa tudo', () => {
    expect(assinaturaValida(corpo, cab(''), '', agora)).toBe(false);
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
    const b = interpretar(msgWhats({}, { account_id: 'acc2' })) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
    expect(a.mensagemId).not.toBe(b.mensagemId);
  });
  it('LinkedIn tenta primeiro o identificador público, depois o link e o id', () => {
    const e = interpretar(msgWhats({ sender_id: 'ACoAA1', sender_public_identifier: 'fulano', sender_profile_url: 'https://www.linkedin.com/in/fulano' }, { account_provider: 'linkedin' }));
    expect(e).toMatchObject({ tipo: 'mensagem', canal: 'linkedin', remetentes: ['fulano', 'https://www.linkedin.com/in/fulano', 'ACoAA1'] });
  });
  it('mensagem só com anexo não é perdida (resposta ainda pausa a cadência)', () => {
    expect(interpretar(msgWhats({ text: null }))).toMatchObject({ tipo: 'mensagem', texto: '[mensagem sem texto]' });
  });
  it('texto gigante é cortado', () => {
    const e = interpretar(msgWhats({ text: 'a'.repeat(50_000) })) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
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
    expect(interpretar(msgWhats({ id: undefined }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar(msgWhats({ sender_id: undefined }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar({ type: 'algo.novo', account_id: 'a' })).toEqual({ tipo: 'ignorar', motivo: 'evento_desconhecido' });
  });
  it('canal desconhecido ou ausente na mensagem é ignorado', () => {
    expect(interpretar(msgWhats({}, { account_provider: 'telegram' }))).toEqual({ tipo: 'ignorar', motivo: 'canal_nao_suportado' });
    expect(interpretar(msgWhats({}, { account_provider: undefined }))).toEqual({ tipo: 'ignorar', motivo: 'canal_nao_suportado' });
  });

  const email = (extra: Record<string, unknown> = {}, envelope: Record<string, unknown> = {}) =>
    env('email.new', { email: { id: 'e1', thread_id: 't1', subject: 'Reunião', plain_text: 'Posso quinta.', from: [{ email: 'Aline@Empresa.com' }], ...extra } }, { account_id: 'acc9', account_name: 'vendas@minha.com', ...envelope });
  it('e-mail recebido vira mensagem de canal email, com assunto e corpo', () => {
    expect(interpretar(email())).toEqual({ tipo: 'mensagem', conta: 'acc9', canal: 'email', remetentes: ['Aline@Empresa.com'], chat: 't1', mensagemId: 'acc9:e1', texto: 'Reunião\n\nPosso quinta.' });
  });
  it('corpo em HTML vira texto simples (sem tags nem scripts)', () => {
    const e = interpretar(email({ plain_text: undefined, body: '<style>a{}</style><p>Olá&nbsp;<b>tudo</b> bem</p><script>x()</script>' })) as Extract<EventoUnipile, { tipo: 'mensagem' }>;
    expect(e.texto).toBe('Reunião\n\nOlá tudo bem');
  });
  it('e-mail enviado pelo próprio titular (eco do nosso envio) é ignorado', () => {
    expect(interpretar(email({ from: [{ email: 'Vendas@Minha.com' }] }))).toEqual({ tipo: 'ignorar', motivo: 'mensagem_propria' });
  });
  it('e-mail sem thread usa o id do e-mail como conversa; sem remetente é ignorado; bounce não é resposta', () => {
    expect(interpretar(email({ thread_id: undefined }))).toMatchObject({ chat: 'e1' });
    expect(interpretar(email({ from: [] }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretar({ ...email(), type: 'email.new.bounce' })).toMatchObject({ tipo: 'ignorar' });
  });

  it('status da conta: rodando e sincronizado conectam; desconectada e erro pedem atenção; removida desconecta', () => {
    const st = (type: string) => interpretar(env(type, {}));
    expect(st('account.status.running')).toEqual({ tipo: 'status', conta: 'acc1', status: 'connected' });
    expect(st('account.initial_sync.completed')).toEqual({ tipo: 'status', conta: 'acc1', status: 'connected' });
    expect(st('account.status.disconnected')).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(st('account.status.errored')).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(st('account.remove')).toEqual({ tipo: 'status', conta: 'acc1', status: 'disconnected' });
    expect(st('account.algo.novo')).toEqual({ tipo: 'ignorar', motivo: 'status_sem_efeito' });
  });

  it('conta conectada pelo link: o `state` é o pedido; sem state válido é ignorado', () => {
    expect(interpretar(env('account.add', { state: PEDIDO, account: { provider: 'google' } }))).toEqual({ tipo: 'conexao', pedidoId: PEDIDO, conta: 'acc1' });
    expect(interpretar(env('account.reconnect', { state: PEDIDO }))).toMatchObject({ tipo: 'conexao' });
    expect(interpretar(env('account.add', { state: 'qualquer-coisa' }))).toEqual({ tipo: 'ignorar', motivo: 'conexao_sem_pedido' });
    expect(interpretar(env('account.add', {}))).toEqual({ tipo: 'ignorar', motivo: 'conexao_sem_pedido' });
  });

  it('nova relação do LinkedIn traz os identificadores do perfil', () => {
    expect(interpretar(env('relation.new', { public_identifier: 'fulano', profile_url: 'https://www.linkedin.com/in/fulano', provider_id: 'ACoAA1' }, { account_id: 'acc2' })))
      .toEqual({ tipo: 'relacao', conta: 'acc2', identificadores: ['fulano', 'https://www.linkedin.com/in/fulano', 'ACoAA1'] });
    expect(interpretar(env('relation.new', {}, { account_id: 'acc2' }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
  });
});

function bancoFalso(respostas: { ingestao?: (remetente: string) => any } = {}) {
  const chamadas: Array<{ fn: string; args: unknown[] }> = [];
  const banco: Banco = {
    async ingerirMensagem(p) { chamadas.push({ fn: 'ingerir', args: [p.remetente] }); return respostas.ingestao ? respostas.ingestao(p.remetente) : { action: 'persisted' }; },
    async definirStatus(conta, status) { chamadas.push({ fn: 'status', args: [conta, status] }); return { action: 'updated' }; },
    async concluirConexao(pedido, conta) { chamadas.push({ fn: 'conexao', args: [pedido, conta] }); return { action: 'connected' }; },
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
    const e = interpretar(msgWhats({ sender_public_identifier: 'a', sender_id: 'b' }, { account_provider: 'linkedin' }));
    expect(await processar(e, banco)).toEqual({ tipo: 'mensagem', resultado: 'non_crm_contact_privacy_filter' });
    expect(chamadas.map(c => c.args[0])).toEqual(['a', 'b']);
  });
  it('segundo identificador acha o contato e para', async () => {
    const { banco, chamadas } = bancoFalso({ ingestao: r => (r === 'b' ? { action: 'persisted' } : { action: 'discarded', reason: 'non_crm_contact_privacy_filter' }) });
    const e = interpretar(msgWhats({ sender_public_identifier: 'a', sender_id: 'b' }, { account_provider: 'linkedin' }));
    expect(await processar(e, banco)).toEqual({ tipo: 'mensagem', resultado: 'persisted' });
    expect(chamadas).toHaveLength(2);
  });
  it('conta desconhecida para na primeira tentativa', async () => {
    const { banco, chamadas } = bancoFalso({ ingestao: () => ({ action: 'discarded', reason: 'messaging_account_not_found' }) });
    const e = interpretar(msgWhats({ sender_public_identifier: 'a', sender_id: 'b' }, { account_provider: 'linkedin' }));
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
