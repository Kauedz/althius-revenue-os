// Cliente do assistente hospedado de conexão de contas (Unipile): gera o link que a pessoa abre para conectar. Fala as duas
// versões da API (ADR 0069). v1 (conforme a documentação, sem teste em conta real): POST /api/v1/hosted/accounts/link com
// { type, providers: [MAIÚSCULAS] | reconnect_account, api_url, expiresOn, success_redirect_url, notify_url, name } e resposta
// { url }. Na v1 o pedido volta no aviso do link (notify_url) como `name`, e o endereço do aviso leva uma chave só desse pedido.
// v2 (abaixo):
// Conferido no protótipo do dono (conexão de e-mail em conta real): POST /v2/auth/link com
// { expires_on, redirect_uri, state, providers | account_id } e resposta { link } (ou { data: { link } }).
// O `state` é o id do pedido no nosso banco: volta no aviso `account.add`/`account.reconnect` e decide de quem é a conta.
// NÃO CONFIRMADO: o nome 'instagram' como provedor (WhatsApp, LinkedIn, google, outlook e imap vieram do protótipo).
import { baseDaApi, versaoDaApi, type ObterConfig } from '../unipile/config.ts';

export type ProvedorNosso = 'linkedin' | 'whatsapp' | 'instagram' | 'google' | 'microsoft' | 'imap';
export const PROVEDORES: readonly ProvedorNosso[] = ['linkedin', 'whatsapp', 'instagram', 'google', 'microsoft', 'imap'];

const NOME_NO_ASSISTENTE: Record<ProvedorNosso, string> = {
  linkedin: 'linkedin', whatsapp: 'whatsapp', instagram: 'instagram', google: 'google', microsoft: 'outlook', imap: 'imap'
};

export interface PedidoLink {
  tipo: 'create' | 'reconnect';
  provedor: ProvedorNosso;
  /** id do pedido no nosso banco (vira o `state`) */
  pedidoId: string;
  /** para onde a pessoa volta depois de conectar */
  retornoUrl: string;
  expiraEm: Date;
  reconnectAccount?: string | null;
  /** só na v1: endereço que a Unipile avisa quando a conta é conectada (leva a chave do pedido) */
  avisoUrl?: string;
}

async function criarLinkV1(cfg: Awaited<ReturnType<ObterConfig>>, p: PedidoLink, buscar: typeof fetch): Promise<string> {
  if (!p.avisoUrl) throw new Error('sem endereço de aviso para a conexão');
  const base = baseDaApi(cfg);
  const corpo: Record<string, unknown> = {
    type: p.tipo, api_url: base, expiresOn: p.expiraEm.toISOString(), success_redirect_url: p.retornoUrl, notify_url: p.avisoUrl, name: p.pedidoId
  };
  if (p.tipo === 'reconnect' && p.reconnectAccount) corpo.reconnect_account = p.reconnectAccount;
  else corpo.providers = [NOME_NO_ASSISTENTE[p.provedor] === 'outlook' ? 'OUTLOOK' : NOME_NO_ASSISTENTE[p.provedor].toUpperCase()];
  const r = await buscar(`${base}/api/v1/hosted/accounts/link`, {
    method: 'POST',
    headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw new Error(`assistente recusou o pedido: HTTP ${r.status}`);
  const dados = (await r.json().catch(() => ({}))) as { url?: unknown };
  if (typeof dados.url !== 'string' || !dados.url.startsWith('https://')) throw new Error('assistente não devolveu o link');
  return dados.url;
}

export async function criarLinkHospedado(obterConfig: ObterConfig, p: PedidoLink, buscar: typeof fetch = fetch): Promise<string> {
  const cfg = await obterConfig();
  if (!cfg.apiKey) throw new Error('sem chave do canal de mensagens');
  if (versaoDaApi(cfg) === 'v1') return criarLinkV1(cfg, p, buscar);
  const corpo: Record<string, unknown> = { expires_on: p.expiraEm.toISOString(), redirect_uri: p.retornoUrl, state: p.pedidoId };
  if (p.tipo === 'reconnect' && p.reconnectAccount) corpo.account_id = p.reconnectAccount;
  else corpo.providers = [NOME_NO_ASSISTENTE[p.provedor]];
  const r = await buscar(`${baseDaApi(cfg)}/v2/auth/link`, {
    method: 'POST',
    headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw new Error(`assistente recusou o pedido: HTTP ${r.status}`);
  const dados = (await r.json().catch(() => ({}))) as { link?: unknown; data?: { link?: unknown } };
  const link = typeof dados.link === 'string' ? dados.link : dados.data?.link;
  if (typeof link !== 'string' || !link.startsWith('https://')) throw new Error('assistente não devolveu o link');
  return link;
}
