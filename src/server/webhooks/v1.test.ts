// Unipile v1 (ADR 0069): leitura dos avisos, autenticação (cabeçalho Unipile-Auth e chave do endereço), link de conexão.
// Nenhuma chamada real: servidor local em 127.0.0.1, banco e Unipile falsos.
import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { criarServidor } from './servidor';
import { iniciarConexao } from './conexoes';
import { criarLinkHospedado } from './hospedado';
import { autorizadoV1, chaveDoAviso, interpretar, interpretarV1, type Banco } from './unipile';

const SEGREDO = 'segredo-v1-de-teste';
const PEDIDO = 'f6000000-0000-0000-0000-000000000001';
const DSN = 'https://api68.unipile.com:19840';

const msgLinkedin = (extra: Record<string, unknown> = {}) => ({
  event: 'message_received', account_id: 'acc1', account_type: 'LINKEDIN', chat_id: 'chat1', message_id: 'm1', message: 'Tenho interesse',
  sender: { attendee_id: 'at1', attendee_provider_id: 'ACoAAA1', attendee_public_identifier: 'maria-silva', attendee_profile_url: 'https://www.linkedin.com/in/maria-silva' },
  attendees: [{ attendee_provider_id: 'ACoAAA1' }, { attendee_provider_id: 'ACoDONO' }], account_info: { user_id: 'ACoDONO' }, ...extra
});

describe('interpretar: avisos da v1', () => {
  it('mensagem do LinkedIn: remetentes (público, perfil, id), chat, mensagem com prefixo da conta e texto', () => {
    expect(interpretar(msgLinkedin())).toEqual({
      tipo: 'mensagem', conta: 'acc1', canal: 'linkedin', chat: 'chat1', mensagemId: 'acc1:m1', texto: 'Tenho interesse',
      remetentes: ['maria-silva', 'https://www.linkedin.com/in/maria-silva', 'ACoAAA1', 'at1']
    });
  });
  it('WhatsApp e Instagram usam o id do provedor; canal desconhecido é ignorado', () => {
    expect(interpretar(msgLinkedin({ account_type: 'WHATSAPP', sender: { attendee_provider_id: '5511900000001@s.whatsapp.net' } }))).toMatchObject({ canal: 'whatsapp', remetentes: ['5511900000001@s.whatsapp.net'] });
    expect(interpretar(msgLinkedin({ account_type: 'INSTAGRAM', sender: { attendee_provider_id: '178414', attendee_profile_url: 'https://www.instagram.com/maria.teste' } }))).toMatchObject({ canal: 'instagram', remetentes: ['https://www.instagram.com/maria.teste', '178414'] });
    expect(interpretar(msgLinkedin({ account_type: 'TELEGRAM' }))).toEqual({ tipo: 'ignorar', motivo: 'canal_nao_suportado' });
  });
  it('mensagem da própria conta, grupo, evento e outros eventos de mensagem não entram', () => {
    expect(interpretar(msgLinkedin({ sender: { attendee_provider_id: 'ACoDONO' } }))).toEqual({ tipo: 'ignorar', motivo: 'mensagem_propria' });
    expect(interpretar(msgLinkedin({ attendees: [{}, {}, {}] }))).toEqual({ tipo: 'ignorar', motivo: 'grupo' });
    expect(interpretar(msgLinkedin({ is_event: true }))).toEqual({ tipo: 'ignorar', motivo: 'evento_sem_texto' });
    expect(interpretar(msgLinkedin({ event: 'message_read' }))).toEqual({ tipo: 'ignorar', motivo: 'evento_desconhecido' });
    expect(interpretar(msgLinkedin({ message_id: undefined }))).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
  });
  it('anúncio do LinkedIn (mensagem patrocinada ou oferta) não entra: é somente leitura e não é do CRM', () => {
    expect(interpretar(msgLinkedin({ content_type: 'sponsored' }))).toEqual({ tipo: 'ignorar', motivo: 'anuncio_do_canal' });
    expect(interpretar(msgLinkedin({ content_type: 'linkedin_offer' }))).toEqual({ tipo: 'ignorar', motivo: 'anuncio_do_canal' });
    expect(interpretar(msgLinkedin({ content_type: 'inmail' }))).toMatchObject({ tipo: 'mensagem' });
  });
  it('mensagem sem texto vira marcador (nunca texto inventado)', () => {
    expect(interpretar(msgLinkedin({ message: '' }))).toMatchObject({ texto: '[mensagem sem texto]' });
  });
  it('e-mail recebido: remetente, assunto + corpo, conversa e id prefixado pela conta', () => {
    expect(interpretar({ event: 'mail_received', account_id: 'acc2', email_id: 'e9', from_attendee: { identifier: 'jonas@serra.test' }, subject: 'Re: proposta', body_plain: 'Fechado.', thread_id: 't1' }))
      .toEqual({ tipo: 'mensagem', conta: 'acc2', canal: 'email', remetentes: ['jonas@serra.test'], chat: 't1', mensagemId: 'acc2:e9', texto: 'Re: proposta\n\nFechado.' });
  });
  it('estado da conta (aninhado, como na documentação, ou direto): OK conecta, CREDENTIALS pede atenção, DELETED desconecta', () => {
    expect(interpretar({ AccountStatus: { account_id: 'acc1', account_type: 'LINKEDIN', message: 'OK' } })).toEqual({ tipo: 'status', conta: 'acc1', status: 'connected' });
    expect(interpretar({ AccountStatus: { account_id: 'acc1', account_type: 'LINKEDIN', message: 'CREDENTIALS' } })).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(interpretar({ account_id: 'acc1', account_type: 'INSTAGRAM', message: 'ERROR' })).toEqual({ tipo: 'status', conta: 'acc1', status: 'attention' });
    expect(interpretar({ AccountStatus: { account_id: 'acc1', account_type: 'LINKEDIN', message: 'DELETED' } })).toEqual({ tipo: 'status', conta: 'acc1', status: 'disconnected' });
    expect(interpretar({ AccountStatus: { account_id: 'acc1', account_type: 'LINKEDIN', message: 'CONNECTING' } })).toEqual({ tipo: 'ignorar', motivo: 'status_sem_efeito' });
  });
  it('nova relação do LinkedIn', () => {
    expect(interpretar({ event: 'new_relation', account_id: 'acc1', user_public_identifier: 'joao', user_provider_id: 'ACoJ' })).toEqual({ tipo: 'relacao', conta: 'acc1', identificadores: ['joao', 'ACoJ'] });
    expect(interpretar({ event: 'new_relation', account_id: 'acc1' })).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
  });
  it('aviso do link de conexão: o name é o id do nosso pedido; sem pedido válido não conecta', () => {
    expect(interpretar({ status: 'CREATION_SUCCESS', account_id: 'acc7', name: PEDIDO })).toEqual({ tipo: 'conexao', pedidoId: PEDIDO, conta: 'acc7' });
    expect(interpretar({ status: 'RECONNECTED', account_id: 'acc7', name: PEDIDO })).toMatchObject({ tipo: 'conexao' });
    expect(interpretar({ status: 'CREATION_SUCCESS', account_id: 'acc7', name: 'qualquer-coisa' })).toEqual({ tipo: 'ignorar', motivo: 'conexao_sem_pedido' });
  });
  it('lixo nunca estoura', () => {
    expect(interpretarV1({})).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretarV1({ event: 'x' })).toEqual({ tipo: 'ignorar', motivo: 'payload_incompleto' });
    expect(interpretarV1({ event: 'x', account_id: 'a' })).toEqual({ tipo: 'ignorar', motivo: 'evento_desconhecido' });
  });
});

describe('autorizadoV1', () => {
  const corpo = JSON.stringify({ status: 'CREATION_SUCCESS', account_id: 'acc7', name: PEDIDO });
  it('cabeçalho igual ao segredo vale; diferente, ausente ou sem segredo configurado, não', () => {
    expect(autorizadoV1(corpo, SEGREDO, null, SEGREDO)).toBe('cabecalho');
    expect(autorizadoV1(corpo, 'outro', null, SEGREDO)).toBeNull();
    expect(autorizadoV1(corpo, undefined, null, SEGREDO)).toBeNull();
    expect(autorizadoV1(corpo, '', null, '')).toBeNull();
    expect(autorizadoV1(corpo, SEGREDO, null, '')).toBeNull();
  });
  it('a chave do endereço vale só para o pedido citado no name', () => {
    expect(autorizadoV1(corpo, undefined, chaveDoAviso(SEGREDO, PEDIDO), SEGREDO)).toBe('chave');
    expect(autorizadoV1(corpo, undefined, chaveDoAviso(SEGREDO, 'outro-pedido'), SEGREDO)).toBeNull();
    expect(autorizadoV1(corpo, undefined, chaveDoAviso('segredo-errado', PEDIDO), SEGREDO)).toBeNull();
    expect(autorizadoV1('não é json', undefined, chaveDoAviso(SEGREDO, PEDIDO), SEGREDO)).toBeNull();
  });
});

let abertos: Array<() => Promise<void>> = [];
afterEach(async () => { for (const f of abertos) await f(); abertos = []; });

async function subir() {
  const ingeridas: string[] = [];
  const conexoes: string[] = [];
  const banco: Banco = {
    ingerirMensagem: async p => { ingeridas.push(p.mensagemId); return { action: 'persisted' }; },
    definirStatus: async () => ({ action: 'updated' }),
    novaRelacao: async () => ({ action: 'connected' }),
    concluirConexao: async (pedido, conta) => { conexoes.push(`${pedido}:${conta}`); return { action: 'connected' }; }
  };
  const { servidor, ocioso } = criarServidor({ segredo: SEGREDO, banco, log: () => {}, esperaMs: 1 });
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  abertos.push(() => new Promise<void>(r => servidor.close(() => r())));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const enviar = (corpo: unknown, cabecalhos: Record<string, string> = {}, consulta = '') =>
    fetch(`${url}/webhooks/unipile${consulta}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) });
  return { enviar, ocioso, ingeridas, conexoes };
}

describe('servidor: autenticação da v1', () => {
  it('Unipile-Auth correto: a mensagem entra; errado ou ausente: 401 e nada vai ao banco', async () => {
    const s = await subir();
    expect((await s.enviar(msgLinkedin(), { 'Unipile-Auth': SEGREDO })).status).toBe(200);
    expect((await s.enviar(msgLinkedin({ message_id: 'm2' }), { 'Unipile-Auth': 'errado' })).status).toBe(401);
    expect((await s.enviar(msgLinkedin({ message_id: 'm3' }))).status).toBe(401);
    await s.ocioso();
    expect(s.ingeridas).toEqual(['acc1:m1']);
  });
  it('aviso do link de conexão com a chave do endereço: conclui a conexão do pedido', async () => {
    const s = await subir();
    const r = await s.enviar({ status: 'CREATION_SUCCESS', account_id: 'acc7', name: PEDIDO }, {}, `?k=${chaveDoAviso(SEGREDO, PEDIDO)}`);
    expect(r.status).toBe(200);
    await s.ocioso();
    expect(s.conexoes).toEqual([`${PEDIDO}:acc7`]);
  });
  it('a chave do endereço NÃO autoriza mensagem: só vale para aviso de conexão', async () => {
    const s = await subir();
    const r = await s.enviar({ ...msgLinkedin(), name: PEDIDO }, {}, `?k=${chaveDoAviso(SEGREDO, PEDIDO)}`);
    expect(r.status).toBe(200);
    await s.ocioso();
    expect(s.ingeridas).toEqual([]);
  });
  it('chave do endereço de outro pedido: 401', async () => {
    const s = await subir();
    expect((await s.enviar({ status: 'CREATION_SUCCESS', account_id: 'acc7', name: PEDIDO }, {}, `?k=${chaveDoAviso(SEGREDO, 'outro')}`)).status).toBe(401);
    expect(s.conexoes).toEqual([]);
  });
});

describe('link de conexão na v1', () => {
  const base = { tipo: 'create', provedor: 'linkedin', pedidoId: PEDIDO, retornoUrl: 'https://app.test/#/inbox', expiraEm: new Date('2026-10-05T12:30:00Z'), avisoUrl: 'https://app.test/webhooks/unipile?k=abc' } as const;
  function fetchLink(status = 200, corpo: unknown = { object: 'HostedAuthUrl', url: 'https://account.unipile.com/xyz' }) {
    const chamadas: Array<{ url: string; headers: Record<string, string>; corpo: any }> = [];
    const f = (async (url: string, init: RequestInit) => { chamadas.push({ url, headers: init.headers as Record<string, string>, corpo: JSON.parse(init.body as string) }); return { ok: status < 300, status, json: async () => corpo }; }) as unknown as typeof fetch;
    return { f, chamadas };
  }
  it('monta o pedido v1 (provedor em maiúsculas, api_url, expiresOn, aviso e name) e devolve o link', async () => {
    const { f, chamadas } = fetchLink();
    expect(await criarLinkHospedado(() => ({ apiKey: 'k', url: DSN }), base, f)).toBe('https://account.unipile.com/xyz');
    expect(chamadas[0].url).toBe(`${DSN}/api/v1/hosted/accounts/link`);
    expect(chamadas[0].headers['X-API-KEY']).toBe('k');
    expect(chamadas[0].corpo).toEqual({ type: 'create', api_url: DSN, expiresOn: '2026-10-05T12:30:00.000Z', success_redirect_url: 'https://app.test/#/inbox', notify_url: 'https://app.test/webhooks/unipile?k=abc', name: PEDIDO, providers: ['LINKEDIN'] });
  });
  it('reconexão leva a conta que já existe; sem endereço de aviso ou com recusa, falha sem inventar link', async () => {
    const { f, chamadas } = fetchLink();
    await criarLinkHospedado(() => ({ apiKey: 'k', url: DSN }), { ...base, tipo: 'reconnect', reconnectAccount: 'acc-9' }, f);
    expect(chamadas[0].corpo).toMatchObject({ type: 'reconnect', reconnect_account: 'acc-9' });
    expect(chamadas[0].corpo.providers).toBeUndefined();
    await expect(criarLinkHospedado(() => ({ apiKey: 'k', url: DSN }), { ...base, avisoUrl: undefined }, f)).rejects.toThrow('sem endereço de aviso');
    await expect(criarLinkHospedado(() => ({ apiKey: 'k', url: DSN }), base, fetchLink(403).f)).rejects.toThrow('HTTP 403');
    await expect(criarLinkHospedado(() => ({ apiKey: 'k', url: DSN }), base, fetchLink(200, { url: 'http://inseguro' }).f)).rejects.toThrow('não devolveu o link');
  });
  it('iniciarConexao na v1: o endereço de aviso leva a chave DO pedido; sem segredo do webhook, recusa com 503', async () => {
    const chamadas: Array<{ url: string; corpo: any }> = [];
    const f = (async (url: string, init: RequestInit = {}) => {
      chamadas.push({ url, corpo: init.body ? JSON.parse(init.body as string) : undefined });
      return url.includes('/rpc/') ? { ok: true, status: 200, json: async () => ({ request_id: PEDIDO, type: 'create', reconnect_account_id: null }) }
        : { ok: true, status: 200, json: async () => ({ url: 'https://account.unipile.com/xyz' }) };
    }) as unknown as typeof fetch;
    const deps = { siteUrl: 'https://app.test/', obterConfig: () => ({ apiKey: 'k', url: DSN }), baseBanco: 'http://rest:3000', chaveAnon: 'a', buscar: f, agora: () => new Date('2026-10-05T12:00:00Z') };
    const pedidoTela = { workspace_id: 'a0000000-0000-0000-0000-000000000001', member_id: 'd0000000-0000-0000-0000-000000000004', provider: 'linkedin' };
    const ok = await iniciarConexao({ ...deps, obterSegredo: () => SEGREDO }, 'jwt', pedidoTela);
    expect(ok).toEqual({ status: 200, corpo: { url: 'https://account.unipile.com/xyz' } });
    const link = chamadas.find(c => c.url.endsWith('/hosted/accounts/link'))!;
    expect(link.corpo.notify_url).toBe(`https://app.test/webhooks/unipile?k=${chaveDoAviso(SEGREDO, PEDIDO)}`);
    expect(JSON.stringify(link.corpo)).not.toContain(SEGREDO); // o segredo nunca vai no pedido
    const semSegredo = await iniciarConexaoSemBanco();
    expect(semSegredo).toEqual({ status: 503, corpo: { erro: 'webhook_sem_segredo' } });
    async function iniciarConexaoSemBanco() { chamadas.length = 0; const r = await iniciarConexao({ ...deps, obterSegredo: () => '' }, 'jwt', pedidoTela); expect(chamadas).toHaveLength(0); return r; }
  });
});
