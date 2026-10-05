// Rota que a tela chama para conectar a PRÓPRIA conta de mensagem. O login da pessoa vai junto e é repassado ao banco:
// quem confere "é você mesmo, no seu workspace, com permissão" é o Postgres (messaging_connect_start), não este código.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { criarLinkHospedado, PROVEDORES, type ConfigUnipile, type ProvedorNosso } from './hospedado.ts';

export interface DepsConexoes {
  /** mesmo segredo do webhook: assina o endereço de retorno de cada pedido */
  segredo: string;
  /** endereço público do sistema (SITE_URL) */
  siteUrl: string;
  unipile: ConfigUnipile;
  baseBanco: string;
  chaveAnon: string;
  buscar?: typeof fetch;
  agora?: () => Date;
}

export const assinarPedido = (segredo: string, pedidoId: string): string => createHmac('sha256', segredo).update(pedidoId).digest('hex');

export function assinaturaValida(segredo: string, pedidoId: string, recebida: string): boolean {
  if (!segredo || !recebida) return false;
  const a = Buffer.from(assinarPedido(segredo, pedidoId));
  const b = Buffer.from(recebida);
  return a.length === b.length && timingSafeEqual(a, b);
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
  // Sem chave do provedor ou sem segredo, não há como conectar: avisa claro, sem simular.
  if (!d.unipile.apiKey || !d.segredo) return resposta(503, { erro: 'conexao_indisponivel' });

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
    const url = await criarLinkHospedado(d.unipile, {
      tipo: pedido.type,
      provedor: c.provider as ProvedorNosso,
      nome: pedido.request_id,
      notifyUrl: `${site}/webhooks/unipile/conta?r=${pedido.request_id}&t=${assinarPedido(d.segredo, pedido.request_id)}`,
      sucessoUrl: `${site}/#/inbox`,
      falhaUrl: `${site}/#/inbox`,
      expiraEm: new Date(agora.getTime() + 30 * 60_000),
      reconnectAccount: pedido.reconnect_account_id
    }, buscar);
    return resposta(200, { url });
  } catch {
    return resposta(502, { erro: 'falha_ao_gerar_link' });
  }
}
