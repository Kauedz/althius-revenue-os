// Cliente do assistente hospedado de conexão de contas (gera o link que a pessoa abre para conectar).
// NÃO VERIFICADO na documentação oficial (site bloqueado ao escrever): rota, campos e nomes dos provedores
// seguem o roteiro do projeto. Tudo fica neste arquivo; nos testes, `buscar` é uma versão falsa.
export interface ConfigUnipile { dsn: string; apiKey: string }

export type ProvedorNosso = 'linkedin' | 'whatsapp' | 'instagram' | 'google' | 'microsoft' | 'imap';
export const PROVEDORES: readonly ProvedorNosso[] = ['linkedin', 'whatsapp', 'instagram', 'google', 'microsoft', 'imap'];

const NOME_NO_ASSISTENTE: Record<ProvedorNosso, string> = {
  linkedin: 'LINKEDIN', whatsapp: 'WHATSAPP', instagram: 'INSTAGRAM', google: 'GOOGLE', microsoft: 'OUTLOOK', imap: 'MAIL'
};

export interface PedidoLink {
  tipo: 'create' | 'reconnect';
  provedor: ProvedorNosso;
  /** id do pedido no nosso banco: volta no aviso e decide de quem é a conta */
  nome: string;
  notifyUrl: string;
  sucessoUrl: string;
  falhaUrl: string;
  expiraEm: Date;
  reconnectAccount?: string | null;
}

export async function criarLinkHospedado(cfg: ConfigUnipile, p: PedidoLink, buscar: typeof fetch = fetch): Promise<string> {
  const corpo: Record<string, unknown> = {
    type: p.tipo,
    providers: [NOME_NO_ASSISTENTE[p.provedor]],
    api_url: cfg.dsn,
    expiresOn: p.expiraEm.toISOString(),
    name: p.nome,
    notify_url: p.notifyUrl,
    success_redirect_url: p.sucessoUrl,
    failure_redirect_url: p.falhaUrl
  };
  if (p.tipo === 'reconnect' && p.reconnectAccount) corpo.reconnect_account = p.reconnectAccount;
  const r = await buscar(`${cfg.dsn.replace(/\/$/, '')}/api/v1/hosted/accounts/link`, {
    method: 'POST',
    headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw new Error(`assistente recusou o pedido: HTTP ${r.status}`);
  const dados = (await r.json().catch(() => ({}))) as { url?: unknown };
  if (typeof dados.url !== 'string' || !dados.url.startsWith('https://')) throw new Error('assistente não devolveu o link');
  return dados.url;
}
