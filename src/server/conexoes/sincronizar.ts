// Sincronia das contas de mensagem com a ponte (Unipile v1 ou v2), ADR 0070. O banco é o dono dos dados; a ponte só diz
// quais contas existem e como estão. Este passo roda junto do serviço de envio e cobre o que o webhook não garante (aviso que
// se perde, ou sistema sem endereço público ainda):
//   1. conexão: um pedido aberto (dono já fixado pelo pedido, ADR 0017) acha a conta recém-criada do mesmo provedor. Só liga se
//      houver EXATAMENTE UMA candidata (criada depois do pedido e ainda sem dono); com duas, não adivinha: o dono tem o aviso
//      do webhook ou tenta de novo;
//   2. estado: a conta que a ponte diz que caiu vira "attention" (a tela pede reconectar); a que voltou, "connected"; a que a
//      ponte já não lista, "disconnected" (só quando a listagem veio completa).
// Nada de mensagem nem de dado pessoal passa por aqui: só ids, provedor, estado e hora. O log idem.
import { baseDaApi, versaoDaApi, type ObterConfig } from '../unipile/config.ts';
import type { ProvedorNosso } from '../webhooks/hospedado.ts';

export type EstadoConta = 'connected' | 'attention' | 'disconnected';

export interface ContaDaPonte { id: string; provedor: ProvedorNosso; estado: EstadoConta | null; criadaEm: Date }
export interface ListaDaPonte { contas: ContaDaPonte[]; completa: boolean }
export interface Ponte { listarContas(): Promise<ListaDaPonte> }

export interface EstadoDoBanco {
  pendentes: Array<{ id: string; provider: ProvedorNosso; criado_em: string }>;
  registradas: Array<{ conta: string; provider: ProvedorNosso; status: string }>;
}
export interface BancoSincronia {
  estado(): Promise<EstadoDoBanco>;
  concluirConexao(pedidoId: string, conta: string): Promise<{ action: string; reason?: string }>;
  definirEstado(conta: string, estado: EstadoConta): Promise<{ action: string }>;
}

export interface ResumoSincronia { conectadas: number; atualizadas: number; ambiguas: number; semConta: number }

const TOLERANCIA_MS = 60_000; // relógios diferentes entre nós e a ponte

export async function sincronizarContas(d: { banco: BancoSincronia; ponte: Ponte; log?: (l: Record<string, unknown>) => void }): Promise<ResumoSincronia> {
  const log = d.log ?? (l => console.log(JSON.stringify(l)));
  const r: ResumoSincronia = { conectadas: 0, atualizadas: 0, ambiguas: 0, semConta: 0 };
  const { contas, completa } = await d.ponte.listarContas();
  const estado = await d.banco.estado();
  const registradas = new Map(estado.registradas.map(c => [c.conta, c]));

  // 1. Conexão: cada pedido aberto acha a sua conta.
  const usadas = new Set<string>();
  for (const p of estado.pendentes) {
    const desde = new Date(p.criado_em).getTime() - TOLERANCIA_MS;
    const candidatas = contas.filter(c => c.provedor === p.provider && !registradas.has(c.id) && !usadas.has(c.id) && c.criadaEm.getTime() >= desde);
    if (candidatas.length === 0) { r.semConta++; continue; }
    if (candidatas.length > 1) { r.ambiguas++; log({ nivel: 'aviso', msg: 'conexao_ambigua', pedido: p.id, provedor: p.provider, candidatas: candidatas.length }); continue; }
    const conta = candidatas[0];
    const res = await d.banco.concluirConexao(p.id, conta.id);
    if (res.action === 'connected') {
      usadas.add(conta.id);
      registradas.set(conta.id, { conta: conta.id, provider: conta.provedor, status: 'connected' });
      r.conectadas++;
      log({ nivel: 'info', msg: 'conexao_achada_pela_sincronia', pedido: p.id, provedor: p.provider });
    } else log({ nivel: 'aviso', msg: 'conexao_nao_concluida', pedido: p.id, motivo: res.reason ?? res.action });
  }

  // 2. Estado das contas que já são nossas.
  const daPonte = new Map(contas.map(c => [c.id, c]));
  for (const reg of registradas.values()) {
    const viva = daPonte.get(reg.conta);
    const desejado: EstadoConta | null = viva ? viva.estado : completa ? 'disconnected' : null;
    if (!desejado || desejado === reg.status) continue;
    await d.banco.definirEstado(reg.conta, desejado);
    r.atualizadas++;
    log({ nivel: 'info', msg: 'estado_da_conta_atualizado', provedor: reg.provider, de: reg.status, para: desejado });
  }
  return r;
}

// ---------------------------------------------------------------------------------------------------------------------
// A ponte de verdade (v1 e v2) e o banco pela API (PostgREST, chave de serviço).
// ---------------------------------------------------------------------------------------------------------------------

const PROVEDOR_V1: Record<string, ProvedorNosso> = {
  LINKEDIN: 'linkedin', WHATSAPP: 'whatsapp', INSTAGRAM: 'instagram', GOOGLE: 'google', GOOGLE_OAUTH: 'google',
  OUTLOOK: 'microsoft', OUTLOOK_OAUTH: 'microsoft', MAIL: 'imap', IMAP: 'imap'
};
const PROVEDOR_V2: Record<string, ProvedorNosso> = { linkedin: 'linkedin', whatsapp: 'whatsapp', instagram: 'instagram', google: 'google', outlook: 'microsoft', imap: 'imap' };

/** v1: o estado da conta vem de cada fonte (mensagens, e-mail...). Qualquer problema vira atenção; tudo OK, conectada. */
export function estadoV1(fontes: unknown): EstadoConta | null {
  const lista = Array.isArray(fontes) ? fontes.map(f => String((f as { status?: unknown })?.status ?? '').toUpperCase()).filter(Boolean) : [];
  if (!lista.length) return null;
  if (lista.some(s => ['CREDENTIALS', 'ERROR', 'STOPPED', 'PERMISSIONS'].includes(s))) return 'attention';
  return lista.every(s => s === 'OK') ? 'connected' : null;
}
export function estadoV2(status: unknown): EstadoConta | null {
  const s = String(status ?? '').toLowerCase();
  if (s === 'running') return 'connected';
  if (s === 'errored' || s === 'disconnected') return 'attention';
  return null;
}

export function ponteViaApi(obterConfig: ObterConfig, buscar: typeof fetch = fetch): Ponte {
  return {
    async listarContas() {
      const cfg = await obterConfig();
      if (!cfg.apiKey) throw new Error('sem chave do canal de mensagens');
      const v1 = versaoDaApi(cfg) === 'v1';
      const r = await buscar(`${baseDaApi(cfg)}${v1 ? '/api/v1/accounts?limit=250' : '/v2/accounts/?limit=100'}`, { headers: { 'X-API-KEY': cfg.apiKey, Accept: 'application/json' } });
      if (!r.ok) throw new Error(`ponte recusou a lista de contas: HTTP ${r.status}`);
      const corpo = (await r.json()) as Record<string, unknown>;
      const itens = (v1 ? corpo.items : corpo.data) as Array<Record<string, unknown>> | undefined;
      const contas: ContaDaPonte[] = [];
      for (const a of Array.isArray(itens) ? itens : []) {
        const provedor = v1 ? PROVEDOR_V1[String(a.type ?? '').toUpperCase()] : PROVEDOR_V2[String(a.provider ?? '').toLowerCase()];
        const criada = new Date(String(a.created_at ?? ''));
        if (!provedor || typeof a.id !== 'string' || Number.isNaN(criada.getTime())) continue;
        contas.push({ id: a.id, provedor, estado: v1 ? estadoV1(a.sources) : estadoV2(a.status), criadaEm: criada });
      }
      // Lista com continuação = pode haver conta que não veio: não se conclui que uma ausente caiu.
      const continua = v1 ? Boolean(corpo.cursor) : corpo.has_more === true;
      return { contas, completa: !continua };
    }
  };
}

export function bancoSincroniaViaApi(base: string, chaveServico: string, buscar: typeof fetch = fetch): BancoSincronia {
  const chamar = async <T>(funcao: string, args: Record<string, unknown>): Promise<T> => {
    const r = await buscar(`${base.replace(/\/$/, '')}/rpc/${funcao}`, {
      method: 'POST',
      headers: { apikey: chaveServico, Authorization: `Bearer ${chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error(`banco recusou ${funcao}: HTTP ${r.status}`);
    return (await r.json()) as T;
  };
  return {
    estado: () => chamar<EstadoDoBanco>('messaging_sync_state', {}),
    concluirConexao: (pedidoId, conta) => chamar('unipile_complete_connection', { p_request_id: pedidoId, p_unipile_account_id: conta, p_display_name: null }),
    definirEstado: (conta, estado) => chamar('unipile_set_account_status', { p_unipile_account_id: conta, p_status: estado })
  };
}
