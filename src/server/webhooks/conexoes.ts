// Rota que a tela chama para conectar a PRÓPRIA conta de mensagem. O login da pessoa vai junto e é repassado ao banco:
// quem confere "é você mesmo, no seu workspace, com permissão" é o Postgres (messaging_connect_start), não este código.
import { criarLinkHospedado, PROVEDORES, type ProvedorNosso } from './hospedado.ts';
import { versaoDaApi, type ObterConfig } from '../unipile/config.ts';
import { chaveDoAviso } from './unipile.ts';

export interface DepsConexoes {
  /** endereço público do sistema (SITE_URL) */
  siteUrl: string;
  /** chave e endereço do canal, relidos a cada pedido (trocar a chave vale na hora) */
  obterConfig: ObterConfig;
  /** segredo do webhook (lido a cada pedido): na v1 assina o endereço do aviso da conexão */
  obterSegredo?: () => Promise<string> | string;
  baseBanco: string;
  chaveAnon: string;
  buscar?: typeof fetch;
  agora?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (status: number, corpo: Record<string, unknown>) => ({ status, corpo });

export async function iniciarConexao(d: DepsConexoes, jwt: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const buscar = d.buscar ?? fetch;
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  if (!jwt) return resposta(401, { erro: 'nao_autorizado' });
  if (typeof c.workspace_id !== 'string' || !UUID.test(c.workspace_id) || typeof c.member_id !== 'string' || !UUID.test(c.member_id)
    || typeof c.provider !== 'string' || !PROVEDORES.includes(c.provider as ProvedorNosso)) {
    return resposta(400, { erro: 'pedido_invalido' });
  }
  // Sem chave do provedor não há como conectar: avisa claro, sem simular.
  const cfg = await d.obterConfig();
  if (!cfg.apiKey) return resposta(503, { erro: 'conexao_indisponivel' });
  // Na v1 quem avisa que a conta foi conectada é o endereço de aviso do link; ele precisa do segredo para levar a chave do pedido.
  const v1 = versaoDaApi(cfg) === 'v1';
  const segredo = v1 ? String((await d.obterSegredo?.()) ?? '').trim() : '';
  if (v1 && !segredo) return resposta(503, { erro: 'webhook_sem_segredo' });

  const r = await buscar(`${d.baseBanco.replace(/\/$/, '')}/rpc/messaging_connect_start`, {
    method: 'POST',
    headers: { apikey: d.chaveAnon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_workspace_id: c.workspace_id, p_member_id: c.member_id, p_provider: c.provider })
  });
  if (!r.ok) {
    const erro = (await r.json().catch(() => ({}))) as { code?: string };
    if (r.status === 401) return resposta(401, { erro: 'nao_autorizado' });
    if (r.status === 403 || erro.code === '42501') return resposta(403, { erro: 'sem_permissao' });
    if (erro.code === '22023') return resposta(400, { erro: 'pedido_invalido' });
    return resposta(502, { erro: 'falha_no_banco' });
  }
  const pedido = (await r.json()) as { request_id: string; type: 'create' | 'reconnect'; reconnect_account_id: string | null };

  const site = d.siteUrl.replace(/\/$/, '');
  const agora = (d.agora ?? (() => new Date()))();
  try {
    const url = await criarLinkHospedado(d.obterConfig, {
      tipo: pedido.type,
      provedor: c.provider as ProvedorNosso,
      pedidoId: pedido.request_id,
      retornoUrl: `${site}/#/inbox`,
      expiraEm: new Date(agora.getTime() + 30 * 60_000),
      reconnectAccount: pedido.reconnect_account_id,
      ...(v1 ? { avisoUrl: `${site}/webhooks/unipile?k=${chaveDoAviso(segredo, pedido.request_id)}` } : {})
    }, buscar);
    return resposta(200, { url });
  } catch {
    return resposta(502, { erro: 'falha_ao_gerar_link' });
  }
}
